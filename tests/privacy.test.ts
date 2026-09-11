import { describe, expect, it, vi } from 'vitest';
import { deletePrivacy, exportJsonLine, exportPrivacy, previewPrivacy, privacyStorage, privacyTarget, type ObjectManifest, type PrivacyPort, type PrivacyRequest } from '../scripts/privacy';

const workspace='10000000-0000-4000-8000-000000000001';
const otherWorkspace='20000000-0000-4000-8000-000000000002';
const project='abcdefghijklmnopqrst';
const request:PrivacyRequest={version:1,requestId:'30000000-0000-4000-8000-000000000003',projectId:project,workspaceId:workspace,operation:'delete',authority:{kind:'privileged_operator',authorizationReference:'40000000-0000-4000-8000-000000000004'},retention:{policy:'approved_expiry_or_erasure',policyReference:'50000000-0000-4000-8000-000000000005',released:true}};
const env={PRIVACY_SUPABASE_PROJECT_ID:project,CONFIRMED_PRIVACY_PROJECT_ID:project,PRIVACY_WORKSPACE_ID:workspace,PRIVACY_DATABASE_URL:`postgresql://postgres:synthetic-local-test@db.${project}.supabase.co:5432/postgres`};
function object(index:number):ObjectManifest{return {workspaceId:workspace,bucket:'david-evidence',id:`60000000-0000-4000-8000-${index.toString().padStart(12,'0')}`,path:`${workspace}/quarantine/evidence-${index}.txt`,createdAt:'2026-09-10T00:00:00Z',updatedAt:'2026-09-10T00:00:00Z',metadata:{mimetype:'text/plain'}};}
function store(count=0){
  let objects=Array.from({length:count},(_,index)=>object(index));
  const remove=vi.fn(async(paths:string[])=>{objects=objects.filter(item=>!paths.includes(item.path));});
  const port:PrivacyPort={preview:vi.fn(async()=>({workspaceId:workspace,tables:[],objects:objects.length,blockers:[],quarantined:false})),page:vi.fn(async()=>[]),objectPage:vi.fn(async(offset,limit)=>objects.slice(offset,offset+limit)),beginDelete:vi.fn(async()=>'70000000-0000-4000-8000-000000000007'),finishDelete:vi.fn(async()=>({completionId:'80000000-0000-4000-8000-000000000008',rowsRemoved:32,objectsAtQuarantine:count,vaultSecretsRemoved:2}))};
  return {port,storage:{remove}};
}
describe('operator privacy boundaries and completion',()=>{
  it('requires matching project, workspace, confirmed target and actual admin-shaped connection before connecting',()=>{
    expect(()=>privacyTarget({...env,CONFIRMED_PRIVACY_PROJECT_ID:'xxxxxxxxxxxxxxxxxxxx'},request)).toThrow('EXACT_TARGET');
    expect(()=>privacyTarget({...env,PRIVACY_WORKSPACE_ID:otherWorkspace},request)).toThrow('EXACT_TARGET');
    expect(()=>privacyTarget({...env,PRIVACY_DATABASE_URL:env.PRIVACY_DATABASE_URL.replace(project,'xxxxxxxxxxxxxxxxxxxx')},request)).toThrow('CONNECTION_MISMATCH');
    expect(()=>privacyTarget({...env,PRIVACY_DATABASE_URL:env.PRIVACY_DATABASE_URL.replace('postgres:synthetic','david_worker:synthetic')},request)).toThrow('CONNECTION_MISMATCH');
    expect(()=>privacyTarget({...env,PRIVACY_DATABASE_URL:env.PRIVACY_DATABASE_URL.replace(':5432',':6543')},request)).toThrow('CONNECTION_MISMATCH');
    expect(()=>privacyTarget({...env,VERCEL:'1'},request)).toThrow('CLI_ONLY');
    expect(()=>privacyTarget(env,{...request,table:'auth.users'})).toThrow();
    expect(()=>privacyTarget(env,{...request,authority:{kind:'privileged_operator'}})).toThrow();
  });
  it('preview performs no database or Storage mutation',async()=>{
    const {port,storage}=store(2);const result=await previewPrivacy(port,privacyTarget(env,request));expect(result.objects).toBe(2);
    expect(port.beginDelete).not.toHaveBeenCalled();expect(port.finishDelete).not.toHaveBeenCalled();expect(storage.remove).not.toHaveBeenCalled();
  });
  it('unreleased retention and incorrect explicit confirmation cannot quarantine or delete',async()=>{
    const {port,storage}=store(2);
    await expect(deletePrivacy(port,privacyTarget(env,{...request,retention:{...request.retention,released:false}}),workspace,storage)).rejects.toThrow('EXPLICIT_ERASURE');
    await expect(deletePrivacy(port,privacyTarget(env,request),otherWorkspace,storage)).rejects.toThrow('EXPLICIT_ERASURE');
    expect(port.beginDelete).not.toHaveBeenCalled();expect(storage.remove).not.toHaveBeenCalled();
  });
  it('requires paused and reconciled provider work before any destructive step',async()=>{
    for(const blocker of ['WORKSPACE_MUST_BE_PAUSED','ACTION_RECONCILIATION_REQUIRED','SUBMITTED_ACTION_EVIDENCE_REQUIRED','RUN_STILL_PROCESSING','MODEL_ATTEMPT_STILL_RESERVED']){
      const {port,storage}=store(1);port.preview=vi.fn(async()=>({workspaceId:workspace,tables:[],objects:1,blockers:[blocker],quarantined:false}));
      await expect(deletePrivacy(port,privacyTarget(env,request),workspace,storage)).rejects.toThrow(blocker);expect(port.beginDelete).not.toHaveBeenCalled();expect(storage.remove).not.toHaveBeenCalled();
    }
  });
  it('rejects cross-workspace preview and object manifests before quarantine',async()=>{
    const {port,storage}=store(1);port.preview=vi.fn(async()=>({workspaceId:otherWorkspace,tables:[],objects:1,blockers:[],quarantined:false}));
    await expect(deletePrivacy(port,privacyTarget(env,request),workspace,storage)).rejects.toThrow('CROSS_WORKSPACE');
    port.preview=vi.fn(async()=>({workspaceId:workspace,tables:[],objects:1,blockers:[],quarantined:false}));port.objectPage=vi.fn(async()=>[{...object(1),path:`${otherWorkspace}/secret.txt`}]);
    await expect(deletePrivacy(port,privacyTarget(env,request),workspace,storage)).rejects.toThrow('CROSS_WORKSPACE_OBJECT');expect(port.beginDelete).not.toHaveBeenCalled();expect(storage.remove).not.toHaveBeenCalled();
  });
  it('without Storage admin access a nonempty workspace remains unchanged',async()=>{
    const {port}=store(1);await expect(deletePrivacy(port,privacyTarget(env,request),workspace)).rejects.toThrow('STORAGE_ADMIN_ACCESS_REQUIRED');expect(port.beginDelete).not.toHaveBeenCalled();
  });
  it('quarantines before remote removal, deletes every batch without offset skips, and only then finishes',async()=>{
    const {port,storage}=store(251);const result=await deletePrivacy(port,privacyTarget(env,request),workspace,storage);
    expect(result.status).toBe('erased');expect(storage.remove.mock.calls.map(call=>call[0].length)).toEqual([100,100,51]);
    expect(vi.mocked(port.beginDelete).mock.invocationCallOrder[0]).toBeLessThan(storage.remove.mock.invocationCallOrder[0]);
    expect(storage.remove.mock.invocationCallOrder.at(-1)).toBeLessThan(vi.mocked(port.finishDelete).mock.invocationCallOrder[0]);
  });
  it('Storage failure or no progress leaves quarantined database records intact for the same approved retry',async()=>{
    const {port}=store(2);const storage={remove:vi.fn(async()=>{throw new Error('synthetic storage failure');})};
    await expect(deletePrivacy(port,privacyTarget(env,request),workspace,storage)).rejects.toThrow('storage failure');expect(port.beginDelete).toHaveBeenCalledOnce();expect(port.finishDelete).not.toHaveBeenCalled();
    const inertStorage={remove:vi.fn(async()=>{})};await expect(deletePrivacy(port,privacyTarget(env,request),workspace,inertStorage)).rejects.toThrow('NO_PROGRESS_QUARANTINED');expect(port.finishDelete).not.toHaveBeenCalled();
  });
  it('exports every page under the authorized workspace with a complete evidence manifest and no credential tables',async()=>{
    const {port}=store(1001);const rows=Array.from({length:1201},(_,index)=>({workspace_id:workspace,id:index,body:'Evidence'}));
    port.preview=vi.fn(async()=>({workspaceId:workspace,tables:[{table:'public.evidence',count:1201,exportable:true},{table:'private.connection_secrets',count:3,exportable:false}],objects:1001,blockers:[],quarantined:false}));
    port.page=vi.fn(async(table,offset,limit)=>{expect(table).toBe('public.evidence');return rows.slice(offset,offset+limit);});const saved:Record<string,unknown[]>={};
    const manifest=await exportPrivacy(port,privacyTarget(env,{...request,operation:'export'}),{async write(table,data){saved[table]??=[];saved[table].push(...data);}});
    expect(saved['public.evidence']).toHaveLength(1201);expect(saved.evidence_objects).toHaveLength(1001);expect(manifest.counts['public.evidence']).toBe(1201);expect(manifest.omittedTables[0].table).toBe('private.connection_secrets');
    expect(vi.mocked(port.page).mock.calls.map(call=>call[1])).toEqual([0,500,1000]);expect(port.beginDelete).not.toHaveBeenCalled();
  });
  it('never emits a record from another workspace even if a broken database port returns it',async()=>{
    const {port}=store();port.preview=vi.fn(async()=>({workspaceId:workspace,tables:[{table:'public.contacts',count:1,exportable:true}],objects:0,blockers:[],quarantined:false}));port.page=vi.fn(async()=>[{workspace_id:otherWorkspace,email:'private@example.invalid'}]);const write=vi.fn();
    await expect(exportPrivacy(port,privacyTarget(env,{...request,operation:'export'}),{write})).rejects.toThrow('CROSS_WORKSPACE_RECORD');expect(write).not.toHaveBeenCalled();
  });
  it('strips nested secrets and makes imported scripts/control strings inert JSON text',()=>{
    const json=exportJsonLine({credential:'hidden',payload:{accessToken:'hidden',refresh_token:'hidden',workflow_claim:'hidden',copy:'<script>alert(1)</script>\u001b[31m',source:'=HYPERLINK("bad")',note:'Bearer abc.def.ghi'}});
    expect(json).not.toContain('hidden');expect(json).not.toContain('<script>');expect(json).not.toContain('\u001b');expect(JSON.parse(json).payload.copy).toContain('<script>');expect(JSON.parse(json).payload.note).toBe('[REDACTED_AUTHORIZATION]');
  });
  it('rejects an anon or wrong-project legacy Storage token before network access',()=>{
    const token=(role:string,ref=project)=>`synthetic.${Buffer.from(JSON.stringify({role,ref})).toString('base64url')}.signature`;
    expect(()=>privacyStorage(privacyTarget(env,request),token('anon'))).toThrow('SERVICE_KEY_PROJECT_MISMATCH');expect(()=>privacyStorage(privacyTarget(env,request),token('service_role','xxxxxxxxxxxxxxxxxxxx'))).toThrow('SERVICE_KEY_PROJECT_MISMATCH');
  });
});
