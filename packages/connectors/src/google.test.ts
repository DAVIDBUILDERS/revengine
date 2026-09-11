import { describe,expect,it,vi } from 'vitest';
import { createGoogleConnector,createOAuthRequest,hashOAuthState,GoogleError,stableCalendarEventId, type SecretStore } from './google';
import { executeGoogleWrite } from './internal/provider-writes';

// These are synthetic HTTP responses, not evidence of real Google permissions or operations.
const connectionId='a0000000-0000-4000-8000-000000000001';const actionId='a0000000-0000-4000-8000-000000000002';
const now=()=>new Date('2026-09-11T12:00:00.000Z');
function fixtureSecrets(expired=false):SecretStore{return{read:vi.fn(async()=>({accessToken:'SYNTHETIC_ACCESS_TOKEN',refreshToken:'SYNTHETIC_REFRESH_TOKEN',expiresAt:expired?'2026-09-10T00:00:00Z':'2026-09-12T00:00:00Z'})),acquireRefresh:vi.fn(async()=>connectionId),storeRefresh:vi.fn(async()=>{}),expire:vi.fn(async()=>{})};}
function fixtureConnector(http:typeof fetch,secrets=fixtureSecrets()) {return createGoogleConnector({binding:{connectionId,identity:'sender@example.invalid',sheet:{fileId:'selected-sheet',range:'Proposals!A1:K100'},calendarId:'approved-calendar',enrolledThreadIds:['thread-enrolled']},clientId:'SYNTHETIC_CLIENT',clientSecret:'SYNTHETIC_SECRET',secrets,fetch:http,now});}
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
const thread={id:'thread-enrolled',messages:[{id:'message-human',threadId:'thread-enrolled',internalDate:'1789131600000',payload:{mimeType:'text/plain',headers:[{name:'From',value:'customer@example.invalid'},{name:'Authorization',value:'untrusted secret request'}],body:{data:Buffer.from('Yes, let us talk.').toString('base64url')}}}]};

