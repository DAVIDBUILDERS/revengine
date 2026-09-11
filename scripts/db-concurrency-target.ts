export type ConcurrencyTarget={ref:string;adminUrl:string;workerUrl:string;dispatcherUrl:string};
/** Pure preflight: it must complete before opening any socket or committing fixtures. */
export function concurrencyTarget(env:Record<string,string|undefined>):ConcurrencyTarget {
 const {TEST_SUPABASE_PROJECT_ID:ref,PRODUCTION_SUPABASE_PROJECT_ID:production,TEST_DATABASE_URL:adminUrl,TEST_WORKER_DATABASE_URL:workerUrl,TEST_DISPATCHER_DATABASE_URL:dispatcherUrl}=env;
 if(!ref||!production||!adminUrl||!workerUrl||!dispatcherUrl)throw new Error('CONCURRENCY_SETUP_MISSING: TEST_SUPABASE_PROJECT_ID, PRODUCTION_SUPABASE_PROJECT_ID, TEST_DATABASE_URL, TEST_WORKER_DATABASE_URL and TEST_DISPATCHER_DATABASE_URL are required.');
 if(ref===production)throw new Error('CONCURRENCY_PRODUCTION_DENIED');
 if(!/^[a-z0-9]+$/.test(ref)||!/^[a-z0-9]+$/.test(production))throw new Error('CONCURRENCY_PROJECT_ID_INVALID');
 const check=(raw:string,role:string)=>{let url:URL;try{url=new URL(raw);}catch{throw new Error('CONCURRENCY_DATABASE_URL_INVALID');}const user=decodeURIComponent(url.username);
  if(!['postgres:','postgresql:'].includes(url.protocol)||url.pathname!=='/postgres'||!url.password||url.hash||
   !((url.hostname===`db.${ref}.supabase.co`&&(user===role||user===`${role}.${ref}`))||(url.hostname.endsWith('.pooler.supabase.com')&&user===`${role}.${ref}`)))throw new Error(`CONCURRENCY_TARGET_OR_ROLE_MISMATCH: ${role}`);
  url.searchParams.delete('sslmode');return url.toString();
 };
 return {ref,adminUrl:check(adminUrl,'postgres'),workerUrl:check(workerUrl,'david_worker'),dispatcherUrl:check(dispatcherUrl,'david_dispatcher')};
}
