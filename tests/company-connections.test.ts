import {describe,expect,it} from 'vitest';
import {createFixtureState,onboardingFor,onboardingReport} from '@david/domain';
import {saveOnboarding} from '../packages/domain/src/onboarding';
import {agentSystemRequirements,companyConnectionCoverage,hasCurrentCapabilitySource} from '../packages/domain/src/company-connections';
import {Briefing,type ConnectionCapability} from '@david/contracts';

// Synthetic server snapshots exercise real authorization evidence rules; no provider is contacted.
function company(){
 const state=createFixtureState('company-source-test');state.workspace.mode='shadow';state.context.environment='shadow';state.connections=[];
 const answers=structuredClone(onboardingFor(state).answers);
 Object.assign(answers.company,{website:'https://company.example',offers:['Service'],customers:['Owners'],priorities:['Recover proposals'],successDefinition:'Verified replies'});
 Object.assign(answers.operations,{policyAcknowledged:true,escalationOwner:'owner@company.example',dailyCapacity:2,modelDailyBudgetMinor:0});
 answers.people=[{name:'Owner',email:'owner@company.example',responsibility:'approver',role:'workspace_owner'}];
 answers.measurement={owner:'Owner',outcomeSources:'Verified CRM data',baseline:[{metric:'Replies',unit:'count',value:null,source:'',asOf:''}],sharing:'private'};
 state.onboarding=saveOnboarding(state,answers,0);
 return state;
}
function account(state:ReturnType<typeof company>):ConnectionCapability{
 return {id:'00000000-0000-4000-8000-000000000011',workspaceId:state.workspace.id,provider:'google',identity:'owner@company.example',resource:'A description cannot prove a binding',owner:'Owner',operations:['sheets.read','gmail.read','gmail.send','calendar.freebusy','calendar.book'],scopes:['drive.file','gmail.readonly','gmail.send','calendar.freebusy','calendar.events.owned'].map(s=>`https://www.googleapis.com/auth/${s}`),health:'healthy',lastSyncAt:state.asOf,verifiedAt:state.asOf,freshnessSeconds:3600,boundResources:[
 {id:'00000000-0000-4000-8000-000000000021',type:'sheet',resource:'actual-sheet',range:'Proposals!A1:S500',owner:'Owner',verifiedAt:state.asOf},
 {id:'00000000-0000-4000-8000-000000000022',type:'mailbox',resource:'owner@company.example',owner:'Owner',verifiedAt:state.asOf},
 {id:'00000000-0000-4000-8000-000000000023',type:'calendar',resource:'owner@company.example',owner:'Owner',verifiedAt:state.asOf},
 ]};
}
const system=(state:ReturnType<typeof company>,kind:string)=>companyConnectionCoverage(state).systems.find(s=>s.kind===kind)!;

