import {Briefing, type AppSnapshot, type OnboardingAnswers} from '../../contracts/src/index';
import {onboardingFor} from './onboarding';
export type BriefingStep = Briefing['step'];
export const goals = [
 {id:'demand',label:'Get more qualified leads'},
 {id:'conversion',label:'Turn more inquiries into customers'},
 {id:'recover',label:'Follow up on open proposals'},
 {id:'other',label:'Something else'},
] as const;
export const firstTasks = [
 {id:'search-growth',requiresModel:true,title:'A content brief for your ideal customer',why:'Give the right customers a useful reason to discover your business.',output:'A source-grounded outline for one useful article. Search demand still needs validation.'},
 {id:'landing-page-optimizer',requiresModel:true,title:'A clearer offer and call to action',why:'Help visitors understand your offer and take the next step.',output:'Suggested landing-page copy and a test hypothesis. Nothing is published; conversion uplift is unknown.'},
 {id:'account-intelligence',requiresModel:true,title:'A company positioning brief',why:'Establish the offer and customer context before preparing outreach.',output:'A reviewed-source company profile. This does not read proposals, find prospects or send follow-ups.'},
 {id:'technical-seo-monitor',requiresModel:false,title:'A check of your public website pages',why:'Find missing titles, descriptions and limited readable content before improving the site.',output:'A captured-page checklist for review. This does not measure rankings, indexing or conversion.'},
] as const;
export function briefingFor(state:AppSnapshot):Briefing {
 return Briefing.parse(onboardingFor(state).answers.briefing??{version:1,step:'welcome',name:state.setupIdentity?.name??''});
}
export function factsSignature(a:OnboardingAnswers){return JSON.stringify([a.company.name,a.company.website,a.company.offers,a.company.customers]);}
export function factsReviewed(a:OnboardingAnswers){return !!a.company.name&&a.company.offers.length>0&&a.company.customers.length>0&&a.briefing?.reviewedFacts===factsSignature(a);}
export function briefingFinished(a:OnboardingAnswers){return !!a.briefing?.finished&&!!a.briefing.goal&&!!a.briefing.task&&factsReviewed(a);}
export function normalizeWebsite(value:string){
 const url=new URL(/^[a-z][a-z\d+.-]*:/i.test(value.trim())?value.trim():`https://${value.trim()}`);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!url.hostname.includes('.'))throw new Error('Enter a public company website, for example example.com.');
 url.hash='';return url.href;
}
export function recommendedTask(state:AppSnapshot,b:Briefing){
 const preferred=b.goal==='demand'?'search-growth':b.goal==='conversion'?'landing-page-optimizer':'account-intelligence';
 const available=firstTasks.filter(t=>state.catalog.some(a=>a.id===t.id&&a.releaseStatus==='implemented'&&a.supportedArchetypes.includes(onboardingFor(state).answers.company.businessModel)));
 return available.find(t=>t.id===b.task)??(state.workspace.mode!=='fixture'&&state.preparationRuntime?.configured===false?available.find(t=>!t.requiresModel):undefined)??available.find(t=>t.id===preferred)??available[0];
}
/** Stable IDs and explicit branches; answers in other branches are retained. */
export function briefingPath(a:OnboardingAnswers,b:Briefing):BriefingStep[]{
 return ['welcome','website',...(b.noWebsite?['description' as const]:[]),...(!b.name?['name' as const]:[]),'goal',...(b.goal==='other'?['other-goal' as const]:[]),'research',...(!a.company.name?['company-name' as const]:[]),...(!a.company.offers.length?['offer' as const]:[]),...(!a.company.customers.length?['customers' as const]:[]),'summary',...(b.goal==='recover'?['proposal-source' as const]:b.goal==='conversion'?['conversion-action' as const]:[]),'recommendation','access',...(b.task==='technical-seo-monitor'?[]:['budget' as const]),'review','finish'];
}
export function nextBriefingStep(step:BriefingStep,a:OnboardingAnswers,b:Briefing):BriefingStep {
 // Missing-fact screens disappear once answered, so order by the complete stable sequence.
 const order:BriefingStep[]=['welcome','website','description','name','goal','other-goal','research','company-name','offer','customers','summary','proposal-source','conversion-action','recommendation','access','budget','review','finish'];
 return briefingPath(a,b).find(s=>order.indexOf(s)>order.indexOf(step))??'finish';
}
export function briefingNextAction(state:AppSnapshot){
 const a=onboardingFor(state).answers;
 if(!factsReviewed(a))return 'Review your business summary.';
 if(!a.company.website||!state.onboardingCapture||!state.activation.confirmedFacts)return a.company.website?'Capture and confirm the website source before preparation.':'Add a public website when available. Manual context is saved, but this release requires website evidence for preparation.';
 if(a.briefing?.task==='technical-seo-monitor'){return !a.operations.policyAcknowledged||onboardingFor(state).appliedRevision!==onboardingFor(state).revision?'Review the permission for the captured-page check. It does not use a model.':'Request the captured-page check. It uses approved source data without model spending.';}
 if(state.workspace.mode!=='fixture'&&state.preparationRuntime?.configured===false)return state.preparationRuntime.message;
 if(a.operations.modelDailyBudgetMinor===null)return 'Choose a spending limit before model work.';
 if(a.operations.modelDailyBudgetMinor===0)return 'Model spending is disabled by your choice. Set a budget when you want a preparation.';
 if(!a.operations.policyAcknowledged||onboardingFor(state).appliedRevision!==onboardingFor(state).revision)return 'Review and apply the operating permission for this preparation.';
 return state.readiness.blockers.find(b=>b.code.includes('model')||b.code.includes('preparation'))?.nextStep??'Request the preparation; the server will check source freshness, capacity and runtime configuration.';
}

/** Reuse matching work across navigation/permission revisions, but never different source or goal facts. */
export function currentBriefingArtifacts(state:AppSnapshot){
 const a=onboardingFor(state).answers,b=briefingFor(state),task=recommendedTask(state,b);
 const required=[`Company: ${a.company.name}`,`Owner-approved brand guidance: ${a.company.brandGuidance}`,`Owner-prohibited claims: ${a.company.forbiddenClaims}`,...a.company.offers.map(v=>`Approved offer: ${v}`),...a.company.customers.map(v=>`Confirmed customer type: ${v}`),...(a.company.priorities.length?[`Owner-selected objective: ${a.company.priorities.join(' · ')}`]:[]),...(b.goal==='conversion'&&b.conversionAction?[`Owner-selected visitor action: ${b.conversionAction}`]:[])];
 return state.artifacts.filter(o=>o.agentId===task?.id&&o.workspaceId===state.workspace.id&&required.every(f=>o.factualInputs.includes(f))&&state.activation.confirmedFacts&&(state.workspace.mode==='fixture'||state.currentPreparationArtifactIds?.includes(o.id)));
}
