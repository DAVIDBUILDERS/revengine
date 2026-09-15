'use client';
import {useContext,useEffect,useRef,useState} from 'react';
import {OnboardingAnswers as AnswersSchema} from '@david/contracts';
import {FeedbackContext} from '../ui';
import {suggestCompany} from '@david/domain/onboarding-assist';
import type {AppSnapshot,Briefing} from '@david/contracts';
import {briefingNextAction,chosenGoals,briefingPath,factsSignature,goalLabels,goals,hasGoal,nextBriefingStep,normalizeWebsite,presentFacts,resolveBriefingStep,setupGoal,type BriefingStep,type GoalId} from '@david/domain/briefing';
import {buildPreparedSetup} from '@david/domain/prepared-setup';
import {onboardingFor} from '@david/domain/onboarding';
import type {ScreenProps} from '../app-shell';
import {Question,Answer} from './question';
import {useBriefingSave} from './use-briefing-save';

function SummaryFacts({offers,customers}:{offers:string[];customers:string[]}){
 const shownOffers=presentFacts(offers),shownCustomers=presentFacts(customers);
 return <>
  {shownOffers.length?<div className="briefing-fact"><p className="eyebrow">Offers</p><ul>{shownOffers.map(v=><li key={v}>{v}</li>)}</ul></div>:<p>Main offer: not identified in the captured pages.</p>}
  {shownCustomers.length?<div className="briefing-fact"><p className="eyebrow">Customers</p><ul>{shownCustomers.map(v=><li key={v}>{v}</li>)}</ul></div>:<p className="muted">Customer audience: not identified in the captured pages.</p>}
 </>;
}