describe('shared company connections',()=>{
 it('covers all 33 responsibilities before a team is selected and distinguishes planned inputs',()=>{
  const state=company(),coverage=companyConnectionCoverage(state);
  expect(Object.keys(agentSystemRequirements).sort()).toEqual(state.catalog.map(a=>a.id).sort());
  expect(coverage.systems).toHaveLength(14);expect(coverage.agents).toHaveLength(33);expect(coverage.agents.every(a=>!a.selected)).toBe(true);
  expect(coverage.agents.find(a=>a.id==='account-intelligence')).toMatchObject({currentSystems:['website'],fullRoleSystems:['website','drive'],engineeringRequired:false});
  expect(coverage.agents.find(a=>a.id==='paid-campaign-operator')).toMatchObject({currentSystems:[],engineeringRequired:true});
  expect(system(state,'advertising').status).toBe('engineering_required');
 });
 it('reuses actual workspace resource checks without duplicating systems form answers',()=>{
  const state=company();state.connections=[account(state)];
  expect(state.onboarding!.answers.systems).toEqual([]);expect(onboardingReport(state).complete[2]).toBe(true);
  for(const kind of ['proposals','mail','calendar'])expect(system(state,kind).status).toBe('verified');
  expect(hasCurrentCapabilitySource(state,'gmail.reply_read')).toBe(true);
  expect(hasCurrentCapabilitySource(state,'calendar.availability')).toBe(true);
  expect(hasCurrentCapabilitySource(state,'calendar.book')).toBe(true);
  expect(onboardingReport(state).agents.find(a=>a.id==='appointment-coordinator')!.missing).not.toContain('Select an available calendar source and its owner.');
 });
 it('does not infer bindings from a description or identity and isolates independent workspaces',()=>{
  const state=company();const other=createFixtureState('other-company');const connection=account(state);state.connections=[connection];
  connection.boundResources=[];connection.resource='actual-sheet, owner@company.example';
  expect(system(state,'mail').status).toBe('connected');expect(hasCurrentCapabilitySource(state,'gmail.send')).toBe(false);
  state.connections=[{...account(state),workspaceId:other.workspace.id}];
  expect(system(state,'mail').connectionIds).toEqual([]);expect(hasCurrentCapabilitySource(state,'gmail.send')).toBe(false);
  expect(companyConnectionCoverage(other).systems.every(s=>s.status!=='verified')).toBe(true);
 });
 it('retains shared source checks across a pure team swap while execution still needs reviewed settings',()=>{
  const state=company();state.connections=[account(state)];const first=state.onboarding!;
  state.asOf=new Date(Date.parse(state.asOf)+60000).toISOString();state.workspace.paused=false;
  state.onboarding=saveOnboarding(state,{...first.answers,team:['appointment-coordinator']},first.revision);
  expect(state.onboarding.configurationRevision).toBe(first.revision);expect(state.onboarding.configurationUpdatedAt).toBe(first.updatedAt);
  expect(state.workspace.paused).toBe(true);expect(state.onboarding.appliedRevision).toBeNull();
  expect(hasCurrentCapabilitySource(state,'calendar.availability')).toBe(true);
  const before=structuredClone(state.connections);const answers={...state.onboarding.answers,team:['deal-follow-up']};
  state.onboarding=saveOnboarding(state,answers,state.onboarding.revision);
  expect(state.connections).toEqual(before);expect(system(state,'mail').status).toBe('verified');
  expect(onboardingReport(state).agents.find(a=>a.id==='deal-follow-up')!.missing).toContain('Apply the current reviewed settings before activation.');
 });
 it('preserves source checks made before the first team save on a persisted revision-zero baseline',()=>{
  const state=createFixtureState('company-before-team');state.workspace.mode='shadow';state.context.environment='shadow';
  const baseline=onboardingFor(state);state.onboarding={...baseline,configurationRevision:0,configurationUpdatedAt:baseline.updatedAt};
  state.asOf=new Date(Date.parse(state.asOf)+60000).toISOString();state.connections=[account(state)];
  expect(system(state,'mail').status).toBe('verified');expect(system(state,'calendar').status).toBe('verified');
  const connections=structuredClone(state.connections);state.asOf=new Date(Date.parse(state.asOf)+60000).toISOString();state.workspace.paused=false;
  state.onboarding=saveOnboarding(state,{...state.onboarding.answers,team:['appointment-coordinator']},0);
  expect(state.onboarding.revision).toBe(1);expect(state.onboarding.configurationRevision).toBe(0);
  expect(state.onboarding.configurationUpdatedAt).toBe(baseline.updatedAt);expect(state.onboarding.updatedAt).toBe(state.asOf);
  expect(state.connections).toEqual(connections);expect(hasCurrentCapabilitySource(state,'calendar.availability')).toBe(true);
  expect(system(state,'mail').status).toBe('verified');expect(state.workspace.paused).toBe(true);expect(state.onboarding.appliedRevision).toBeNull();
  const changed=structuredClone(state.onboarding.answers);changed.operations.dailyCapacity=2;
  state.onboarding=saveOnboarding(state,changed,1);
  expect(state.onboarding.configurationRevision).toBe(2);expect(state.onboarding.configurationUpdatedAt).toBe(state.asOf);
  expect(hasCurrentCapabilitySource(state,'calendar.availability')).toBe(false);
 });
 it('only asks for additional capability permissions when a new role needs them',()=>{
  const state=company();const connection=account(state);connection.operations=connection.operations.filter(op=>op!=='gmail.send');connection.scopes=connection.scopes.filter(scope=>!scope.endsWith('gmail.send'));state.connections=[connection];
  expect(system(state,'mail').status).toBe('verified'); // The read check remains true.
  expect(hasCurrentCapabilitySource(state,'gmail.reply_read')).toBe(true);expect(hasCurrentCapabilitySource(state,'gmail.send')).toBe(false);
  expect(companyConnectionCoverage(state).agents.find(a=>a.id==='deal-follow-up')!.missingCapabilities).toContain('gmail.send');
  expect(companyConnectionCoverage(state).agents.find(a=>a.id==='deal-follow-up')!.missingCurrentSystems).toContain('mail');
 });
 it('invalidates source proof when settings change, access expires, scopes are denied or resources are incomplete',()=>{
  const state=company();state.connections=[account(state)];state.asOf=new Date(Date.parse(state.asOf)+60000).toISOString();
  const answers=structuredClone(state.onboarding!.answers);answers.operations.dailyCapacity=3;
  state.onboarding=saveOnboarding(state,answers,state.onboarding!.revision);
  expect(system(state,'calendar').status).toBe('connected');expect(hasCurrentCapabilitySource(state,'calendar.book')).toBe(false);
  const connection=account(state);state.connections=[connection];connection.health='expired';expect(system(state,'mail').status).toBe('needs_access');expect(system(state,'mail').detail).toContain('expired');
  connection.health='revoked';expect(hasCurrentCapabilitySource(state,'gmail.send')).toBe(false);
  connection.health='failed';expect(system(state,'mail').detail).toContain('failed');
  connection.health='healthy';connection.scopes=[];expect(system(state,'mail').detail).toContain('partial');
  connection.scopes=account(state).scopes;connection.boundResources![1].resource='different@company.example';expect(hasCurrentCapabilitySource(state,'gmail.send')).toBe(false);
  connection.boundResources![0].range='';expect(system(state,'proposals').status).toBe('connected');
 });
 it('requires fresh live proposal evidence in addition to Sheets read access',()=>{
  const state=company();state.connections=[account(state)];expect(hasCurrentCapabilitySource(state,'proposals.current')).toBe(false);
  const proposal=state.proposals[0];proposal.fixture=false;proposal.sourceVerifiedAt=state.asOf;proposal.syncedAt=state.asOf;proposal.evidence.forEach(e=>e.quality='provider_verified');
  expect(hasCurrentCapabilitySource(state,'proposals.current')).toBe(true);
  proposal.sourceVerifiedAt='2020-01-01T00:00:00Z';expect(hasCurrentCapabilitySource(state,'proposals.current')).toBe(false);
 });
 it('does not present imported CSV or recorded future tools as verified integration',()=>{
  const state=company();const connection=account(state);connection.provider='csv';connection.operations=['proposals.read'];connection.scopes=[];connection.health='unconfigured';connection.verifiedAt=null;connection.boundResources=[{id:'00000000-0000-4000-8000-000000000031',type:'csv',resource:'csv-bootstrap',owner:'Owner',verifiedAt:null}];state.connections=[connection];
  expect(system(state,'proposals').status).toBe('connected');expect(hasCurrentCapabilitySource(state,'proposals.current')).toBe(false);
  state.onboarding!.answers.systems.push({id:'ads',kind:'advertising',tool:'Google Ads',availability:'available',resource:'1234',owner:'Owner',mapping:'',connectionId:connection.id});
  expect(system(state,'advertising').status).toBe('engineering_required');
 });
 it('does not recapture website facts or reset material stamps for navigation, team or measurement edits',()=>{
  const state=company(),original=state.onboarding!;
  state.asOf=new Date(Date.parse(state.asOf)+60000).toISOString();
  const answers=structuredClone(original.answers);answers.briefing=Briefing.parse({version:1,step:'welcome'});answers.measurement.owner='New measurement contact';
  state.onboarding=saveOnboarding(state,answers,original.revision);
  expect(state.onboarding.configurationRevision).toBe(original.configurationRevision);
  answers.briefing.goal='demand';state.onboarding=saveOnboarding(state,answers,state.onboarding.revision);
  expect(state.onboarding.configurationRevision).toBe(state.onboarding.revision);
 });
 it('uses captured website evidence, not a manually entered URL, and leaves all demos labeled',()=>{
  const state=company();expect(system(state,'website').status).toBe('needs_information');
  state.onboardingCapture={id:'00000000-0000-4000-8000-000000000041',sourceHash:'a'.repeat(64),fixture:false,pages:[{url:'https://company.example',title:'Company',description:'Services',text:'Company service facts',capturedAt:state.asOf}]};
  state.activation.confirmedFacts=false;expect(system(state,'website').status).toBe('connected');state.activation.confirmedFacts=true;expect(system(state,'website').status).toBe('verified');
  state.onboardingCapture.pages[0].url='https://unrelated.example';expect(system(state,'website').status).toBe('needs_access');
  state.workspace.mode='fixture';expect(system(state,'website').status).toBe('demo_only');
 });
});
