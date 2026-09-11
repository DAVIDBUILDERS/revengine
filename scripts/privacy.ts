import { createHash } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import type postgres from 'postgres';
import { z } from 'zod';

const ProjectId = z.string().regex(/^[a-z0-9]{20}$/);
const Authority = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('workspace_membership'), actorId: z.uuid() }).strict(),
  z.object({ kind: z.literal('privileged_operator'), authorizationReference: z.uuid() }).strict(),
]);
export const PrivacyRequest = z.object({
  version: z.literal(1), requestId: z.uuid(), projectId: ProjectId, workspaceId: z.uuid(),
  operation: z.enum(['export', 'delete']), authority: Authority,
  retention: z.object({ policy: z.literal('approved_expiry_or_erasure'), policyReference: z.uuid(), released: z.boolean() }).strict(),
}).strict();
export type PrivacyRequest = z.infer<typeof PrivacyRequest>;
export type PrivacyTarget = { projectId: string; workspaceId: string; databaseUrl: string; request: PrivacyRequest; requestHash: string };
export function privacyTarget(input: Record<string,string|undefined>, rawRequest: unknown): PrivacyTarget {
  const request = PrivacyRequest.parse(rawRequest);
  if (input.VERCEL || input.VERCEL_ENV) throw new Error('PRIVACY_ADMIN_CLI_ONLY');
  if (input.PRIVACY_SUPABASE_PROJECT_ID !== request.projectId || input.CONFIRMED_PRIVACY_PROJECT_ID !== request.projectId || input.PRIVACY_WORKSPACE_ID !== request.workspaceId) throw new Error('PRIVACY_EXACT_TARGET_REQUIRED');
  if (!input.PRIVACY_DATABASE_URL) throw new Error('PRIVACY_ADMIN_DATABASE_REQUIRED');
  const url = new URL(input.PRIVACY_DATABASE_URL);
  const user = decodeURIComponent(url.username);
  const direct = url.hostname === `db.${request.projectId}.supabase.co` && user === 'postgres';
  const pooler = url.hostname.endsWith('.pooler.supabase.com') && user === `postgres.${request.projectId}`;
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || (!direct && !pooler) || url.port === '6543' || url.pathname !== '/postgres' || !url.password || url.searchParams.get('sslmode') === 'disable') throw new Error('PRIVACY_ADMIN_PROJECT_CONNECTION_MISMATCH');
  return {projectId:request.projectId,workspaceId:request.workspaceId,databaseUrl:input.PRIVACY_DATABASE_URL,request,requestHash:createHash('sha256').update(JSON.stringify(request)).digest('hex')};
}

export const PrivacyPreview = z.object({ workspaceId:z.uuid(), tables:z.array(z.object({table:z.string().regex(/^(public|private)\.[a-z_]+$/),count:z.number().int().nonnegative(),exportable:z.boolean()}).strict()),objects:z.number().int().nonnegative(),blockers:z.array(z.string()),quarantined:z.boolean() }).strict();
export type PrivacyPreview = z.infer<typeof PrivacyPreview>;
const ObjectManifest = z.object({workspaceId:z.uuid(),bucket:z.literal('david-evidence'),id:z.uuid(),path:z.string().min(1),createdAt:z.unknown(),updatedAt:z.unknown(),metadata:z.unknown()}).strict();
export type ObjectManifest = z.infer<typeof ObjectManifest>;
const Completion = z.object({completionId:z.uuid(),rowsRemoved:z.number().int().nonnegative(),objectsAtQuarantine:z.number().int().nonnegative(),vaultSecretsRemoved:z.number().int().nonnegative()}).strict();
export type PrivacyPort = {
  preview():Promise<unknown>;
  page(table:string,offset:number,limit:number):Promise<unknown[]>;
  objectPage(offset:number,limit:number):Promise<unknown[]>;
  beginDelete(confirmedWorkspace:string):Promise<string>;
  finishDelete(confirmedWorkspace:string):Promise<unknown>;
};
export type StorageRemovalPort = {remove(paths:string[]):Promise<void>};
export type ExportSink = {write(table:string,rows:unknown[]):Promise<void>};

