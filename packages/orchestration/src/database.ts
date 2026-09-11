import {createDatabase,type Database} from '../../db/src/index';
import {environment} from './environment';
let instance:Database|undefined;
export function runtimeDatabase(){
  const env=environment();
  if(env.DAVID_MODE==='fixture'||!env.WORKER_DATABASE_URL||!env.DISPATCHER_DATABASE_URL)throw new Error('SUPABASE_WORKER_UNCONFIGURED: Configure the project-bound restricted worker and dispatcher roles.');
  if(!instance)instance=createDatabase({workerUrl:env.WORKER_DATABASE_URL,dispatcherUrl:env.DISPATCHER_DATABASE_URL,oauthUrl:env.DAVID_OAUTH_DATABASE_URL,ca:env.DATABASE_CA_CERT});
  return instance;
}
