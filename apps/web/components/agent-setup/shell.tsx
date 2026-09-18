'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {AgentDefinition} from '@david/contracts';
import {SERP_LOCATIONS} from '@david/contracts';
import {
  agentSetupPath,
  bookingUrlInfo,
  companyFromSnapshot,
  companyWebsite,
  generateVoiceOpening,
  nextSetupAgentId,
  onboardingFor,
  parseLeadCsv,
  parseSetupKeywords,
  prepareFromContext,
  sequencePreviewFromSnapshot,
  setupCompanyName,
  setupPages,
  slotAgentIds,
  technicalSeoAnswers,
} from '@david/domain';
import {Answer,Question} from '../briefing/question';
import type {ScreenProps} from '../app-shell';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Tools({tools}:{tools:string[]}) {
  if (!tools.length) return null;
  return <div className="agent-setup-tools" aria-label="Required tools">{tools.map(tool=><span key={tool}>{tool}</span>)}</div>;
}

export function AgentSetupShell({agent,onExit,...props}:ScreenProps & {agent:AgentDefinition;onExit:()=>void}) {
  const {state,act,busy,navigate}=props;
  const steps=agentSetupPath(state,agent.id);
  const [stepId,setStepId]=useState(steps[0]?.id ?? 'intro');
  const [done,setDone]=useState(false);
  const [csvError,setCsvError]=useState('');
  const answers=state.agentOnboarding?.find(record=>record.agentId===agent.id)?.answers ?? {};
  const seo=technicalSeoAnswers(state);
  const [draft,setDraft]=useState({
    bookingUrl:String(answers.bookingUrl ?? state.outboundSdr?.bookingUrl ?? ''),
    csv:'',
    keywords:seo.keywords.join('\n'),
    locationName:seo.locationName || SERP_LOCATIONS[0].name,
    greeting:String(answers.greeting ?? `Thanks for calling ${setupCompanyName(state)}. How can I help?`),
    hours:String(answers.hours ?? ''),
    script:String(answers.script ?? ''),
    listMode:String(answers.listMode ?? ''),
    bindId:String(answers.elevenlabsAgentId ?? ''),
    proposalSource:String(answers.proposalSource ?? state.onboarding?.answers.briefing?.proposalSource ?? ''),
  });
  const installRequested=useRef(false);
  const index=Math.max(0,steps.findIndex(step=>step.id===stepId));
  const step=steps[index] ?? steps[0];
  const nextAgentId=nextSetupAgentId(state,agent.id);
  const nextAgent=state.catalog.find(item=>item.id===nextAgentId);
  const bookingUrl=draft.bookingUrl || state.outboundSdr?.bookingUrl || '';
  const sequence=useMemo(()=>sequencePreviewFromSnapshot(state, bookingUrl),[state,bookingUrl]);
  const companyAnswers=state.onboarding?.answers.company;
  const voiceScript=draft.script || generateVoiceOpening({
    companyName:setupCompanyName(state),
    offers:companyAnswers?.offers ?? [],
    customerTypes:companyAnswers?.customers ?? [],
  }, bookingUrl);
  const pages=setupPages(state);
  const artifact=state.artifacts.filter(item=>item.agentId===agent.id).slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
  const origin=companyWebsite(state) || 'the captured company website';

  useEffect(()=>{
    if (installRequested.current) return;
    const saved=slotAgentIds(onboardingFor(state).answers.team.length?onboardingFor(state).answers.team:state.activation.selectedTeam);
    if (state.installations.some(item=>item.agentId===agent.id) || !saved.includes(agent.id)) return;
    installRequested.current=true;
    void act({type:'select_team',agentIds:saved}).then(result=>{if(!result)installRequested.current=false;});
  },[act,agent.id,state.installations,state.onboarding,state.activation.selectedTeam]);

  useEffect(()=>{
    if (done || !steps.length) return;
    if (!steps.some(item=>item.id===stepId)) setStepId(steps[Math.min(index,steps.length-1)]?.id ?? steps[0].id);
  },[steps,stepId,done,index]);

  function update<K extends keyof typeof draft>(key:K,value:(typeof draft)[K]) {
    setDraft(current=>({...current,[key]:value}));
  }

  async function saveAnswers(patch:Record<string,unknown>) {
    const current=state.agentOnboarding?.find(record=>record.agentId===agent.id);
    return act({type:'save_agent_onboarding',agentId:agent.id,expectedRevision:current?.revision ?? 0,answers:{...(current?.answers ?? {}),...patch}});
  }

  function localReady() {
    if (!step) return false;
    if (step.kind==='confirm' && step.id!=='prepare') return true;
    switch (step.id) {
      case 'booking': return bookingUrlInfo(draft.bookingUrl).ok;
      case 'leads': return Boolean(draft.csv.trim()) || step.canContinue;
      case 'sequence': return sequence.length>=3 || bookingUrlInfo(bookingUrl).ok || step.canContinue;
      case 'keywords': { const keywords=parseSetupKeywords(draft.keywords); return keywords.length>=1 && keywords.length<=20; }
      case 'location': return SERP_LOCATIONS.some(item=>item.name===draft.locationName);
      case 'bind': return UUID.test(draft.bindId.trim());
      case 'greeting': return draft.greeting.trim().length>=4;
      case 'hours': return draft.hours.trim().length>=2;
      case 'script': return voiceScript.trim().length>=12;
      case 'list': return draft.listMode==='email' || (draft.listMode==='csv' && (Boolean(draft.csv.trim()) || step.canContinue));
      case 'proposals': return draft.proposalSource.trim().length>=2 || step.canContinue;
      case 'prepare': return step.canContinue;
      case 'artifact':
      case 'facts':
      case 'preview':
      case 'tools':
      case 'gmail': return true;
      default: return step.canContinue;
    }
  }

  async function persist() {
    if (!step) return false;
    if (step.id==='booking') {
      if (agent.id==='outbound-email-sdr') return Boolean(await act({type:'set_booking_url',url:draft.bookingUrl.trim()}));
      return Boolean(await saveAnswers({bookingUrl:draft.bookingUrl.trim()}));
    }
    if (step.id==='leads') {
      if (step.canContinue && !draft.csv.trim()) return true;
      const preview=parseLeadCsv(draft.csv);
      if (!preview.valid) { setCsvError(preview.errors[0]?.message || 'Email is required.'); return false; }
      return Boolean(await act({type:'import_lead_csv',csv:draft.csv,preview:false,mapping:preview.mapping}));
    }
    if (step.id==='sequence') return Boolean(await act({type:'generate_outbound_sequence'}));
    if (step.id==='bind') {
      if (agent.id==='outbound-email-sdr') return Boolean(await act({type:'bind_instantly_workspace',instantlyWorkspaceId:draft.bindId.trim()}));
      return Boolean(await saveAnswers({elevenlabsAgentId:draft.bindId.trim()}));
    }
    if (step.id==='keywords') return Boolean(await saveAnswers({keywords:parseSetupKeywords(draft.keywords)}));
    if (step.id==='location') {
      const current=state.agentOnboarding?.find(record=>record.agentId==='technical-seo-monitor');
      const keywords=parseSetupKeywords(draft.keywords).length?parseSetupKeywords(draft.keywords):seo.keywords;
      const location=SERP_LOCATIONS.find(item=>item.name===draft.locationName) ?? SERP_LOCATIONS[0];
      return Boolean(await act({type:'save_technical_seo_setup',expectedRevision:current?.revision ?? 0,keywords,locationName:location.name,languageCode:location.languageCode}));
    }
    if (step.id==='prepare') {
      if (state.artifacts.some(item=>item.agentId===agent.id)) return true;
      if (!state.workspace.paused) return Boolean(await act({type:'prepare',agentId:agent.id}));
      try {
        const preview=prepareFromContext(agent.id,companyFromSnapshot(state));
        return Boolean(await saveAnswers({previewTitle:preview.title,previewContent:preview.content,pausedPreview:true}));
      } catch {
        return Boolean(await saveAnswers({pausedPreview:true}));
      }
    }
    if (step.id==='proposals') return Boolean(await saveAnswers({proposalSource:draft.proposalSource.trim()}));
    if (step.id==='greeting') return Boolean(await saveAnswers({greeting:draft.greeting.trim()}));
    if (step.id==='hours') return Boolean(await saveAnswers({hours:draft.hours.trim()}));
    if (step.id==='script') return Boolean(await saveAnswers({script:voiceScript.trim()}));
    if (step.id==='list') {
      if (draft.listMode==='csv' && draft.csv.trim()) {
        const preview=parseLeadCsv(draft.csv);
        if (!preview.valid) { setCsvError(preview.errors[0]?.message || 'Email is required.'); return false; }
      }
      return Boolean(await saveAnswers({listMode:draft.listMode,leadsImported:draft.listMode==='csv' && Boolean(draft.csv.trim())}));
    }
    if (step.id==='ready') return Boolean(await saveAnswers({completed:true}));
    return true;
  }

  async function forward() {
    if (busy || !localReady()) return;
    const saved=await persist();
    if (!saved) return;
    if (index>=steps.length-1) { setDone(true); return; }
    setStepId(steps[index+1].id);
    setCsvError('');
  }

  function back() {
    if (done) { setDone(false); setStepId(steps.at(-1)?.id ?? 'ready'); return; }
    if (index<=0) { onExit(); return; }
    setStepId(steps[index-1].id);
  }

  const disabled=busy || !localReady();
  const progress=done?100:steps.length?Math.round(((index+1)/steps.length)*100):0;

  return <div className="briefing-shell agent-setup-shell">
    <header className="briefing-header">
      <span className="brand-wordmark" role="img" aria-label="David Engine"/>
      <div className="flex wrap" style={{alignItems:'center',gap:16}}>
        <div className="agent-setup-progress" aria-hidden="true"><span style={{width:`${progress}%`}}/></div>
        <span className="help">{done?'Done':`${index+1} / ${steps.length}`}</span>
        <button className="link-button" disabled={busy} onClick={onExit}>Save and exit</button>
      </div>
    </header>
    <main id="agent-setup-main" className="briefing-main">
      <p className="eyebrow">{state.workspace.name} / {agent.name}</p>
      {step && <Tools tools={step.requiredTools}/>}
      {done
        ? <Question id={`${agent.id}-done`} title={`${agent.name} is set up.`} description="The specialist is installed. Start send, crawls, and live calls stay on their own gates.">
            <div className="flex wrap">
              {nextAgent && <button type="button" className="btn btn-primary" onClick={()=>navigate('team',{agent:nextAgent.id,setup:true})}>Set up {nextAgent.name}<span aria-hidden="true"> →</span></button>}
              <button type="button" className="btn" onClick={onExit}>Back to team</button>
            </div>
          </Question>
        : step && <Question id={`${agent.id}-${step.id}`} title={step.title} description={step.description} onContinue={()=>void forward()} disabled={disabled} label={step.id==='ready'?'Finish setup':step.id==='prepare'?'Run preparation':'Continue'}>
            {step.id==='booking' && <Answer label="Meeting link" value={draft.bookingUrl} onChange={value=>update('bookingUrl',value)}/>}
            {step.id==='booking' && <p className="help">{bookingUrlInfo(draft.bookingUrl).message}</p>}
            {step.id==='leads' && <>
              <label className="field">Lead CSV
                <input aria-label="Lead CSV" className="input" type="file" accept=".csv,text/csv" onChange={async event=>{
                  const file=event.target.files?.[0]; if (!file) return;
                  if (file.size>1_000_000) { setCsvError('Choose a CSV smaller than 1 MB.'); return; }
                  update('csv',await file.text()); setCsvError('');
                }}/>
              </label>
              {draft.csv && <p role="status">{parseLeadCsv(draft.csv).valid} valid lead row(s) ready.</p>}
              {csvError && <p className="notice notice-warning" role="alert">{csvError}</p>}
              <p className="help">Email is required. This agent does not find leads.</p>
            </>}
            {step.id==='sequence' && <div className="agent-setup-sequence" aria-label="Three-step sequence preview">
              {sequence.map((item,position)=><article key={item.subject} className="agent-setup-card" style={{animationDelay:`${position*90}ms`}}>
                <p className="eyebrow">Step {position+1}</p>
                <strong>{item.subject}</strong>
                <pre>{item.body}</pre>
              </article>)}
              {!sequence.length && <p className="help">Save a meeting link first so the sequence can include it.</p>}
            </div>}
            {step.id==='keywords' && <Answer label="Keywords" value={draft.keywords} onChange={value=>update('keywords',value)} multiline/>}
            {step.id==='keywords' && <div className="agent-setup-tools">{parseSetupKeywords(draft.keywords).map(keyword=><span key={keyword}>{keyword}</span>)}</div>}
            {step.id==='location' && <div className="briefing-choices" role="radiogroup" aria-label="SERP location">
              {SERP_LOCATIONS.map((item,position)=><label key={item.name} className={`briefing-choice ${draft.locationName===item.name?'selected':''}`}>
                <input type="radio" name="serp-location" checked={draft.locationName===item.name} onChange={()=>update('locationName',item.name)}/>
                <kbd aria-hidden="true">{position+1}</kbd><span>{item.name}</span>
              </label>)}
            </div>}
            {step.id==='preview' && agent.id==='technical-seo-monitor' && <div className="agent-setup-card"><p className="eyebrow">Crawl target</p><strong>{origin}</strong><p>DataForSEO stays origin-only. Start crawl is a later gate.</p></div>}
            {(step.id==='facts' || step.id==='artifact') && <>
              {pages.length>0 && <div className="agent-setup-pages">{pages.slice(0,4).map(page=><article key={page.url} className="agent-setup-card"><p className="eyebrow">Captured page</p><strong>{page.title || page.url}</strong><p>{page.description || page.text.slice(0,180)}</p></article>)}</div>}
              {artifact && <div className="briefing-output"><p className="eyebrow">{artifact.type}</p><pre>{artifact.content.slice(0,1800)}</pre></div>}
              {!artifact && step.id==='artifact' && String(answers.previewContent ?? '') && <div className="briefing-output"><pre>{String(answers.previewContent).slice(0,1800)}</pre></div>}
            </>}
            {step.id==='tools' && <div className="agent-setup-card"><p>Required tools stay bound by DAVID. You never paste provider keys.</p></div>}
            {step.id==='proposals' && <Answer label="Proposals source" value={draft.proposalSource} onChange={value=>update('proposalSource',value)}/>}
            {step.id==='greeting' && <Answer label="Greeting" value={draft.greeting} onChange={value=>update('greeting',value)} multiline/>}
            {step.id==='hours' && <Answer label="Hours" value={draft.hours} onChange={value=>update('hours',value)}/>}
            {step.id==='script' && <article className="agent-setup-card agent-setup-voice"><p className="eyebrow">DAVID will speak this</p><pre>{voiceScript}</pre></article>}
            {step.id==='list' && <div className="briefing-choices" role="radiogroup" aria-label="Who to call">
              <label className={`briefing-choice ${draft.listMode==='email'?'selected':''}`}><input type="radio" name="voice-list" checked={draft.listMode==='email'} onChange={()=>update('listMode','email')}/><span>Same list as Outbound Email SDR</span></label>
              <label className={`briefing-choice ${draft.listMode==='csv'?'selected':''}`}><input type="radio" name="voice-list" checked={draft.listMode==='csv'} onChange={()=>update('listMode','csv')}/><span>Upload a CSV</span></label>
            </div>}
            {step.id==='list' && draft.listMode==='csv' && <label className="field">Call list CSV
              <input aria-label="Call list CSV" className="input" type="file" accept=".csv,text/csv" onChange={async event=>{
                const file=event.target.files?.[0]; if (!file) return;
                update('csv',await file.text()); setCsvError('');
              }}/>
            </label>}
            {step.id==='bind' && <Answer label={agent.id==='outbound-email-sdr'?'Instantly workspace UUID':'ElevenLabs agent id'} value={draft.bindId} onChange={value=>update('bindId',value)}/>}
            {csvError && step.id!=='leads' && <p className="notice notice-warning" role="alert">{csvError}</p>}
          </Question>}
    </main>
    <footer className="briefing-footer">
      <button className="btn" disabled={busy} onClick={back}>← Back</button>
      <span className="help">{step?.requiredTools.length?`Tools: ${step.requiredTools.join(' · ')}`:'One question at a time.'}</span>
    </footer>
  </div>;
}
