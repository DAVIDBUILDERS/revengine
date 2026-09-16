import {buildPreparedSetup,validateSetupAcceptance} from '../../../packages/domain/src/prepared-setup';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {z} from 'zod';
import * as C from '../../../packages/contracts/src/index';
import {catalog,recommendationFor,ALWAYS_ON_AGENT_ID} from '../../../packages/agents/src/index';
import {parseCsvImport,forecastCases,parseLeadCsv,mappedLeadRow,generateOutboundSequence,companyFromSnapshot,emptyOutboundSdr} from '../../../packages/domain/src/index';
import {launchManagedInstantlyCampaign,pauseManagedInstantlyCampaign} from '../../../packages/orchestration/src/action-service';
import {authClient,authorize} from './auth';
import {HttpError} from './http';
import {environment} from '../../../packages/orchestration/src/environment';
import {preparationModelConfig} from '../../../packages/orchestration/src/model-budget';

type Row=Record<string,unknown>;
const text=(r:Row,k:string)=>String(r[k]??'');
const number=(r:Row,k:string)=>r[k]===null||r[k]===undefined?null:Number(r[k]);
const date=(r:Row,k:string)=>r[k]?new Date(String(r[k])).toISOString():null;
async function selectedWorkspace(requested:string|null){if(requested)return C.Id.parse(requested);const client=await authClient();const {data,error}=await client.auth.getClaims();if(error||!data?.claims?.sub)throw new HttpError(401,'AUTH_REQUIRED','Sign in with your invited DAVID account.');const {data:members}=await client.from('memberships').select('workspace_id').eq('actor_id',data.claims.sub).eq('active',true).limit(1);if(!members?.[0])throw new HttpError(403,'WORKSPACE_UNASSIGNED','Your account has no active workspace assignment. Ask your workspace owner for an invitation.');return String(members[0].workspace_id);}
export async function operationalSnapshot(requested:string|null):Promise<C.AppSnapshot>{
 const workspaceId=await selectedWorkspace(requested);const {client,context}=await authorize(workspaceId);const asOf=new Date().toISOString();
 const names=['workspaces','accounts','contacts','opportunities','proposals','evidence','installations','connections','source_bindings','actions','approvals','receipts','outcomes','prepared_artifacts','product_records','usage_records','audit_events','runs','policies','conversations','outbound_campaigns','outbound_leads','outbound_events'] as const;
 const pairs=await Promise.all(names.map(async name=>{let query=client.from(name).select('*');query=name==='workspaces'?query.eq('id',workspaceId):query.eq('workspace_id',workspaceId);const {data,error}=await query.limit(201);if(error)throw new HttpError(503,'SCHEMA_OR_ACCESS_UNAVAILABLE',`Unable to read ${name}. Verify migrations and membership policies in the intended Supabase project.`);return [name,(data??[]) as Row[]] as const;}));
 const rows=Object.fromEntries(pairs) as Record<(typeof names)[number],Row[]>;const w=rows.workspaces[0];if(!w)throw new HttpError(404,'WORKSPACE_NOT_FOUND','The workspace is unavailable.');
 const ev=rows.evidence.map(r=>C.EvidenceRef.parse({id:r.id,label:r.label,source:r.source,capturedAt:date(r,'captured_at'),quality:r.quality,...(r.url?{url:r.url}:{})}));
 const sourceEvidence=(binding:unknown)=>rows.evidence.filter(e=>e.source_binding_id===binding).flatMap(e=>ev.filter(v=>v.id===e.id));
 const product=<T>(kind:string,schema:z.ZodType<T>):T[]=>rows.product_records.filter(r=>r.kind===kind).map(r=>schema.parse(r.payload));
 const recommendation=product('team_recommendation',C.TeamRecommendation).at(-1)??recommendationFor(randomUUID(),workspaceId,'Recover eligible proposals and coordinate sales conversations',C.BusinessModel.parse(w.business_model));
 const installations=rows.installations.map(r=>C.AgentInstallation.parse({id:r.id,workspaceId,agentId:r.agent_id,definitionVersion:r.definition_version,mode:r.mode,status:r.status,sourceMappings:[],policyVersion:rows.policies.find(p=>p.id===r.policy_id)?.version??1,dailyCapacity:r.daily_capacity,lastPreparationAt:date(r,'last_preparation_at'),lastBusinessActionAt:date(r,'last_business_action_at'),blockers:r.policy_id?[]:['Confirmed operating policy required']}));
 const activation=product('activation_plan',C.ActivationPlan).at(-1)??C.ActivationPlan.parse({id:randomUUID(),workspaceId,selectedTeam:installations.filter(i=>i.status!=='paused').map(i=>i.agentId).slice(0,32),step:1,prerequisites:[{key:'source',label:'Confirm source and operating owner',provider:'Google Workspace',owner:'Workspace owner',unlocks:['Proposal Follow-up'],state:'missing',evidence:null,nextStep:'Bind the authoritative proposal Sheet or import a validated CSV and confirm reply coverage.'},{key:'rules',label:'Review sending rules and cohort',provider:'DAVID',owner:'DAVID operator',unlocks:['Checked external actions'],state:'missing',evidence:null,nextStep:'Confirm policy, staffing, current permissions and explicit live activation.'}],milestone:'not_started',confirmedFacts:false,owner:'Workspace owner'});
 const state:C.AppSnapshot={workspace:{entitlement:Number(w.entitlement),id:workspaceId,name:text(w,'name'),businessModel:C.BusinessModel.parse(w.business_model),timeZone:text(w,'time_zone'),mode:C.Mode.parse(w.environment),paused:Boolean(w.paused),subscriptionMinor:number(w,'subscription_minor')??500000,currency:text(w,'currency')},asOf,context,catalog,installations,recommendation,activation,
 contacts:rows.contacts.map(r=>C.ContactRecord.parse({id:r.id,workspaceId,name:r.name,email:r.email,account:rows.accounts.find(a=>a.id===r.account_id)?.name??'Unknown account',suppressed:r.suppressed,enrolled:r.enrolled,humanTakeover:r.human_takeover,owner:r.owner,lastContactAt:date(r,'last_contact_at')})),
 opportunities:rows.opportunities.map(r=>C.OpportunityRecord.parse({schemaVersion:1,id:r.id,workspaceId,contactId:r.contact_id,accountId:r.account_id,businessModel:r.business_model,owner:r.owner,stage:r.stage,rawStage:r.raw_stage,evidence:[]})),
 proposals:rows.proposals.map(r=>C.ProposalRecord.parse({schemaVersion:1,id:r.id,workspaceId,opportunityId:r.opportunity_id,contactId:r.contact_id,version:r.version,reference:r.reference,issuedAt:date(r,'issued_at'),validUntil:date(r,'valid_until'),amountMinor:number(r,'amount_minor'),currency:r.currency,valueKind:r.value_kind,scopeSummary:r.scope_summary,sourceUrl:r.source_url,status:r.status,rawStatus:r.raw_status,owner:r.owner,sourceVerifiedAt:date(r,'source_verified_at'),syncedAt:date(r,'synced_at'),evidence:sourceEvidence(r.source_binding_id),fixture:r.fixture})),
 connections:rows.connections.map(r=>C.ConnectionCapability.parse({id:r.id,workspaceId,provider:r.provider,identity:r.identity,resource:rows.source_bindings.filter(b=>b.connection_id===r.id).map(b=>b.resource_id).join(', ')||'No resource bound',scopes:r.scopes,operations:r.operations,health:r.health,lastSyncAt:date(r,'last_sync_at'),verifiedAt:date(r,'verified_at'),owner:[...new Set(rows.source_bindings.filter(b=>b.connection_id===r.id).map(b=>text(b,'source_owner')))].filter(Boolean).join(', ')||'Resource owner required',boundResources:rows.source_bindings.filter(b=>b.connection_id===r.id).map(b=>({id:b.id,type:b.resource_type,resource:b.resource_id,owner:b.source_owner,verifiedAt:date(b,'verified_at'),range:b.range_name??null})),freshnessSeconds:r.freshness_seconds})),
 actions:rows.actions.map(r=>C.ActionProposal.parse({schemaVersion:1,id:r.id,workspaceId,installationId:r.installation_id,runId:r.run_id,contactId:r.contact_id,proposalId:r.proposal_id,type:r.type,payload:r.payload,payloadHash:r.payload_hash,evidence:[],approvalId:rows.approvals.find(a=>a.action_id===r.id)?.id??null,reservedCostMinor:number(r,'reserved_cost_minor'),status:r.status,createdAt:date(r,'created_at'),expiresAt:date(r,'expires_at')})),
 approvals:rows.approvals.map(r=>C.Approval.parse({id:r.id,workspaceId,actionId:r.action_id,status:r.status,payloadHash:r.payload_hash,approverId:r.approver_id,decidedAt:date(r,'decided_at'),expiresAt:date(r,'expires_at')})),
 receipts:rows.receipts.map(r=>C.ActionReceipt.parse({id:r.id,workspaceId,actionId:r.action_id,status:r.status,provider:r.provider,providerId:r.provider_id,message:r.message,reconciliation:r.reconciliation,observedAt:date(r,'observed_at'),evidence:[]})),
 outcomes:rows.outcomes.map(r=>C.OutcomeObservation.parse({id:r.id,workspaceId,opportunityId:r.opportunity_id,metric:r.metric,metricVersion:r.metric_version,stage:r.stage,source:r.source,periodStart:date(r,'period_start'),periodEnd:date(r,'period_end'),value:number(r,'value'),valueType:r.value_type,currency:r.currency,quality:r.quality,evidence:ev.filter(e=>e.id===r.evidence_id)})),
 artifacts:rows.prepared_artifacts.map(r=>C.PreparedArtifact.parse({id:r.id,workspaceId,agentId:r.agent_id,type:r.type,sourceSnapshot:r.source_snapshot,factualInputs:r.factual_inputs,title:r.title,content:r.content,reviewState:r.review_state,capabilityVersion:r.capability_version,runId:r.run_id,createdAt:date(r,'created_at'),limitation:r.limitation})),
 findings:product('work_opportunity',C.WorkOpportunity),initiatives:rows.product_records.filter(r=>r.kind==='initiative').map(r=>r.payload as C.Initiative),scenarios:product('forecast_scenario',C.ForecastScenario),brief:product('brief_snapshot',C.BriefSnapshot).at(-1)??null,
 usage:rows.usage_records.map(r=>({id:text(r,'id'),workspaceId,category:text(r,'category') as C.UsageRecord['category'],minutes:Number(r.minutes),costMinor:number(r,'cost_minor'),note:text(r,'note'),at:date(r,'created_at')!})),
 metrics:[],timeline:[],readiness:{integration:false,action:false,measurement:false,evaluatedAt:asOf,freshUntil:null,fallback:'Prepare approved internal work while the assigned operator resolves critical readiness.',blockers:[]},health:[]};
 const {data:setupSources,error:setupSourceError}=await client.from('product_records').select('payload,kind').eq('workspace_id',workspaceId).in('kind',['prepared_setup','setup_document']).limit(6);
 if(setupSourceError)throw new HttpError(503,'SETUP_DISCOVERY_UNAVAILABLE','Prepared setup storage is unavailable.');
 state.setupDocuments=(setupSources??[]).filter(r=>r.kind==='setup_document').map(r=>C.SetupDocument.parse(r.payload));
 const prepared=(setupSources??[]).find(r=>r.kind==='prepared_setup');if(prepared)state.preparedSetup=C.PreparedSetup.parse(prepared.payload);
 if(context.role==='workspace_owner'){const {data}=await client.auth.getUser();if(data.user?.email&&data.user.email_confirmed_at)state.setupIdentity={email:data.user.email,name:String(data.user.user_metadata?.full_name??data.user.user_metadata?.name??'').slice(0,200)};}
 state.activation.selectedTeam=installations.filter(i=>i.status!=='paused'&&i.agentId!==ALWAYS_ON_AGENT_ID).map(i=>i.agentId).slice(0,32);
 state.activation.teamSelectedAt=date(w,'team_selected_at')??undefined;
 const {data:latestCapture}=await client.from('product_records').select('payload').eq('workspace_id',workspaceId).eq('kind','company_context').order('created_at',{ascending:false}).limit(1).maybeSingle();
 const capture=latestCapture?.payload as {requestId?:string;id:string;sourceHash:string;context:{evidence:C.EvidenceRef[];confirmed:boolean;fixture:boolean;pages:NonNullable<C.AppSnapshot['onboardingCapture']>['pages']}}|undefined;
 if(capture)state.onboardingCapture={evidence:capture.context.evidence,requestId:capture.requestId,id:capture.id,sourceHash:capture.sourceHash,fixture:capture.context.fixture,pages:capture.context.pages};
 state.currentPreparationArtifactIds=rows.prepared_artifacts.filter(r=>Array.isArray(r.source_snapshot)&&r.source_snapshot.length>0&&r.source_snapshot.every((proof:{id:string})=>rows.evidence.some(e=>e.id===proof.id&&e.content_hash===capture?.sourceHash&&!['fixture','unknown'].includes(String(e.quality))))).map(r=>text(r,'id'));
 state.activation.confirmedFacts=capture?.context.confirmed===true;
 state.activation.milestone=state.outcomes.some(o=>o.quality==='provider_verified'&&['booked','attended','signed','completed','paid'].includes(o.stage))?'live_business_outcome':state.receipts.some(r=>r.provider!=='fixture'&&['provider_accepted','confirmed'].includes(r.status))?'authorized_test_action':state.artifacts.length?'preparation_artifact':'not_started';
 const {data:authoritativeMetrics,error:metricsError}=await client.rpc('read_workspace_metrics',{p_workspace:workspaceId});
 if(metricsError)throw new HttpError(503,'METRICS_UNAVAILABLE','Apply the current metrics migration before displaying workspace totals.');
 state.metrics=z.array(C.Metric).parse(authoritativeMetrics);
 const {data:setup,error:setupError}=await client.rpc('read_onboarding_v2',{p_workspace:workspaceId});
 if(setupError)throw new HttpError(503,'ONBOARDING_UNAVAILABLE','Apply the company source setup migration (023) in the operational Supabase project.');
 state.onboarding=setup?C.OnboardingRecord.parse(setup):C.emptyOnboarding(state.workspace,asOf);
 const {data:agentOnboarding,error:agentOnboardingError}=await client.rpc('read_agent_onboarding',{p_workspace:workspaceId});
 if(agentOnboardingError)throw new HttpError(503,'AGENT_ONBOARDING_UNAVAILABLE','Apply the per-agent onboarding migration (029) in the operational Supabase project.');
 state.agentOnboarding=z.array(C.AgentOnboardingRecord).parse(agentOnboarding??[]);
 state.timeline=[...state.proposals.map(p=>({id:p.id,workspaceId,opportunityId:p.opportunityId,at:p.syncedAt,kind:'source',title:`${p.reference} · ${p.status}`,detail:`Business fact last verified ${p.sourceVerifiedAt}; source status ${p.rawStatus}.`,actor:'source' as const,evidence:p.evidence})),...state.receipts.flatMap(receipt=>{const action=state.actions.find(a=>a.id===receipt.actionId);const proposal=state.proposals.find(p=>p.id===action?.proposalId);return proposal?[{id:receipt.id,workspaceId,opportunityId:proposal.opportunityId,at:receipt.observedAt,kind:'action',title:receipt.status.replaceAll('_',' '),detail:receipt.message,actor:'david' as const,evidence:receipt.evidence}]:[];}),...state.outcomes.map(o=>({id:o.id,workspaceId,opportunityId:o.opportunityId,at:o.periodEnd,kind:'outcome',title:`${o.stage} · ${o.quality}`,detail:`Observed ${o.stage}; other outcome stages require separate evidence.`,actor:'source' as const,evidence:o.evidence})),...rows.outbound_events.flatMap(event=>{
  const lead=rows.outbound_leads.find(item=>item.id===event.lead_id);
  const opportunityId=lead?.opportunity_id?String(lead.opportunity_id):'';
  if(!opportunityId)return [];
  const eventType=text(event,'event_type');
  const kind=eventType==='lead_meeting_booked'?'meeting_booked':eventType==='email_sent'?'email_out':'email_in';
  return [{id:text(event,'id'),workspaceId,opportunityId,at:date(event,'occurred_at')!,kind,title:`${text(lead!,'email')} · ${eventType.replaceAll('_',' ')}`,detail:text(event,'body')||eventType,actor:eventType==='email_sent'?'david' as const:'source' as const,evidence:[]}];
 })];
 const campaign=rows.outbound_campaigns[0];
 if(campaign||installations.some(item=>item.agentId==='outbound-email-sdr')){
  const empty=emptyOutboundSdr(workspaceId);
  state.outboundSdr=C.OutboundSdrState.parse({
   workspaceId,
   bookingUrl:campaign?text(campaign,'booking_url')||null:empty.bookingUrl,
   sequence:Array.isArray(campaign?.sequence)?campaign.sequence:empty.sequence,
   leads:rows.outbound_leads.map(lead=>C.OutboundLead.parse({
    id:text(lead,'id'),workspaceId,opportunityId:lead.opportunity_id?text(lead,'opportunity_id'):null,email:text(lead,'email'),
    firstName:text(lead,'first_name'),lastName:text(lead,'last_name'),company:text(lead,'company'),title:text(lead,'title'),website:text(lead,'website'),
    custom:lead.custom&&typeof lead.custom==='object'&&!Array.isArray(lead.custom)?lead.custom:{},
    status:lead.status,lastReply:lead.last_reply==null?null:text(lead,'last_reply'),lastEventAt:date(lead,'last_event_at'),
   })),
   campaignId:campaign?.campaign_id?text(campaign,'campaign_id'):null,
   instantlyWorkspaceId:campaign?.instantly_workspace_id?text(campaign,'instantly_workspace_id'):null,
   warmupReady:Boolean(campaign?.warmup_ready),
   sendingAccounts:Array.isArray(campaign?.sending_accounts)?campaign.sending_accounts:empty.sendingAccounts,
   status:campaign?text(campaign,'status'):empty.status,
   crmProvider:campaign?text(campaign,'crm_provider'):empty.crmProvider,
   crmStatus:campaign?text(campaign,'crm_status'):empty.crmStatus,
   lastError:campaign?.last_error==null?null:text(campaign,'last_error'),
  });
 }
 const [{data:readiness,error:readinessError},{data:health,error:healthError}]=await Promise.all([client.rpc('read_workspace_readiness',{p_workspace:workspaceId}),client.rpc('read_workspace_health',{p_workspace:workspaceId})]);
 if(readinessError||healthError)throw new HttpError(503,'READINESS_UNAVAILABLE','Apply the current readiness/health migrations and review the actual runtime.');
 state.readiness=C.ReadinessResult.parse(readiness);
 const blockers=state.readiness.blockers;
 if(environment().DAVID_LIVE_EXECUTION!=='true')blockers.push({code:'live_not_enabled',message:'External execution is disabled in this environment.',owner:'Release owner',nextStep:'Complete the documented live activation and hosted verification gates.',dimension:'action'});
 for(const [name,records]of pairs)if(records.length>200)blockers.push({code:`coverage_${name}`,message:`${name} display is limited to the first 201 records.`,owner:'DAVID operator',nextStep:'Use the authorized complete export for full reconciliation; numeric totals use the full database.',dimension:'measurement'});
 state.readiness.action=state.readiness.action&&!blockers.some(b=>b.dimension==='action');
 state.readiness.measurement=state.readiness.measurement&&!blockers.some(b=>b.dimension==='measurement');
 const {data:modelSetup,error:modelSetupError}=await client.rpc('read_preparation_setup',{p_workspace:workspaceId});
 if(modelSetupError)throw new HttpError(503,'BRIEFING_SCHEMA_UNAVAILABLE','Apply the conversational briefing migration before using this release.');
 let providerConfigured=false;try{preparationModelConfig(process.env);providerConfigured=true;}catch{/* Configuration errors are administrative; never expose credentials in validation output. */}
 state.preparationRuntime={configured:providerConfigured&&modelSetup?.globalConfigured===true,message:!providerConfigured?'Model provider and per-job spending setup must be completed by the DAVID administrator. Your briefing is saved.':'The application model budget must be approved by the DAVID administrator. Your workspace budget does not authorize application-wide spending.'};
 state.preparationRequests=rows.runs.filter(r=>rows.installations.some(i=>i.id===r.installation_id&&i.mode==='preparation')).map(r=>({id:text(r,'id'),agentId:String(rows.installations.find(i=>i.id===r.installation_id)?.agent_id??''),status:text(r,'status'),createdAt:date(r,'created_at')!}));
 state.health=z.array(C.RuntimeHealth).parse(health);
 return state;
}
export async function operationalCommand(command:C.Command,requested:string|null):Promise<C.CommandResult>{
 const workspaceId=await selectedWorkspace(requested);const {client,context}=await authorize(workspaceId,true);
 if(!['workspace_owner','david_operator'].includes(context.role))throw new HttpError(403,'OWNER_REQUIRED','An assigned owner or operator must make this change.');
 async function rpc(name:string,args:Record<string,unknown>){const {data,error}=await client.rpc(name,args);if(error)throw new HttpError(409,'OPERATION_BLOCKED',error.message.slice(0,500));return data;}
 await rpc('consume_request_quota',{p_workspace:workspaceId,p_scope:'commands'});
 const setupFingerprint=command.type==='build_setup'?await rpc('read_setup_fingerprint',{p_workspace:workspaceId}):null;
 const current=await operationalSnapshot(workspaceId);let message='Change saved.';let invitationUrl:string|undefined;
 switch(command.type){
  case 'save_setup_document':await rpc('save_setup_document',{p_workspace:workspaceId,p_name:command.name,p_text:command.text});message='Selected company brief saved for discovery. Facts remain unconfirmed.';break;
  case 'remove_setup_document':await rpc('remove_setup_document',{p_workspace:workspaceId,p_document:command.documentId});message='Selected brief removed. Refresh discovery before accepting a setup.';break;
  case 'build_setup':{const proposal=buildPreparedSetup(current,command.goal,current.preparedSetup?.id??randomUUID());await rpc('save_prepared_setup',{p_workspace:workspaceId,p_expected_revision:command.expectedRevision,p_expected_generation:command.expectedGeneration,p_fingerprint:setupFingerprint,p_payload:proposal});message='Prepared setup saved for review. No operating permissions were granted.';break;}
  case 'accept_setup':{const answers=validateSetupAcceptance(current,command.generation,command.expectedRevision,command.answers);await rpc('accept_prepared_setup',{p_workspace:workspaceId,p_generation:command.generation,p_revision:command.expectedRevision,p_answers:answers});message='Reviewed setup saved. Confirm captured sources and apply reviewed settings before first work.';break;}
  case 'confirm_sample_company':case 'sample_onboarding_capture':throw new HttpError(403,'FIXTURE_ONLY','Synthetic captures are unavailable in operational workspaces.');
  case 'assign_operator':await rpc('assign_onboarding_operator',{p_workspace:workspaceId,p_email:command.email});message='Registered DAVID operator assigned to this workspace. MFA remains required for operator access.';break;
  case 'save_onboarding':await rpc('save_onboarding',{p_workspace:workspaceId,p_expected_revision:command.expectedRevision,p_answers:command.answers});message='Setup saved. Changed operating configuration pauses execution and requires fresh verification.';break;
  case 'save_agent_onboarding':await rpc('save_agent_onboarding',{p_workspace:workspaceId,p_agent:command.agentId,p_expected_revision:command.expectedRevision,p_answers:command.answers});message='Agent onboarding saved for this client. Company connections were not copied or replaced.';break;
  case 'onboarding_task':await rpc('update_onboarding_task',{p_workspace:workspaceId,p_revision:command.expectedRevision,p_id:command.taskId,p_title:command.title,p_owner:command.owner,p_status:command.status,p_note:command.note});message='Setup request saved. Task status does not grant capability verification.';break;
  case 'review_artifact':await rpc('review_prepared_artifact',{p_workspace:workspaceId,p_artifact:command.artifactId,p_decision:command.decision});message='Artifact review saved.';break;
  case 'set_allowance':await rpc('configure_workspace_allowance',{p_workspace:workspaceId,p_allowance:command.allowance});message='Workspace allowance updated.';break;
  case 'create_invitation':{const token=randomBytes(32).toString('hex');await rpc('create_workspace_invitation',{p_workspace:workspaceId,p_email:command.email,p_role:command.role,p_token_hash:createHash('sha256').update(token).digest('hex')});invitationUrl=`${environment().APP_ORIGIN}/join#token=${token}`;message='Invitation link created for the named email. Share it with that person; no invitation email has been sent.';break;}
  case 'revoke_invitation':await rpc('revoke_workspace_invitation',{p_workspace:workspaceId,p_invitation:command.invitationId});message='Pending invitation revoked.';break;
  case 'apply_onboarding':await rpc('apply_onboarding_settings',{p_workspace:workspaceId,p_revision:command.expectedRevision});message='Reviewed settings applied. Execution stays paused until you explicitly resume and readiness checks pass.';break;
  case 'pause':await rpc('set_workspace_pause',{p_workspace_id:workspaceId,p_paused:command.paused});break;
  case 'takeover':await rpc('set_contact_takeover',{p_contact_id:command.contactId,p_enabled:command.enabled});break;
  case 'approve':case 'reject':{const action=current.actions.find(a=>a.id===command.actionId);if(!action)throw new HttpError(404,'ACTION_NOT_FOUND','Action was not found in this workspace.');await rpc('decide_action',{p_action_id:action.id,p_decision:command.type==='approve'?'approved':'rejected',p_payload_hash:action.payloadHash});message='Decision saved atomically. The dispatcher will resume the registered workflow; all dispatch checks still apply.';break;}
  case 'select_team':await rpc('select_team',{p_workspace:workspaceId,p_agents:command.agentIds});break;
  case 'recommend_team':{if(command.businessModel!==current.workspace.businessModel)throw new HttpError(409,'ARCHETYPE_REVIEW_REQUIRED','Changing the verified business model requires an operator source review.');const record=recommendationFor(current.recommendation.id,workspaceId,command.goal,command.businessModel);await rpc('save_product_record',{p_workspace:workspaceId,p_kind:'team_recommendation',p_id:record.id,p_payload:record});break;}
  case 'activation':{const record=C.ActivationPlan.parse({...current.activation,step:command.step,confirmedFacts:command.confirmedFacts,milestone:'not_started'});await rpc('save_product_record',{p_workspace:workspaceId,p_kind:'activation_plan',p_id:record.id,p_payload:record});message='Activation progress saved. Capability verification remains a separate operator gate.';break;}
  case 'save_scenario':C.ForecastScenario.parse(command.scenario);forecastCases(command.scenario);await rpc('save_product_record',{p_workspace:workspaceId,p_kind:'forecast_scenario',p_id:command.scenario.id,p_payload:command.scenario});break;
  case 'log_time':await rpc('record_time',{p_workspace:workspaceId,p_category:command.category,p_minutes:command.minutes,p_cost:command.costMinor,p_note:command.note});break;
  case 'draft':case 'book':case 'prepare':{const agent=command.type==='prepare'?command.agentId:command.type==='book'?'appointment-coordinator':'deal-follow-up';await rpc('request_work',{p_workspace:workspaceId,p_agent:agent,p_kind:command.type==='prepare'?'prepare':command.type,p_payload:command});message='Work persisted and queued for the protected dispatcher. No external action has been completed by this request.';break;}
  case 'import_csv':{const preview=parseCsvImport(command.csv);if(command.preview)return {snapshot:current,message:'CSV field mapping and row validation preview. Sending remains subject to fresh source and conversation coverage.',preview};if(preview.errors.length)throw new HttpError(400,'IMPORT_INVALID','Resolve all preview errors before importing.');await rpc('import_proposal_rows',{p_workspace:workspaceId,p_rows:preview.rows});message='Source rows imported with provenance. Imported contacts are not enrolled for live communication.';break;}
  case 'import_lead_csv':{const preview=parseLeadCsv(command.csv,command.mapping);if(command.preview)return {snapshot:current,message:'Lead CSV preview. Email is required. This agent does not find leads.',preview};if(preview.errors.length)throw new HttpError(400,'IMPORT_INVALID','Resolve all lead CSV errors before importing.');await rpc('import_outbound_leads',{p_workspace:workspaceId,p_rows:preview.rows.map(row=>mappedLeadRow(row,preview.mapping))});message='Imported leads for Instantly. This agent does not generate leads.';break;}
  case 'set_booking_url':message=String(await rpc('upsert_outbound_booking',{p_workspace:workspaceId,p_url:command.url}));break;
  case 'bind_instantly_workspace':message=String(await rpc('bind_instantly_workspace',{p_workspace:workspaceId,p_instantly_workspace:command.instantlyWorkspaceId}));break;
  case 'generate_outbound_sequence':{const sequence=generateOutboundSequence(companyFromSnapshot(current),current.outboundSdr?.bookingUrl??'');await rpc('save_outbound_sequence',{p_workspace:workspaceId,p_sequence:sequence});message='Three-step sequence written from confirmed company facts. Instantly will send it; no copy-out to another mail tool.';break;}
  case 'start_outbound_sdr':{if(!current.activation.confirmedFacts)throw new HttpError(409,'COMPANY_UNCONFIRMED','Confirm company facts before Instantly can send.');const prepared=z.object({name:z.string(),dailyLimit:z.number(),sequence:z.array(z.object({subject:z.string(),body:z.string()})),leads:z.array(z.object({email:z.string(),firstName:z.string().optional(),lastName:z.string().optional(),company:z.string().optional(),title:z.string().optional(),website:z.string().optional(),custom:z.record(z.string(),z.string()).optional()})),campaignId:z.string().nullable().optional(),instantlyWorkspaceId:z.string().min(1)}).parse(await rpc('prepare_outbound_launch',{p_workspace:workspaceId}));const resume=!!prepared.campaignId&&['paused','sending'].includes(current.outboundSdr?.status??'');const launched=await launchManagedInstantlyCampaign({...prepared,campaignId:resume?prepared.campaignId:null});message=String(await rpc('record_outbound_campaign',{p_workspace:workspaceId,p_campaign:launched.campaignId,p_accounts:launched.sendingAccounts,p_warmup:launched.warmupReady}));break;}
  case 'pause_outbound_sdr':{if(current.outboundSdr?.campaignId&&/^[0-9a-f-]{36}$/i.test(current.outboundSdr.instantlyWorkspaceId??'')){try{await pauseManagedInstantlyCampaign(current.outboundSdr.campaignId,current.outboundSdr.instantlyWorkspaceId!);}catch{/* Workspace pause still applies. */}}message=String(await rpc('pause_outbound_sdr',{p_workspace:workspaceId}));break;}
  case 'set_outbound_crm':message=String(await rpc('set_outbound_crm',{p_workspace:workspaceId,p_provider:command.provider}));break;
  case 'ingest_outbound_event':throw new HttpError(409,'SOURCE_EVENT_REQUIRED','Live Instantly replies must come from the authorized Instantly webhook.');
  case 'dispatch':case 'reconcile':await rpc('request_action_dispatch',{p_action:command.actionId,p_reconcile:command.type==='reconcile'});message='Action queued for checked processing. Refresh to inspect its retained receipt.';break;
  case 'approve_finding':await rpc('approve_work_finding',{p_workspace:workspaceId,p_finding:command.findingId});break;
  case 'review_initiative':await rpc('review_initiative',{p_workspace:workspaceId,p_initiative:command.initiativeId,p_result:command.result});break;
  case 'record_outcome':await rpc('record_manual_outcome',{p_workspace:workspaceId,p_proposal:command.proposalId,p_stage:command.stage,p_value:command.value,p_currency:command.currency,p_reference:command.reference,p_at:command.observedAt});message='Responsible-person confirmation saved and labeled manually reported. Authoritative source reconciliation remains separate.';break;
  case 'brief':await rpc('refresh_work_findings',{p_workspace:workspaceId});await rpc('save_weekly_brief',{p_workspace:workspaceId,p_snapshot:C.BriefSnapshot.parse({id:randomUUID(),workspaceId,asOf:current.asOf,metrics:current.metrics,evidence:current.outcomes.flatMap(o=>o.evidence),limitations:current.readiness.blockers.map(b=>b.message),decisions:current.findings.filter(f=>f.status==='proposed').slice(0,3).map(f=>f.title),commitments:['Resolve current source and permission blockers.'],narrativeVersion:'deterministic.v1',narrative:'Reconciled available records. Metrics retain their recorded stages and limitations.'})});break;
  case 'reply':throw new HttpError(409,'FIXTURE_EVENT_DENIED','Live replies must come from the authorized Google synchronization adapter.');
  case 'reset':throw new HttpError(403,'OPERATIONAL_RESET_DENIED','Reset applies only to a synthetic session. Use the documented authorized export/deletion procedure for a real workspace.');
 }
 return {snapshot:await operationalSnapshot(workspaceId),message,...(invitationUrl?{invitationUrl}:{})};
}