function checkedPreview(value:unknown,target:PrivacyTarget) {
  const preview=PrivacyPreview.parse(value);
  if(preview.workspaceId!==target.workspaceId)throw new Error('PRIVACY_CROSS_WORKSPACE_RESULT');
  if(new Set(preview.tables.map(t=>t.table)).size!==preview.tables.length)throw new Error('PRIVACY_DUPLICATE_TABLE');
  return preview;
}
function checkedObject(value:unknown,target:PrivacyTarget) {
  const item=ObjectManifest.parse(value);
  if(item.workspaceId!==target.workspaceId || !item.path.startsWith(`${target.workspaceId}/`) || item.path.split('/').some(p=>p==='..'||p==='.') || item.path.includes('\\') || /[\u0000-\u001f]/u.test(item.path))throw new Error('PRIVACY_CROSS_WORKSPACE_OBJECT');
  return item;
}
function checkedRecord(value:unknown,table:string,target:PrivacyTarget) {
  const item=z.record(z.string(),z.unknown()).parse(value);
  if((table==='public.workspaces'?item.id:item.workspace_id)!==target.workspaceId)throw new Error('PRIVACY_CROSS_WORKSPACE_RECORD');
  return redactExport(item);
}
const secretKey = /(^tokens?$|^session$|access.?token|refresh.?token|id.?token|api.?key|secret|password|credential|authorization|cookie|session.?token|hook.?token|route.?token|claim.?token|workflow.?claim|lease.?token|private.?key|verifier)/i;
export function redactExport(value:unknown):unknown {
  if(Array.isArray(value))return value.map(redactExport);
  if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!secretKey.test(key)).map(([key,item])=>[key,redactExport(item)]));
  if(typeof value==='string')return value.replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi,'[REDACTED_AUTHORIZATION]').replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[REDACTED_TOKEN]').replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|sb_secret_[A-Za-z0-9_-]+|ya29\.[A-Za-z0-9._-]+|1\/\/[A-Za-z0-9_-]{12,})\b/g,'[REDACTED_CREDENTIAL]').replace(/([?&](?:access_token|refresh_token|token|key|api_key|signature|x-amz-signature)=)[^&#\s]+/gi,'$1[REDACTED_CREDENTIAL]');
  return value;
}
/** Plain JSONL only: source strings cannot become HTML/script, spreadsheet formulas or terminal controls. */
export function exportJsonLine(value:unknown) {
  return JSON.stringify(redactExport(value)).replace(/[<>&\u2028\u2029]/gu,c=>`\\u${c.charCodeAt(0).toString(16).padStart(4,'0')}`)+'\n';
}
export async function previewPrivacy(port:PrivacyPort,target:PrivacyTarget){return checkedPreview(await port.preview(),target);}
export async function exportPrivacy(port:PrivacyPort,target:PrivacyTarget,sink:ExportSink) {
  if(target.request.operation!=='export')throw new Error('PRIVACY_EXPORT_REQUEST_REQUIRED');
  const preview=await previewPrivacy(port,target);const counts:Record<string,number>={};
  for(const table of preview.tables.filter(t=>t.exportable)){
    let count=0;
    for(;;){const page=await port.page(table.table,count,500);if(page.length>500)throw new Error('PRIVACY_INVALID_PAGE');const rows=page.map(row=>checkedRecord(row,table.table,target));await sink.write(table.table,rows);count+=rows.length;if(rows.length<500)break;}
    if(count!==table.count)throw new Error('PRIVACY_EXPORT_SNAPSHOT_CHANGED');counts[table.table]=count;
  }
  let count=0;
  for(;;){const page=await port.objectPage(count,500);if(page.length>500)throw new Error('PRIVACY_INVALID_PAGE');const items=page.map(row=>checkedObject(row,target));await sink.write('evidence_objects',items);count+=items.length;if(items.length<500)break;}
  if(count!==preview.objects)throw new Error('PRIVACY_EXPORT_SNAPSHOT_CHANGED');
  return {version:1,workspaceId:target.workspaceId,projectId:target.projectId,requestId:target.request.requestId,format:'application/x-ndjson',counts,objectManifestCount:count,
    omittedTables:preview.tables.filter(t=>!t.exportable).map(t=>({table:t.table,count:t.count,reason:'Credential, routing capability or privacy-control metadata excluded'})),
    limitations:['Object manifest includes all workspace evidence/quarantine paths; binary downloads are not included.','Credentials and known secret fields are redacted. Treat all remaining source text as untrusted plaintext.','This export is scoped to the workspace; shared Auth identities, provider-side copies and backups are outside its scope.']};
}
export async function deletePrivacy(port:PrivacyPort,target:PrivacyTarget,confirmedWorkspace:string,storage?:StorageRemovalPort) {
  if(target.request.operation!=='delete'||confirmedWorkspace!==target.workspaceId||!target.request.retention.released)throw new Error('PRIVACY_EXPLICIT_ERASURE_APPROVAL_REQUIRED');
  const preview=await previewPrivacy(port,target);
  if(preview.blockers.length)throw new Error(`PRIVACY_BLOCKED: ${preview.blockers.join(', ')}`);
  if(preview.objects>0&&!storage)throw new Error('PRIVACY_STORAGE_ADMIN_ACCESS_REQUIRED');
  // Inspect all prospective paths before quarantine, so a corrupted/cross-tenant manifest cannot trigger an unrelated deletion.
  let inspected=0;
  for(;;){const page=await port.objectPage(inspected,500);if(page.length>500)throw new Error('PRIVACY_INVALID_PAGE');page.forEach(item=>checkedObject(item,target));inspected+=page.length;if(page.length<500)break;}
  if(inspected!==preview.objects)throw new Error('PRIVACY_OBJECT_SET_CHANGED_RERUN_PREVIEW');
  const jobId=z.uuid().parse(await port.beginDelete(confirmedWorkspace));
  // Always restart at offset zero after removal. Offset pagination while deleting would skip objects.
  let priorBatch='';
  for(;;){const page=await port.objectPage(0,100);if(page.length>100)throw new Error('PRIVACY_INVALID_PAGE');const items=page.map(item=>checkedObject(item,target));if(!items.length)break;
    if(!storage)throw new Error('PRIVACY_STORAGE_ADMIN_ACCESS_REQUIRED_QUARANTINED');
    const paths=items.map(item=>item.path);const signature=JSON.stringify(paths);if(signature===priorBatch)throw new Error('PRIVACY_STORAGE_NO_PROGRESS_QUARANTINED');priorBatch=signature;
    await storage.remove(paths);
  }
  const completion=Completion.parse(await port.finishDelete(confirmedWorkspace));return {status:'erased',jobId,...completion};
}

