'use client';
import {useContext,useEffect,useRef,useState} from 'react';
import {OnboardingAnswers as AnswersSchema} from '@david/contracts';
import {FeedbackContext} from '../ui';
import {suggestCompany} from '@david/domain/onboarding-assist';
import type {AppSnapshot,Briefing} from '@david/contracts';
import {briefingNextAction,currentBriefingArtifacts,briefingPath,factsReviewed,factsSignature,firstTasks,goals,nextBriefingStep,normalizeWebsite,recommendedTask,type BriefingStep} from '@david/domain/briefing';
import {buildPreparedSetup} from '@david/domain/prepared-setup';
import {onboardingFor} from '@david/domain/onboarding';
import type {ScreenProps} from '../app-shell';
import {Question,Answer} from './question';
import {useBriefingSave} from './use-briefing-save';

export function Conversation(props:ScreenProps){
 const {state,act}=props;const feedback=useContext(FeedbackContext);
 const save=useBriefingSave(props),a=save.answers,b=a.briefing!;
 const [step,setStep]=useState<BriefingStep>(b.step);
 const [website,setWebsite]=useState(b.websiteInput||a.company.website||state.onboardingCapture?.pages[0]?.url||'');
 const [capture,setCapture]=useState(state.onboardingCapture);
 const [research,setResearch]=useState<'idle'|'running'|'ready'|'failed'>(state.onboardingCapture&&(!b.researchId||state.onboardingCapture.requestId===b.researchId)?'ready':'idle');
 const [error,setError]=useState(''),[pending,setPending]=useState(false),[review,setReview]=useState(false);
 const [approver,setApprover]=useState(state.setupIdentity?.email??a.people.find(p=>p.responsibility==='approver')?.email??'');
 const [budget,setBudget]=useState(a.operations.modelDailyBudgetMinor===null?'':String(a.operations.modelDailyBudgetMinor/100));
 const lock=useRef(false),request=useRef(b.researchId),history=useRef<BriefingStep[]>([]);
 const task=recommendedTask(state,b),demo=state.workspace.mode==='fixture';
 const writable=['workspace_owner','david_operator'].includes(state.context.role);
 const disabled=pending||!writable||save.status==='conflict';
 const usableCapture=capture&&(!b.researchId||capture.requestId===b.researchId||demo)&&!b.noWebsite?capture:undefined;
 function briefing(patch:Partial<Briefing>){save.update(d=>({...d,briefing:{...d.briefing!,...patch}}));}
 function company(key:'name'|'offers'|'customers',value:string){save.update(d=>({...d,company:{...d.company,[key]:key==='name'?value:value.split('\n')},briefing:{...d.briefing!,reviewedFacts:'',finished:false},operations:{...d.operations,policyAcknowledged:false}}));}
 async function run(work:()=>Promise<void>){if(lock.current)return;lock.current=true;setPending(true);setError('');try{await work();}catch(e){if(save.alive.current)setError(e instanceof Error?e.message:'Please try again.');}finally{lock.current=false;if(save.alive.current)setPending(false);}}
 async function command(command:Parameters<typeof act>[0]){if(!await save.flush())throw new Error('Save your answers before continuing.');const result=await act(command);if(!result)throw new Error('The server did not accept this action. Your briefing is retained.');save.adopt(result.snapshot);return result.snapshot;}
 async function post(path:string,body:Record<string,unknown>){const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspaceId:state.workspace.id,...body})});const result=await response.json();if(!response.ok)throw new Error(result.message??'This step could not complete.');return result;}
 async function go(next:BriefingStep){briefing({step:next});if(!await save.flush())return;history.current.push(step);setStep(next);setReview(false);const url=new URL(location.href);url.searchParams.set('view','activation');url.searchParams.set('step',next);url.searchParams.delete('setup');url.searchParams.delete('guide');window.history.replaceState({},'',url.pathname+url.search);}
 async function forward(){save.update(d=>AnswersSchema.parse(d));await go(nextBriefingStep(step,save.draft.current,save.draft.current.briefing!));}
 async function back(){const path=briefingPath(a,b);const previous=history.current.pop()??path[Math.max(0,path.indexOf(step)-1)];await go(previous);history.current.pop();}
 async function leave(profile=false){if(!await save.flush())return;const url=new URL(location.href);url.searchParams.set('view',profile?'activation':'today');url.searchParams.delete('step');if(profile)url.searchParams.set('mode','profile');else url.searchParams.delete('mode');location.assign(url.pathname+url.search);}
 async function researchWebsite(url:string,id:string){
  request.current=id;setResearch('running');
  try{
   let result:AppSnapshot['onboardingCapture'];
   if(demo){const snapshot=await command({type:'sample_onboarding_capture'});result=snapshot.onboardingCapture;}
   else {const response=await post('/api/context/capture',{url,requestId:id});result={...response.capture.context,id:response.capture.id,sourceHash:response.capture.sourceHash,requestId:id};}
   if(!save.alive.current||request.current!==id||save.draft.current.briefing?.researchId!==id)return;
   setCapture(result);setResearch('ready');
  }catch(e){if(save.alive.current&&request.current===id){setResearch('failed');setError(e instanceof Error?e.message:'The website could not be read. You can describe your business instead.');}}
 }
 async function websiteNext(manual=false){
  const url=manual?'':normalizeWebsite(website),id=crypto.randomUUID();request.current=id;
  save.update(d=>({...d,company:{...d.company,website:url},briefing:{...d.briefing!,noWebsite:manual,websiteInput:manual?'':website,researchId:id,reviewedFacts:'',finished:false},operations:{...d.operations,policyAcknowledged:false}}));
  setCapture(undefined);setResearch('idle');if(!await save.flush())return;
  await forward();if(!manual)void researchWebsite(url,id);
 }
 function useResearch(){
  if(b.noWebsite&&b.description){
   const proposed=suggestCompany({id:'owner-description',sourceHash:'owner-description',fixture:demo,pages:[{url:'',title:'',description:'',text:b.description,capturedAt:state.asOf}]});
   save.update(d=>({...d,company:{...d.company,offers:d.company.offers.length?d.company.offers:proposed.filter(f=>f.field==='offers').map(f=>f.value),customers:d.company.customers.length?d.company.customers:proposed.filter(f=>f.field==='customers').map(f=>f.value)}}));
  }
  if(usableCapture){
   const proposal=buildPreparedSetup({...save.latest.current,onboarding:{...onboardingFor(save.latest.current),answers:save.draft.current},onboardingCapture:usableCapture},b.goal==='recover'?'recover':b.goal==='conversion'?'conversion':'demand',crypto.randomUUID());
   save.update(d=>({...d,company:{...d.company,name:d.company.name||proposal.answers.company.name,website:usableCapture.pages[0]?.url??d.company.website,offers:d.company.offers.length?d.company.offers:proposal.answers.company.offers,customers:d.company.customers.length?d.company.customers:proposal.answers.company.customers},systems:proposal.answers.systems}));
  }
 }
 async function confirmSummary(){save.update(d=>AnswersSchema.parse(d));briefing({reviewedFacts:factsSignature(save.draft.current)});await forward();}
 async function confirmSource(){
  if(!await save.flush())return;
  if(!usableCapture)throw new Error('Capture the website first, or save the briefing and add a website later.');
  if(demo)await command({type:'confirm_sample_company',expectedRevision:onboardingFor(save.latest.current).revision});
  else await post('/api/context/confirm',{contextId:usableCapture.id,sourceHash:usableCapture.sourceHash,companyName:a.company.name,offers:a.company.offers,customerTypes:a.company.customers,locations:[]});
  await forward();
 }
 async function finishOnly(){briefing({finished:true,step:'finish'});await go('finish');}
 async function approvePreparation(){
  if(!review||!approver||!task)throw new Error('Review the preparation permission first.');
  save.update(d=>({...d,team:d.team,people:[...d.people.filter(p=>p.responsibility!=='approver'),{email:approver,name:b.name||approver,responsibility:'approver',role:'workspace_owner'}],operations:{...d.operations,approvalMode:'each_action',automationAcknowledged:false,approvedContactIds:[],sender:'',calendarId:'',dailyCapacity:1,modelDailyBudgetMinor:task.requiresModel?d.operations.modelDailyBudgetMinor:0,actionDailyBudgetMinor:0,escalationOwner:approver,policyAcknowledged:true},briefing:{...d.briefing!,finished:true,step:'finish'}}));
  if(!await save.flush())return;
  // The last write is the reviewed permission; advancing the screen must not create another revision.
  await command({type:'apply_onboarding',expectedRevision:onboardingFor(save.latest.current).revision});setStep('finish');
 }
 async function help(){
  const existing=onboardingFor(save.latest.current).tasks.find(t=>t.title==='Help prepare the first task'&&t.status!=='resolved');
  await command({type:'onboarding_task',expectedRevision:onboardingFor(save.latest.current).revision,taskId:existing?.id??crypto.randomUUID(),title:'Help prepare the first task',owner:'Workspace administrator',status:'open',note:briefingNextAction({...state,onboarding:{...onboardingFor(state),answers:a}})});
  setError('Assistance request saved to the shared operator queue. No email was sent.');
 }
 useEffect(()=>{
  const incoming=state.onboardingCapture;
  if(incoming&&incoming.requestId===save.draft.current.briefing?.researchId&&!save.draft.current.briefing?.noWebsite){setCapture(incoming);setResearch('ready');}
 },[state.onboardingCapture]);
 useEffect(()=>{sessionStorage.setItem('david.resumeWorkspace',state.workspace.id);},[state.workspace.id]);
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{
   if(step!=='goal'||e.altKey||e.ctrlKey||e.metaKey||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement||disabled)return;
   const chosen=goals[Number(e.key)-1];if(chosen){e.preventDefault();briefing({goal:chosen.id,task:'',finished:false});}
  };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[step,disabled]);
 const title:Record<BriefingStep,string>={welcome:`Let’s find a useful first step for ${a.company.name||'your company'}.`,website:'What’s your company’s website?',description:'Tell us a little about your business.',name:'What should we call you?',goal:'What would make the biggest difference right now?','other-goal':'What would you like to accomplish?',research:'Here’s what we can learn from your website.','company-name':'What’s your company called?',offer:'What’s your main offer?',customers:'Who do you help?',summary:'Here’s what we learned about your business.','proposal-source':'Where do your proposals live today?','conversion-action':'What action should visitors take?',recommendation:'Here’s where I’d start.',access:'May we use these sources for your first task?',budget:'What’s a comfortable spending limit?',review:'Review this preparation permission.',finish:`Your first step, ${b.name.split(' ')[0]||a.company.name}.`};
 const next=()=>void run(forward);
 const field=(label:string,value:string,change:(v:string)=>void,multiline=false)=><Answer label={label} value={value} onChange={change} multiline={multiline}/>;
 const artifacts=currentBriefingArtifacts(state);
 const requests=(state.preparationRequests??[]).filter(r=>r.agentId===task?.id);
 const working=requests.find(r=>['scheduled','processing','awaiting_approval','waiting_for_input'].includes(r.status));
 const canRequest=artifacts.length===0&&!!task&&factsReviewed(a)&&state.activation.confirmedFacts&&a.operations.policyAcknowledged&&onboardingFor(state).appliedRevision===onboardingFor(state).revision&&(!task.requiresModel||((demo||state.preparationRuntime?.configured)&&a.operations.modelDailyBudgetMinor!==null&&a.operations.modelDailyBudgetMinor>0))&&!working;
 return <div className="briefing-shell">
  <header className="briefing-header"><span className="brand-wordmark" role="img" aria-label="David Engine"/><div className="flex wrap"><span role="status" className="small">{save.status==='saving'?'Saving…':save.status==='saved'?'Saved to this workspace':save.status==='unsaved'?'Unsaved changes':save.status==='conflict'?'Newer saved version available':'Save needs attention'}</span><button className="link-button" disabled={pending} onClick={()=>void run(()=>leave())}>Save and exit</button>{!demo&&<button className="link-button" disabled={pending} onClick={()=>void run(async()=>{if(!await save.flush())return;await post('/api/auth/signout',{});location.assign('/login');})}>Sign out</button>}</div></header>
  <main id="main-content" className="briefing-main">
   <p className="eyebrow">{demo?'Synthetic demo · sample data only':a.company.name} / {['welcome','website','description','name'].includes(step)?'Introduction':['goal','other-goal','research','company-name','offer','customers','summary','proposal-source','conversion-action'].includes(step)?'Your business':step==='finish'?'Your workspace':'Your first task'}</p>
   {!writable&&<p role="alert">A workspace owner must save answers and approve permissions. You can review this briefing.</p>}
   {(error||save.error)&&<div className="notice" role="alert">{error||save.error}{feedback?.error&&<p className="help">{feedback.text}</p>}{save.status==='error'&&<div className="flex wrap"><button className="btn" onClick={()=>void save.flush()}>Retry saving</button><button className="link-button" onClick={()=>location.reload()}>Reload saved version (discard edits)</button></div>}{save.status==='conflict'&&<button className="btn" onClick={()=>{save.reload();location.reload();}}>Reload saved answers</button>}</div>}
   <fieldset disabled={disabled} className="onboarding-fields">
   {step==='welcome'&&<Question id={step} title={title[step]} description="Share your objective. We’ll research your business, suggest one useful task, and ask for approval before doing any work." onContinue={next} label="Let’s begin"/>}
   {step==='website'&&<Question id={step} title={title[step]} description={demo?'This demo uses an illustrative company website. It never reads real websites.':'We’ll read public pages while you tell us what matters. You can correct everything we find.'} onContinue={()=>void run(()=>websiteNext())} disabled={!website.trim()}>
    {field('Company website',website,v=>{setWebsite(v);const id=crypto.randomUUID();request.current=id;setCapture(undefined);setResearch('idle');save.update(d=>({...d,briefing:{...d.briefing!,websiteInput:v,researchId:id,reviewedFacts:'',finished:false},operations:{...d.operations,policyAcknowledged:false}}));})}<button type="button" className="link-button" onClick={()=>void run(()=>websiteNext(true))}>I don’t have a website</button>
   </Question>}
   {step==='description'&&<Question id={step} title={title[step]} description="A sentence or two is enough. This stays as your own description; it isn’t independently verified website evidence." onContinue={next} disabled={!b.description.trim()}>{field('Business description',b.description,v=>briefing({description:v}),true)}</Question>}
   {step==='name'&&<Question id={step} title={title[step]} onContinue={next} disabled={!b.name.trim()}>{field('Your name',b.name,v=>briefing({name:v}))}</Question>}
   {step==='goal'&&<Question id={step} title={title[step]} description="Choose a direction. We’ll recommend the starting task." onContinue={next} disabled={!b.goal}>
    <div className="briefing-choices">{goals.map((g,i)=><label key={g.id} className={`briefing-choice ${b.goal===g.id?'selected':''}`}><input type="radio" name="business-goal" value={g.id} checked={b.goal===g.id} onChange={()=>briefing({goal:g.id,task:'',finished:false})}/><kbd aria-hidden="true">{i+1}</kbd><span>{g.label}</span></label>)}</div>
   </Question>}
   {step==='other-goal'&&<Question id={step} title={title[step]} description="We’ll save your objective and suggest a supported starting preparation. This won’t imply a custom workflow already exists." onContinue={next} disabled={!b.otherGoal.trim()}>{field('Your objective',b.otherGoal,v=>briefing({otherGoal:v}),true)}</Question>}
   {step==='research'&&<Question id={step} title={b.noWebsite?'Let’s fill in just the essentials.':title[step]} description={b.noWebsite?'We’ll use the description you provided and ask only for the missing facts.':research==='running'?'The public pages are still being read. You can wait here or continue with your own answers.':research==='ready'?'Your pages are captured. Review the suggested facts and any gaps together.':research==='failed'?'We couldn’t read this site. You can continue with your own answers.':'No completed research is available for this website yet.'} onContinue={()=>void run(async()=>{useResearch();if(usableCapture)await go('summary');else await forward();})} label={usableCapture?'Review what we found':'Continue with my own answers'}>
    {!b.noWebsite&&research!=='running'&&!usableCapture&&<button type="button" className="btn" onClick={()=>void researchWebsite(a.company.website,b.researchId)}>Retry website research</button>}
    {b.description&&<p className="briefing-excerpt">{b.description}</p>}
   </Question>}
   {step==='company-name'&&<Question id={step} title={title[step]} onContinue={usableCapture?()=>void run(()=>go('summary')):next} disabled={!a.company.name.trim()}>{field('Company name',a.company.name,v=>company('name',v))}</Question>}
   {step==='offer'&&<Question id={step} title={title[step]} onContinue={usableCapture?()=>void run(()=>go('summary')):next} disabled={!a.company.offers.some(v=>v.trim())}>{field('Main offer',a.company.offers.join('\n'),v=>company('offers',v),true)}</Question>}
   {step==='customers'&&<Question id={step} title={title[step]} onContinue={usableCapture?()=>void run(()=>go('summary')):next} disabled={!a.company.customers.some(v=>v.trim())}>{field('Ideal customers',a.company.customers.join('\n'),v=>company('customers',v),true)}</Question>}
   {step==='summary'&&<Question id={step} title={title[step]} description={usableCapture?'Suggested facts remain unconfirmed until you review them.':'Based on your answers. Website research has not verified these facts.'} onContinue={()=>void run(confirmSummary)} disabled={!a.company.name||!a.company.offers.length||!a.company.customers.length} label="That’s right">
    <div className="briefing-summary"><h2>{a.company.name}</h2><p>{a.company.offers.length?a.company.offers.join(' · '):'Main offer: not identified in the captured pages.'}</p><p className="muted">{a.company.customers.length?'For '+a.company.customers.join(' · '):'Customer audience: not identified in the captured pages.'}</p></div>
    {!a.company.offers.length&&<div className="briefing-summary"><h2>One detail to add: your main offer</h2><p>We couldn’t confidently extract this from the captured wording.</p><button type="button" className="btn" onClick={()=>void run(()=>go('offer'))}>Add your main offer</button></div>}
    {!a.company.customers.length&&<div className="briefing-summary"><h2>Who should this work focus on?</h2><p>The captured pages didn’t give us a clear audience. Choose one to start. These are your choices, not website findings.</p><div className="flex wrap">{(a.company.businessModel==='home_services'?['Homeowners','Businesses','Property managers']:['Individuals','Small businesses','Enterprise teams']).map(value=><button type="button" className="btn" key={value} onClick={()=>company('customers',value)}>{value}</button>)}<button type="button" className="btn" onClick={()=>void run(()=>go('customers'))}>Describe another audience</button></div></div>}
    <details><summary>Let me change something</summary><div className="flex wrap">{(['company-name','offer','customers'] as const).map(s=><button type="button" className="btn" key={s} onClick={()=>void run(()=>go(s))}>{s==='company-name'?'Company name':s==='offer'?'Main offer':'Customers'}</button>)}</div></details>
    {usableCapture&&<details><summary>See source excerpts</summary>{usableCapture.pages.map(p=><blockquote className="briefing-excerpt" key={p.url}><a href={p.url} target="_blank" rel="noreferrer">{p.title||p.url}</a><p>{p.description}</p><p>{p.text.slice(0,2000)}</p></blockquote>)}</details>}
   </Question>}
   {step==='proposal-source'&&<Question id={step} title={title[step]} description="For example: a Google Sheet, your CRM, or a folder. We won’t connect or read it yet." onContinue={next} disabled={!b.proposalSource.trim()}>{field('Proposal system',b.proposalSource,v=>briefing({proposalSource:v}))}</Question>}
   {step==='conversion-action'&&<Question id={step} title={title[step]} description="For example: request a quote, book a consultation, or make a purchase." onContinue={next} disabled={!b.conversionAction.trim()}>{field('Desired visitor action',b.conversionAction,v=>briefing({conversionAction:v}))}</Question>}
   {step==='recommendation'&&<Question id={step} title={title[step]} onContinue={()=>void run(async()=>{if(!task)throw new Error('No implemented preparation is available for this business model.');if(!a.team.includes(task.id)&&a.team.length>=(state.workspace.entitlement??5))throw new Error('Your workspace allowance is in use. Adjust your team in Complete profile before adding this task.');save.update(d=>({...d,company:{...d.company,priorities:[b.goal==='other'?b.otherGoal:goals.find(g=>g.id===b.goal)!.label],successDefinition:b.goal==='conversion'?b.conversionAction:b.goal==='other'?b.otherGoal:goals.find(g=>g.id===b.goal)!.label},briefing:{...d.briefing!,task:task.id},team:d.team.includes(task.id)?d.team:[...d.team,task.id]}));await forward();})} disabled={!task} label="Start with this task">
    {task&&<div className="briefing-summary"><h2>{task.title}</h2><p>{task.why}</p><p><strong>You’ll receive:</strong> {task.output}</p><p><strong>Needed:</strong> reviewed public website pages and permission for internal preparation.</p>{!task.requiresModel&&<p className="help">No model spending is needed. Existing hosting costs are separate.</p>}{b.goal==='conversion'&&b.conversionAction&&<p>Desired visitor action: {b.conversionAction}</p>}</div>}
    {task?.requiresModel&&!demo&&state.preparationRuntime?.configured===false&&<p className="notice">Writing preparations aren’t available in this workspace yet. Save this task for later, or choose the public-page check below.</p>}{b.goal==='recover'&&<p className="help">Automatic proposal follow-up is a separate pilot requiring verified proposal and mailbox access, contact selection and sending approval. This first brief prepares company context; it does not follow up with customers.</p>}
    <details><summary>Choose a different starting task</summary><div className="briefing-choices">{firstTasks.filter(t=>state.catalog.some(c=>c.id===t.id&&c.releaseStatus==='implemented'&&c.supportedArchetypes.includes(a.company.businessModel))).map(t=><label className="briefing-choice" key={t.id}><input type="radio" name="first-task" checked={task?.id===t.id} onChange={()=>briefing({task:t.id})}/>{t.title}</label>)}</div></details>
   </Question>}
   {step==='access'&&<Question id={step} title={title[step]} description={usableCapture?'Only your captured public website pages are needed for this preparation. No mailbox, calendar or private account access is requested.':'This release needs captured website evidence for its preparations. Your manual briefing can be saved now; no account connection can replace missing website evidence.'} onContinue={usableCapture?()=>void run(confirmSource):()=>void run(finishOnly)} label={usableCapture?'Confirm this source':'Save briefing for later'}>
    {usableCapture?.pages.map(p=><p key={p.url}>{p.url}</p>)}
    <div className="flex wrap"><button type="button" className="link-button" onClick={()=>void run(finishOnly)}>Do this later</button><button type="button" className="link-button" onClick={()=>void run(help)}>I need help</button>{!usableCapture&&<button type="button" className="link-button" onClick={()=>void run(()=>go('website'))}>Add or retry website</button>}</div>
   </Question>}
   {step==='budget'&&<Question id={step} title={title[step]} description={`Set a daily model-spending ceiling in ${state.workspace.currency}. It is shared across the workspace. Enter 0 to disable model spending. Hosting costs are separate.`} onContinue={next} disabled={a.operations.modelDailyBudgetMinor===null||!/^\d+(\.\d{1,2})?$/.test(budget)}>
    <Answer label={`Daily model budget (${state.workspace.currency})`} value={budget} type="text" onChange={v=>{setBudget(v);if(/^\d+(\.\d{1,2})?$/.test(v)&&Number(v)<=10000)save.update(d=>({...d,operations:{...d.operations,modelDailyBudgetMinor:Math.round(Number(v)*100),policyAcknowledged:false}}));else save.update(d=>({...d,operations:{...d.operations,modelDailyBudgetMinor:null,policyAcknowledged:false}}));}}/>
    <button type="button" className="link-button" onClick={()=>void run(finishOnly)}>Decide later; save my briefing</button>
   </Question>}
   {step==='review'&&<Question id={step} title={title[step]} description="Saving answers did not authorize work. Review this bounded internal preparation before applying its settings." onContinue={()=>void run(approvePreparation)} disabled={!review||!approver} label="Approve this preparation setup">
    <p>Allow <strong>{task?.title}</strong>, up to one preparation per day, {task?.requiresModel?`within your ${state.workspace.currency} ${(a.operations.modelDailyBudgetMinor??0)/100} daily model ceiling`:'with model spending disabled; this task reads captured pages without a model'}. External actions remain unapproved. You must separately request the first task.</p>
    {!state.setupIdentity?.email&&<Answer label="Approver email" type="email" value={approver} onChange={setApprover}/>}
    <p className="help">{approver||'The named owner'} will review output and handle questions. This applies workspace limits of one preparation per selected agent per day and clears existing automatic contact authority. Other settings remain available in the complete profile.</p>
    <label className="briefing-choice"><input type="checkbox" checked={review} onChange={e=>setReview(e.target.checked)}/>I approve this internal preparation limit and accept responsibility for reviewing its output.</label>
    <button type="button" className="link-button" onClick={()=>void run(finishOnly)}>Save without authorizing work</button>
   </Question>}
   {step==='finish'&&<Question id={step} title={title[step]} description="Your business context and starting task are saved. Operational readiness is checked separately.">
    <div className="briefing-summary"><p className="eyebrow">{b.goal==='other'?b.otherGoal:goals.find(g=>g.id===b.goal)?.label}</p><h2>{task?.title??'Choose a starting task'}</h2><p>{a.company.offers.join(' · ')} for {a.company.customers.join(' · ')}</p></div>
    {artifacts.map(o=><article className="briefing-output" key={o.id}><h2>{o.title}</h2><p className="help">{demo?'Synthetic output':onboardingFor(state).reviews.some(r=>r.artifactId===o.id&&r.revision===onboardingFor(state).revision)?'Reviewed for this setup':'Review for the current setup'} · {o.limitation}</p><pre>{o.content}</pre><button type="button" className="btn" disabled={onboardingFor(state).reviews.some(r=>r.artifactId===o.id&&r.revision===onboardingFor(state).revision)} onClick={()=>void run(async()=>{await command({type:'review_artifact',artifactId:o.id,decision:'reviewed'});})}>Mark output reviewed</button></article>)}
    {working?<p role="status">Preparation status: {working.status.replaceAll('_',' ')}. This is a saved server task, not a completed output.</p>:<p className="notice">{artifacts.length?'Your preparation is available above. Review the output and its sources before using it.':briefingNextAction(state)}</p>}
    {requests.filter(r=>['failed','blocked','cancelled'].includes(r.status)).map(r=><p role="status" key={r.id}>Previous preparation: {r.status}. Review the operator queue before retrying.</p>)}
    {canRequest&&<button type="button" className="btn btn-primary" onClick={()=>void run(async()=>{if(state.workspace.paused)await command({type:'pause',paused:false});await command({type:'prepare',agentId:task!.id});setError(demo?'Synthetic preparation saved below.':'Preparation request saved. Server status will refresh here.');})}>{demo?'Prepare sample output':'Request my first preparation'}</button>}
    <div className="flex wrap"><button type="button" className="btn btn-primary" onClick={()=>void run(()=>leave())}>Open my workspace</button><button type="button" className="btn" onClick={()=>void run(()=>go(!usableCapture?'website':task?.requiresModel&&a.operations.modelDailyBudgetMinor===null?'budget':'review'))}>Continue setup</button><button type="button" className="link-button" onClick={()=>void run(help)}>Request setup assistance</button></div>
   </Question>}
   </fieldset>
  </main>
  <footer className="briefing-footer"><button className="btn" disabled={disabled||step==='welcome'} onClick={()=>void run(back)}>← Back</button><span className="help">{research==='running'?'Reading public website pages in the background…':'Your answers stay with this workspace.'}</span><button className="link-button" disabled={pending} onClick={()=>void run(()=>leave(true))}>Complete profile</button></footer>
 </div>;
}
