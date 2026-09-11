import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { boundedJson, GoogleError, makeTransport, registerTransport, TokenResponse, type SecretStore } from './internal/transport';

export type { SecretStore, Token, GoogleOperation } from './internal/transport';
export { GoogleError } from './internal/transport';
export const GOOGLE_SCOPES = {
  identity:['openid','email'], sheets:['https://www.googleapis.com/auth/drive.file'],
  mail:['https://www.googleapis.com/auth/gmail.send','https://www.googleapis.com/auth/gmail.readonly'],
  calendar:['https://www.googleapis.com/auth/calendar.freebusy','https://www.googleapis.com/auth/calendar.events.owned']
} as const;
const ResourceId=z.string().min(1).max(512).refine(s=>!/[\r\n]/.test(s));
export const GoogleBinding=z.object({connectionId:z.uuid(),identity:z.email(),sheet:z.object({fileId:ResourceId,range:z.string().min(1).max(200)}).optional(),calendarId:ResourceId.optional(),enrolledThreadIds:z.array(ResourceId).max(500)}).strict();
export type GoogleBinding=z.infer<typeof GoogleBinding>;
export const GmailCursor=z.object({historyId:z.string().regex(/^\d+$/).optional(),pageToken:z.string().max(1000).optional(),reconcileOffset:z.number().int().nonnegative().optional(),baselineHistoryId:z.string().regex(/^\d+$/).optional(),reconcileSelectionHash:z.string().regex(/^[a-f0-9]{64}$/).optional()}).strict();
export type GmailCursor=z.infer<typeof GmailCursor>;
const Headers=z.array(z.object({name:z.string(),value:z.string()}));
const Part: z.ZodType<{mimeType?:string;body?:{data?:string;size?:number};headers?:{name:string;value:string}[];parts?:unknown[]}> = z.object({mimeType:z.string().optional(),body:z.object({data:z.string().optional(),size:z.number().optional()}).optional(),headers:Headers.optional(),parts:z.array(z.unknown()).optional()});
const Thread=z.object({id:z.string(),historyId:z.string().optional(),messages:z.array(z.object({id:z.string(),threadId:z.string(),historyId:z.string().optional(),internalDate:z.string().optional(),labelIds:z.array(z.string()).optional(),snippet:z.string().optional(),payload:Part.optional()})).optional()});
export type MailMessage={id:string;threadId:string;receivedAt:string|null;headers:Record<string,string>;text:string;labels:string[]};
function plainText(part:unknown,depth=0):string {
  if(depth>6)return '';const p=Part.safeParse(part);if(!p.success)return '';
  if(p.data.mimeType==='text/plain'&&p.data.body?.data)return Buffer.from(p.data.body.data,'base64url').toString('utf8').slice(0,16000);
  return(p.data.parts??[]).slice(0,20).map(v=>plainText(v,depth+1)).join('\n').slice(0,16000);
}
export type GoogleConnector=ReturnType<typeof createGoogleConnector>;
export function createGoogleConnector(options:{binding:GoogleBinding;secrets:SecretStore;clientId:string;clientSecret:string;fetch?:typeof fetch;now?:()=>Date}) {
  const binding=structuredClone(GoogleBinding.parse(options.binding));binding.enrolledThreadIds.sort();
  Object.freeze(binding.enrolledThreadIds);if(binding.sheet)Object.freeze(binding.sheet);Object.freeze(binding);
  const transport=makeTransport({...options,connectionId:binding.connectionId,identity:binding.identity});
  const api={
    binding:Object.freeze(binding),
    async readSheet():Promise<{range:string;values:string[][];fetchedAt:string}> {
      if(!binding.sheet)throw new GoogleError('sheet_not_bound');
      const raw=await transport.request('sheets.read',`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(binding.sheet.fileId)}/values/${encodeURIComponent(binding.sheet.range)}?valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`);
      const result=z.object({range:z.string(),values:z.array(z.array(z.union([z.string(),z.number(),z.boolean()]))).max(5000).optional()}).parse(raw);
      return{range:result.range,values:(result.values??[]).map(row=>row.map(String)),fetchedAt:(options.now?.()??new Date()).toISOString()};
    },
    async readThread(threadId:string):Promise<MailMessage[]> {
      if(!binding.enrolledThreadIds.includes(threadId))throw new GoogleError('thread_not_enrolled');
      const result=Thread.parse(await transport.request('gmail.read',`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=full`));
      if(result.id!==threadId)throw new GoogleError('thread_binding_mismatch');
      if((result.messages?.length??0)>100)throw new GoogleError('thread_exceeds_review_limit');
      return(result.messages??[]).map(m=>({id:m.id,threadId:m.threadId,receivedAt:m.internalDate?new Date(Number(m.internalDate)).toISOString():null,headers:Object.fromEntries((m.payload?.headers??[]).filter(h=>['from','to','subject','message-id','in-reply-to','auto-submitted','return-path','content-type','precedence'].includes(h.name.toLowerCase())).map(h=>[h.name.toLowerCase(),h.value])),text:plainText(m.payload),labels:m.labelIds??[]}));
    },
    async pollHistory(input:GmailCursor):Promise<{messages:MailMessage[];cursor:GmailCursor;complete:boolean;recoveredExpiredHistory:boolean}> {
      const cursor=GmailCursor.parse(input);
      const reconcile=async(expired:boolean)=>{
        const selectionHash=createHash('sha256').update(binding.enrolledThreadIds.join('\n')).digest('hex');
        if(cursor.baselineHistoryId&&cursor.reconcileSelectionHash!==selectionHash)throw new GoogleError('enrollment_changed_during_reconciliation');
        let baseline=cursor.baselineHistoryId;
        if(!baseline){const profile=z.object({historyId:z.string()}).parse(await transport.request('gmail.read','https://gmail.googleapis.com/gmail/v1/users/me/profile'));baseline=profile.historyId;}
        const offset=cursor.reconcileOffset??0; const ids=binding.enrolledThreadIds.slice(offset,offset+10);const messages:MailMessage[]=[];
        for(const id of ids)messages.push(...await api.readThread(id));
        const complete=offset+ids.length>=binding.enrolledThreadIds.length;
        return{messages,cursor:complete?{historyId:baseline}:{baselineHistoryId:baseline,reconcileOffset:offset+ids.length,reconcileSelectionHash:selectionHash},complete,recoveredExpiredHistory:expired};
      };
      if(!cursor.historyId)return reconcile(false);
      const query=new URLSearchParams({startHistoryId:cursor.historyId,maxResults:'100',historyTypes:'messageAdded',...(cursor.pageToken?{pageToken:cursor.pageToken}:{})});
      let raw:unknown;
      try {raw=await transport.request('gmail.read',`https://gmail.googleapis.com/gmail/v1/users/me/history?${query}`);}catch(error){if(error instanceof GoogleError&&error.status===404)return reconcile(true);throw error;}
      const result=z.object({historyId:z.string(),nextPageToken:z.string().optional(),history:z.array(z.object({messagesAdded:z.array(z.object({message:z.object({id:z.string(),threadId:z.string()})})).optional()})).optional()}).parse(raw);
      const relevant=new Set((result.history??[]).flatMap(h=>(h.messagesAdded??[]).map(m=>m.message.threadId)).filter(id=>binding.enrolledThreadIds.includes(id)));
      if(relevant.size>25)throw new GoogleError('history_page_requires_smaller_batch');
      const messages:MailMessage[]=[];for(const id of relevant)messages.push(...await api.readThread(id));
      return{messages,cursor:result.nextPageToken?{historyId:cursor.historyId,pageToken:result.nextPageToken}:{historyId:result.historyId},complete:!result.nextPageToken,recoveredExpiredHistory:false};
    },
    async freeBusy(startAt:string,endAt:string,timeZone:string):Promise<{start:string;end:string}[]> {
      if(!binding.calendarId)throw new GoogleError('calendar_not_bound');
      z.iso.datetime().parse(startAt);z.iso.datetime().parse(endAt);new Intl.DateTimeFormat('en',{timeZone});
      if(Date.parse(endAt)<=Date.parse(startAt)||Date.parse(endAt)-Date.parse(startAt)>31*86400000)throw new GoogleError('invalid_availability_window');
      const result=z.object({calendars:z.record(z.string(),z.object({busy:z.array(z.object({start:z.string(),end:z.string()})).optional(),errors:z.array(z.unknown()).optional()}))}).parse(await transport.request('calendar.freebusy','https://www.googleapis.com/calendar/v3/freeBusy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({timeMin:startAt,timeMax:endAt,timeZone,items:[{id:binding.calendarId}]})}));
      const calendar=result.calendars[binding.calendarId];if(!calendar||calendar.errors?.length||!calendar.busy)throw new GoogleError('calendar_availability_unverified');return calendar.busy;
    },
    async reconcileSent(actionId:string):Promise<{status:'found'|'not_found'|'ambiguous';providerId:string|null}> {
      const identity=stableMessageId(actionId);
      const result=z.object({messages:z.array(z.object({id:z.string(),threadId:z.string()})).optional(),nextPageToken:z.string().optional()}).parse(await transport.request('gmail.read',`https://gmail.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({q:`in:sent rfc822msgid:${identity}`,maxResults:'10'})}`));
      if(!result.messages?.length)return{status:'not_found',providerId:null};
      // Not found is never authority to resubmit: Gmail indexing can lag.
      if(result.messages.length!==1||result.nextPageToken)return{status:'ambiguous',providerId:null};
      return{status:'found',providerId:result.messages[0]!.id};
    },
    async readCalendarEvent(actionId:string):Promise<{id:string;status:string;start?:string;end?:string;actionId?:string;attendees?:string[]}|null> {
      if(!binding.calendarId)throw new GoogleError('calendar_not_bound');
      try {const result=z.object({id:z.string(),status:z.string(),start:z.object({dateTime:z.string().optional()}).optional(),end:z.object({dateTime:z.string().optional()}).optional(),attendees:z.array(z.object({email:z.string().optional()})).optional(),extendedProperties:z.object({private:z.object({davidActionId:z.string().optional()}).optional()}).optional()}).parse(await transport.request('calendar.book',`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(binding.calendarId)}/events/${stableCalendarEventId(actionId)}`));return{id:result.id,status:result.status,start:result.start?.dateTime,end:result.end?.dateTime,actionId:result.extendedProperties?.private?.davidActionId,attendees:result.attendees?.flatMap(a=>a.email?[a.email.toLowerCase()]:[])};}
      catch(error){if(error instanceof GoogleError&&error.status===404)return null;throw error;}
    }
  };
  registerTransport(api,transport);return api;
}
export function stableMessageId(actionId:string){return `<david-${z.uuid().parse(actionId)}@engine.getdavid.ai>`;}
/** Hex is a subset of Calendar's allowed base32hex alphabet (0-9,a-v). */
export function stableCalendarEventId(actionId:string){return `david${z.uuid().parse(actionId).replaceAll('-','')}`;}
export function createOAuthRequest(input:{clientId:string;redirectUri:string;scopes:readonly string[]}) {
  const url=new URL(input.redirectUri);if(url.protocol!=='https:')throw new GoogleError('https_oauth_redirect_required');
  const state=randomBytes(32).toString('base64url');const verifier=randomBytes(48).toString('base64url');
  const challenge=createHash('sha256').update(verifier).digest('base64url');
  const query=new URLSearchParams({client_id:input.clientId,redirect_uri:input.redirectUri,response_type:'code',scope:[...new Set(input.scopes)].join(' '),state,code_challenge:challenge,code_challenge_method:'S256',access_type:'offline',prompt:'consent',include_granted_scopes:'true'});
  return{url:`https://accounts.google.com/o/oauth2/v2/auth?${query}`,stateHash:hashOAuthState(state),verifier};
}
export function hashOAuthState(state:string){if(state.length<32||state.length>256)throw new GoogleError('invalid_oauth_state');return createHash('sha256').update(state).digest('hex');}
/** Called only after consuming the actor-bound, one-time database state. */
export async function exchangeGoogleCode(input:{code:string;verifier:string;redirectUri:string;clientId:string;clientSecret:string;fetch?:typeof fetch;now?:()=>Date}) {
  const http=input.fetch??fetch;
  const response=await http('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({code:input.code,code_verifier:input.verifier,redirect_uri:input.redirectUri,client_id:input.clientId,client_secret:input.clientSecret,grant_type:'authorization_code'}),signal:AbortSignal.timeout(10000)});
  if(!response.ok){await response.body?.cancel();throw new GoogleError('oauth_exchange_failed',response.status);}
  const token=TokenResponse.parse(await boundedJson(response,32768));
  const identityResponse=await http('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${token.access_token}`},signal:AbortSignal.timeout(10000)});
  if(!identityResponse.ok){await identityResponse.body?.cancel();throw new GoogleError('google_identity_unverified');}
  const identity=z.object({sub:z.string().min(1),email:z.email(),email_verified:z.literal(true)}).parse(await boundedJson(identityResponse,32768));
  return{subject:identity.sub,email:identity.email,scopes:(token.scope??'').split(' ').filter(Boolean),tokens:{accessToken:token.access_token,...(token.refresh_token?{refreshToken:token.refresh_token}:{})},expiresAt:new Date((input.now?.()??new Date()).getTime()+token.expires_in*1000).toISOString()};
}
