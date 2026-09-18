import {Briefing, type AppSnapshot, type OnboardingAnswers} from '../../contracts/src/index';
import {onboardingFor} from './onboarding';
import {cleanFact} from './onboarding-assist';
export type BriefingStep = Briefing['step'];
export const goals = [
 {id:'demand',label:'Get more qualified leads'},
 {id:'conversion',label:'Turn more inquiries into customers'},
 {id:'recover',label:'Follow up on open proposals'},
 {id:'other',label:'Something else'},
] as const;
export type GoalId = typeof goals[number]['id'];
/** Prefer the multi-select list; fall back to the legacy single `goal` field. */
export function chosenGoals(b:Pick<Briefing,'goal'|'goals'>):GoalId[]{
 return b.goals.length?b.goals:(b.goal?[b.goal as GoalId]:[]);
}
export function hasGoal(b:Pick<Briefing,'goal'|'goals'>,id:GoalId){return chosenGoals(b).includes(id);}
export function goalLabels(b:Pick<Briefing,'goal'|'goals'|'otherGoal'>){
 return chosenGoals(b).map(id=>id==='other'&&b.otherGoal.trim()?b.otherGoal:goals.find(g=>g.id===id)?.label??'').filter(Boolean);
}
export function setupGoal(b:Pick<Briefing,'goal'|'goals'>):'recover'|'demand'|'conversion'{
 const selected=chosenGoals(b);
 return selected.includes('recover')?'recover':selected.includes('conversion')?'conversion':'demand';
}
export const firstTasks = [
 {id:'search-growth',requiresModel:true,title:'A content brief for your ideal customer',why:'Give the right customers a useful reason to discover your business.',output:'A source-grounded outline for one useful article. Search demand still needs validation.'},
 {id:'landing-page-optimizer',requiresModel:true,title:'A clearer offer and call to action',why:'Help visitors understand your offer and take the next step.',output:'Suggested landing-page copy and a test hypothesis. Nothing is published; conversion uplift is unknown.'},
 {id:'account-intelligence',requiresModel:true,title:'A company positioning brief',why:'Establish the offer and customer context before preparing outreach.',output:'A reviewed-source company profile. This does not read proposals, find prospects or send follow-ups.'},
 {id:'technical-seo-monitor',requiresModel:false,title:'A check of your public website pages',why:'Find crawl issues and observed Google ranks before improving the site.',output:'A bounded crawl and rank snapshot for review. Copy-out is complete delivery; this does not write the CMS or use Search Console.'},
] as const;
export function briefingFor(state:AppSnapshot):Briefing {
 return Briefing.parse(onboardingFor(state).answers.briefing??{version:1,step:'welcome',name:state.setupIdentity?.name??''});
}
export function factsSignature(a:OnboardingAnswers){return JSON.stringify([a.company.name,a.company.website,a.company.offers,a.company.customers]);}
/** Readable briefing items: drop markdown, split run-on separators, sentence-case the first letter. */
export function presentFacts(values:string[]){
 const items:string[]=[];const seen=new Set<string>();
 for(const value of values){
  for(const part of value.split(/\s*[·•]\s+/)){
   const cleaned=cleanFact(part);
   if(!cleaned)continue;
   const presented=cleaned.charAt(0).toLocaleUpperCase()+cleaned.slice(1);
   const key=presented.toLocaleLowerCase();
   if(seen.has(key))continue;seen.add(key);items.push(presented);
  }
 }
 return items;
}
export function factsReviewed(a:OnboardingAnswers){return !!a.company.name&&a.company.offers.length>0&&a.company.customers.length>0&&a.briefing?.reviewedFacts===factsSignature(a);}
export function briefingFinished(a:OnboardingAnswers){return !!a.briefing?.finished&&chosenGoals(a.briefing).length>0&&factsReviewed(a);}
export function normalizeWebsite(value:string){
 const url=new URL(/^[a-z][a-z\d+.-]*:/i.test(value.trim())?value.trim():`https://${value.trim()}`);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!url.hostname.includes('.'))throw new Error('Enter a public company website, for example example.com.');
 url.hash='';return url.href;
}
export function recommendedTask(state:AppSnapshot,b:Briefing){
 const primary=chosenGoals(b)[0];
 const preferred=primary==='demand'?'search-growth':primary==='conversion'?'landing-page-optimizer':'account-intelligence';
 const available=firstTasks.filter(t=>state.catalog.some(a=>a.id===t.id&&(a.releaseStatus==='implemented'||(a.releaseStatus==='pilot'&&a.modes.includes('preparation')))&&a.supportedArchetypes.includes(onboardingFor(state).answers.company.businessModel)));
 return available.find(t=>t.id===b.task)??(state.workspace.mode!=='fixture'&&state.preparationRuntime?.configured===false?available.find(t=>!t.requiresModel):undefined)??available.find(t=>t.id===preferred)??available[0];
}
/** Saved first-task screens stay parseable; the live briefing no longer visits them. */
export const firstTaskSteps=['recommendation','access','budget','review'] as const satisfies readonly BriefingStep[];
export function resolveBriefingStep(step:BriefingStep):BriefingStep{
 return (firstTaskSteps as readonly BriefingStep[]).includes(step)?'finish':step;
}
/** Stable IDs and explicit branches; answers in other branches are retained. */
export function briefingPath(a:OnboardingAnswers,b:Briefing):BriefingStep[]{
 return ['welcome','website',...(b.noWebsite?['description' as const]:[]),...(!b.name?['name' as const]:[]),'goal',...(hasGoal(b,'other')?['other-goal' as const]:[]),'research',...(!a.company.name?['company-name' as const]:[]),...(!a.company.offers.length?['offer' as const]:[]),...(!a.company.customers.length?['customers' as const]:[]),'summary',...(hasGoal(b,'recover')?['proposal-source' as const]:[]),...(hasGoal(b,'conversion')?['conversion-action' as const]:[]),'finish'];
}
export function nextBriefingStep(step:BriefingStep,a:OnboardingAnswers,b:Briefing):BriefingStep {
 // Missing-fact screens disappear once answered, so order by the complete stable sequence.
 const order:BriefingStep[]=['welcome','website','description','name','goal','other-goal','research','company-name','offer','customers','summary','proposal-source','conversion-action','recommendation','access','budget','review','finish'];
 return briefingPath(a,b).find(s=>order.indexOf(s)>order.indexOf(step))??'finish';
}
export function briefingNextAction(state:AppSnapshot){
 const a=onboardingFor(state).answers;
 if(!chosenGoals(a.briefing??{goals:[],goal:''}).length)return 'Choose what would make the biggest difference.';
 if(!factsReviewed(a))return 'Review your business summary.';
 if(!a.briefing?.finished)return 'Finish your business briefing.';
 return 'Your business context is saved. Continue setup when you’re ready to connect sources.';
}

/** Reuse matching work across navigation/permission revisions, but never different source or goal facts. */
export function currentBriefingArtifacts(state:AppSnapshot){
 const a=onboardingFor(state).answers,b=briefingFor(state),task=recommendedTask(state,b);
 const required=[`Company: ${a.company.name}`,`Owner-approved brand guidance: ${a.company.brandGuidance}`,`Owner-prohibited claims: ${a.company.forbiddenClaims}`,...a.company.offers.map(v=>`Approved offer: ${v}`),...a.company.customers.map(v=>`Confirmed customer type: ${v}`),...(a.company.priorities.length?[`Owner-selected objective: ${a.company.priorities.join(' · ')}`]:[]),...(hasGoal(b,'conversion')&&b.conversionAction?[`Owner-selected visitor action: ${b.conversionAction}`]:[])];
 return state.artifacts.filter(o=>o.agentId===task?.id&&o.workspaceId===state.workspace.id&&required.every(f=>o.factualInputs.includes(f))&&state.activation.confirmedFacts&&(state.workspace.mode==='fixture'||state.currentPreparationArtifactIds?.includes(o.id)));
}
