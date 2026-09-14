import { describe, it, expect } from 'vitest';
import { createFixtureState, executeCommand, snapshot, onboardingFor, onboardingReport } from '@david/domain';
import { Command, OnboardingAnswers, OnboardingRecord } from '@david/contracts';

function configured(){const state=createFixtureState();const answers=structuredClone(onboardingFor(state).answers);Object.assign(answers.company,{website:'https://example.invalid',offers:['Advisory'],customers:['B2B owners'],priorities:['Recover proposals'],successDefinition:'Reviewed replies and bookings'});answers.team=['account-intelligence'];answers.systems=[{id:'website',kind:'website',tool:'Website',availability:'available',resource:'https://example.invalid',owner:'Owner',connectionId:'',mapping:''}];answers.operations.policyAcknowledged=true;answers.operations.escalationOwner='operator@example.invalid';answers.operations.modelDailyBudgetMinor=500;answers.operations.dailyCapacity=2;answers.people=[{name:'Owner',email:'owner@example.invalid',responsibility:'approver',role:'workspace_owner'}];answers.measurement.owner='Owner';answers.measurement.outcomeSources='Owner-confirmed CRM status; payment source unavailable';answers.measurement.baseline=[{metric:'Replies',value:null,unit:'count',source:'',asOf:''}];return {state,answers};}

