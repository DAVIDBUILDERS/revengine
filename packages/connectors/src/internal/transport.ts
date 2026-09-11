import { z } from 'zod';

export type GoogleOperation = 'sheets.read'|'gmail.read'|'gmail.send'|'calendar.freebusy'|'calendar.book';
export type Token = {accessToken:string;refreshToken?:string;expiresAt:string};
export interface SecretStore {
  read(connectionId:string, operation:GoogleOperation):Promise<Token>;
  acquireRefresh(connectionId:string):Promise<string|null>;
  storeRefresh(connectionId:string, lease:string, tokens:Token):Promise<void>;
  expire(connectionId:string):Promise<void>;
}
export class GoogleError extends Error {
  constructor(public readonly code:string, public readonly status:number|null = null, public readonly uncertain=false) { super(code); this.name='GoogleError'; }
}
export const TokenResponse = z.object({access_token:z.string().min(1),refresh_token:z.string().optional(),expires_in:z.number().positive(),scope:z.string().optional(),token_type:z.string()});
export async function boundedJson(response:Response, maxBytes=2_000_000):Promise<unknown> {
  if (Number(response.headers.get('content-length') ?? 0)>maxBytes) { await response.body?.cancel(); throw new GoogleError('provider_response_too_large'); }
  const reader=response.body?.getReader(); if(!reader) throw new GoogleError('provider_empty_response');
  let bytes=0; const chunks:Uint8Array[]=[];
  try { while(true) { const part=await reader.read(); if(part.done)break; bytes+=part.value.length; if(bytes>maxBytes)throw new GoogleError('provider_response_too_large'); chunks.push(part.value); } }
  finally { await reader.cancel().catch(()=>{}); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new GoogleError('provider_invalid_json'); }
}
export interface Transport {
  connectionId:string; identity:string;
  request(operation:GoogleOperation,url:string,init?:RequestInit,write?:boolean):Promise<unknown>;
}
const transports = new WeakMap<object,Transport>();
export function registerTransport(connector:object,transport:Transport) { transports.set(connector,transport); }
export function getTransport(connector:object):Transport { const result=transports.get(connector); if(!result)throw new GoogleError('unknown_connector'); return result; }
export function makeTransport(options:{secrets:SecretStore;connectionId:string;identity:string;clientId:string;clientSecret:string;fetch?:typeof fetch;now?:()=>Date}):Transport {
  const http=options.fetch??fetch; const now=options.now??(()=>new Date());
  async function access(operation:GoogleOperation):Promise<string> {
    const current=await options.secrets.read(options.connectionId,operation);
    if(new Date(current.expiresAt).getTime()>now().getTime()+60_000)return current.accessToken;
    if(!current.refreshToken){await options.secrets.expire(options.connectionId);throw new GoogleError('reauthorization_required');}
    const lease=await options.secrets.acquireRefresh(options.connectionId);
    if(!lease)throw new GoogleError('refresh_in_progress'); // persisted lease; caller schedules a bounded later retry
    let response:Response;
    try {response=await http('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'refresh_token',refresh_token:current.refreshToken,client_id:options.clientId,client_secret:options.clientSecret}),signal:AbortSignal.timeout(10_000)});}
    catch {throw new GoogleError('token_refresh_unavailable');}
    if(!response.ok){ if(response.status===400||response.status===401)await options.secrets.expire(options.connectionId); await response.body?.cancel();throw new GoogleError('token_refresh_rejected',response.status); }
    const result=TokenResponse.parse(await boundedJson(response,32_768));
    const token={accessToken:result.access_token,refreshToken:result.refresh_token??current.refreshToken,expiresAt:new Date(now().getTime()+result.expires_in*1000).toISOString()};
    await options.secrets.storeRefresh(options.connectionId,lease,token); return token.accessToken;
  }
  return {connectionId:options.connectionId,identity:options.identity,async request(operation,url,init={},write=false){
    const parsed=new URL(url);
    if(parsed.protocol!=='https:'||!['gmail.googleapis.com','sheets.googleapis.com','www.googleapis.com'].includes(parsed.hostname))throw new GoogleError('unbound_provider_endpoint');
    for(let attempt=0;attempt<(write?1:3);attempt++){
      const token=await access(operation); let response:Response;
      try {response=await http(url,{...init,headers:{...Object.fromEntries(new Headers(init.headers)),Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(10_000)});}
      catch {throw new GoogleError(write?'write_outcome_uncertain':'provider_read_unavailable',null,write);}
      if(response.ok){try{return await boundedJson(response);}catch{throw new GoogleError(write?'write_response_uncertain':'provider_invalid_response',response.status,write);}}
      const status=response.status; const after=Number(response.headers.get('retry-after')??0); await response.body?.cancel();
      if(status===401){await options.secrets.expire(options.connectionId);throw new GoogleError('reauthorization_required',status);}
      if(!write&&(status===429||status>=500)&&attempt<2){await new Promise(resolve=>setTimeout(resolve,Math.min(2000,Math.max(after*1000,150*2**attempt))));continue;}
      throw new GoogleError(status===403?'permission_denied':status===404?'provider_not_found':write&&status>=500?'write_outcome_uncertain':'provider_rejected',status,write&&status>=500);
    }
    throw new GoogleError('provider_retry_exhausted');
  }};
}
