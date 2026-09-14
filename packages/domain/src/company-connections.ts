import {emptyOnboarding, type AppSnapshot, type ConnectionCapability, type ConnectionResource, type OnboardingAnswers} from '../../contracts/src/index';

export type SystemKind = OnboardingAnswers['systems'][number]['kind'];
/** Full responsibilities, including capabilities that have not been implemented. */
export const agentSystemRequirements: Record<string, SystemKind[]> = {
 'account-intelligence':['website','drive'],'buying-signal-scout':['analytics','proposals'],'outbound-email-sdr':['proposals','mail'],'linkedin-outreach-assistant':['social','proposals'],'partner-development':['proposals','mail'],'rfp-opportunity-scout':['rfp','drive'],'competitor-intelligence':['website'],
 'search-growth':['website','analytics'],'technical-seo-monitor':['website'],'local-search-manager':['local','website'],'creative-performance':['advertising','drive'],'paid-campaign-operator':['advertising','analytics'],'landing-page-optimizer':['website','analytics'],'social-content-publisher':['social','drive'],'video-script-producer':['drive'],'product-merchandiser':['commerce'],
 'speed-to-lead-responder':['proposals','mail'],'ai-receptionist':['calls','calendar'],'website-sales-concierge':['website','drive'],'appointment-coordinator':['calendar','mail'],'lead-qualification':['proposals'],
 'proposal-operations':['proposals','drive'],'deal-follow-up':['proposals','mail'],'sales-call-coach':['calls','drive'],'estimate-recovery':['proposals','mail'],'revenue-experiment-manager':['analytics','payments'],
 'abandoned-cart-recovery':['commerce','mail'],'lifecycle-email-manager':['mail','proposals'],'customer-win-back':['proposals','mail'],'expansion-opportunity-scout':['proposals','payments'],'renewal-and-retention':['proposals','payments'],'review-and-referral-manager':['local','mail'],
};
export const companySystemDefinitions: {kind:SystemKind;label:string;supported:boolean}[] = [
 {kind:'website',label:'Company website',supported:true},{kind:'proposals',label:'Proposals & customer records',supported:true},
 {kind:'mail',label:'Email',supported:true},{kind:'calendar',label:'Calendar',supported:true},
 {kind:'drive',label:'Files & knowledge',supported:false},{kind:'advertising',label:'Advertising',supported:false},
 {kind:'social',label:'Social channels',supported:false},{kind:'analytics',label:'Analytics',supported:false},
 {kind:'calls',label:'Calls & reception',supported:false},{kind:'payments',label:'Payments',supported:false},
 {kind:'commerce',label:'Commerce',supported:false},{kind:'local',label:'Local listings & reviews',supported:false},
 {kind:'rfp',label:'RFP sources',supported:false},{kind:'other',label:'Other systems',supported:false},
];
export type CompanySystemStatus = 'verified'|'connected'|'needs_access'|'needs_information'|'not_available'|'engineering_required'|'demo_only';
export type CompanySystemCoverage = {
 kind:SystemKind;label:string;supported:boolean;status:CompanySystemStatus;
 agentIds:string[];selectedAgentIds:string[];connectionIds:string[];resourceIds:string[];detail:string;
};
export const connectorOperationsForCapability: Readonly<Record<string,readonly string[]>> = {
 'proposals.current':['sheets.read','proposals.read'], 'gmail.reply_read':['gmail.read'],
 'gmail.send':['gmail.send'], 'calendar.availability':['calendar.freebusy'], 'calendar.book':['calendar.book'],
};
const resourceTypes: Partial<Record<SystemKind,ConnectionResource['type'][]>> = {proposals:['sheet','csv'],mail:['mailbox'],calendar:['calendar']};
const relatedOperations: Partial<Record<SystemKind,string[]>> = {proposals:['sheets.read','proposals.read'],mail:['gmail.read','gmail.send'],calendar:['calendar.freebusy','calendar.book']};
const readOperations: Partial<Record<SystemKind,string[]>> = {proposals:['sheets.read','proposals.read'],mail:['gmail.read'],calendar:['calendar.freebusy']};
const operationScopes: Record<string,string[]> = {
 'sheets.read':['https://www.googleapis.com/auth/drive.file','https://www.googleapis.com/auth/spreadsheets.readonly','https://www.googleapis.com/auth/spreadsheets'],
 'gmail.read':['https://www.googleapis.com/auth/gmail.readonly'], 'gmail.send':['https://www.googleapis.com/auth/gmail.send'],
 'calendar.freebusy':['https://www.googleapis.com/auth/calendar.freebusy','https://www.googleapis.com/auth/calendar.events.freebusy'],
 'calendar.book':['https://www.googleapis.com/auth/calendar.events.owned','https://www.googleapis.com/auth/calendar.events'],
};
function recordFor(state:AppSnapshot){return state.onboarding??emptyOnboarding(state.workspace,state.asOf);}
export function configurationBoundary(state:AppSnapshot){const record=recordFor(state);return {revision:record.configurationRevision??record.revision,updatedAt:record.configurationUpdatedAt??record.updatedAt};}
/** Selection/history changes retain proof; material business/source/permission edits invalidate it. */
export function onboardingConfiguration(answers:OnboardingAnswers){
 const b=answers.briefing;
 const briefing={goal:b?.goal??'',otherGoal:b?.otherGoal??'',proposalSource:b?.proposalSource??'',conversionAction:b?.conversionAction??'',researchId:b?.researchId??'',noWebsite:b?.noWebsite??false};
 return {company:answers.company,systems:answers.systems,operations:answers.operations,people:answers.people,briefing};
}
function hasOperation(connection:ConnectionCapability,operation:string){return connection.operations.includes(operation)&&(connection.provider!=='google'||(operationScopes[operation]??[]).some(scope=>connection.scopes.includes(scope)));}
function isCurrent(at:string|null,now:string,seconds:number){const age=Date.parse(now)-Date.parse(at??'');return Number.isFinite(age)&&age>=0&&age<=seconds*1000;}
function resourcesFor(state:AppSnapshot,kind:SystemKind){return state.connections.filter(c=>c.workspaceId===state.workspace.id&&['google','csv'].includes(c.provider)).flatMap(connection=>(connection.boundResources??[]).filter(resource=>resourceTypes[kind]?.includes(resource.type)&&resource.resource.trim()&&resource.owner.trim()&&(resource.type!=='sheet'||!!resource.range?.trim())&&(resource.type!=='mailbox'||resource.resource.toLowerCase()===connection.identity.toLowerCase())).map(resource=>({connection,resource})));}
function verifiedResource(state:AppSnapshot,connection:ConnectionCapability,resource:ConnectionResource){
 const boundary=Date.parse(configurationBoundary(state).updatedAt);
 return connection.health==='healthy'&&!!connection.verifiedAt&&Date.parse(connection.verifiedAt)>=boundary&&!!resource.verifiedAt&&Date.parse(resource.verifiedAt)>=boundary&&isCurrent(connection.lastSyncAt,state.asOf,connection.freshnessSeconds);
}
function currentWebsite(state:AppSnapshot){
 const capture=state.onboardingCapture,website=recordFor(state).answers.company.website;
 if(!capture||capture.fixture||!capture.pages.length||!website)return false;
 try{return capture.pages.every(page=>new URL(page.url).origin===new URL(website).origin&&!!page.text.trim()&&isCurrent(page.capturedAt,state.asOf,86400));}catch{return false;}
}
export function hasConfiguredCompanySource(state:AppSnapshot,kind:SystemKind){
 if(state.workspace.mode==='fixture')return false;
 return kind==='website'?currentWebsite(state):resourcesFor(state,kind).length>0;
}
/** Actual read evidence only. It never implies permission to send, book, publish or run an agent. */
export function hasVerifiedCompanySource(state:AppSnapshot,kind:SystemKind){
 if(state.workspace.mode==='fixture')return false;
 if(kind==='website')return currentWebsite(state)&&state.activation.confirmedFacts;
 return resourcesFor(state,kind).some(({connection,resource})=>verifiedResource(state,connection,resource)&&(readOperations[kind]??[]).some(op=>hasOperation(connection,op)));
}
export function hasCurrentCapabilitySource(state:AppSnapshot,capability:string){
 if(state.workspace.mode==='fixture')return false;
 if(capability==='website.captured')return currentWebsite(state);
 if(capability==='company.confirmed')return state.activation.confirmedFacts;
 const operations=connectorOperationsForCapability[capability];if(!operations)return false;
 const kind:SystemKind=capability.startsWith('gmail.')?'mail':capability.startsWith('calendar.')?'calendar':'proposals';
 const valid=resourcesFor(state,kind).filter(({connection,resource})=>verifiedResource(state,connection,resource)&&operations.some(operation=>hasOperation(connection,operation)));
 if(capability==='proposals.current')return valid.some(({resource})=>state.proposals.some(p=>p.workspaceId===state.workspace.id&&!p.fixture&&p.status==='open'&&!!p.owner&&isCurrent(p.sourceVerifiedAt,state.asOf,86400)&&isCurrent(p.syncedAt,state.asOf,86400)&&p.evidence.some(e=>e.quality!=='fixture'&&e.quality!=='unknown')&&resource.type==='sheet'));
 return valid.length>0;
}
export function companyConnectionCoverage(state:AppSnapshot){
 const record=recordFor(state),selected=new Set(record.answers.team);
 const agents=state.catalog.map(agent=>{
  const fullRoleSystems=[...(agentSystemRequirements[agent.id]??['other'])];
  // The implemented preparation suite reads approved website snapshots, not future provider inputs.
  const currentSystems:SystemKind[]=agent.releaseStatus==='implemented'?['website']:agent.releaseStatus==='planned'?[]:[...new Set(agent.requiredCapabilities.flatMap(cap=>cap.startsWith('gmail.')?['mail' as const]:cap.startsWith('calendar.')?['calendar' as const]:cap==='proposals.current'?['proposals' as const]:cap==='website.captured'?['website' as const]:[]))];
  const missingCapabilities=agent.requiredCapabilities.filter(cap=>!!connectorOperationsForCapability[cap]&&!hasCurrentCapabilitySource(state,cap));
  const missingCurrentSystems=currentSystems.filter(kind=>!hasVerifiedCompanySource(state,kind)||missingCapabilities.some(cap=>kind==='mail'?cap.startsWith('gmail.'):kind==='calendar'?cap.startsWith('calendar.'):kind==='proposals'?cap==='proposals.current':false));
  return {id:agent.id,selected:selected.has(agent.id),applicable:agent.supportedArchetypes.includes(record.answers.company.businessModel),currentSystems,fullRoleSystems,missingCurrentSystems,missingCapabilities,engineeringRequired:agent.releaseStatus==='planned'};
 });
 const systems=companySystemDefinitions.map((definition):CompanySystemCoverage=>{
  const {kind}=definition,related=agents.filter(agent=>agent.fullRoleSystems.includes(kind)||agent.currentSystems.includes(kind));
  const resources=resourcesFor(state,kind),answers=record.answers.systems.filter(s=>s.kind===kind);
  const connections=state.connections.filter(c=>c.workspaceId===state.workspace.id&&['google','csv'].includes(c.provider)&&((relatedOperations[kind]??[]).some(op=>c.operations.includes(op))||resources.some(r=>r.connection.id===c.id)));
  const base={...definition,agentIds:related.map(a=>a.id),selectedAgentIds:related.filter(a=>a.selected).map(a=>a.id),connectionIds:connections.map(c=>c.id),resourceIds:resources.map(r=>r.resource.resource)};
  if(!definition.supported)return {...base,status:answers.some(s=>s.availability==='not_available')?'not_available':'engineering_required',detail:answers.some(s=>s.availability==='not_available')?'Recorded as unavailable for this company. The provider integration is not implemented.':'Record the company’s system once. This provider integration is not implemented; saving details does not connect it.'};
  if(state.workspace.mode==='fixture')return {...base,status:'demo_only',detail:'Synthetic demonstration. No real account or source access is verified.'};
  if(hasVerifiedCompanySource(state,kind))return {...base,status:'verified',resourceIds:kind==='website'?state.onboardingCapture!.pages.map(p=>p.url):base.resourceIds,detail:kind==='website'?'Captured website pages and company facts are reviewed. Available to every applicable preparation.':'Selected resources passed read checks. Shared across the company; sending, booking and agent readiness require separate checks.'};
  if(kind==='website'&&currentWebsite(state))return {...base,status:'connected',resourceIds:state.onboardingCapture!.pages.map(p=>p.url),detail:'Website pages are captured. Review the company facts before agents use them.'};
  const unavailable=answers.some(s=>s.availability==='not_available');
  const bad=connections.find(c=>['expired','revoked','failed'].includes(c.health));
  if(bad)return {...base,status:'needs_access',detail:`Account access is ${bad.health}. Reconnect or repair the account before reusing its sources.`};
  if(answers.some(s=>s.availability==='admin_needed'))return {...base,status:'needs_access',detail:'Administrator assistance was requested for this company source.'};
  if(connections.length){
   const missingGrant=resources.some(({connection})=>!(readOperations[kind]??[]).some(op=>hasOperation(connection,op)));
   return {...base,status:missingGrant?'needs_access':'connected',detail:missingGrant?'The account has only partial permissions. Authorize the missing read capability.':resources.length?'Saved resources need current read checks. Existing authorization is retained.':'Account authorization is saved. Select the exact company resources to check.'};
  }
  if(unavailable)return {...base,status:'not_available',detail:'Recorded as unavailable for this company. You can add this source later.'};
  if(kind==='website'&&state.onboardingCapture)return {...base,status:'needs_access',detail:'Capture the current company website again; the saved pages are stale or belong to a different website.'};
  return {...base,status:answers.some(s=>s.availability==='available'&&s.resource&&s.owner)?'needs_access':'needs_information',detail:answers.length?'Company details are saved; actual source access still needs to be established.':'Add this company source once, then reuse it when choosing or changing agents.'};
 });
 return {systems,agents,configurationUpdatedAt:configurationBoundary(state).updatedAt};
}
