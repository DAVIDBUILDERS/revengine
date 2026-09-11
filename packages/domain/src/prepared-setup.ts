import {PreparedSetup,OnboardingAnswers,type AppSnapshot,type SetupCitation} from '../../contracts/src/index';
import {onboardingFor} from './onboarding';
import {onboardingGoals,suggestCompany,suggestTeam} from './onboarding-assist';

/** Only source/configuration identities enter this signature, never a moving wall clock. */
export function setupInputSignature(state:AppSnapshot):string {
 return JSON.stringify({capture:state.onboardingCapture?[state.onboardingCapture.id,state.onboardingCapture.sourceHash]:null,documents:(state.setupDocuments??[]).map(d=>[d.id,d.hash,d.version]).sort(),connections:state.connections.filter(c=>c.workspaceId===state.workspace.id).map(c=>[c.id,c.identity,c.resource,c.health,c.verifiedAt,c.lastSyncAt,[...c.operations].sort()]).sort(),metrics:state.metrics.map(m=>[m.key,m.value,m.unit,[...m.evidenceIds].sort(),m.limitation]).sort()});
}
export function setupSourcesChanged(state:AppSnapshot):boolean {
 if(!state.preparedSetup)return false;
 try{const old=JSON.parse(state.preparedSetup.inputSignature),current=JSON.parse(setupInputSignature(state));return JSON.stringify([old.capture,old.documents])!==JSON.stringify([current.capture,current.documents]);}catch{return true;}
}
export function setupIsStale(state:AppSnapshot){const setup=state.preparedSetup;return !!setup&&(setup.basedOnRevision!==onboardingFor(state).revision||setup.inputSignature!==setupInputSignature(state));}

