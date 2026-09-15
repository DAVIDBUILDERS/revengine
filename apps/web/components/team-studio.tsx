"use client";
import {useContext,useEffect,useState,type ReactNode} from 'react';
import {ArrowUpRight,Plus,Play,ShieldCheck,FileText,Settings2} from 'lucide-react';
import {catalog} from '@david/domain';
import type {ScreenProps} from './app-shell';
import {onboardingFor} from '@david/domain/onboarding';
import {agentConversationLabel,agentDelivery,conversationProposalForAgent,isWalkthroughFloor,specialistWorkSnapshot} from '@david/domain/delivery';
import {ALWAYS_ON_AGENT_ID, isIncludedAgent, nextAgentIds, workbenchAgentIds} from '@david/domain/team';
import {AgentWorkspace} from './agent-workspace';
import {ArtifactCopyOut} from './artifact-copy-out';
import {Button,dateTime,QuietWalkthroughContext} from './ui';

export function TeamStudio(props:ScreenProps & {configuration:ReactNode}){
 const quiet=useContext(QuietWalkthroughContext);
 const {state,act,busy,navigate,configuration}=props;
 const floor=isWalkthroughFloor(state,quiet);
 const saved=onboardingFor(state);const ids=workbenchAgentIds(saved.revision?saved.answers.team:state.activation.selectedTeam);
 const [chosen,setChosen]=useState('');const [settings,setSettings]=useState(false);const [builderOpened,setBuilderOpened]=useState(false);const [inspect,setInspect]=useState(false);
 const agents=ids.map(id=>state.catalog.find(a=>a.id===id)).filter(a=>!!a);
 const agent=agents.find(a=>a.id===chosen)??agents[0];
 const install=state.installations.find(i=>i.agentId===agent?.id);
 const outputs=state.artifacts.filter(a=>a.agentId===agent?.id).slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 const output=outputs[0];const [outputId,setOutputId]=useState('');const current=outputs.find(a=>a.id===outputId)??output;
 const goal=saved.answers.company.priorities[0]||state.recommendation.goal;
 const delivery=agent?agentDelivery(state,agent.id):null;
 const conversationLabel=agent?agentConversationLabel(agent.id):null;
 const recommended=nextAgentIds(goal,state.workspace.businessModel,ids,7);
 const recommendedAgents=recommended.map(id=>catalog.find(item=>item.id===id)).filter(item=>!!item);
 const catalogRest=catalog.filter(item=>!ids.includes(item.id)&&!recommended.includes(item.id));
 function setup(){navigate('connections');}
 function openConversation(agentId:string){
  const proposalId=conversationProposalForAgent(state,agentId);
  navigate('opportunities',proposalId?{proposal:proposalId}:undefined);
 }
 function selectAgent(id:string){
  setChosen(id);setOutputId('');
  const url=new URL(window.location.href);
  url.searchParams.set('view','team');url.searchParams.set('agent',id);
  window.history.replaceState({},'',`${url.pathname}${url.search}`);
 }
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  setChosen(params.get('agent')??'');
  const build=params.get('team')==='build';
  setSettings(build);setBuilderOpened(build);
  const sync=()=>setChosen(new URLSearchParams(window.location.search).get('agent')??'');
  window.addEventListener('popstate',sync);
  return ()=>window.removeEventListener('popstate',sync);
 },[]);
 return <div className="team-studio">
  <header className="studio-heading"><div><span className="studio-kicker">DAVID / WORKSPACE</span><h1>AI agents<span aria-hidden="true">.</span></h1><p>{state.workspace.name} · Five paid agents plus the included website concierge. Browse the rest below.</p></div><Button onClick={()=>(setBuilderOpened(true),setSettings(!settings))}><Settings2 size={15}/>{settings?'Back to workspace':'Build your team'}</Button></header>
  {builderOpened&&<section hidden={!settings} aria-label="Team configuration">{configuration}</section>}
  {!settings&&<>
  <section className="studio-mission"><div><span className="studio-kicker">THE OBJECTIVE</span><h2>{goal||'Choose the work that moves your business forward.'}</h2></div><button className="studio-text-action" onClick={()=>(setBuilderOpened(true),setSettings(true))}>Shape the team <ArrowUpRight size={16}/></button></section>
  <nav className="studio-team" aria-label="Choose an agent">{agents.map(a=>{const work=specialistWorkSnapshot(state,a.id);const n=work.artifacts;const subtitle=n?`${n} saved output${n===1?'':'s'}`:work.latestTitle?work.latestTitle:isIncludedAgent(a.id)?'Included with every workspace':a.releaseStatus==='planned'?'Capability planned':'Awaiting work';return <button key={a.id} className={`studio-specialist ${agent?.id===a.id?'is-current':''}`} aria-pressed={agent?.id===a.id} onClick={()=>selectAgent(a.id)}><span className="studio-specialist-top"><span className="studio-index">{isIncludedAgent(a.id)?'IN':String(ids.filter(id=>id!==ALWAYS_ON_AGENT_ID).indexOf(a.id)+1).padStart(2,'0')}</span><ArrowUpRight size={16}/></span><strong>{a.name}</strong><span>{subtitle}</span></button>})}<button className="studio-add" onClick={()=>(setBuilderOpened(true),setSettings(true))}><Plus size={23}/><span>{agents.length?'Edit team':'Choose your specialists'}</span></button></nav>
  {agent?<section className="studio-workbench" aria-label={`${agent.name} workbench`}>
   <aside className="studio-brief"><span className="studio-kicker">{isIncludedAgent(agent.id)?'INCLUDED WITH EVERY WORKSPACE':'ASSIGNED SPECIALIST'}</span><h2>{agent.name}</h2><p>{(state.workspace.mode==='fixture'&&agent.releaseStatus==='planned'?agent.responsibility.replace(/ is catalog scope; external execution is not implemented\./,' prepares reviewable work you can copy into your tools.'):agent.responsibility).replace(/source-grounded /g,'').replace(/WebsiteProfile/g,'company research').replace(/ContentBrief/g,'a content brief').replace(/CapturedPageAudit/g,'a website assessment')}</p>
   <div className="studio-state"><span className="studio-status-dot"/>{state.workspace.paused?'Workspace paused':!install?'Setup required':install.blockers.length?'Needs your attention':'Available for review'}</div>
   {install?.blockers.length? <p className="studio-blocker">{install.blockers[0]}</p>:null}
   {delivery&&<p className="studio-destination">{delivery.headline}</p>}
   <div className="studio-actions">{conversationLabel&&floor?<Button variant="primary" onClick={()=>openConversation(agent.id)}>{conversationLabel} <ArrowUpRight size={14}/></Button>:state.workspace.mode==='fixture'&&agent.releaseStatus==='planned'&&current?<Button variant="primary" onClick={()=>setInspect(true)}>Review saved work <ArrowUpRight size={14}/></Button>:agent.releaseStatus==='planned'?<p>This capability is not implemented yet.</p>:agent.modes.includes('preparation')?<Button variant="primary" disabled={busy||state.workspace.paused||!install} onClick={()=>void act({type:'prepare',agentId:agent.id})}><Play size={14}/>{busy?'Requesting…':'Prepare first draft'}</Button>:<Button variant="primary" onClick={()=>navigate('opportunities')}>Open pipeline <ArrowUpRight size={14}/></Button>}
   <button className="studio-text-action" onClick={setup}>{state.workspace.mode==='fixture'&&agent.releaseStatus==='planned'?'Company sources':delivery?.mode==='engineering_required'||agent.releaseStatus==='planned'?'Record needed systems':delivery?.mode==='needs_access'?'Review source access':'Company sources'} <ArrowUpRight size={14}/></button><button className="studio-text-action" onClick={()=>setInspect(true)}><ShieldCheck size={15}/>Access, limits & history</button></div>
   <p className="studio-footnote">{quiet||state.workspace.mode!=='fixture'?'Requests use approved sources. External actions require separate authorization.':'Synthetic workspace. Outputs are examples.'}</p></aside>
   <div className="studio-document"><header><span><FileText size={15}/> WORK PRODUCT</span>{outputs.length>1&&<select aria-label="Choose saved output" value={current?.id} onChange={e=>setOutputId(e.target.value)}>{outputs.map(o=><option key={o.id} value={o.id}>{o.title}</option>)}</select>}<span>{current?'Saved':'No output yet'}</span></header>
   {current?<article className="studio-output"><p className="studio-kicker">{dateTime(current.createdAt)} · {current.reviewState}</p><h2>{current.title}</h2><div className="studio-output-content">{current.content}</div><p className="studio-footnote">{current.limitation}</p>{delivery&&<ArtifactCopyOut artifact={current} delivery={delivery}/>}<Button onClick={()=>setInspect(true)}>Review output & sources <ArrowUpRight size={14}/></Button></article>:<div className="studio-empty"><div className="studio-orbit" aria-hidden="true"><span>D</span></div><span className="studio-kicker">A PLACE FOR REAL WORK</span><h2>Work you can copy out<br/>belongs here.</h2><p>{!install?'Save your team and review its setup to begin.':state.workspace.paused?'Review workspace permissions and readiness before requesting work.':'Prepare work from approved sources, then copy it into your own tools.'}</p><button className="studio-text-action" onClick={()=>setInspect(true)}>See what’s needed <ArrowUpRight size={16}/></button></div>}
   </div>
  </section>:<section className="studio-empty"><h2>Build around a business problem.</h2><p>Choose an objective and assemble your team together on the call.</p><Button variant="primary" onClick={()=>(setBuilderOpened(true),setSettings(true))}>Build your team <Plus size={15}/></Button></section>}
  <section className="agent-browse" aria-label="DAVID catalog">
   <div className="agent-browse-intro">
    <span className="studio-kicker">THE REST OF DAVID</span>
    <h2>More agents when you are ready.</h2>
    <p>Your five plus the included website concierge are above. Adding another is a conversation with your specialist — nothing here starts on its own.</p>
   </div>
   {recommendedAgents.length>0&&<>
    <h3>Worth testing next</h3>
    <div className="agent-browse-grid">
     {recommendedAgents.map(item=><article key={item.id} className="agent-browse-card">
      <span className="studio-kicker">{item.category}</span>
      <strong>{item.name}</strong>
      <p>{item.responsibility.replace(/ is catalog scope; external execution is not implemented\./,'.')}</p>
      <button type="button" className="studio-text-action" onClick={()=>(setBuilderOpened(true),setSettings(true))}>See in builder <ArrowUpRight size={14}/></button>
     </article>)}
    </div>
   </>}
   <h3>All DAVID agents</h3>
   <div className="agent-browse-grid">
    {catalogRest.map(item=><article key={item.id} className="agent-browse-card">
     <span className="studio-kicker">{item.category}</span>
     <strong>{item.name}</strong>
     <p>{item.responsibility.replace(/ is catalog scope; external execution is not implemented\./,'.')}</p>
     <button type="button" className="studio-text-action" onClick={()=>(setBuilderOpened(true),setSettings(true))}>See in builder <ArrowUpRight size={14}/></button>
    </article>)}
   </div>
  </section>
  </>}
  <AgentWorkspace {...props} agent={inspect&&agent?agent:null} onClose={()=>setInspect(false)}/>
 </div>;
}
