import { emptyOnboarding, OnboardingAnswers, type AppSnapshot, OnboardingRecord, type Command } from '../../contracts/src/index';

import {agentSystemRequirements, configurationBoundary, hasConfiguredCompanySource, hasCurrentCapabilitySource, onboardingConfiguration, type SystemKind} from './company-connections';

export function onboardingFor(state:AppSnapshot):OnboardingRecord {return state.onboarding ? OnboardingRecord.parse(state.onboarding) : emptyOnboarding(state.workspace,state.asOf);}
export function onboardingReport(state:AppSnapshot) {
 const record=onboardingFor(state),a=record.answers,boundary=configurationBoundary(state);
 const saved=record.revision>0;
 const sourceInformationSaved=(a.systems.length>0||(['website','proposals','mail','calendar'] as const).some(kind=>hasConfiguredCompanySource(state,kind)))&&a.systems.every(s=>hasConfiguredCompanySource(state,s.kind)||!!s.tool&&!!s.owner&&(s.availability!=='available'||!!s.resource));
 const complete=[saved&&!!(a.company.name&&a.company.website&&a.company.offers.length&&a.company.customers.length&&a.company.priorities.length&&a.company.successDefinition),saved&&a.team.length>0,saved&&sourceInformationSaved,saved&&a.operations.policyAcknowledged&&!!a.operations.escalationOwner&&a.operations.modelDailyBudgetMinor!==null,saved&&a.people.some(p=>p.responsibility==='approver'&&p.role==='workspace_owner')&&!!a.measurement.owner&&!!a.measurement.outcomeSources&&a.measurement.baseline.length>0&&a.measurement.baseline.every(b=>!!b.metric&&!!b.unit&&(b.value===null||!!b.source))];
 const agents=state.catalog.map(agent=>{
  const selected=a.team.includes(agent.id),requiredSystems=agentSystemRequirements[agent.id]??['other'];
  const missing:string[]=[];
  let status='ready';
  const add=(kind:string,message:string)=>{if(status==='ready')status=kind;missing.push(message);};
  if(!agent.supportedArchetypes.includes(a.company.businessModel))add('not_applicable','This responsibility does not apply to the selected business model.');
  if(agent.releaseStatus==='planned')add('engineering_required','This capability still requires implementation and provider integration.');
  const preparationFacts=!!(a.company.name&&a.company.website&&a.company.offers.length&&a.company.customers.length);
  const preparationPermission=complete[3]&&a.people.some(p=>p.responsibility==='approver'&&p.role==='workspace_owner');
  if(agent.releaseStatus==='implemented'?(!preparationFacts||!preparationPermission):(!complete[0]||!complete[3]||!complete[4]))add('information_required',agent.releaseStatus==='implemented'?'Review company facts, an approver and operating limits for this preparation.':'Complete company, operating rules, approver and measurement details.');
  // Preparation capabilities currently read approved website snapshots. Other systems are future dependencies,
  // not a claim that these preparations read Drive, ads, social platforms or search analytics today.
  const needed:SystemKind[]=agent.releaseStatus==='implemented'?['website']:requiredSystems;
  for(const kind of needed){
   if(hasConfiguredCompanySource(state,kind))continue;
   const system=a.systems.find(s=>s.kind===kind);
   if(system?.availability==='admin_needed')add('access_required',`An administrator must authorize the ${kind} source.`);
   else if(!system||system.availability!=='available'||!system.resource||!system.owner)add('information_required',`Select an available ${kind} source and its owner.`);
  }
  if(agent.releaseStatus!=='planned'){
   if(state.workspace.mode==='fixture')add('demo_only','Synthetic verification only. Live account checks require the operational deployment.');
   else {
    for(const cap of agent.requiredCapabilities){
     if(!['cohort.enrolled','conversation.assignment'].includes(cap)&&!hasCurrentCapabilitySource(state,cap))add('access_required',cap==='company.confirmed'||cap==='website.captured'?'Capture and confirm current company source evidence in Connections.':`Verify fresh access for ${cap} after the latest configuration change.`);
    }
   }
   if(agent.releaseStatus==='implemented'){
    if(!state.artifacts.some(o=>o.workspaceId===state.workspace.id&&o.agentId===agent.id&&o.reviewState==='reviewed'&&record.reviews.some(r=>r.artifactId===o.id&&(r.configurationRevision??r.revision)===boundary.revision)&&o.sourceSnapshot.length>0&&o.sourceSnapshot.every(e=>state.workspace.mode==='fixture'?e.quality==='fixture':e.quality!=='fixture'&&e.quality!=='unknown')))add('verification_required','Generate and review a current source-backed preparation.');
   }else {
    const type=agent.id==='deal-follow-up'?'send_follow_up':'book_appointment';
    if(!state.actions.some(action=>action.workspaceId===state.workspace.id&&action.type===type&&state.receipts.some(r=>r.actionId===action.id&&r.provider==='google'&&['provider_accepted','confirmed'].includes(r.status)&&Date.parse(r.observedAt)>=Date.parse(boundary.updatedAt))))add('verification_required','Verify the first approved real action and retain its provider receipt.');
    if(!state.readiness.action)add('access_required','Resolve the execution readiness checks before activation.');
   }
  }
  if(!state.installations.some(i=>i.agentId===agent.id&&i.dailyCapacity>0&&!['selected','paused','blocked','failed','connection_expired'].includes(i.status)))add('verification_required','An enabled installation with positive capacity is required.');
  if(record.appliedRevision!==record.revision)add('verification_required','Apply the current reviewed settings before activation.');
  if(state.workspace.paused)add('paused','Workspace is paused. Review and apply settings before resuming.');
  return {id:agent.id,name:agent.name,selected,status,missing,requiredSystems,requiredCapabilities:agent.requiredCapabilities};
 });
 return {complete:[...complete,saved&&a.team.length>0&&agents.filter(a=>a.selected).every(a=>a.status==='ready')],agents};
}
export function saveOnboarding(state:AppSnapshot,answers:OnboardingAnswers,expectedRevision:number):OnboardingRecord {
 const old=onboardingFor(state);if(old.revision!==expectedRevision)throw new Error('Setup changed in another session. Reload before saving; your changes were not applied.');
 const a=OnboardingAnswers.parse(answers);
 if(a.team.length>(state.workspace.entitlement??5))throw new Error('Selected team exceeds the configured workspace allowance.');
 if(a.team.some(id=>!state.catalog.some(c=>c.id===id)))throw new Error('Unknown agent selected.');
 const initialized=old.configurationRevision!==undefined&&old.configurationUpdatedAt!==undefined;
 const material=(old.revision===0&&!initialized)||JSON.stringify(onboardingConfiguration(old.answers))!==JSON.stringify(onboardingConfiguration(a));
 const critical=material||JSON.stringify(old.answers.team)!==JSON.stringify(a.team);
 if(critical){state.workspace.paused=true;state.approvals.filter(ap=>(ap.status==='pending'||ap.status==='approved')&&state.actions.some(action=>action.id===ap.actionId&&action.status==='not_attempted')).forEach(ap=>ap.status='invalidated');}
 const revision=old.revision+1;
 return {...old,answers:a,revision,configurationRevision:material?revision:(old.configurationRevision??old.revision),configurationUpdatedAt:material?state.asOf:(old.configurationUpdatedAt??old.updatedAt),updatedAt:state.asOf,updatedBy:state.context.actorId,history:[{revision,at:state.asOf,actor:state.context.actorId,summary:critical?'Configuration changed; execution paused and affected approvals invalidated.':'Onboarding answers saved.'},...old.history].slice(0,100)};
}
export function updateOnboardingTask(state:AppSnapshot,command:Extract<Command,{type:'onboarding_task'}>):OnboardingRecord {
 const old=onboardingFor(state);if(old.revision!==command.expectedRevision)throw new Error('Setup changed. Reload the current record.');
 if(command.status==='resolved'&&state.context.role!=='david_operator')throw new Error('An assigned operator must resolve setup requests.');
 const task={id:command.taskId,title:command.title,owner:command.owner,status:command.status,note:command.note,revision:old.revision};
 if(!old.tasks.some(t=>t.id===task.id)&&old.tasks.length>=100)throw new Error('Setup request limit reached.');
 return {...old,tasks:[...old.tasks.filter(t=>t.id!==task.id),task]};
}