export function buildPreparedSetup(state:AppSnapshot,goalId:'recover'|'demand'|'conversion',id:string):PreparedSetup {
 const record=onboardingFor(state), answers=structuredClone(record.answers), goal=onboardingGoals.find(g=>g.id===goalId)!;
 const citations:SetupCitation[]=[], conflicts:string[]=[],limitations:string[]=[];
 const cite=(field:string,value:string,sourceId:string,source:string,quote:string,basis:string)=>{if(citations.length<80)citations.push({field,value:value.slice(0,2000),sourceId,source:source.slice(0,2000),quote:quote.slice(0,2000),basis});};
 const candidates=state.onboardingCapture?suggestCompany(state.onboardingCapture).map(s=>({...s,sourceId:state.onboardingCapture!.id,source:s.url})):[];
 for(const doc of state.setupDocuments??[]){
  if(doc.workspaceId!==state.workspace.id)continue;
  // Explicit headings and sentences only. Uploaded documents cannot supply policy or spending authority.
  for(const [lineIndex,line]of doc.text.split(/\r?\n/).entries()){
   const match=/^\s*(?:#{1,4}\s*)?(Company(?: name)?|Offers?|Services?|Customers?|Audience)\s*:\s*(.{2,500})$/i.exec(line);
   if(match){const label=match[1].toLowerCase();const field=label.startsWith('company')?'name':/customer|audience/.test(label)?'customers':'offers';for(const value of match[2].split(/;\s*/).filter(Boolean).slice(0,5))candidates.push({field,value,quote:line.trim(),url:'',sourceId:doc.id,source:doc.name,basis:`Selected document, line ${lineIndex+1}`});}
  }
  for(const suggestion of suggestCompany({id:doc.id,sourceHash:doc.hash,fixture:doc.fixture,pages:[{url:'https://document.invalid',title:'',description:'',text:doc.text,capturedAt:doc.capturedAt}]}))candidates.push({...suggestion,sourceId:doc.id,source:doc.name,basis:'Explicit wording in selected document'});
 }
 for(const field of ['name','offers','customers'] as const){
  const found=candidates.filter(c=>c.field===field);for(const c of found)cite(`company.${field}`,c.value,c.sourceId,c.source,c.quote,c.basis);
  const values=[...new Set(found.map(c=>c.value.trim()))].slice(0,10);
  const current=answers.company[field];const saved=record.revision>0&&(Array.isArray(current)?current.length>0:!!current);
  if(saved){if(values.some(value=>!(Array.isArray(current)?current:[current]).some(v=>v.toLowerCase()===value.toLowerCase())))conflicts.push(`New sources suggest different ${field}. Your saved answer is retained; review the source comparison if you want to change it.`);}
  else if(field==='name'){if(values.length>1)conflicts.push('Sources use more than one company name. Review the proposed name.');if(values[0])answers.company.name=values[0];}
  else if(values.length)answers.company[field]=values;
 }
 if(state.onboardingCapture){
  const capture=state.onboardingCapture;answers.company.website=answers.company.website||capture.pages[0]?.url||'';
  if(!answers.systems.some(s=>s.kind==='website'))answers.systems.push({id:capture.id,kind:'website',tool:'Company website',availability:'available',resource:capture.pages[0]?.url??'',owner:'Workspace owner',mapping:`Captured source ${capture.id}; facts awaiting review`,connectionId:''});
 }
 answers.company.priorities=[goal.title];answers.company.successDefinition=goal.success;
 if(!answers.team.length)answers.team=suggestTeam(goal.title,answers.company.businessModel,state.workspace.entitlement??5).map(a=>a.id);
 cite('company.priorities',goal.title,'selected-objective','Your selected objective',goal.success,'Selected by you; team suggestion uses the implemented capability catalog.');
 const owner=state.context.role==='workspace_owner'?state.setupIdentity:undefined;
 if(owner){
  if(!answers.people.some(p=>p.responsibility==='approver'))answers.people.push({email:owner.email,name:owner.name||owner.email,responsibility:'approver',role:'workspace_owner'});
  if(!answers.operations.escalationOwner)answers.operations.escalationOwner=owner.email;
  if(!answers.measurement.owner)answers.measurement.owner=owner.email;
  cite('people.approver',owner.email,'workspace-owner','Signed-in workspace owner',owner.email,'Suggested responsibility; your explicit review is required.');
 }
 // Only bound resources are reused; connection identity is a candidate, never verified ownership.
 for(const connection of state.connections.filter(c=>c.workspaceId===state.workspace.id&&c.provider==='google')){
  if(['expired','revoked'].includes(connection.health)){limitations.push(`${connection.identity}: reconnect before reading sources.`);continue;}
  if(!answers.operations.sender&&connection.operations.includes('gmail.send')){answers.operations.sender=connection.identity;cite('operations.sender',connection.identity,connection.id,'Connected Google account',connection.identity,'Suggested sender; sending still requires verified source access and explicit contact/action approval.');}
  if(!answers.operations.calendarId&&connection.operations.includes('calendar.book')){answers.operations.calendarId=connection.identity;cite('operations.calendarId',connection.identity,connection.id,'Connected Google account',connection.identity,'Candidate primary calendar; ownership must pass the provider check.');}
 }
 const metricKeys=goalId==='recover'?['human_replies','verified_bookings','collected_revenue']:['collected_revenue'];
 const baseline:OnboardingAnswers['measurement']['baseline']=[];
 for(const key of metricKeys){
  const metric=state.metrics.find(m=>m.key===key);
  const knownEvidence=state.outcomes.filter(o=>o.workspaceId===state.workspace.id&&o.stage===metric?.stage&&(state.workspace.mode==='fixture'?o.quality==='fixture':o.quality==='provider_verified')).flatMap(o=>o.evidence);
  const evidence=metric?.evidenceIds.map(id=>knownEvidence.find(e=>e.id===id))??[];
  const supported=metric?.value!==null&&metric?.value!==undefined&&evidence.length>0&&evidence.every(e=>e&&(state.workspace.mode==='fixture'?e.quality==='fixture':e.quality==='provider_verified'));
  const source=supported?`${state.workspace.mode==='fixture'?'Synthetic sample; ':''}Recorded ${metric!.stage} evidence: ${metric!.evidenceIds.join(', ')}. ${metric!.limitation??'Current recorded cohort only; not a causal impact measurement.'}`:'Not connected or not independently verified. Leave unknown until authoritative evidence is available.';
  baseline.push({metric:metric?.label??(key==='collected_revenue'?'Collected revenue':key),value:supported?metric!.value:null,unit:metric?.unit??'count',source:source.slice(0,4000),asOf:supported?state.asOf.slice(0,10):''});
  cite('measurement.baseline',`${metric?.label??key}: ${supported?metric!.value:'Unknown'}`,'recorded-metrics','Workspace outcome evidence',source,'Current recorded cohort; no inferred uplift or missing-source zero.');
 }
 if(goalId!=='recover')baseline.unshift({metric:goal.metric,value:null,unit:'count',source:'Analytics/CRM inquiry source is not connected.',asOf:''});
 // Existing measured or explicitly recorded baseline answers are never overwritten by discovery.
 if(!answers.measurement.baseline.length)answers.measurement.baseline=baseline;
 if(!answers.measurement.outcomeSources)answers.measurement.outcomeSources=baseline.map(b=>`${b.metric}: ${b.source}`).join('\n').slice(0,4000);
 if(!answers.operations.dailyCapacity)answers.operations.dailyCapacity=1;
 answers.operations.policyAcknowledged=false;
 limitations.push('Facts are proposed from explicit source wording. Missing facts require your answer; no model inference or model spending during discovery.','Google access and suggested resources do not verify an agent. First output and external actions still require their own checks.');
 return PreparedSetup.parse({id,workspaceId:state.workspace.id,generation:(state.preparedSetup?.generation??0)+1,basedOnRevision:record.revision,createdAt:state.asOf,goal:goalId,fixture:state.workspace.mode==='fixture',captureId:state.onboardingCapture?.id??null,sourceHash:state.onboardingCapture?.sourceHash??null,inputSignature:setupInputSignature(state),answers:OnboardingAnswers.parse(answers),citations,conflicts:conflicts.slice(0,30),limitations:limitations.slice(0,30),acceptedRevision:null});
}
export function requiredSetupQuestions(answers:OnboardingAnswers){
 const missing:string[]=[];
 if(!answers.company.name)missing.push('company.name');if(!answers.company.offers.length)missing.push('company.offers');if(!answers.company.customers.length)missing.push('company.customers');
 if(!answers.people.some(p=>p.responsibility==='approver'&&p.role==='workspace_owner'))missing.push('people.approver');
 if(!answers.operations.escalationOwner)missing.push('operations.escalationOwner');if(answers.operations.modelDailyBudgetMinor===null)missing.push('operations.modelDailyBudgetMinor');
 if(!answers.operations.policyAcknowledged)missing.push('operations.policyAcknowledged');return missing;
}
export function validateSetupAcceptance(state:AppSnapshot,generation:number,revision:number,answers:OnboardingAnswers){
 const setup=state.preparedSetup;
 if(!setup||setup.workspaceId!==state.workspace.id||setup.generation!==generation||setup.basedOnRevision!==revision||onboardingFor(state).revision!==revision||setupIsStale(state))throw new Error('Setup sources or answers changed. Prepare a fresh setup before accepting.');
 if(requiredSetupQuestions(answers).length)throw new Error('Review missing company facts, responsibilities, budget and operating permissions.');
 return OnboardingAnswers.parse(answers);
}
