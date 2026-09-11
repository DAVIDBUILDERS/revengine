import './runtime';
import {environment,assertMigrationTarget} from '../packages/orchestration/src/environment';
import {database} from './runtime';
const remote=process.argv.includes('--remote');
const rows:{capability:string;status:string;detail:string}[]=[];
let valid=true;
const runtimeInput={...process.env};
// This administrative tool may load an isolated migration credential; it never becomes web configuration.
for(const key of ['MIGRATION_DATABASE_URL','TEST_DATABASE_URL','TEST_WORKER_DATABASE_URL','TEST_DISPATCHER_DATABASE_URL','PRIVACY_DATABASE_URL','PRIVACY_STORAGE_SERVICE_KEY'])delete runtimeInput[key];
try{const env=environment(runtimeInput);rows.push({capability:'environment',status:'PASS',detail:`${env.DAVID_MODE} / ${env.DAVID_DEPLOYMENT}; live execution ${env.DAVID_LIVE_EXECUTION}. Review actual deployment secrets separately.`});}catch(error){valid=false;rows.push({capability:'environment',status:'FAIL',detail:error instanceof Error?error.message:'Invalid environment'});}
const requirements:Record<string,string[]>={Vercel:['EXPECTED_VERCEL_PROJECT_ID','VERCEL_TEAM_ID'],Supabase:['EXPECTED_SUPABASE_PROJECT_ID','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','WORKER_DATABASE_URL','DISPATCHER_DATABASE_URL','DAVID_OAUTH_DATABASE_URL'],Google:['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REDIRECT_URI'],Model:['AI_GATEWAY_API_KEY','AI_MODEL_ID','AI_ALLOWED_PROVIDER','AI_MAX_JOB_COST_MINOR'],Operations:['ALERT_DESTINATION','AUTH_EMAIL_PROVIDER','APP_COMPUTE_REGION','WORKFLOW_REGION','SUPABASE_REGION','MODEL_PROCESSING_REGION']};
for(const [capability,keys] of Object.entries(requirements)){const missing=keys.filter(k=>!process.env[k]);rows.push({capability,status:missing.length?'BLOCKED':'CONFIGURED_UNVERIFIED',detail:missing.length?`Missing ${missing.join(', ')}`:'Configuration present; requires permission/resource and receipt verification.'});}
if(remote&&valid){
  if(process.env.MIGRATION_DATABASE_URL){
    let admin;
    try{
      const target=assertMigrationTarget(process.env);admin=database(target.connection);
      await admin.begin(async tx=>{
        await tx`set transaction read only`;
        const [schema]=await tx`select to_regclass('david_migrations.versions') is not null as ledger, to_regclass('public.workspaces') is not null as workspaces, to_regclass('vault.secrets') is not null as vault`;
        rows.push({capability:'Hosted schema',status:schema.ledger&&schema.workspaces&&schema.vault?'PASS':'FAIL',detail:'Read-only check of migration ledger, workspace schema and Vault availability. Actual policy tests remain separate.'});
        const [bucket]=await tx`select public,file_size_limit from storage.buckets where id='david-evidence'`;
        rows.push({capability:'Private evidence bucket',status:bucket&&!bucket.public&&Number(bucket.file_size_limit)===5242880?'PASS':'FAIL',detail:'Bucket privacy and 5 MB cap inspected; authenticated object access still needs its hosted test.'});
        const [roles]=await tx`select count(*) as invalid from pg_roles where rolname in ('david_worker','david_dispatcher','david_oauth') and (rolsuper or rolbypassrls or rolcreaterole or rolcreatedb)`;
        const [owners]=await tx`select count(*) as invalid from pg_tables where schemaname in ('public','private') and tableowner in ('david_worker','david_dispatcher','david_oauth')`;
        rows.push({capability:'Role ownership boundary',status:Number(roles.invalid)===0&&Number(owners.invalid)===0?'PASS':'FAIL',detail:'Runtime roles must have no privileged attributes or application-table ownership.'});
      });
    }catch{rows.push({capability:'Hosted schema inspection',status:'FAIL',detail:'Read-only inspection failed; check the explicitly confirmed project, migration version and scoped administrative connection.'});}
    finally{if(admin)await admin.end();}
  }
  for(const [key,role] of [['WORKER_DATABASE_URL','david_worker'],['DISPATCHER_DATABASE_URL','david_dispatcher'],['DAVID_OAUTH_DATABASE_URL','david_oauth']]){
    if(!process.env[key])continue;const sql=database(process.env[key]!);try{const [result]=await sql`select current_user as role, rolbypassrls, rolsuper from pg_roles where rolname=current_user`;const ok=result&&result.role===role&&!result.rolbypassrls&&!result.rolsuper;rows.push({capability:`${role} role`,status:ok?'PASS':'FAIL',detail:ok?'Authenticated restricted role; TLS certificate verification enabled.':'Unexpected or privileged runtime database role.'});}catch{rows.push({capability:role,status:'FAIL',detail:'Could not verify role/connection. Check project connection details and trusted CA.'});}finally{await sql.end();}
  }
  if(process.env.VERCEL_API_TOKEN&&process.env.EXPECTED_VERCEL_PROJECT_ID&&process.env.VERCEL_TEAM_ID){try{const url=new URL(`https://api.vercel.com/v9/projects/${encodeURIComponent(process.env.EXPECTED_VERCEL_PROJECT_ID)}`);url.searchParams.set('teamId',process.env.VERCEL_TEAM_ID);const response=await fetch(url,{headers:{Authorization:`Bearer ${process.env.VERCEL_API_TOKEN}`},signal:AbortSignal.timeout(10000)});const data=await response.json();rows.push({capability:'Vercel target',status:response.ok&&data.id===process.env.EXPECTED_VERCEL_PROJECT_ID?'PASS':'FAIL',detail:'Read-only target project API check; workflow execution and cron still require hosted trace.'});}catch{rows.push({capability:'Vercel target',status:'FAIL',detail:'Read-only target lookup failed.'});}}
}
console.table(rows);
console.log('Fixture passes do not verify SQL/RLS, Vault, Storage, Google operations, AI availability, hosted waits, alerts, restore or migration. See docs/RELEASE_READINESS.md.');
process.exitCode=rows.some(r=>r.status==='FAIL')?1:rows.some(r=>r.status==='BLOCKED')?2:0;
