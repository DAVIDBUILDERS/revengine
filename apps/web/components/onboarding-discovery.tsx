"use client";
import {useEffect,useState} from 'react';
import type {AppSnapshot,OnboardingAnswers} from '@david/contracts';
import {proposalFields,suggestColumnMapping} from '@david/domain/onboarding-assist';
import {Button,Badge} from './ui';

type Source=OnboardingAnswers['systems'][number];
export function OnboardingDiscovery({state,onSave}:{state:AppSnapshot;onSave:(source:Source)=>Promise<boolean>}){
 const demo=state.workspace.mode==='fixture';
 const available=state.connections.filter(c=>c.provider==='google'&&!['expired','revoked'].includes(c.health));
 const [connectionId,setConnectionId]=useState(available.length===1?available[0].id:'');
 const [kind,setKind]=useState<'sheet'|'mailbox'|'calendar'>('sheet');
 const [files,setFiles]=useState<{id:string;name:string}[]>([]);
 const [nextPage,setNextPage]=useState<string|undefined>();
 const [fileId,setFileId]=useState('');const [tabs,setTabs]=useState<string[]>([]);const [tab,setTab]=useState('');
 const [headers,setHeaders]=useState<string[]>([]);const [columns,setColumns]=useState<Record<string,string>>({});
 const [owner,setOwner]=useState(state.setupIdentity?.email??'');const [resource,setResource]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 const [reviewed,setReviewed]=useState(false);const [allMappings,setAllMappings]=useState(false);
 const connection=state.connections.find(c=>c.id===connectionId);
 const missing=proposalFields.filter(f=>!columns[f]);
 useEffect(()=>{if(!demo&&connectionId&&connection?.scopes.some(s=>s.endsWith('/drive.file')||s.endsWith('/drive.metadata.readonly')))void load();},[connectionId]);
 async function request(path:string,body:Record<string,unknown>){
  const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspaceId:state.workspace.id,...body})});
  const result=await r.json();if(!r.ok)throw new Error(result.message??'Account access could not be checked.');return result;
 }
 async function load(file?:string,selectedTab?:string,more=false){
  setBusy(true);setMessage('');setReviewed(false);
  try{
   const result=await request('/api/google/discover',{connectionId,...(file?{fileId:file,...(selectedTab?{tab:selectedTab}:{})}:more?{pageToken:nextPage}:{})});
   if(result.files){setFiles(prev=>more?[...prev,...result.files]:result.files);setNextPage(result.nextPageToken);if(!result.files.length)setMessage('No authorized Sheets found. Use an already authorized file ID, or explicitly authorize read-only spreadsheet discovery above.');}
   if(result.tabs){setTabs(result.tabs);setTab(selectedTab??'');setHeaders(result.headers);setColumns(result.mapping?.columns??{});if(file&&!selectedTab&&result.tabs.length===1)await load(file,result.tabs[0]);}
  }catch(e){setMessage(e instanceof Error?e.message:'Discovery failed.');}finally{setBusy(false);}
 }
 function sample(){setFileId('sample-proposals');setTabs(['Proposals']);setTab('Proposals');setHeaders([...proposalFields]);setColumns(suggestColumnMapping([...proposalFields]).columns);setOwner('Example source owner');setMessage('Illustrative headers loaded. No Google account was accessed.');setReviewed(false);}
 async function save(){
  setBusy(true);setMessage('');
  try{
   const resourceId=kind==='sheet'?fileId:resource;const mapping=kind==='sheet'?{columns}:{};
   const range=kind==='sheet'?`'${tab.replaceAll("'","''")}'!A1:AZ501`:null;
   // Saving intent comes first; a queued check must observe a revision no older than that intent.
   const saved=await onSave({id:crypto.randomUUID(),kind:kind==='sheet'?'proposals':kind==='mailbox'?'mail':'calendar',tool:kind==='sheet'?'Google Sheets':kind==='mailbox'?'Gmail':'Google Calendar',availability:'available',resource:resourceId,owner,mapping:kind==='sheet'?JSON.stringify({range,...mapping}):'',connectionId:demo?'':connectionId});
   if(!saved)throw new Error('Source selection was not saved. Review the setup conflict before continuing.');
   if(!demo){const result=await request('/api/google/bind',{connectionId,resourceType:kind,resourceId,range,mapping,owner});setMessage(result.message);}else setMessage('Sample source selection saved. Actual account verification is unavailable in the browser demo.');
  }catch(e){setMessage(e instanceof Error?e.message:'Source selection failed.');}finally{setBusy(false);}
 }
 return <div className="card card-body stack"><fieldset disabled={busy} className="onboarding-fields stack">
  <div className="between wrap"><h3>Choose an authorized resource</h3><Badge>{demo?'Sample resources':'Read-only discovery'}</Badge></div>
  {demo?<><p>Try suggested column mapping with a labeled sample. Real account discovery runs in the operational deployment.</p><Button onClick={sample}>Load sample spreadsheet headers</Button></>:<>
   <label className="field">Google account<select aria-label="Discovery Google account" className="input" value={connectionId} onChange={e=>{setConnectionId(e.target.value);setFiles([]);setFileId('');setHeaders([]);setColumns({});setTabs([]);setReviewed(false);setResource(state.connections.find(c=>c.id===e.target.value)?.identity??'');}}><option value="">Choose a connected account</option>{state.connections.filter(c=>c.provider==='google').map(c=><option key={c.id} value={c.id}>{c.identity} · {c.health}</option>)}</select></label>
   <label className="field">Source type<select aria-label="Discovery source type" className="input" value={kind} onChange={e=>{setKind(e.target.value as typeof kind);setReviewed(false);setResource(connection?.identity??'');}}><option value="sheet">Proposal spreadsheet</option><option value="mailbox">Sender and reply mailbox</option><option value="calendar">Booking calendar</option></select></label>
   {kind==='sheet'?<>
    <Button disabled={busy||!connectionId} onClick={()=>void load()}>Find authorized spreadsheets</Button>
    <p className="help">Lists only spreadsheets allowed by the current Google grant. Discovery does not search mailbox contents or widen your Google permissions.</p>
    {files.length>0&&<label className="field">Spreadsheet<select aria-label="Discovered spreadsheet" className="input" value={fileId} onChange={e=>{setFileId(e.target.value);setHeaders([]);setColumns({});setTabs([]);void load(e.target.value);}}><option value="">Choose a spreadsheet</option>{files.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>}
    {nextPage&&<Button disabled={busy} onClick={()=>void load(undefined,undefined,true)}>Load more authorized files</Button>}
    <details><summary>Use an already authorized file ID</summary><label className="field">Spreadsheet file ID<input aria-label="Discovery spreadsheet file ID" className="input" value={fileId} onChange={e=>{setFileId(e.target.value);setTabs([]);setTab('');setHeaders([]);setColumns({});setReviewed(false);}}/></label><Button disabled={busy||!fileId||!connectionId} onClick={()=>void load(fileId)}>Read spreadsheet tabs</Button></details>
    {tabs.length>0&&<label className="field">Tab<select aria-label="Spreadsheet tab" className="input" value={tab} onChange={e=>{setTab(e.target.value);setHeaders([]);setColumns({});void load(fileId,e.target.value);}}><option value="">Choose a tab to inspect its header row</option>{tabs.map(t=><option key={t} value={t}>{t}</option>)}</select></label>}
   </>:<><label className="field">{kind==='mailbox'?'Mailbox identity':'Calendar ID'}<input className="input" aria-label="Selected account resource" value={resource} onChange={e=>{setResource(e.target.value);setReviewed(false);}}/></label><p className="help">Suggested from the signed-in account identity. Calendar ownership and mailbox access still require successful provider checks.</p></>}
  </>}
  {kind==='sheet'&&headers.length>0&&<>
   <p>{proposalFields.length-missing.length} of {proposalFields.length} required fields matched. {missing.length?'Choose the unmatched columns below.':'Review the suggested mapping before using this source.'}</p>
   <Button onClick={()=>setAllMappings(!allMappings)}>{allMappings?'Show only unresolved fields':'Review all suggested mappings'}</Button>
   {(allMappings?proposalFields:missing).map(field=><label className="field" key={field}>{field.replaceAll('_',' ')}<select aria-label={`Map ${field}`} className="input" value={columns[field]??''} onChange={e=>{setColumns(c=>({...c,[field]:e.target.value}));setReviewed(false);}}><option value="">Choose a source column</option>{headers.map((h,i)=><option key={`${h}-${i}`} value={h}>{h}</option>)}</select></label>)}
   <p className="help">Amounts must already be integer minor units; dates, statuses, stable IDs and source verification must pass import validation. Ambiguous headers stay unresolved. This reads row 1 only; reviewed binding permits validation of up to 500 data rows.</p>
  </>}
  <label className="field">Responsible source owner<input aria-label="Discovery source owner" className="input" value={owner} onChange={e=>{setOwner(e.target.value);setReviewed(false);}}/></label>
  <label className="check-row"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>I reviewed this resource, owner and mapping and authorize its bounded read check.</label>
  <Button disabled={busy||!reviewed||!owner.trim()||(!demo&&!connectionId)||(kind==='sheet'?(!tab||!fileId||!headers.length||missing.length>0):!resource)} onClick={()=>void save()}>Use this source and check access</Button>
  {message&&<p role="status" className="notice">{message}</p>}
 </fieldset></div>;
}
