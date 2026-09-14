"use client";
import { useEffect, useRef, useState, type FormEvent } from 'react';

export function WorkspaceEntry({mode}:{mode:'start'|'join'|'account'}){
 const lock=useRef(false);const [stage,setStage]=useState<'name'|'model'>('name');const [companyName,setCompanyName]=useState('');
 const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [token,setToken]=useState('');
 useEffect(()=>{
  if(mode==='start'&&sessionStorage.getItem('david.pendingInvitation')){window.location.replace('/join');return;}
  if(mode!=='join')return;
  const hash=new URLSearchParams(window.location.hash.slice(1));const candidate=hash.get('token');
  if(candidate&&/^[a-f0-9]{64}$/.test(candidate)){sessionStorage.setItem('david.pendingInvitation',candidate);window.history.replaceState({},'', '/join');}
  setToken(sessionStorage.getItem('david.pendingInvitation')??'');
 },[mode]);
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(lock.current)return;if(mode==='start'&&stage==='name'){setStage('model');return;}lock.current=true;setBusy(true);setMessage('');const data=new FormData(event.currentTarget);
  try{
   const body=mode==='join'?{type:'accept_invitation',token}:mode==='account'?{type:'update_password',password:data.get('password')}:{type:'create_workspace',requestId:(()=>{const key=sessionStorage.getItem('david.workspaceCreation')??crypto.randomUUID();sessionStorage.setItem('david.workspaceCreation',key);return key;})(),name:companyName,businessModel:data.get('businessModel'),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone};
   const response=await fetch('/api/onboarding/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(result.message??'Setup could not be completed.');
   if(result.workspaceId){sessionStorage.removeItem('david.workspaceCreation');if(mode==='join')sessionStorage.removeItem('david.pendingInvitation');window.location.assign(`/?view=${mode==='start'?'connections':'team'}&workspace=${encodeURIComponent(result.workspaceId)}`);}else setMessage(result.message);
  }catch(error){setMessage(error instanceof Error?error.message:'Setup could not complete.');}finally{lock.current=false;setBusy(false);}
 }
 return <main className="login-page"><a href="/" aria-label="David Engine home"><span className="brand-wordmark" role="img" aria-label="David Engine"/></a><h1>{mode==='join'?'Join your workspace':mode==='account'?'Update your password':stage==='name'?'What’s your company called?':'How does your business operate?'}</h1><p>{mode==='join'?'Sign in using the email named on the invitation. Accepting adds you only to the invited workspace.':mode==='start'?'Start a private workspace. Account access, sources and operating decisions are configured in the next steps.':'Use at least 12 characters.'}</p><form onSubmit={submit} className="stack">
 {mode==='start'&&(stage==='name'?<label className="field">Company name<input className="input" name="name" required maxLength={200} value={companyName} onChange={e=>setCompanyName(e.target.value)}/></label>:<><p>{companyName}</p><label className="field">Business model<select className="input" name="businessModel"><option value="b2b_services">B2B services</option><option value="home_services">Home services</option><option value="commerce">Commerce</option></select></label><p className="help">Your local time zone is {Intl.DateTimeFormat().resolvedOptions().timeZone}. You can edit it later.</p><button className="btn" type="button" onClick={()=>setStage('name')}>Back</button></>)}
 {mode==='account'&&<label className="field">New password<input className="input" name="password" type="password" autoComplete="new-password" required minLength={12}/></label>}
 <button className="btn btn-primary" disabled={busy||(mode==='join'&&!token)}>{busy?'Saving…':mode==='join'?'Accept invitation':mode==='account'?'Save password':stage==='name'?'Continue':'Create workspace'}</button>{message&&<p role="status">{message}</p>}</form><p><a href="/login">Sign in or create an account</a> · <a href="/">Open existing workspace</a></p>{mode==='join'&&!token&&<p role="alert">Open the complete invitation link supplied by your workspace owner.</p>}</main>;
}
