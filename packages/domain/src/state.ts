import { catalog, recommendationFor, prepareFromContext, preparationIds, ALWAYS_ON_AGENT_ID, type WebsiteContext } from '../../agents/src/index';
import type { AppSnapshot, ActionProposal, WorkspaceContext, EvidenceRef } from '../../contracts/src/index';

export const FIXTURE_WORKSPACE_KEYS = ['david', 'northstar', 'wallaroo'] as const;
export type FixtureWorkspaceKey = typeof FIXTURE_WORKSPACE_KEYS[number];
export const DEFAULT_PREVIEW_WORKSPACE = 'wallaroo' satisfies FixtureWorkspaceKey;
export function isFixtureWorkspace(value: string): value is FixtureWorkspaceKey {
  return (FIXTURE_WORKSPACE_KEYS as readonly string[]).includes(value);
}

export const FIXTURE_NOW = '2026-09-10T16:00:00.000Z';
export type ReplyClassification = 'positive'|'decline'|'opt_out'|'bounce'|'automatic'|'ambiguous';
export type Policy = { version:number; sourceFreshnessHours:number; replyReviewHours:number; spacingHours:number; dailyActionLimit:number; dailyBudgetMinor:number; sender:string; calendarId:string; meetingMinutes:number; bufferMinutes:number; workingDays:number[]; calendarCapacity:number; workingHours:{start:number;end:number}; operator:string; requireApproval:boolean; confirmed:boolean; liveActivation:{sender:string;cohortIds:string[];policyVersion:number;operator:string;expiresAt:string}|null };
export type StandingMandate = {id:string;version:number;grantorId:string;revoked:boolean;expiresAt:string;actionTypes:ActionProposal['type'][];cohortIds:string[];recipientDomains:string[];maxActions:number;maxCostMinor:number;usedActions:number;usedCostMinor:number;policyVersion:number;approvedScope:string;templateVersion:'factual-followup.v1'};
export interface EngineState extends AppSnapshot {
  schemaVersion:1; fixtureKey:string; sequence:number; policy:Policy; company:WebsiteContext;
  replies:Record<string,{eventId:string;classification:ReplyClassification;text:string;at:string}>;
  seenEvents:string[]; claims:Record<string,{actionId:string;installationId:string;fence:number;state:'reserved'|'submitting'|'uncertain'}>;
  actionPolicyVersions:Record<string,number>; actionMandates:Record<string,string>; mandates:StandingMandate[];
  budget:{day:string;reservedMinor:number;settledMinor:number;actions:number};
  preparationRuns:Record<string,{day:string;count:number;sourceSignature:string}>;
  sourceRows:Record<string,Record<string,string>>; sourceBindings:Record<string,string>;
  appointmentBusy:{startAt:string;endAt:string;calendarId:string}[];
  fixtureProvider:Record<string,{providerId:string;confirmed:boolean}>;
  audit:{id:string;at:string;actorId:string;event:string;detail:string}[];
  briefHistory:NonNullable<AppSnapshot['brief']>[];
  proposalHistory:AppSnapshot['proposals'];
  scenarioHistory:AppSnapshot['scenarios'];
}