describe('repeatable onboarding',()=>{
 it('saves shared answers with revision history, isolates workspaces and rejects stale edits',async()=>{
  const {state,answers}=configured();const other=createFixtureState('northstar');
  await executeCommand(state,{type:'save_onboarding',expectedRevision:0,answers});
  expect(snapshot(state).onboarding?.answers.company.offers).toEqual(['Advisory']);
  expect(onboardingFor(other).revision).toBe(0);
  await expect(executeCommand(state,{type:'save_onboarding',expectedRevision:0,answers})).rejects.toThrow('another session');
  expect(onboardingFor(state).history).toHaveLength(1);
 });
 it('invalidates existing approval and pauses when operating settings change',async()=>{
  const {state,answers}=configured();await executeCommand(state,{type:'draft',proposalId:state.proposals[0].id});
  await executeCommand(state,{type:'approve',actionId:state.actions[0].id});
  await executeCommand(state,{type:'save_onboarding',expectedRevision:0,answers});
  expect(state.workspace.paused).toBe(true);expect(state.approvals[0].status).toBe('invalidated');
 });
 it('does not turn information or fixture activity into verified live readiness',async()=>{
  const {state,answers}=configured();await executeCommand(state,{type:'save_onboarding',expectedRevision:0,answers});
  const report=onboardingReport(state);expect(report.agents).toHaveLength(32);expect(report.complete.slice(0,5)).toEqual([true,true,true,true,true]);expect(report.complete[5]).toBe(false);
  expect(report.agents.find(a=>a.id==='account-intelligence')?.status).toBe('demo_only');
  expect(report.agents.find(a=>a.id==='paid-campaign-operator')?.status).toBe('engineering_required');
 });
 it('distinguishes expired access from missing information and missing engineering',async()=>{
  const {state,answers}=configured();answers.team=['deal-follow-up'];answers.systems=[...answers.systems,{id:'proposals',kind:'proposals',tool:'Sheets',availability:'available',resource:'sheet-id',owner:'Owner',mapping:'',connectionId:''},{id:'mail',kind:'mail',tool:'Gmail',availability:'available',resource:'owner@example.invalid',owner:'Owner',mapping:'',connectionId:''}];
  await executeCommand(state,{type:'save_onboarding',expectedRevision:0,answers});state.workspace.mode='live';state.connections.forEach(c=>{c.health='expired';});
  expect(onboardingReport(state).agents.find(a=>a.id==='deal-follow-up')?.status).toBe('access_required');
 });
 it('enforces allowance and prevents owners granting their own expanded access',async()=>{
  const {state,answers}=configured();answers.team=state.catalog.slice(0,6).map(a=>a.id);
  await expect(executeCommand(state,{type:'save_onboarding',expectedRevision:0,answers})).rejects.toThrow('allowance');
  await expect(executeCommand(state,{type:'set_allowance',allowance:32})).rejects.toThrow('operator');
  state.context.role='david_operator';await executeCommand(state,{type:'set_allowance',allowance:32});
  answers.team=state.catalog.map(a=>a.id);await executeCommand(state,{type:'save_onboarding',expectedRevision:0,answers});
  expect(onboardingFor(state).answers.team).toHaveLength(32);
  expect(onboardingReport(state).agents.find(a=>a.id==='abandoned-cart-recovery')?.status).toBe('not_applicable');
 });
 it('denies viewer/member and cross-workspace configuration',async()=>{
  const {state,answers}=configured();for(const role of ['workspace_viewer','workspace_member'] as const){await expect(executeCommand(state,{type:'save_onboarding',expectedRevision:0,answers},{...state.context,role})).rejects.toThrow();}
  await expect(executeCommand(state,{type:'save_onboarding',expectedRevision:0,answers},{...createFixtureState('other').context})).rejects.toThrow('match');
  expect(onboardingFor(state).revision).toBe(0);
 });
 it('requires explicit automation acknowledgement and validates operating fields',()=>{
  const {answers}=configured();answers.operations.approvalMode='bounded_follow_up';expect(OnboardingAnswers.safeParse(answers).success).toBe(false);answers.operations.automationAcknowledged=true;expect(OnboardingAnswers.safeParse(answers).success).toBe(true);
  answers.operations.endHour=8;expect(OnboardingAnswers.safeParse(answers).success).toBe(false);
  expect(Command.safeParse({type:'save_onboarding',expectedRevision:0,answers,verified:true}).success).toBe(false);
 });
 it('records assistance ownership and allows only operator resolution without proving readiness',async()=>{
  const {state,answers}=configured();await executeCommand(state,{type:'save_onboarding',expectedRevision:0,answers});
  const task={type:'onboarding_task' as const,expectedRevision:1,taskId:'google-admin',title:'Grant account access',owner:'Admin',note:'',status:'open' as const};
  await executeCommand(state,task);await expect(executeCommand(state,{...task,status:'resolved',note:'Checked'})).rejects.toThrow('operator');
  state.context.role='david_operator';await executeCommand(state,{...task,status:'resolved',note:'Account owner contacted'});
  expect(onboardingFor(state).tasks[0].status).toBe('resolved');expect(onboardingReport(state).complete[5]).toBe(false);
 });
 it('applies selected team and limits without resuming or creating real authority',async()=>{
  const {state,answers}=configured();await executeCommand(state,{type:'save_onboarding',expectedRevision:0,answers});await executeCommand(state,{type:'apply_onboarding',expectedRevision:1});
  expect(state.activation.selectedTeam).toEqual(['account-intelligence']);expect(state.policy.dailyActionLimit).toBe(2);expect(state.workspace.paused).toBe(true);expect(state.policy.requireApproval).toBe(true);expect(state.installations[0].dailyCapacity).toBe(2);
 });
 it('labels demo invitations and keeps them scoped to the selected workspace',async()=>{
  const {state}=configured();const result=await executeCommand(state,{type:'create_invitation',email:'admin@example.invalid',role:'workspace_owner'});
  expect(result.invitationUrl).toBeUndefined();expect(result.message).toContain('No email was sent');
  expect(onboardingFor(state).invitations).toHaveLength(1);expect(onboardingFor(createFixtureState('northstar')).invitations).toHaveLength(0);
 });
 it('requires a reviewed output at the current applied revision, and rejection removes readiness',async()=>{
  const {state,answers}=configured();await executeCommand(state,{type:'save_onboarding',expectedRevision:0,answers});await executeCommand(state,{type:'apply_onboarding',expectedRevision:1});
  await executeCommand(state,{type:'pause',paused:false});await executeCommand(state,{type:'prepare',agentId:'account-intelligence'});
  const artifact=state.artifacts.at(-1)!;await executeCommand(state,{type:'review_artifact',artifactId:artifact.id,decision:'reviewed'});
  // Supply explicit retained source evidence to exercise the operational report, never the public demo.
  state.workspace.mode='shadow';state.context.environment='shadow';state.activation.confirmedFacts=true;state.onboardingCapture={id:artifact.id,sourceHash:'a'.repeat(64),fixture:false,pages:[{url:answers.company.website,title:'Reviewed company',description:'Advisory',text:'Reviewed company facts',capturedAt:state.asOf}]};artifact.sourceSnapshot.forEach(e=>e.quality='manually_reported');
  expect(onboardingReport(state).agents.find(a=>a.id==='account-intelligence')?.status).toBe('ready');
  await executeCommand(state,{type:'review_artifact',artifactId:artifact.id,decision:'rejected'});
  expect(onboardingReport(state).complete[5]).toBe(false);
  await executeCommand(state,{type:'review_artifact',artifactId:artifact.id,decision:'reviewed'});
  answers.operations.dailyCapacity=3;await executeCommand(state,{type:'save_onboarding',expectedRevision:1,answers});
  expect(onboardingReport(state).complete[5]).toBe(false);
  expect(onboardingReport(state).agents.find(a=>a.id==='account-intelligence')?.missing).toContain('Apply the current reviewed settings before activation.');
 });
 it('retains a reviewed preparation across team changes but not changed operating configuration',async()=>{
  const {state,answers}=configured();await executeCommand(state,{type:'save_onboarding',expectedRevision:0,answers});await executeCommand(state,{type:'apply_onboarding',expectedRevision:1});
  await executeCommand(state,{type:'pause',paused:false});await executeCommand(state,{type:'prepare',agentId:'account-intelligence'});
  const artifact=state.artifacts.at(-1)!;await executeCommand(state,{type:'review_artifact',artifactId:artifact.id,decision:'reviewed'});
  state.workspace.mode='shadow';state.context.environment='shadow';state.activation.confirmedFacts=true;state.onboardingCapture={id:artifact.id,sourceHash:'a'.repeat(64),fixture:false,pages:[{url:answers.company.website,title:'Reviewed company',description:'Advisory',text:'Reviewed company facts',capturedAt:state.asOf}]};artifact.sourceSnapshot.forEach(e=>e.quality='manually_reported');
  answers.team=['account-intelligence','technical-seo-monitor'];await executeCommand(state,{type:'save_onboarding',expectedRevision:1,answers});
  let report=onboardingReport(state).agents.find(a=>a.id==='account-intelligence')!;
  expect(report.missing).not.toContain('Generate and review a current source-backed preparation.');
  expect(report.missing).toContain('Apply the current reviewed settings before activation.');expect(state.workspace.paused).toBe(true);
  answers.operations.dailyCapacity=3;await executeCommand(state,{type:'save_onboarding',expectedRevision:2,answers});
  report=onboardingReport(state).agents.find(a=>a.id==='account-intelligence')!;
  expect(report.missing).toContain('Generate and review a current source-backed preparation.');
 });
 it('keeps missing source information distinct from administrator account access',async()=>{
  const {state,answers}=configured();answers.systems=[];await executeCommand(state,{type:'save_onboarding',expectedRevision:0,answers});
  expect(onboardingReport(state).agents.find(a=>a.id==='account-intelligence')?.status).toBe('information_required');
  answers.systems=[{id:'web',kind:'website',tool:'Website',availability:'admin_needed',resource:'',owner:'Administrator',mapping:'',connectionId:''}];
  await executeCommand(state,{type:'save_onboarding',expectedRevision:1,answers});
  expect(onboardingReport(state).agents.find(a=>a.id==='account-intelligence')?.status).toBe('access_required');
 });
 it('accepts PostgreSQL timestamp offsets without losing revision evidence',()=>{
  const {state}=configured();const record=onboardingFor(state);record.updatedAt='2026-09-11T12:00:00+00:00';
  expect(OnboardingRecord.parse(record).updatedAt).toBe(record.updatedAt);
 });

});
