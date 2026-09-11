import {start,resumeHook} from 'workflow/api';
import {z} from 'zod';
import {workflowRoute} from '../../../../../packages/orchestration/src/workflow-routing';
import {connectionCheckV1} from '../../../workflows/source-check-v1';
import {proposalV1,actionV1,reconcileSourceV1} from '../../../workflows/proposal-v1';
import {runtimeDatabase} from '../../../../../packages/orchestration/src/database';
import {apiError,json,verifyCron} from '../../../lib/http';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(request:Request){try{verifyCron(request);const db=runtimeDatabase();const claims=await db.claimDue(10);let dispatched=0;let deferred=0;
 for(const claim of claims){try{
  const metadata=await db.withRun(claim.run_id,async tx=>(await tx<{status:string;definition_version:string;sdk_version:string}[]>`select status,definition_version,sdk_version from public.runs where id=${claim.run_id}::uuid`)[0]);
  if(!metadata)throw new Error('WORKFLOW_RUN_MISSING');
  const route=workflowRoute(metadata.definition_version,metadata.sdk_version);
  if(claim.event_type==='approval_decided'){
   const actionId=z.uuid().parse(claim.payload.action_id);const wait=await db.withRun(claim.run_id,async tx=>(await tx<{hook_token:string;decision:string}[]>`select * from private.pending_hook(${actionId}::uuid)`)[0]);
   if(!wait){await db.retryDispatch(claim.outbox_id,claim.lease_token,'Approval saved; waiting for hook registration or expiry review.');deferred++;continue;}
   await resumeHook(wait.hook_token,{decisionSaved:true});await db.withRun(claim.run_id,async tx=>{await tx`select private.complete_hook(${actionId}::uuid)`;});await db.finishDispatch(claim.outbox_id,claim.lease_token,null);
  }else if(claim.event_type==='action_dispatch'||claim.event_type==='action_reconcile'){
   if(route!=='proposal')throw new Error('WORKFLOW_EVENT_MISMATCH');
   const run=await start(actionV1,[claim.run_id,z.uuid().parse(claim.payload.action_id),claim.event_type==='action_reconcile']);await db.finishDispatch(claim.outbox_id,claim.lease_token,run.runId);
  }else if(claim.event_type==='connection_check'){
   if(route!=='connection-check')throw new Error('WORKFLOW_EVENT_MISMATCH');
   const run=await start(connectionCheckV1,[claim.run_id]);await db.finishDispatch(claim.outbox_id,claim.lease_token,run.runId);
  }else if(claim.event_type==='run_due'){
   if(route!=='proposal')throw new Error('WORKFLOW_EVENT_MISMATCH');
   const run=metadata.status==='waiting_for_reply'?await start(reconcileSourceV1,[claim.run_id]):await start(proposalV1,[claim.run_id]);await db.finishDispatch(claim.outbox_id,claim.lease_token,run.runId);
  }else{await db.retryDispatch(claim.outbox_id,claim.lease_token,'Unknown outbox version/event. Operator review required.');deferred++;continue;}
  dispatched++;
 }catch{await db.retryDispatch(claim.outbox_id,claim.lease_token,'Dispatch/resume unavailable or uncertain; retry from persisted record.');deferred++;}}
 return json({claimed:claims.length,dispatched,deferred,meaning:'Workflow starts are not completed business actions.'});}catch(error){return apiError(error);}}
