"use client";
import { useEffect, useState, type FormEvent } from 'react';

export function WorkspaceEntry({mode}:{mode:'start'|'join'|'account'}){
 const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [token,setToken]=useState('');
 useEffect(()=>{
  if(mode==='start'&&sessionStorage.getItem('david.pendingInvitation')){window.location.replace('/join');return;}
  if(mode!=='join')return;
  const hash=new URLSearchParams(window.location.hash.slice(1));const candidate=hash.get('token');
  if(candidate&&/^[a-f0-9]{64}$/.test(candidate)){sessionStorage.setItem('david.pendingInvitation',candidate);window.history.replaceState({},'', '/join');}
  setToken(sessionStorage.getItem('david.pendingInvitation')??'');
 },[mode]);
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setMessage('');const data=new FormData(event.currentTarget);
  try{
   const body=mode==='join'?{type:'accept_invitation',token}:mode==='account'?{type:'update_password',password:data.get('password')}:{type:'create_workspace',name:data.get('name'),businessModel:data.get('businessModel'),timeZone:data.get('timeZone')};
   const response=await fetch('/api/onboarding/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(result.message??'Setup could not be completed.');
   if(result.workspaceId){if(mode==='join')sessionStorage.removeItem('david.pendingInvitation');window.location.assign(`/?view=activation&workspace=${encodeURIComponent(result.workspaceId)}`);}else setMessage(result.message);
  }catch(error){setMessage(error instanceof Error?error.message:'Setup could not complete.');}finally{setBusy(false);}
 }
 return <main className="login-page"><a href="/" aria-label="David Engine home"><span className="brand-wordmark" role="img" aria-label="David Engine"/></a><h1>{mode==='join'?'Join your workspace':mode==='account'?'Update your password':'Set up your company'}</h1><p>{mode==='join'?'Sign in using the email named on the invitation. Accepting adds you only to the invited workspace.':mode==='start'?'Start a private workspace. Account access, sources and operating decisions are configured in the next steps.':'Use at least 12 characters.'}</p><form onSubmit={submit} className="stack">
 {mode==='start'&&<><label className="field">Company name<input className="input" name="name" required maxLength={200}/></label><label className="field">Business model<select className="input" name="businessModel"><option value="b2b_services">B2B services</option><option value="home_services">Home services</option><option value="commerce">Commerce</option></select></label><label className="field">Time zone<input className="input" name="timeZone" required defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone}/></label></>}
 {mode==='account'&&<label className="field">New password<input className="input" name="password" type="password" autoComplete="new-password" required minLength={12}/></label>}
 <button className="btn btn-primary" disabled={busy||(mode==='join'&&!token)}>{busy?'Saving…':mode==='join'?'Accept invitation':mode==='account'?'Save password':'Create workspace'}</button>{message&&<p role="status">{message}</p>}</form><p><a href="/login">Sign in or create an account</a> · <a href="/">Open existing workspace</a></p>{mode==='join'&&!token&&<p role="alert">Open the complete invitation link supplied by your workspace owner.</p>}</main>;
}
