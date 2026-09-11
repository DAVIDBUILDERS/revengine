import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {runtimeDatabase} from '../../../packages/orchestration/src/database';
import {boundGoogle,executeCheckedAction,reconcileCheckedAction} from '../../../packages/orchestration/src/action-service';
import {actionHash,classifyReply} from '../../../packages/domain/src/index';
import {ActionProposal,ProposalRecord} from '../../../packages/contracts/src/index';
import {WebsiteContext} from '../../../packages/agents/src/index';
import {runPreparation,createDatabasePreparationStore,configuredPreparationModel} from '../../../packages/orchestration/src/model-budget';
import {inboundSince} from '../../../packages/orchestration/src/provider-evidence';
import {GmailCursor} from '../../../packages/connectors/src/index';

export async function claimRunStep(runId:string,workflowId:string){'use step';z.uuid().parse(runId);return runtimeDatabase().withRun(runId,async tx=>{const [claimed]=await tx<{fence:number|null}[]>`select private.claim_run(${workflowId}) as fence`;if(!claimed?.fence)return null;await tx`update public.runs set deployment_id=${process.env.VERCEL_DEPLOYMENT_ID??'local-workflow-unverified'} where id=${runId}::uuid`;const [input]=await tx<{kind:string;payload:Record<string,unknown>}[]>`select * from private.run_input()`;if(!input)throw new Error('WORKFLOW_INPUT_MISSING');return {kind:input.kind};});}
export async function prepareActionStep(runId:string){'use step';return runtimeDatabase().withRun(runId,async tx=>{
 const [old]=await tx<{id:string;expires_at:Date}[]>`select id,expires_at from public.actions where run_id=${runId}::uuid order by created_at limit 1`;if(old)return {actionId:old.id,expiresAt:old.expires_at.toISOString()};
 const [job]=await tx<{kind:string;payload:Record<string,unknown>}[]>`select * from private.run_input()`;const proposalId=z.uuid().parse(job.payload.proposalId);
 const [data]=await tx<{p:Record<string,unknown>;email:string;workspace_id:string;installation_id:string;policy_id:string|null;policy_version:number;bounds:Record<string,unknown>;time_zone:string}[]>`select row_to_json(p) p,c.email,r.workspace_id,r.installation_id,i.policy_id,pol.version policy_version,pol.bounds,w.time_zone from public.runs r join public.installations i on i.id=r.installation_id join public.policies pol on pol.id=i.policy_id and pol.workspace_id=r.workspace_id join public.workspaces w on w.id=r.workspace_id join public.proposals p on p.id=${proposalId}::uuid and p.workspace_id=r.workspace_id join public.contacts c on c.id=p.contact_id and c.workspace_id=r.workspace_id where r.id=${runId}::uuid`;
 if(!data?.policy_id)throw new Error('POLICY_REQUIRED');const p=data.p;const status=ProposalRecord.shape.status.parse(p.status);if(status!=='open'||p.fixture)throw new Error('PROPOSAL_NOT_ELIGIBLE');
 await tx`select private.ensure_proposal_conversation(${proposalId}::uuid)`;
 const now=new Date().toISOString();const body=`I’m following up on proposal ${String(p.reference)}.\n\n${String(p.scope_summary)}\n\nWhat questions can we help answer?`;
 const payload:ActionProposal['payload']={recipient:data.email,subject:`Following up on ${String(p.reference)}`,body,proposalVersion:Number(p.version)};
 if(job.kind==='book'){
  const start=z.iso.datetime().parse(job.payload.startAt);const timeZone=z.string().parse(job.payload.timeZone);if(timeZone!==data.time_zone)throw new Error('SCHEDULING_TIME_ZONE_REVIEW');const duration=z.number().int().min(15).max(120).parse(data.bounds.meetingMinutes);const calendarId=z.string().min(1).parse(data.bounds.calendarId);const [conversation]=await tx`select id from public.conversations where contact_id=${String(p.contact_id)}::uuid and active and reply_class='positive' and not takeover and booked_at is null`;if(!conversation)throw new Error('SCHEDULING_HANDOFF_REQUIRED');
  Object.assign(payload,{subject:`Proposal conversation · ${String(p.reference)}`,body:'Sales conversation requested in the reviewed proposal thread.',startAt:start,endAt:new Date(Date.parse(start)+duration*60000).toISOString(),timeZone,calendarId});
 }
 const reservedCostMinor=z.number().int().min(0).max(100000).parse(data.bounds.reservedCostMinor);
 const action=ActionProposal.parse({schemaVersion:1,id:randomUUID(),workspaceId:data.workspace_id,installationId:data.installation_id,runId,contactId:p.contact_id,proposalId,type:job.kind==='book'?'book_appointment':'send_follow_up',payload,payloadHash:'pending',evidence:[],approvalId:null,reservedCostMinor,status:'not_attempted',createdAt:now,expiresAt:new Date(Date.now()+86400000).toISOString()});action.payloadHash=await actionHash(action,data.policy_version);
 const [created]=await tx<{id:string}[]>`select private.create_action(${action.id}::uuid,${action.contactId}::uuid,${proposalId}::uuid,${action.type},${JSON.stringify(action.payload)}::jsonb,${action.payloadHash},${data.policy_id}::uuid,${action.reservedCostMinor},${action.expiresAt}::timestamptz) id`;
 return {actionId:created.id,expiresAt:action.expiresAt};
});}
export async function registerWaitStep(runId:string,actionId:string,token:string,expiresAt:string){'use step';await runtimeDatabase().withRun(runId,async tx=>{await tx`select private.register_wait(${actionId}::uuid,${token},${expiresAt}::timestamptz)`;});return {registered:true};}
export async function decisionStep(runId:string,actionId:string){'use step';return runtimeDatabase().withRun(runId,async tx=>{const [row]=await tx<{authority:string}[]>`select private.action_authority(${actionId}::uuid) authority`;return row?.authority??'missing';});}
export async function finishWaitStep(runId:string,actionId:string){'use step';await runtimeDatabase().withRun(runId,async tx=>{await tx`select private.complete_hook(${actionId}::uuid)`;});}
export async function executeActionStep(runId:string,actionId:string,reconcile=false){'use step';const db=runtimeDatabase();return reconcile?reconcileCheckedAction(db,runId,actionId):executeCheckedAction(db,runId,actionId);}
executeActionStep.maxRetries=0;
export async function blockStep(runId:string,reason:string){'use step';await runtimeDatabase().withRun(runId,async tx=>{await tx`select private.block_run(${reason})`;});}
export async function prepareArtifactStep(runId:string){'use step';
 const db=runtimeDatabase();
 const input=await db.withRun(runId,async tx=>{
  const [job]=await tx<{kind:string;payload:Record<string,unknown>}[]>`select * from private.run_input()`;
  const [context]=await tx<{payload:unknown}[]>`select payload from public.product_records where kind='company_context' order by created_at desc limit 1`;
  const [run]=await tx<{workspace_id:string}[]>`select workspace_id from public.runs where id=${runId}::uuid`;
  return {job,context,workspaceId:run.workspace_id};
 });
 const company=z.object({context:WebsiteContext}).passthrough().parse(input.context?.payload).context;
 const agentId=z.string().parse(input.job.payload.agentId);
 // Model configuration is read only inside this bounded step; no credentials or full output leave it.
 const model=agentId==='technical-seo-monitor'?undefined:{prepare:async(args:Parameters<ReturnType<typeof configuredPreparationModel>['prepare']>[0])=>configuredPreparationModel(db,runId,process.env).prepare(args)};
 return runPreparation({runId,workspaceId:input.workspaceId,agentId,company},createDatabasePreparationStore(db,runId),model);
}
prepareArtifactStep.maxRetries=0;
export async function pollReplyStep(runId:string){'use step';
 const db=runtimeDatabase();const google=await boundGoogle(db,runId);
 const input=await db.withRun(runId,async tx=>{
  const [stored]=await tx<{cursor:unknown}[]>`select private.gmail_cursor() cursor`;
  const conversations=await tx<{contact_id:string;provider_thread_id:string;issued_at:Date|null}[]>`select cv.contact_id,cv.provider_thread_id,source.issued_at from public.conversations cv join public.contacts ct on ct.workspace_id=cv.workspace_id and ct.id=cv.contact_id left join lateral (select p.issued_at from public.actions a join public.proposals p on p.workspace_id=a.workspace_id and p.id=a.proposal_id where a.run_id=cv.run_id and a.workspace_id=cv.workspace_id order by a.created_at desc limit 1) source on true where cv.connection_id=${google.binding.connectionId}::uuid and cv.active and ct.enrolled and cv.provider_thread_id is not null limit 501`;
  if(conversations.length>500||conversations.some(c=>!c.issued_at))throw new Error('REPLY_COVERAGE_BASELINE_REQUIRED: Bind each enrolled conversation to its authoritative proposal before advancing the shared mailbox cursor.');
  return{cursor:GmailCursor.parse(stored?.cursor??{}),conversations};
 });
 const page=await google.pollHistory(input.cursor);
 const replies=input.conversations.flatMap(conversation=>inboundSince(page.messages.filter(m=>m.threadId===conversation.provider_thread_id),google.binding.identity,conversation.issued_at!.toISOString()).map(message=>({message,contactId:conversation.contact_id}))).sort((a,b)=>Date.parse(a.message.receivedAt!)-Date.parse(b.message.receivedAt!));
 const observed=await db.withRun(runId,async tx=>{
  let count=0;
  for(const {message,contactId} of replies){const classification=message.headers['auto-submitted']&&message.headers['auto-submitted']!=='no'?'automatic':classifyReply(message.text);const [result]=await tx<{added:boolean}[]>`select private.record_reply(${google.binding.connectionId}::uuid,${contactId}::uuid,${message.id},${message.receivedAt}::timestamptz,${classification},${message.text.slice(0,1000)}) added`;if(result?.added)count++;}
  const [checkpoint]=await tx<{saved:boolean}[]>`select private.checkpoint_gmail(${JSON.stringify(input.cursor)}::jsonb,${JSON.stringify(page.cursor)}::jsonb) saved`;
  if(!checkpoint?.saved)throw new Error('GMAIL_CURSOR_CONCURRENT_CHANGE: Another authorized poll committed first; retry from its checkpoint.');
  if(page.complete)await tx`select private.mark_connection_synced(${google.binding.connectionId}::uuid)`;
  await tx`select private.refresh_current_findings()`;
  await tx`update public.runs set next_due_at=now()+interval '5 minutes' where id=${runId}::uuid and status='waiting_for_reply'`;
  return count;
 });
 return{observedReplies:observed,complete:page.complete,recoveredExpiredHistory:page.recoveredExpiredHistory};
}