/** Deterministic IDs are for local synthetic records/import keys, never authentication. */
export function stableId(value:string):string {
  const parts=[2166136261, 2246822519, 3266489917, 668265263];
  for(let i=0;i<value.length;i++) for(let p=0;p<parts.length;p++) parts[p]=Math.imul(parts[p]^value.charCodeAt(i)^(p*31),16777619)>>>0;
  const hex=parts.map(p=>p.toString(16).padStart(8,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
export function nextId(state:EngineState,kind:string):string { state.sequence++; return stableId(`${state.workspace.id}:${kind}:${state.sequence}`); }
export function evidence(state:Pick<EngineState,'workspace'|'asOf'>, label:string, source='fixture', key=label):EvidenceRef {return {id:stableId(`${state.workspace.id}:evidence:${key}`),label,source,capturedAt:state.asOf,quality:state.workspace.mode==='fixture'?'fixture':'manually_reported'};}
export function audit(state:EngineState,event:string,detail:string,context:WorkspaceContext=state.context) {state.audit.push({id:nextId(state,'audit'),at:state.asOf,actorId:context.actorId,event,detail});}
export function createFixtureState(workspaceKey='david'):EngineState {
  const workspaceId=stableId(`fixture:${workspaceKey}`); const now=FIXTURE_NOW;
  const context:WorkspaceContext={schemaVersion:1,actorId:stableId(`${workspaceKey}:owner`),workspaceId,membershipId:stableId(`${workspaceKey}:membership`),role:'workspace_owner',environment:'fixture',permittedOperations:['read','command','approve','pause','configure'],assurance:'aal1'};
  const state:EngineState={schemaVersion:1,fixtureKey:workspaceKey,sequence:100,workspace:{id:workspaceId,name:workspaceKey==='david'?'DAVID AI · illustrative workspace':`${workspaceKey} · illustrative workspace`,businessModel:'b2b_services',timeZone:'America/Denver',mode:'fixture',paused:false,subscriptionMinor:500000,currency:'USD'},asOf:now,context,contacts:[],opportunities:[],proposals:[],catalog:structuredClone(catalog),installations:[],recommendation:recommendationFor(stableId(`${workspaceKey}:recommendation`),workspaceId,'Recover eligible proposals and coordinate sales conversations','b2b_services'),activation:{id:stableId(`${workspaceKey}:activation`),workspaceId,selectedTeam:[],step:1,prerequisites:[],milestone:'not_started',confirmedFacts:true,owner:'Fixture operator'},readiness:{integration:false,action:false,measurement:false,blockers:[],evaluatedAt:now,freshUntil:null,fallback:'Use labeled fixture records and preparation while real access is configured.'},connections:[],actions:[],approvals:[],receipts:[],outcomes:[],metrics:[],timeline:[],artifacts:[],findings:[],initiatives:[],scenarios:[],health:[],usage:[],brief:null,company:{companyName:'DAVID AI',confirmed:true,offers:['Managed business execution with five selected specialists'],customerTypes:['B2B service businesses'],locations:[],pages:[{url:'https://example.com/david-fixture',title:'DAVID AI — illustrative company profile',description:'A synthetic approved source for testing bounded preparation.',text:'DAVID AI provides managed business execution with five selected specialists for B2B service businesses. This is an illustrative fixture used to verify preparation and approval flows.',capturedAt:now}],evidence:[],fixture:true},policy:{version:1,sourceFreshnessHours:24,replyReviewHours:4,spacingHours:48,dailyActionLimit:10,dailyBudgetMinor:1000,sender:'approved-sender@example.invalid',calendarId:'fixture-calendar-primary',meetingMinutes:30,bufferMinutes:15,workingDays:[1,2,3,4,5],calendarCapacity:4,workingHours:{start:8,end:18},operator:'Fixture operator',requireApproval:true,confirmed:true,liveActivation:null},replies:{},seenEvents:[],claims:{},actionPolicyVersions:{},actionMandates:{},mandates:[],budget:{day:now.slice(0,10),reservedMinor:0,settledMinor:0,actions:0},preparationRuns:{},sourceRows:{},sourceBindings:{},appointmentBusy:[],fixtureProvider:{},audit:[],briefHistory:[],proposalHistory:[],scenarioHistory:[]};
  state.company.evidence=[evidence(state,'Confirmed synthetic company profile','fixture website')];
  const fixtures:[string,string,string,boolean,boolean][]=[['P-1001','Maya Chen','open',false,false],['P-1002','Jordan Blake','accepted',false,false],['P-1003','Morgan Rivera','declined',false,false],['P-1004','Taylor Brooks','expired',false,false],['P-1005','Casey Reed','on_hold',false,false],['P-1006','Alex Parker','open',true,false],['P-1007','Sam Ellis','open',false,true],['P-1008','Riley Quinn','unknown',false,false]];
  fixtures.forEach(([reference,name,status,suppressed,stale],index)=>{
    const contactId=stableId(`${workspaceKey}:contact:${reference}`),opportunityId=stableId(`${workspaceKey}:opportunity:${reference}`),id=stableId(`${workspaceKey}:proposal:${reference}`);
    const source=evidence(state,`${reference} synthetic proposal source`,'fixture proposal',reference);
    const account=['Northstar Advisory','Pine & Field','Horizon Studio','Juniper Services','Atlas Consulting','Summit Strategy','Willow Group','Cedar Partners'][index];
    state.contacts.push({id:contactId,workspaceId,name,email:`sample-${index+1}@example.invalid`,account,suppressed,enrolled:!suppressed,humanTakeover:false,owner:'Fixture operator',lastContactAt:null});
    state.opportunities.push({schemaVersion:1,id:opportunityId,workspaceId,contactId,accountId:stableId(`${workspaceKey}:account:${account}`),businessModel:'b2b_services',owner:'Fixture operator',stage:status==='accepted'?'won':status==='declined'?'lost':'proposal',rawStage:status==='accepted'?'won':status==='declined'?'lost':'proposal',evidence:[source]});
    state.proposals.push({schemaVersion:1,id,workspaceId,opportunityId,contactId,version:1,reference,issuedAt:'2026-09-01T16:00:00.000Z',validUntil:status==='expired'?'2026-09-09T16:00:00.000Z':'2026-10-10T16:00:00.000Z',amountMinor:500000,currency:'USD',valueKind:'monthly_recurring',scopeSummary:'Five selected specialist responsibilities with shared context, reporting and coordination. Scope and pricing require the existing approved proposal.',sourceUrl:null,status:status as EngineState['proposals'][number]['status'],rawStatus:status,owner:'Fixture operator',sourceVerifiedAt:stale?'2026-09-06T16:00:00.000Z':now,syncedAt:now,evidence:[source],fixture:true});
    state.timeline.push({id:stableId(`${workspaceKey}:timeline:${reference}`),workspaceId,opportunityId,at:now,kind:'source',title:`${reference} imported`,detail:`Illustrative ${status} proposal; business fact ${stale?'stale':'current at fixture clock'}.`,actor:'source',evidence:[source]});
  });
  for(const [provider,resource,operations] of [['fixture','Synthetic proposal batch',['proposals.current']],['fixture','Synthetic Gmail sender and enrolled reply history',['gmail.send','gmail.reply_read']],['fixture','Synthetic authorized calendar',['calendar.availability','calendar.book']]] as const) state.connections.push({id:stableId(`${workspaceKey}:connection:${resource}`),workspaceId,provider,identity:'Fixture only — no connected Google account',resource,scopes:[],operations:[...operations],health:'fixture',lastSyncAt:now,verifiedAt:now,owner:'Fixture operator',freshnessSeconds:86400});
  state.connections.push({id:stableId(`${workspaceKey}:connection:google`),workspaceId,provider:'google',identity:'Not connected',resource:'Google Workspace',scopes:[],operations:[],health:'unconfigured',lastSyncAt:null,verifiedAt:null,owner:'Workspace owner',freshnessSeconds:3600});
  state.activation.selectedTeam=[...state.recommendation.specialistIds];
  state.installations=[...state.activation.selectedTeam,ALWAYS_ON_AGENT_ID].map(agentId=>({id:stableId(`${workspaceKey}:installation:${agentId}`),workspaceId,agentId,definitionVersion:'1.0.0',mode:catalog.find(a=>a.id===agentId)!.modes[0],status:'installed',sourceMappings:agentId==='deal-follow-up'?['fixture-proposals']:agentId==='appointment-coordinator'?['fixture-calendar']:['fixture-website'],policyVersion:1,dailyCapacity:agentId in {'deal-follow-up':1,'appointment-coordinator':1}?10:1,lastPreparationAt:null,lastBusinessActionAt:null,blockers:[]}));
  for(const agentId of state.installations.map(item=>item.agentId).filter(id=>preparationIds.includes(id as typeof preparationIds[number]))){
    const output=prepareFromContext(agentId,state.company);
    state.artifacts.push({id:stableId(`${workspaceKey}:artifact:${agentId}`),workspaceId,agentId,...output,sourceSnapshot:state.company.evidence,reviewState:'draft',capabilityVersion:'1.0.0',runId:stableId(`${workspaceKey}:artifact-run:${agentId}`),createdAt:now});
    const installation=state.installations.find(item=>item.agentId===agentId);if(installation)installation.lastPreparationAt=now;
  }
  if(state.installations.some(item=>item.agentId==='appointment-coordinator')){
    const calendar=evidence(state,'Synthetic authorized calendar','fixture calendar','fixture-calendar-coverage');
    state.findings.push({id:stableId(`${workspaceKey}:finding:fixture-calendar`),workspaceId,title:'Review fixture calendar coverage',affectedIds:[],observedCondition:'Synthetic calendar availability is labeled for demonstration. No live Google Calendar grant or booking exists.',evidence:[calendar],hypothesis:'Owner review of availability rules prevents an unintended booking in this demonstration.',agentId:'appointment-coordinator',effortMinutes:10,costMinor:null,owner:'Fixture operator',evaluationRule:'fixture.v1/calendar-coverage: labeled synthetic availability only; not a live booking grant.',status:'proposed',alternatives:['Keep using labeled fixture availability','Record a real calendar after operator setup'],baseline:'No live calendar grant recorded.',target:'Keep bookings on the synthetic calendar until a verified grant exists.',reviewAt:now});
  }
  state.scenarios=[{id:stableId(`${workspaceKey}:scenario:b2b`),workspaceId,version:1,name:'Illustrative proposal recovery · 30 days',businessModel:'b2b_services',currency:'USD',horizonDays:30,volume:20,cohort:'recovery',overlapResolved:true,conversions:[{label:'Qualified conversations',low:.2,base:.3,high:.4},{label:'Bookings',low:.4,base:.5,high:.6},{label:'Held meetings',low:.7,base:.8,high:.9},{label:'Wins',low:.2,base:.3,high:.4}],capacity:4,valueMinor:500000,spendMinor:500000,baselineWins:null,counterfactual:null,assumptions:['Illustrative inputs, not business forecasts.','Recovery cohort is separate from new demand.','Unit value is monthly recurring value; not collected revenue.'],createdAt:now}];
  state.health=['Web application','Vercel workflow','Cron dispatcher','Supabase','Google synchronization','AI Gateway','Legacy Sites','Legacy Netlify'].map(component=>({component,health:component==='Web application'?'fixture':'unverified',observedAt:now,lastSuccessAt:component==='Web application'?now:null,lastPreparationAt:null,lastBusinessActionAt:null,coverage:component==='Web application'?'Local deterministic fixture service':'No authorized deployed probe or credential verification recorded',owner:'DAVID operator',nextStep:component==='Web application'?'Review the labeled fixture journey.':'Configure and verify the bound nonproduction service.'}));
  return state;
}
