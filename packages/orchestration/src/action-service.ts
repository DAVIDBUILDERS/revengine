import {z} from 'zod';
import {ActionProposal} from '../../contracts/src/index';
import {actionHash,classifyReply} from '../../domain/src/index';
import {createVaultSecretStore,type Database} from '../../db/src/index';
import {createGoogleConnector,type GoogleConnector,GoogleError,createInstantlyClient,parseInstantlyAccounts,requireInstantlySubWorkspace,InstantlyError} from '../../connectors/src/index';
import {executeGoogleWrite} from '../../connectors/src/internal/provider-writes';
import {executeInstantlyWrite} from '../../connectors/src/internal/instantly-writes';
import {environment} from './environment';
import {chooseBoundResource,inboundSince,validateCriticalSheet,type ApprovedSourceSnapshot} from './provider-evidence';

type ActionRow={id:string;workspace_id:string;installation_id:string;run_id:string;contact_id:string;proposal_id:string;type:string;payload:unknown;source_snapshot:ApprovedSourceSnapshot;payload_hash:string;reserved_cost_minor:string|number;status:string;created_at:Date|string;expires_at:Date|string;claim_token:string|null;fence:string|number;policy_version:number};
const iso=(value:Date|string)=>new Date(value).toISOString();
export async function loadAction(database:Database,runId:string,actionId:string){
 return database.withRun(runId,async tx=>{
  const [row]=await tx<ActionRow[]>`select a.*,p.version as policy_version from public.actions a join public.policies p on p.workspace_id=a.workspace_id and p.id=a.policy_id where a.id=${actionId}::uuid and a.run_id=${runId}::uuid`;
  if(!row)throw new Error('ACTION_NOT_FOUND');
  const action=ActionProposal.parse({schemaVersion:1,id:row.id,workspaceId:row.workspace_id,installationId:row.installation_id,runId:row.run_id,contactId:row.contact_id,proposalId:row.proposal_id,type:row.type,payload:row.payload,payloadHash:row.payload_hash,evidence:[],approvalId:null,reservedCostMinor:Number(row.reserved_cost_minor),status:row.status,createdAt:iso(row.created_at),expiresAt:iso(row.expires_at)});
  return {action,row};
 });
}
export async function boundGoogle(database:Database,runId:string,action?:ActionProposal):Promise<GoogleConnector>{
 const env=environment();if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET)throw new Error('GOOGLE_UNCONFIGURED: OAuth client credentials are missing.');
 const data=await database.withRun(runId,async tx=>{
  const [connection]=await tx<{id:string;identity:string}[]>`select c.id,c.identity from public.runs r join public.connections c on c.id=r.connection_id and c.workspace_id=r.workspace_id where r.id=${runId}::uuid and c.health not in ('revoked','expired')`;
  if(!connection)throw new Error('GOOGLE_CONNECTION_MISSING: This run has no verified connection binding.');
  const bindings=await tx<{resource_type:string;resource_id:string;range_name:string|null}[]>`select resource_type,resource_id,range_name from public.source_bindings where connection_id=${connection.id}::uuid`;
  const threads=await tx<{provider_thread_id:string}[]>`select cv.provider_thread_id from public.conversations cv join public.contacts ct on ct.workspace_id=cv.workspace_id and ct.id=cv.contact_id where cv.connection_id=${connection.id}::uuid and cv.provider_thread_id is not null and cv.active and ct.enrolled`;
  const [job]=await tx<{payload:Record<string,unknown>}[]>`select payload from private.run_input()`;
  const proposalId=action?.proposalId??job?.payload.proposalId;
  const [source]=proposalId?await tx<{resource_id:string;connection_id:string;range_name:string|null}[]>`select s.resource_id,s.connection_id,s.range_name from public.proposals p join public.source_bindings s on s.workspace_id=p.workspace_id and s.id=p.source_binding_id where p.id=${String(proposalId)}::uuid`:[];
  if(source&&source.connection_id!==connection.id)throw new Error('SOURCE_CONNECTION_MISMATCH');
  const [policy]=await tx<{bounds:Record<string,unknown>}[]>`select p.bounds from public.runs r join public.installations i on i.id=r.installation_id and i.workspace_id=r.workspace_id join public.policies p on p.id=i.policy_id and p.workspace_id=r.workspace_id where r.id=${runId}::uuid`;
  return {connection,bindings,threads,source,calendarId:action?.payload.calendarId??(typeof policy?.bounds.calendarId==='string'?policy.bounds.calendarId:undefined)};
 });
 const sheet=chooseBoundResource(data.bindings,'sheet',data.source?.resource_id);const calendar=data.calendarId?chooseBoundResource(data.bindings,'calendar',data.calendarId):undefined;
 if(sheet&&data.source&&sheet.range_name!==data.source.range_name)throw new Error('SOURCE_RANGE_MISMATCH');
 return createGoogleConnector({binding:{connectionId:data.connection.id,identity:data.connection.identity,...(sheet?.range_name?{sheet:{fileId:sheet.resource_id,range:sheet.range_name}}:{}),...(calendar?{calendarId:calendar.resource_id}:{}),enrolledThreadIds:data.threads.map(t=>t.provider_thread_id)},secrets:createVaultSecretStore(database,runId),clientId:env.GOOGLE_CLIENT_ID,clientSecret:env.GOOGLE_CLIENT_SECRET});
}
async function refreshCriticalState(database:Database,runId:string,action:ActionProposal,google:GoogleConnector,sourceSnapshot:ApprovedSourceSnapshot){
 const binding=await database.withRun(runId,async tx=>{
  const [record]=await tx<{source_key:string;status:string;version:number;source_verified_at:string;issued_at:string;resource_id:string;range_name:string|null;mapping:Record<string,unknown>;resource_type:string;provider_thread_id:string|null;replied_at:Date|null}[]>`select p.source_key,p.status,p.version,p.source_verified_at,p.issued_at,s.resource_id,s.range_name,s.mapping,s.resource_type,c.provider_thread_id,c.replied_at from public.proposals p join public.source_bindings s on s.workspace_id=p.workspace_id and s.id=p.source_binding_id left join public.conversations c on c.workspace_id=p.workspace_id and c.contact_id=p.contact_id and c.active where p.id=${action.proposalId}::uuid`;
  if(!record)throw new Error('SOURCE_BINDING_REQUIRED');return record;
 });
 if(binding.resource_type!=='sheet'||!google.binding.sheet||google.binding.sheet.fileId!==binding.resource_id||google.binding.sheet.range!==binding.range_name)throw new Error('SOURCE_FRESHNESS_UNVERIFIED: Live dispatch requires current authoritative Sheet state. A CSV needs a separately approved fresh batch and reply coverage.');
 const sheet=await google.readSheet();const mapping=z.record(z.string(),z.string()).parse(binding.mapping.columns??{});
 let current:ReturnType<typeof validateCriticalSheet>;
 try{current=validateCriticalSheet(sheet.values,mapping,sourceSnapshot,action.payload.recipient);}catch(error){
  await database.withRun(runId,async tx=>{await tx`select private.invalidate_action(${action.id}::uuid,'Source material change or mapping drift requires a new review')`;});throw error;
 }
 await database.withRun(runId,async tx=>{await tx`update public.proposals set status=${current.status},raw_status=${current.status},source_verified_at=${current.verifiedAt}::timestamptz,synced_at=now() where id=${action.proposalId}::uuid`;});
 if(current.status!=='open'){await database.withRun(runId,async tx=>{await tx`select private.invalidate_action(${action.id}::uuid,'Proposal status is no longer open')`;});throw new Error('SOURCE_STATUS_STOPPED: Current proposal is no longer open.');}
 if(!binding.provider_thread_id)throw new Error('REPLY_COVERAGE_MISSING: Bind the enrolled proposal conversation before any outbound action.');
 const messages=await google.readThread(binding.provider_thread_id);
 const inbound=inboundSince(messages,google.binding.identity,iso(binding.issued_at));
 for(const message of inbound){
  const classification=message.headers['auto-submitted']&&message.headers['auto-submitted']!=='no'?'automatic':classifyReply(message.text);
  await database.withRun(runId,async tx=>{await tx`select private.record_reply(${google.binding.connectionId}::uuid,${action.contactId}::uuid,${message.id},${message.receivedAt}::timestamptz,${classification},${message.text.slice(0,1000)})`;});
 }
 if(action.type==='book_appointment'&&inbound.some(message=>Date.parse(message.receivedAt!)>=Date.parse(action.createdAt)))throw new Error('SCHEDULING_REPLY_CHANGED: A new reply arrived after this booking draft; review timing and intent before another approval.');
 if(action.type==='send_follow_up'&&(inbound.length||binding.replied_at))throw new Error('REPLY_RECEIVED: Further follow-up stopped; the assigned operator must review the reply.');
 await database.withRun(runId,async tx=>{await tx`select private.mark_connection_synced(${google.binding.connectionId}::uuid)`;});
}
export async function executeCheckedAction(database:Database,runId:string,actionId:string){
 const env=environment();
 if(env.DAVID_MODE!=='live'||env.DAVID_LIVE_EXECUTION!=='true')throw new Error('LIVE_EXECUTION_DISABLED: Shadow mode prepares work but never contacts customers.');
 const {action,row}=await loadAction(database,runId,actionId);
 if(['provider_accepted','confirmed','failed'].includes(action.status))return {actionId,status:action.status};
 const google=await boundGoogle(database,runId,action);
 if(action.status==='submitting'||action.status==='uncertain')return reconcileCheckedAction(database,runId,actionId,google);
 if(await actionHash(action,row.policy_version)!==action.payloadHash)throw new Error('APPROVAL_PAYLOAD_CHANGED: Create a new exact-content approval.');
 await refreshCriticalState(database,runId,action,google,row.source_snapshot);
 const claim=await database.withRun(runId,async tx=>(await tx<{claim_token:string;fence:number}[]>`select * from private.reserve_action(${actionId}::uuid)`)[0]);
 if(!claim)throw new Error('ACTION_NOT_READY: Current authority, cohort, ownership, capacity or source gates failed.');
 try{
  await refreshCriticalState(database,runId,action,google,row.source_snapshot);
  if(action.type==='book_appointment'){
   const [policy]=await database.withRun(runId,async tx=>await tx<{bounds:Record<string,unknown>}[]>`select p.bounds from public.actions a join public.policies p on p.id=a.policy_id and p.workspace_id=a.workspace_id where a.id=${actionId}::uuid`);
   const buffer=z.number().int().min(0).max(120).parse(policy?.bounds.bufferMinutes)*60000;
   const start=new Date(Date.parse(z.iso.datetime().parse(action.payload.startAt))-buffer).toISOString();
   const end=new Date(Date.parse(z.iso.datetime().parse(action.payload.endAt))+buffer).toISOString();
   if((await google.freeBusy(start,end,z.string().parse(action.payload.timeZone))).some(slot=>Date.parse(slot.start)<Date.parse(end)&&Date.parse(slot.end)>Date.parse(start)))throw new Error('CALENDAR_BUFFER_UNAVAILABLE: Review a time with the required calendar buffer.');
  }
 }catch(error){await database.withRun(runId,async tx=>{await tx`select private.release_action_reservation(${actionId}::uuid,${claim.claim_token}::uuid,${claim.fence})`;});throw error;}
 const submitting=await database.withRun(runId,async tx=>(await tx<{allowed:boolean}[]>`select private.mark_submitting(${actionId}::uuid,${claim.claim_token}::uuid,${claim.fence}) as allowed`)[0]?.allowed);
 if(!submitting){await database.withRun(runId,async tx=>{await tx`select private.release_action_reservation(${actionId}::uuid,${claim.claim_token}::uuid,${claim.fence})`;});throw new Error('ACTION_STOPPED: Policy, pause, source, suppression or ownership changed immediately before dispatch.');}
 try{
  const conversation=await database.withRun(runId,async tx=>(await tx<{provider_thread_id:string}[]>`select provider_thread_id from public.conversations where run_id=${runId}::uuid and contact_id=${action.contactId}::uuid and active`)[0]);
  const result=await executeGoogleWrite(google,action.type==='send_follow_up'?{type:'send_follow_up',actionId,recipient:action.payload.recipient,subject:action.payload.subject,body:action.payload.body,threadId:conversation?.provider_thread_id}:{type:'book_appointment',actionId,recipient:action.payload.recipient,summary:action.payload.subject,startAt:z.iso.datetime().parse(action.payload.startAt),endAt:z.iso.datetime().parse(action.payload.endAt),timeZone:z.string().parse(action.payload.timeZone)});
  await database.withRun(runId,async tx=>{await tx`select private.record_receipt(${actionId}::uuid,${claim.claim_token}::uuid,${claim.fence},${result.status},'google',${result.providerId},${result.status==='confirmed'?'Calendar confirms the booking; attendance remains unknown.':'Gmail accepted the message; recipient delivery is unverified.'},${action.reservedCostMinor})`;await tx`select private.complete_action_evidence(${actionId}::uuid,${result.providerId},${result.threadId??null})`;});
  return {actionId,status:result.status};
 }catch(error){
  const definiteRejection=error instanceof GoogleError&&!error.uncertain&&error.status!==null&&error.status>=400&&error.status<500;
  const status=definiteRejection?'failed':'uncertain';
  // This also handles failure persisting an already accepted provider result. NEVER retry the write here.
  await database.withRun(runId,async tx=>{await tx`select private.record_receipt(${actionId}::uuid,${claim.claim_token}::uuid,${claim.fence},${status},'google',null,${status==='uncertain'?'Acceptance is uncertain. Keep the contact reserved and reconcile provider evidence.':'Provider rejected this request. Assigned operator review required.'},0)`;});
  return {actionId,status};
 }
}
export async function reconcileCheckedAction(database:Database,runId:string,actionId:string,existing?:GoogleConnector){
 const {action,row}=await loadAction(database,runId,actionId);if(!['uncertain','submitting'].includes(action.status))return {actionId,status:action.status};
 const google=existing??await boundGoogle(database,runId,action);let providerId:string|null=null;
 if(action.type==='send_follow_up'){const found=await google.reconcileSent(actionId);if(found.status==='found')providerId=found.providerId;}
 else{const event=await google.readCalendarEvent(actionId);if(event?.status==='confirmed'&&event.actionId===actionId&&event.attendees?.includes(action.payload.recipient.toLowerCase())&&event.start&&event.end&&Date.parse(event.start)===Date.parse(action.payload.startAt??'')&&Date.parse(event.end)===Date.parse(action.payload.endAt??''))providerId=event.id;}
 if(!providerId)return {actionId,status:'uncertain',nextStep:'Provider evidence remains inconclusive. Operator review; no automatic resend.'};
 const status=action.type==='book_appointment'?'confirmed':'provider_accepted';
 await database.withRun(runId,async tx=>{await tx`select private.record_receipt(${actionId}::uuid,${row.claim_token}::uuid,${Number(row.fence)},${status},'google',${providerId},'Reconciled retained provider evidence without another external write.',${action.reservedCostMinor})`;await tx`select private.complete_action_evidence(${actionId}::uuid,${providerId},null)`;});
 return {actionId,status};
}

