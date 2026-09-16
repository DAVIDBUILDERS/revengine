"use client";
import {useContext,useEffect,useState,type ReactNode} from 'react';
import {ArrowUpRight,Plus,Settings2} from 'lucide-react';
import {catalog} from '@david/domain';
import type {ScreenProps} from './app-shell';
import {onboardingFor} from '@david/domain/onboarding';
import {agentOvernightRecap,conversationProposalForAgent,isWalkthroughFloor} from '@david/domain/delivery';
import {ALWAYS_ON_AGENT_ID, isIncludedAgent, nextAgentIds, workbenchAgentIds} from '@david/domain/team';
import {AgentWorkspace} from './agent-workspace';
import {Button,QuietWalkthroughContext} from './ui';

export function TeamStudio(props:ScreenProps & {configuration:ReactNode}){
 const quiet=useContext(QuietWalkthroughContext);
 const {state,navigate,configuration}=props;
 const floor=isWalkthroughFloor(state,quiet);
 const saved=onboardingFor(state);const ids=workbenchAgentIds(saved.revision?saved.answers.team:state.activation.selectedTeam);
 const [settings,setSettings]=useState(false);const [builderOpened,setBuilderOpened]=useState(false);const [inspect,setInspect]=useState(false);
 const agents=ids.map(id=>state.catalog.find(a=>a.id===id)).filter(a=>!!a);
 const [chosen,setChosen]=useState('');
 const agent=agents.find(a=>a.id===chosen)??agents[0];
 const goal=saved.answers.company.priorities[0]||state.recommendation.goal;
 const recommended=nextAgentIds(goal,state.workspace.businessModel,ids,7);
 const recommendedAgents=recommended.map(id=>catalog.find(item=>item.id===id)).filter(item=>!!item);
 const catalogRest=catalog.filter(item=>!ids.includes(item.id)&&!recommended.includes(item.id));
 function openConversation(agentId:string){
  const proposalId=conversationProposalForAgent(state,agentId);
  navigate('opportunities',proposalId?{proposal:proposalId}:undefined);
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
  <header className="studio-heading"><div><span className="studio-kicker">DAVID / WORKSPACE</span><h1>AI agents<span aria-hidden="true">.</span></h1><p>{state.workspace.name} · Five paid agents plus the included website concierge. Browse the rest below.</p></div><div className="studio-heading-actions"><button className="studio-text-action" onClick={()=>setInspect(true)}>Workspace limits</button><Button onClick={()=>(setBuilderOpened(true),setSettings(!settings))}><Settings2 size={15}/>{settings?'Back to workspace':'Build your team'}</Button></div></header>
  {builderOpened&&<section hidden={!settings} aria-label="Team configuration">{configuration}</section>}
  {!settings&&<>
  <section className="studio-mission"><div><span className="studio-kicker">THE OBJECTIVE</span><h2>{goal||'Choose the work that moves your business forward.'}</h2></div><button className="studio-text-action" onClick={()=>(setBuilderOpened(true),setSettings(true))}>Shape the team <ArrowUpRight size={16}/></button></section>
  <section className="agent-results" aria-label="Your agents">
   {agents.map(item=>{
    const recap=agentOvernightRecap(state,item.id);
    return <article key={item.id} className={`agent-result-card ${item.id===ALWAYS_ON_AGENT_ID?'is-concierge':''}`}>
     <button type="button" className="agent-result-open" onClick={()=>navigate('today',{agent:item.id})} aria-label={`Open ${item.name} recap`}>
      <span className="studio-kicker">{isIncludedAgent(item.id)?'INCLUDED · FREE':floor?'OVERNIGHT':'ON THE TEAM'}</span>
      <strong>{item.name}</strong>
      <p>{recap.headline}</p>
     </button>
     {recap.primary.kind==='conversation'?
      <Button variant="primary" onClick={()=>openConversation(item.id)}>{recap.primary.label} <ArrowUpRight size={14}/></Button>
      :recap.primary.kind==='pipeline'?
      <Button onClick={()=>navigate('opportunities')}>{recap.primary.label} <ArrowUpRight size={14}/></Button>
      :<Button onClick={()=>navigate('today',{agent:item.id})}>Read the recap <ArrowUpRight size={14}/></Button>}
    </article>;
   })}
   <button className="studio-add agent-result-add" onClick={()=>(setBuilderOpened(true),setSettings(true))}><Plus size={23}/><span>{agents.length?'Edit team':'Choose your specialists'}</span></button>
  </section>
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