export function Conversation(props:ScreenProps){
 const {state,act}=props;const feedback=useContext(FeedbackContext);
 const save=useBriefingSave(props),a=save.answers,b=a.briefing!;
 const [step,setStep]=useState<BriefingStep>(resolveBriefingStep(b.step));
 const [website,setWebsite]=useState(b.websiteInput||a.company.website||state.onboardingCapture?.pages[0]?.url||'');
 const [capture,setCapture]=useState(state.onboardingCapture);
 const [research,setResearch]=useState<'idle'|'running'|'ready'|'failed'>(state.onboardingCapture&&(!b.researchId||state.onboardingCapture.requestId===b.researchId)?'ready':'idle');
 const [error,setError]=useState(''),[pending,setPending]=useState(false);
 const lock=useRef(false),request=useRef(b.researchId),history=useRef<BriefingStep[]>([]),completing=useRef(false);
 const demo=state.workspace.mode==='fixture';
 const writable=['workspace_owner','david_operator'].includes(state.context.role);
 const disabled=pending||!writable||save.status==='conflict';
 const usableCapture=capture&&(!b.researchId||capture.requestId===b.researchId||demo)&&!b.noWebsite?capture:undefined;
 function briefing(patch:Partial<Briefing>){save.update(d=>({...d,briefing:{...d.briefing!,...patch}}));}
 function toggleGoal(id:GoalId){
  const current=chosenGoals(b);
  const next=current.includes(id)?current.filter(g=>g!==id):[...current,id];
  briefing({goals:next,goal:next[0]??'',task:'',finished:false});
 }
 function company(key:'name'|'offers'|'customers',value:string){save.update(d=>({...d,company:{...d.company,[key]:key==='name'?value:value.split('\n')},briefing:{...d.briefing!,reviewedFacts:'',finished:false},operations:{...d.operations,policyAcknowledged:false}}));}
 async function run(work:()=>Promise<void>){if(lock.current)return;lock.current=true;setPending(true);setError('');try{await work();}catch(e){if(save.alive.current)setError(e instanceof Error?e.message:'Please try again.');}finally{lock.current=false;if(save.alive.current)setPending(false);}}
 async function command(command:Parameters<typeof act>[0]){if(!await save.flush())throw new Error('Save your answers before continuing.');const result=await act(command);if(!result)throw new Error('The server did not accept this action. Your briefing is retained.');save.adopt(result.snapshot);return result.snapshot;}
 async function post(path:string,body:Record<string,unknown>){const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspaceId:state.workspace.id,...body})});const result=await response.json();if(!response.ok)throw new Error(result.message??'This step could not complete.');return result;}
 async function go(next:BriefingStep){briefing({step:next});if(!await save.flush())return;history.current.push(step);setStep(next);const url=new URL(location.href);url.searchParams.set('view','activation');url.searchParams.set('step',next);url.searchParams.delete('setup');url.searchParams.delete('guide');window.history.replaceState({},'',url.pathname+url.search);}
 async function forward(){save.update(d=>AnswersSchema.parse(d));const next=nextBriefingStep(step,save.draft.current,save.draft.current.briefing!);if(next==='finish'){await completeBriefing();return;}await go(next);}
 async function back(){const path=briefingPath(a,b);const previous=history.current.pop()??path[Math.max(0,path.indexOf(step)-1)];await go(previous);history.current.pop();}
 async function leave(profile=false){if(!await save.flush())return;const url=new URL(location.href);url.searchParams.set('view',profile?'activation':'team');url.searchParams.delete('step');url.searchParams.delete('guide');url.searchParams.delete('setup');if(profile){url.searchParams.set('mode','profile');url.searchParams.set('setup','5');}else url.searchParams.delete('mode');location.assign(url.pathname+url.search);}
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
   const proposal=buildPreparedSetup({...save.latest.current,onboarding:{...onboardingFor(save.latest.current),answers:save.draft.current},onboardingCapture:usableCapture},setupGoal(b),crypto.randomUUID());
   save.update(d=>({...d,company:{...d.company,name:d.company.name||proposal.answers.company.name,website:usableCapture.pages[0]?.url??d.company.website,offers:d.company.offers.length?d.company.offers:proposal.answers.company.offers,customers:d.company.customers.length?d.company.customers:proposal.answers.company.customers},systems:proposal.answers.systems}));
  }
 }
 function applyBusinessContext(){
  const draft=save.draft.current.briefing!;
  const labels=goalLabels(draft);
  save.update(d=>({...d,company:{...d.company,priorities:labels,successDefinition:hasGoal(draft,'conversion')&&draft.conversionAction?draft.conversionAction:hasGoal(draft,'other')&&draft.otherGoal?draft.otherGoal:labels[0]??''},briefing:{...d.briefing!,finished:true,step:'finish'}}));
 }
 async function confirmSummary(){save.update(d=>AnswersSchema.parse(d));briefing({reviewedFacts:factsSignature(save.draft.current)});await forward();}
 async function completeBriefing(){
  if(completing.current)return;completing.current=true;
  try{
   applyBusinessContext();
   if(!await save.flush()){completing.current=false;return;}
   if(usableCapture&&!save.latest.current.activation.confirmedFacts){
    if(demo)await command({type:'confirm_sample_company',expectedRevision:onboardingFor(save.latest.current).revision});
    else await post('/api/context/confirm',{contextId:usableCapture.id,sourceHash:usableCapture.sourceHash,companyName:save.draft.current.company.name,offers:save.draft.current.company.offers,customerTypes:save.draft.current.company.customers,locations:[]});
   }
   await go('finish');
  }catch(e){completing.current=false;throw e;}
 }
 async function help(){
  const existing=onboardingFor(save.latest.current).tasks.find(t=>t.title==='Help finish this briefing'&&t.status!=='resolved');
  await command({type:'onboarding_task',expectedRevision:onboardingFor(save.latest.current).revision,taskId:existing?.id??crypto.randomUUID(),title:'Help finish this briefing',owner:'Workspace administrator',status:'open',note:briefingNextAction({...state,onboarding:{...onboardingFor(state),answers:a}})});
  setError('Assistance request saved to the shared operator queue. No email was sent.');
 }
 useEffect(()=>{
  const incoming=state.onboardingCapture;
  if(incoming&&incoming.requestId===save.draft.current.briefing?.researchId&&!save.draft.current.briefing?.noWebsite){setCapture(incoming);setResearch('ready');}
 },[state.onboardingCapture]);
 useEffect(()=>{sessionStorage.setItem('david.resumeWorkspace',state.workspace.id);},[state.workspace.id]);
 useEffect(()=>{
  if(resolveBriefingStep(b.step)!=='finish'||b.finished||!chosenGoals(b).length||!a.company.name||!a.company.offers.length||!a.company.customers.length)return;
  void run(completeBriefing);
 },[]);
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{
   if(step!=='goal'||e.altKey||e.ctrlKey||e.metaKey||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement||disabled)return;
   const chosen=goals[Number(e.key)-1];if(chosen){e.preventDefault();toggleGoal(chosen.id);}
  };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[step,disabled,b.goal,b.goals]);
 const title:Record<BriefingStep,string>={welcome:`Let’s get to know ${a.company.name||'your company'}.`,website:'What’s your company’s website?',description:'Tell us a little about your business.',name:'What should we call you?',goal:'What would make the biggest difference right now?','other-goal':'What would you like to accomplish?',research:'Here’s what we can learn from your website.','company-name':'What’s your company called?',offer:'What’s your main offer?',customers:'Who do you help?',summary:'Here’s what we learned about your business.','proposal-source':'Where do your proposals live today?','conversion-action':'What action should visitors take?',recommendation:'Here’s where I’d start.',access:'May we use these company sources?',budget:'What’s a comfortable spending limit?',review:'Review this preparation permission.',finish:`We’ve saved what we learned about ${a.company.name||'your business'}.`};
 const next=()=>void run(forward);
 const field=(label:string,value:string,change:(v:string)=>void,multiline=false)=><Answer label={label} value={value} onChange={change} multiline={multiline}/>;
 return <div className="briefing-shell">
  <header className="briefing-header"><span className="brand-wordmark" role="img" aria-label="David Engine"/><div className="flex wrap"><span role="status" className="small">{save.status==='saving'?'Saving…':save.status==='saved'?'Saved to this workspace':save.status==='unsaved'?'Unsaved changes':save.status==='conflict'?'Newer saved version available':'Save needs attention'}</span><button className="link-button" disabled={pending} onClick={()=>void run(()=>leave())}>Save and exit</button>{!demo&&<button className="link-button" disabled={pending} onClick={()=>void run(async()=>{if(!await save.flush())return;await post('/api/auth/signout',{});location.assign('/login');})}>Sign out</button>}</div></header>
  <main id="main-content" className="briefing-main">
   <p className="eyebrow">{demo?'Synthetic demo · sample data only':a.company.name} / {['welcome','website','description','name'].includes(step)?'Introduction':step==='finish'?'Your workspace':'Your business'}</p>
   {!writable&&<p role="alert">A workspace owner must save answers and approve permissions. You can review this briefing.</p>}
   {(error||save.error)&&<div className="notice" role="alert">{error||save.error}{feedback?.error&&<p className="help">{feedback.text}</p>}{save.status==='error'&&<div className="flex wrap"><button className="btn" onClick={()=>void save.flush()}>Retry saving</button><button className="link-button" onClick={()=>location.reload()}>Reload saved version (discard edits)</button></div>}{save.status==='conflict'&&<button className="btn" onClick={()=>{save.reload();location.reload();}}>Reload saved answers</button>}</div>}
   <fieldset disabled={disabled} className="onboarding-fields">
   {step==='welcome'&&<Question id={step} title={title[step]} description="Share what you’re working toward. We’ll research your public pages and save the facts your workspace needs." onContinue={next} label="Let’s begin"/>}
   {step==='website'&&<Question id={step} title={title[step]} description={demo?'This demo uses an illustrative company website. It never reads real websites.':'We’ll read public pages while you tell us what matters. You can correct everything we find.'} onContinue={()=>void run(()=>websiteNext())} disabled={!website.trim()}>
    {field('Company website',website,v=>{setWebsite(v);const id=crypto.randomUUID();request.current=id;setCapture(undefined);setResearch('idle');save.update(d=>({...d,briefing:{...d.briefing!,websiteInput:v,researchId:id,reviewedFacts:'',finished:false},operations:{...d.operations,policyAcknowledged:false}}));})}<button type="button" className="link-button" onClick={()=>void run(()=>websiteNext(true))}>I don’t have a website</button>
   </Question>}
   {step==='description'&&<Question id={step} title={title[step]} description="A sentence or two is enough. This stays as your own description; it isn’t independently verified website evidence." onContinue={next} disabled={!b.description.trim()}>{field('Business description',b.description,v=>briefing({description:v}),true)}</Question>}
   {step==='name'&&<Question id={step} title={title[step]} onContinue={next} disabled={!b.name.trim()}>{field('Your name',b.name,v=>briefing({name:v}))}</Question>}
   {step==='goal'&&<Question id={step} title={title[step]} description="Choose one or more. We’ll use this to focus your workspace." onContinue={next} disabled={!chosenGoals(b).length}>
    <div className="briefing-choices" role="group" aria-label="Business directions">{goals.map((g,i)=><label key={g.id} className={`briefing-choice ${hasGoal(b,g.id)?'selected':''}`}><input type="checkbox" name="business-goals" value={g.id} checked={hasGoal(b,g.id)} onChange={()=>toggleGoal(g.id)}/><kbd aria-hidden="true">{i+1}</kbd><span>{g.label}</span></label>)}</div>
   </Question>}
   {step==='other-goal'&&<Question id={step} title={title[step]} description="We’ll save your objective. This doesn’t imply a custom workflow already exists." onContinue={next} disabled={!b.otherGoal.trim()}>{field('Your objective',b.otherGoal,v=>briefing({otherGoal:v}),true)}</Question>}
   {step==='research'&&<Question id={step} title={b.noWebsite?'Let’s fill in just the essentials.':title[step]} description={b.noWebsite?'We’ll use the description you provided and ask only for the missing facts.':research==='running'?'The public pages are still being read. You can wait here or continue with your own answers.':research==='ready'?'Your pages are captured. Review the suggested facts and any gaps together.':research==='failed'?'We couldn’t read this site. You can continue with your own answers.':'No completed research is available for this website yet.'} onContinue={()=>void run(async()=>{useResearch();if(usableCapture)await go('summary');else await forward();})} label={usableCapture?'Review what we found':'Continue with my own answers'}>
    {!b.noWebsite&&research!=='running'&&!usableCapture&&<button type="button" className="btn" onClick={()=>void researchWebsite(a.company.website,b.researchId)}>Retry website research</button>}
    {b.description&&<p className="briefing-excerpt">{b.description}</p>}
   </Question>}
   {step==='company-name'&&<Question id={step} title={title[step]} onContinue={usableCapture?()=>void run(()=>go('summary')):next} disabled={!a.company.name.trim()}>{field('Company name',a.company.name,v=>company('name',v))}</Question>}
   {step==='offer'&&<Question id={step} title={title[step]} onContinue={usableCapture?()=>void run(()=>go('summary')):next} disabled={!a.company.offers.some(v=>v.trim())}>{field('Main offer',a.company.offers.join('\n'),v=>company('offers',v),true)}</Question>}
   {step==='customers'&&<Question id={step} title={title[step]} onContinue={usableCapture?()=>void run(()=>go('summary')):next} disabled={!a.company.customers.some(v=>v.trim())}>{field('Ideal customers',a.company.customers.join('\n'),v=>company('customers',v),true)}</Question>}
   {step==='summary'&&<Question id={step} title={title[step]} description={usableCapture?'Suggested facts remain unconfirmed until you review them.':'Based on your answers. Website research has not verified these facts.'} onContinue={()=>void run(confirmSummary)} disabled={!a.company.name||!a.company.offers.length||!a.company.customers.length} label="That’s right">
    <div className="briefing-summary"><h2>{a.company.name}</h2><SummaryFacts offers={a.company.offers} customers={a.company.customers}/></div>
    {!a.company.offers.length&&<div className="briefing-summary"><h2>One detail to add: your main offer</h2><p>We couldn’t confidently extract this from the captured wording.</p><button type="button" className="btn" onClick={()=>void run(()=>go('offer'))}>Add your main offer</button></div>}
    {!a.company.customers.length&&<div className="briefing-summary"><h2>Who should this work focus on?</h2><p>The captured pages didn’t give us a clear audience. Choose one to start. These are your choices, not website findings.</p><div className="flex wrap">{(a.company.businessModel==='home_services'?['Homeowners','Businesses','Property managers']:['Individuals','Small businesses','Enterprise teams']).map(value=><button type="button" className="btn" key={value} onClick={()=>company('customers',value)}>{value}</button>)}<button type="button" className="btn" onClick={()=>void run(()=>go('customers'))}>Describe another audience</button></div></div>}
    <details><summary>Let me change something</summary><div className="flex wrap">{(['company-name','offer','customers'] as const).map(s=><button type="button" className="btn" key={s} onClick={()=>void run(()=>go(s))}>{s==='company-name'?'Company name':s==='offer'?'Main offer':'Customers'}</button>)}</div></details>
    {usableCapture&&<details><summary>See source excerpts</summary>{usableCapture.pages.map(p=><blockquote className="briefing-excerpt" key={p.url}><a href={p.url} target="_blank" rel="noreferrer">{p.title||p.url}</a><p>{p.description}</p><p>{p.text.slice(0,2000)}</p></blockquote>)}</details>}
   </Question>}
   {step==='proposal-source'&&<Question id={step} title={title[step]} description="For example: a Google Sheet, your CRM, or a folder. We won’t connect or read it yet." onContinue={next} disabled={!b.proposalSource.trim()}>
    {field('Proposal system',b.proposalSource,v=>briefing({proposalSource:v}))}
    <p className="help">Automatic proposal follow-up is a separate pilot requiring verified proposal and mailbox access. This briefing only saves where they live today.</p>
   </Question>}
   {step==='conversion-action'&&<Question id={step} title={title[step]} description="For example: request a quote, book a consultation, or make a purchase." onContinue={next} disabled={!b.conversionAction.trim()}>{field('Desired visitor action',b.conversionAction,v=>briefing({conversionAction:v}))}</Question>}
   {step==='finish'&&<Question id={step} title={title[step]} description="Your business context is saved. Source connections and permissions stay in setup.">
    <div className="briefing-summary"><p className="eyebrow">{goalLabels(b).join(' · ')}</p><h2>{a.company.name}</h2><SummaryFacts offers={a.company.offers} customers={a.company.customers}/></div>
    <div className="flex wrap"><button type="button" className="btn btn-primary" onClick={()=>void run(()=>leave())}>Open my workspace</button><button type="button" className="btn" onClick={()=>void run(()=>leave(true))}>Continue setup</button><button type="button" className="link-button" onClick={()=>void run(help)}>Request setup assistance</button></div>
   </Question>}
   </fieldset>
  </main>
  <footer className="briefing-footer"><button className="btn" disabled={disabled||step==='welcome'} onClick={()=>void run(back)}>← Back</button><span className="help">{research==='running'?'Reading public website pages in the background…':'Your answers stay with this workspace.'}</span><button className="link-button" disabled={pending} onClick={()=>void run(()=>leave(true))}>Complete profile</button></footer>
 </div>;
}