export type InstantlyLaunchInput = {
 name:string;
 dailyLimit:number;
 sequence:{subject:string;body:string}[];
 leads:{email:string;firstName?:string;lastName?:string;company?:string;title?:string;website?:string;custom?:Record<string,string>}[];
 campaignId?:string|null;
 instantlyWorkspaceId:string;
};

export async function launchManagedInstantlyCampaign(input:InstantlyLaunchInput,fetchImpl?:typeof fetch){
 const env=environment();
 if(env.DAVID_MODE==='fixture')throw new InstantlyError('fixture_denied','Instantly credentials are denied in fixture mode.');
 if(env.DAVID_LIVE_EXECUTION!=='true'||env.DAVID_MODE!=='live')throw new InstantlyError('live_disabled','Live Instantly send is disabled until production live execution is enabled.');
 if(!env.INSTANTLY_API_KEY)throw new InstantlyError('unconfigured','INSTANTLY_API_KEY is required for DAVID-managed Instantly.');
 const asWorkspace=requireInstantlySubWorkspace(input.instantlyWorkspaceId);
 const client=createInstantlyClient({apiKey:env.INSTANTLY_API_KEY,asWorkspace,fetch:fetchImpl});
 const accounts=parseInstantlyAccounts(await client.listAccounts());
 const ready=accounts.filter(account=>account.warmupReady);
 if(!ready.length)throw new InstantlyError('warmup_unhealthy','Wait until Instantly warmup is healthy. Cold inboxes do not send.');
 if(input.campaignId){
  const resumed=await executeInstantlyWrite(env.INSTANTLY_API_KEY,asWorkspace,{type:'resume_campaign',campaignId:input.campaignId},fetchImpl);
  return {campaignId:resumed.campaignId,status:resumed.status,sendingAccounts:ready,warmupReady:true};
 }
 const launched=await executeInstantlyWrite(env.INSTANTLY_API_KEY,asWorkspace,{
  type:'launch_campaign',
  campaign:{name:input.name,dailyLimit:input.dailyLimit,senderEmails:ready.map(account=>account.email),steps:input.sequence},
  leads:input.leads.map(lead=>({
   email:lead.email,
   first_name:lead.firstName,
   last_name:lead.lastName,
   company_name:lead.company,
   website:lead.website,
   custom_variables:{...(lead.title?{title:lead.title}:{}),...(lead.custom??{})},
  })),
 },fetchImpl);
 return {campaignId:launched.campaignId,status:launched.status,sendingAccounts:ready,warmupReady:true};
}

export async function pauseManagedInstantlyCampaign(campaignId:string,instantlyWorkspaceId:string,fetchImpl?:typeof fetch){
 const env=environment();
 if(env.DAVID_MODE==='fixture')throw new InstantlyError('fixture_denied','Instantly credentials are denied in fixture mode.');
 if(!env.INSTANTLY_API_KEY)throw new InstantlyError('unconfigured','INSTANTLY_API_KEY is required for DAVID-managed Instantly.');
 return executeInstantlyWrite(env.INSTANTLY_API_KEY,requireInstantlySubWorkspace(instantlyWorkspaceId),{type:'pause_campaign',campaignId},fetchImpl);
}