describe('Google HTTP fixtures — live provider verification not performed',()=>{
 it('reads only the bound sheet range and preserves formatted source values',async()=>{
  const http=vi.fn<typeof fetch>(async()=>json({range:'Proposals!A1:K2',values:[['ID','Amount'],['001','12,000.00']]}));
  const result=await fixtureConnector(http).readSheet();expect(result.values[1]).toEqual(['001','12,000.00']);expect(String(http.mock.calls[0]?.[0])).toContain('selected-sheet/values/Proposals!A1%3AK100');
 });
 it('rejects un-enrolled thread access before retrieving any token or making an HTTP request',async()=>{
  const http=vi.fn(async()=>json({}));const secrets=fixtureSecrets();await expect(fixtureConnector(http,secrets).readThread('employee-private')).rejects.toThrow('thread_not_enrolled');expect(http).not.toHaveBeenCalled();expect(secrets.read).not.toHaveBeenCalled();
 });
 it('filters mailbox history to enrolled threads, keeping the original cursor while pagination remains',async()=>{
  const http=vi.fn<typeof fetch>(async(input)=>String(input).includes('/history?')?json({historyId:'999',nextPageToken:'page-two',history:[{messagesAdded:[{message:{id:'employee',threadId:'unrelated-private'}},{message:{id:'message-human',threadId:'thread-enrolled'}}]}]}):json(thread));
  const result=await fixtureConnector(http).pollHistory({historyId:'100'});expect(result.cursor).toEqual({historyId:'100',pageToken:'page-two'});expect(result.messages).toHaveLength(1);expect(result.messages[0]?.text).toBe('Yes, let us talk.');expect(result.messages[0]?.headers.authorization).toBeUndefined();expect(http.mock.calls.map(c=>String(c[0])).join(' ')).not.toContain('/threads/unrelated');
 });
 it('recovers expired history by sampling only enrolled threads after obtaining a new baseline',async()=>{
  const urls:string[]=[];const http:typeof fetch=async(input)=>{const url=String(input);urls.push(url);return url.includes('/history?')?json({},404):url.endsWith('/profile')?json({historyId:'1000'}):json(thread);};
  const result=await fixtureConnector(http).pollHistory({historyId:'1'});expect(result.recoveredExpiredHistory).toBe(true);expect(result.cursor).toEqual({historyId:'1000'});expect(urls[1]).toContain('/profile');expect(urls[2]).toContain('/threads/thread-enrolled');
 });
 it('a refresh lease conflict cannot start another refresh or send',async()=>{
  const secrets=fixtureSecrets(true);secrets.acquireRefresh=vi.fn(async()=>null);const http=vi.fn(async()=>json({}));await expect(fixtureConnector(http,secrets).readSheet()).rejects.toThrow('refresh_in_progress');expect(http).not.toHaveBeenCalled();
 });
 it('atomically retains a rotated refresh token before using it',async()=>{
  const secrets=fixtureSecrets(true);const http=vi.fn<typeof fetch>(async input=>String(input).includes('oauth2.googleapis.com')?json({access_token:'ROTATED_SYNTHETIC',refresh_token:'NEW_REFRESH_SYNTHETIC',expires_in:3600,token_type:'Bearer'}):json({range:'Proposals!A1:K2',values:[]}));
  await fixtureConnector(http,secrets).readSheet();expect(secrets.storeRefresh).toHaveBeenCalledWith(connectionId,connectionId,{accessToken:'ROTATED_SYNTHETIC',refreshToken:'NEW_REFRESH_SYNTHETIC',expiresAt:'2026-09-11T13:00:00.000Z'});
 });
 it('a timeout after Gmail submission yields uncertainty with exactly one HTTP attempt',async()=>{
  const http=vi.fn<typeof fetch>(async()=>{throw new TypeError('SIMULATED_ACCEPTED_THEN_SOCKET_LOST');});
  try{await executeGoogleWrite(fixtureConnector(http),{type:'send_follow_up',actionId,recipient:'customer@example.invalid',subject:'Proposal',body:'Approved copy'});throw new Error('Expected uncertainty');}catch(error){expect(error).toBeInstanceOf(GoogleError);expect((error as GoogleError).uncertain).toBe(true);}expect(http).toHaveBeenCalledTimes(1);
 });
 it('the Gmail receipt means accepted by API, and uses a stable RFC message identity',async()=>{
  const http=vi.fn<typeof fetch>(async()=>json({id:'provider-message',threadId:'provider-thread'}));const result=await executeGoogleWrite(fixtureConnector(http),{type:'send_follow_up',actionId,recipient:'customer@example.invalid',subject:'Approved subject',body:'Approved text'});
  expect(result.status).toBe('provider_accepted');const payload=JSON.parse(String(http.mock.calls[0]?.[1]?.body));const mime=Buffer.from(payload.raw,'base64url').toString('utf8');expect(mime).toContain(`Message-ID: <david-${actionId}@engine.getdavid.ai>`);expect(mime).toContain('To: customer@example.invalid');
 });
 it('rejects injected message headers before external writes',async()=>{
  const http=vi.fn(async()=>json({}));await expect(executeGoogleWrite(fixtureConnector(http),{type:'send_follow_up',actionId,recipient:'customer@example.invalid',subject:'Approved\r\nBcc: attacker@example.invalid',body:'copy'})).rejects.toThrow('invalid_mail_header');expect(http).not.toHaveBeenCalled();
 });
 it('rechecks the bound calendar and blocks a conflict without inserting an event',async()=>{
  const http=vi.fn(async()=>json({calendars:{'approved-calendar':{busy:[{start:'2026-09-11T13:00:00Z',end:'2026-09-11T14:00:00Z'}]}}}));await expect(executeGoogleWrite(fixtureConnector(http),{type:'book_appointment',actionId,recipient:'customer@example.invalid',summary:'Proposal review',startAt:'2026-09-11T13:00:00Z',endAt:'2026-09-11T13:30:00Z',timeZone:'America/Denver'})).rejects.toThrow('calendar_slot_no_longer_available');expect(http).toHaveBeenCalledTimes(1);
 });
 it('books with a provider-compatible stable event ID, without inferring attendance',async()=>{
  const http=vi.fn<typeof fetch>(async input=>String(input).endsWith('/freeBusy')?json({calendars:{'approved-calendar':{busy:[]}}}):json({id:stableCalendarEventId(actionId),status:'confirmed'}));const result=await executeGoogleWrite(fixtureConnector(http),{type:'book_appointment',actionId,recipient:'customer@example.invalid',summary:'Proposal review',startAt:'2026-09-11T13:00:00Z',endAt:'2026-09-11T13:30:00Z',timeZone:'America/Denver'});expect(result).toEqual({providerId:stableCalendarEventId(actionId),status:'confirmed'});expect(result.providerId).toMatch(/^[a-v0-9]{5,1024}$/);
 });
 it('not finding the stable sent identity is inconclusive, not permission to resend',async()=>{
  const http=vi.fn(async()=>json({}));expect(await fixtureConnector(http).reconcileSent(actionId)).toEqual({status:'not_found',providerId:null});expect(http).toHaveBeenCalledTimes(1);
 });
 it('generates independent one-time state and PKCE inputs, storing only state hashes',()=>{
  const a=createOAuthRequest({clientId:'fixture',redirectUri:'https://app.example.invalid/callback',scopes:['openid','email']});const b=createOAuthRequest({clientId:'fixture',redirectUri:'https://app.example.invalid/callback',scopes:['openid','email']});const params=new URL(a.url).searchParams;expect(a.stateHash).toBe(hashOAuthState(params.get('state')!));expect(a.stateHash).not.toBe(b.stateHash);expect(params.get('code_challenge_method')).toBe('S256');expect(params.get('code_challenge')).not.toBe(a.verifier);
 });
});