export function privacyDatabasePort(sql:postgres.Sql|postgres.TransactionSql,target:PrivacyTarget):PrivacyPort {
  const actor=target.request.authority.kind==='workspace_membership'?target.request.authority.actorId:null;
  const authority=target.request.authority.kind==='privileged_operator'?target.request.authority.authorizationReference:null;
  const workspace=target.workspaceId;const operation=target.request.operation;const requestHash=target.requestHash;
  return {
    async preview(){const [row]=await sql`select private.privacy_preview(${workspace}::uuid,${actor}::uuid,${authority}::uuid,${operation},${requestHash}) as result`;return row?.result;},
    async page(table,offset,limit){return (await sql`select private.privacy_export_page(${workspace}::uuid,${actor}::uuid,${authority}::uuid,${table},${offset},${limit}) as record`).map(r=>r.record);},
    async objectPage(offset,limit){return (await sql`select private.privacy_object_page(${workspace}::uuid,${actor}::uuid,${authority}::uuid,${operation},${requestHash},${offset},${limit}) as record`).map(r=>r.record);},
    async beginDelete(confirmed){const [row]=await sql`select private.privacy_begin_delete(${workspace}::uuid,${actor}::uuid,${authority}::uuid,${requestHash},${confirmed}::uuid,${target.request.retention.released},${target.request.retention.policy}) as id`;return row?.id;},
    async finishDelete(confirmed){const [row]=await sql`select private.privacy_finish_delete(${workspace}::uuid,${requestHash},${confirmed}::uuid,${target.request.retention.released}) as result`;return row?.result;},
  };
}
export function privacyStorage(target:PrivacyTarget,key:string):StorageRemovalPort {
  if(!key.startsWith('sb_secret_')){
    let payload:Record<string,unknown>;try{payload=JSON.parse(Buffer.from(key.split('.')[1]??'','base64url').toString('utf8'));}catch{throw new Error('PRIVACY_STORAGE_SERVICE_KEY_REQUIRED');}
    if(payload.role!=='service_role'||payload.ref!==target.projectId)throw new Error('PRIVACY_STORAGE_SERVICE_KEY_PROJECT_MISMATCH');
  }
  const client=createClient(`https://${target.projectId}.supabase.co`,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  return {async remove(paths){if(paths.length>100||paths.some(path=>!path.startsWith(`${target.workspaceId}/`)||path.split('/').some(segment=>segment==='..'||segment==='.')))throw new Error('PRIVACY_CROSS_WORKSPACE_OBJECT');const {error}=await client.storage.from('david-evidence').remove(paths);if(error)throw new Error('PRIVACY_STORAGE_REMOVAL_FAILED_QUARANTINED');}};
}

async function main(){
  const {database}=await import('./runtime'); // Loads protected .env.tools.local only for the actual CLI.
  const args=process.argv.slice(2);const command=args[0];
  if(!['export','delete'].includes(command)||!args[1])throw new Error('Usage: tsx scripts/privacy.ts export REQUEST.json OUTPUT_DIRECTORY | delete REQUEST.json [--apply --confirm-workspace UUID]');
  if(command==='export' && (args.length!==3||args[2].startsWith('--')))throw new Error('An exclusive, new output directory is required.');
  if(command==='delete' && !(args.length===2 || (args.length===5&&args[2]==='--apply'&&args[3]==='--confirm-workspace')))throw new Error('Deletion defaults to preview; apply requires --apply --confirm-workspace UUID.');
  const file=await readFile(args[1],'utf8');if(Buffer.byteLength(file)>16000)throw new Error('PRIVACY_REQUEST_TOO_LARGE');
  const target=privacyTarget(process.env,JSON.parse(file));if(target.request.operation!==command)throw new Error('PRIVACY_REQUEST_OPERATION_MISMATCH');
  const sql=database(target.databaseUrl);
  try{
    const [role]=await sql`select session_user as session_user,current_user as current_user`;
    if(role.session_user!=='postgres'||role.current_user!=='postgres')throw new Error('PRIVACY_ADMIN_REQUIRED');
    if(command==='export'){
      const directory=resolve(args[2]);await mkdir(directory,{mode:0o700});
      const files=new Map<string,Awaited<ReturnType<typeof open>>>();
      try{
        const manifest=await sql.begin('isolation level repeatable read read only',async tx=>exportPrivacy(privacyDatabasePort(tx,target),target,{async write(table,rows){let handle=files.get(table);if(!handle){handle=await open(resolve(directory,`${table}.jsonl`),'wx',0o600);files.set(table,handle);}for(const row of rows)await handle.write(exportJsonLine(row));}}));
        const handle=await open(resolve(directory,'manifest.json'),'wx',0o600);try{await handle.write(exportJsonLine(manifest));}finally{await handle.close();}
        console.log(`Export complete: ${directory}. Object manifests included; no binary downloads.`);
      }finally{await Promise.all([...files.values()].map(handle=>handle.close()));}
    }else{
      const port=privacyDatabasePort(sql,target);
      if(args.length===2){console.log(exportJsonLine(await previewPrivacy(port,target)));console.log('PREVIEW ONLY: no records, objects, credentials or memberships changed.');}
      else {const storage=process.env.PRIVACY_STORAGE_SERVICE_KEY?privacyStorage(target,process.env.PRIVACY_STORAGE_SERVICE_KEY):undefined;console.log(exportJsonLine(await deletePrivacy(port,target,args[4],storage)));}
    }
  }finally{await sql.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){main().catch(error=>{console.error(error instanceof z.ZodError?'PRIVACY_REQUEST_OR_RESULT_INVALID':error instanceof Error?error.message:'PRIVACY_OPERATION_FAILED');process.exitCode=1;});}
