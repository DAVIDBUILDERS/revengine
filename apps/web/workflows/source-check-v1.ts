import {getWorkflowMetadata} from 'workflow';
import {normalizeSheetRows} from '../../../packages/orchestration/src/sheet-import';
import {z} from 'zod';
import {runtimeDatabase} from '../../../packages/orchestration/src/database';
import {environment} from '../../../packages/orchestration/src/environment';
import {createGoogleConnector} from '../../../packages/connectors/src/index';
import {createVaultSecretStore} from '../../../packages/db/src/index';

export async function connectionCheckV1(runId:string){
 'use workflow';
 try{
  const resources=await connectionResourcesStep(runId,getWorkflowMetadata().workflowRunId);
  if(!resources)return {status:'duplicate'};
  const results:{bindingId:string;operation:string;observedAt:string}[]=[];
  for(const id of resources)results.push(await checkResourceStep(runId,id));
  await recordConnectionCheckStep(runId,results);
  return {status:'read_checks_passed',testedResources:results.length,externalWritesVerified:false};
 }catch{await connectionFailureStep(runId);return {status:'blocked',externalWritesVerified:false};}
}
async function connectionResourcesStep(runId:string,workflowId:string){'use step';return runtimeDatabase().withRun(runId,async tx=>{const [claim]=await tx<{fence:number|null}[]>`select private.claim_run(${workflowId}) fence`;if(!claim?.fence)return null;const rows=await tx<{id:string}[]>`select s.id from public.source_bindings s join public.runs r on r.workspace_id=s.workspace_id and r.connection_id=s.connection_id where r.id=${runId}::uuid order by s.id limit 11`;if(!rows.length||rows.length>10)throw new Error('RESOURCE_BOUNDARY: Bind one to ten approved resources.');return rows.map(r=>r.id);});}
async function checkResourceStep(runId:string,bindingId:string){'use step';const db=runtimeDatabase();const env=environment();if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET)throw new Error('GOOGLE_CONFIGURATION_REQUIRED');const row=await db.withRun(runId,async tx=>(await tx<{connection_id:string;identity:string;operations:string[];resource_type:string;resource_id:string;range_name:string|null;mapping:Record<string,unknown>;time_zone:string}[]>`select c.id connection_id,c.identity,c.operations,s.resource_type,s.resource_id,s.range_name,s.mapping,w.time_zone from public.runs r join public.connections c on c.id=r.connection_id and c.workspace_id=r.workspace_id join public.source_bindings s on s.connection_id=c.id and s.workspace_id=c.workspace_id join public.workspaces w on w.id=r.workspace_id where r.id=${runId}::uuid and s.id=${bindingId}::uuid`)[0]);if(!row)throw new Error('RESOURCE_BINDING_DENIED');
 const google=createGoogleConnector({binding:{connectionId:row.connection_id,identity:row.identity,enrolledThreadIds:[],...(row.resource_type==='sheet'?{sheet:{fileId:row.resource_id,range:z.string().min(1).parse(row.range_name)}}:{}),...(row.resource_type==='calendar'?{calendarId:row.resource_id}:{})},secrets:createVaultSecretStore(db,runId),clientId:env.GOOGLE_CLIENT_ID,clientSecret:env.GOOGLE_CLIENT_SECRET});let operation='';
 if(row.resource_type==='sheet'){const result=await google.readSheet();const columns=z.record(z.string(),z.string()).parse(row.mapping.columns??{});const normalized=normalizeSheetRows(result.values,columns);await db.withRun(runId,async tx=>{await tx`select private.ingest_sheet_rows(${bindingId}::uuid,${JSON.stringify(normalized)}::jsonb)`;await tx`select private.refresh_current_findings()`;});operation='sheets.read_and_ingest';}
 else if(row.resource_type==='calendar'){const start=new Date().toISOString();await google.freeBusy(start,new Date(Date.now()+3600000).toISOString(),row.time_zone);operation='calendar.freebusy';}
 else if(row.resource_type==='mailbox'){if(row.resource_id.toLowerCase()!==row.identity.toLowerCase())throw new Error('MAILBOX_IDENTITY_MISMATCH');await google.pollHistory({});operation='gmail.read';}
 else throw new Error('RESOURCE_TYPE_UNSUPPORTED');
 return {bindingId,operation,observedAt:new Date().toISOString()};
}
async function recordConnectionCheckStep(runId:string,checks:{bindingId:string;operation:string;observedAt:string}[]){'use step';await runtimeDatabase().withRun(runId,async tx=>{const [run]=await tx<{connection_id:string}[]>`select connection_id from public.runs where id=${runId}::uuid`;await tx`select private.record_connection_check(${run.connection_id}::uuid,${JSON.stringify({verifiedResourceIds:checks.map(c=>c.bindingId),checks,externalWritesVerified:false})}::jsonb)`;});}
async function connectionFailureStep(runId:string){'use step';await runtimeDatabase().withRun(runId,async tx=>{await tx`select private.block_run('Connection resource read check failed. Verify grants, file selection, mapping and calendar permissions. No external writes were attempted.')`;});}
