import {describe,it,expect} from 'vitest';
import {createFixtureState,executeCommand,onboardingFor} from '@david/domain';
import {Briefing,OnboardingAnswers} from '@david/contracts';
import {briefingFor,briefingPath,nextBriefingStep,normalizeWebsite,recommendedTask,factsSignature,factsReviewed,briefingFinished} from '../packages/domain/src/briefing';
describe('conversational briefing',()=>{
 it('normalizes common website inputs and refuses non-web protocols and embedded credentials',()=>{
  expect(normalizeWebsite(' example.com ')).toBe('https://example.com/');
  for(const value of ['javascript:alert(1)','ftp://example.com','https://user:pass@example.com','localhost'])expect(()=>normalizeWebsite(value)).toThrow();
 });
 it('skips known names, branches by objective and retains unrelated answers',()=>{
  const state=createFixtureState(),a=onboardingFor(state).answers,b=briefingFor(state);
  b.name='Known Owner';b.goal='recover';b.proposalSource='Existing CRM';
  expect(briefingPath(a,b)).not.toContain('name');expect(briefingPath(a,b)).toContain('proposal-source');expect(briefingPath(a,b)).not.toContain('conversion-action');
  b.goal='conversion';expect(briefingPath(a,b)).toContain('conversion-action');expect(briefingPath(a,b)).not.toContain('proposal-source');expect(b.proposalSource).toBe('Existing CRM');
  b.goal='other';expect(briefingPath(a,b)).toContain('other-goal');
  b.noWebsite=true;expect(briefingPath(a,b)).toContain('description');
 });
 it('does not skip the next missing fact after an answer removes its own conditional screen',()=>{
  const state=createFixtureState(),a=onboardingFor(state).answers,b=briefingFor(state);a.company.offers=['Advisory'];a.company.customers=[];
  expect(nextBriefingStep('offer',a,b)).toBe('customers');a.company.customers=['Business owners'];expect(nextBriefingStep('customers',a,b)).toBe('summary');
 });
 it('recommends a catalog-backed deliverable and updates recommendation when the goal changes',()=>{
  const state=createFixtureState(),b=briefingFor(state);b.goal='recover';expect(recommendedTask(state,b)?.id).toBe('account-intelligence');
  b.goal='conversion';expect(recommendedTask(state,b)?.id).toBe('landing-page-optimizer');b.goal='demand';expect(recommendedTask(state,b)?.id).toBe('search-growth');
  state.catalog.forEach(a=>a.releaseStatus='planned');expect(recommendedTask(state,b)).toBeUndefined();
 });
 it('autosaves and resumes briefing without authorizing execution or inventing evidence',async()=>{
  const state=createFixtureState(),a=onboardingFor(state).answers;a.briefing=Briefing.parse({version:1,step:'goal',description:'Our own business description',noWebsite:true});
  await executeCommand(state,{type:'save_onboarding',expectedRevision:0,answers:a});
  expect(briefingFor(state).step).toBe('goal');expect(onboardingFor(state).answers.operations.modelDailyBudgetMinor).toBeNull();expect(onboardingFor(state).answers.operations.policyAcknowledged).toBe(false);expect(state.artifacts).toHaveLength(0);expect(state.onboardingCapture).toBeUndefined();
  expect(briefingFor(createFixtureState('other')).description).toBe('');
  await expect(executeCommand(state,{type:'save_onboarding',expectedRevision:0,answers:a})).rejects.toThrow('another session');
 });
 it('visiting finish or changing facts cannot count as reviewed completion',()=>{
  const a=onboardingFor(createFixtureState()).answers;a.briefing=Briefing.parse({version:1,step:'finish',finished:true,goal:'demand',task:'search-growth'});
  expect(briefingFinished(a)).toBe(false);a.company.offers=['Advisory'];a.company.customers=['Owners'];a.briefing.reviewedFacts=factsSignature(a);expect(factsReviewed(a)).toBe(true);expect(briefingFinished(a)).toBe(true);
  a.company.offers=['Changed'];expect(briefingFinished(a)).toBe(false);
 });
 it('rejects unknown steps, invalid spending and injected authority fields',()=>{
  expect(Briefing.safeParse({version:1,step:'activate-everything'}).success).toBe(false);
  const a=onboardingFor(createFixtureState()).answers;a.briefing=Briefing.parse({version:1,step:'goal'});
  expect(OnboardingAnswers.safeParse({...a,briefing:{...a.briefing,authorized:true}}).success).toBe(false);
  expect(OnboardingAnswers.safeParse({...a,operations:{...a.operations,modelDailyBudgetMinor:-1}}).success).toBe(false);
 });
 it('retains owner-only restrictions for all briefing writes',async()=>{
  const state=createFixtureState();state.context.role='workspace_viewer';const a=onboardingFor(state).answers;a.briefing=Briefing.parse({version:1,step:'goal'});
  await expect(executeCommand(state,{type:'save_onboarding',expectedRevision:0,answers:a})).rejects.toThrow('membership');
 });
});
describe('runtime-aware first work',()=>{
 it('offers an implemented non-model check when model setup is unavailable and omits model-budget questions',()=>{
  const state=createFixtureState();state.workspace.mode='shadow';state.preparationRuntime={configured:false,message:'Not configured'};
  const b=briefingFor(state);b.goal='conversion';expect(recommendedTask(state,b)?.id).toBe('technical-seo-monitor');b.task='technical-seo-monitor';expect(briefingPath(onboardingFor(state).answers,b)).not.toContain('budget');
  b.task='landing-page-optimizer';expect(recommendedTask(state,b)?.requiresModel).toBe(true);expect(briefingPath(onboardingFor(state).answers,b)).toContain('budget');
 });
});
it('reuses an unchanged output across navigation revisions but excludes changed business facts',async()=>{
 const {currentBriefingArtifacts}=await import('../packages/domain/src/briefing');
 const state=createFixtureState();await executeCommand(state,{type:'sample_onboarding_capture'});
 const a=onboardingFor(state).answers;a.company.offers=['Consulting'];a.company.customers=['Owners'];a.company.priorities=['Qualified inquiries'];a.briefing=Briefing.parse({version:1,step:'finish',goal:'demand',task:'search-growth'});
 await executeCommand(state,{type:'save_onboarding',expectedRevision:0,answers:a});await executeCommand(state,{type:'confirm_sample_company',expectedRevision:1});
 await executeCommand(state,{type:'select_team',agentIds:['search-growth']});await executeCommand(state,{type:'pause',paused:false});await executeCommand(state,{type:'prepare',agentId:'search-growth'});
 expect(currentBriefingArtifacts(state)).toHaveLength(1);
 const saved=structuredClone(onboardingFor(state).answers);saved.briefing!.step='summary';await executeCommand(state,{type:'save_onboarding',expectedRevision:1,answers:saved});expect(currentBriefingArtifacts(state)).toHaveLength(1);
 saved.company.offers=['Different offer'];await executeCommand(state,{type:'save_onboarding',expectedRevision:2,answers:saved});expect(currentBriefingArtifacts(state)).toHaveLength(0);
});
