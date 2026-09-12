'use client';
import {useEffect,useRef,useState} from 'react';
import {OnboardingAnswers, type AppSnapshot} from '@david/contracts';
import {onboardingFor} from '@david/domain/onboarding';
import {briefingFor} from '@david/domain/briefing';
import type {ScreenProps} from '../app-shell';

/** One serialized writer. Failed and conflicting edits stay visible, never silently rebased. */
export function useBriefingSave({state,act}:ScreenProps){
 const initial=()=>({...structuredClone(onboardingFor(state).answers),briefing:briefingFor(state)});
 const [answers,setAnswers]=useState<OnboardingAnswers>(initial);
 const draft=useRef(answers),revision=useRef(onboardingFor(state).revision),saved=useRef(JSON.stringify(answers));
 const alive=useRef(true),inflight=useRef<Promise<boolean>|null>(null),latest=useRef(state);latest.current=state;
 const [status,setStatus]=useState<'saved'|'saving'|'unsaved'|'error'|'conflict'>('saved');
 const [error,setError]=useState('');
 const conflict=useRef(false);
 function update(change:(a:OnboardingAnswers)=>OnboardingAnswers){
  const next=change(structuredClone(draft.current));draft.current=next;setAnswers(next);setStatus(conflict.current?'conflict':JSON.stringify(next)===saved.current?'saved':'unsaved');setError('');
 }
 function adopt(snapshot:AppSnapshot){revision.current=onboardingFor(snapshot).revision;latest.current=snapshot;}
 async function flush():Promise<boolean>{
  if(inflight.current){if(!await inflight.current)return false;return flush();}
  if(conflict.current||!alive.current)return false;
  if(saved.current===JSON.stringify(draft.current)){setStatus('saved');return true;}
  const pending=(async()=>{
   setStatus('saving');setError('');
   const parsed=OnboardingAnswers.safeParse(draft.current);
   if(!parsed.success){setError(parsed.error.issues.map(i=>i.message).join(' '));setStatus('error');return false;}
   const sent=JSON.stringify(draft.current);
   const result=await act({type:'save_onboarding',expectedRevision:revision.current,answers:parsed.data});
   if(!alive.current)return false;
   if(!result){setStatus('error');setError('Your changes are still here. Retry saving. If another session changed setup, reload its saved answers first.');return false;}
   adopt(result.snapshot);saved.current=sent;setStatus(JSON.stringify(draft.current)===sent?'saved':'unsaved');return true;
  })();
  inflight.current=pending;
  try{return await pending;}finally{inflight.current=null;}
 }
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  if(!inflight.current&&onboardingFor(state).revision!==revision.current){conflict.current=true;setStatus('conflict');setError('Setup changed in another session. Your edits are retained below. Reload the saved version to continue.');}
 },[state]);
 useEffect(()=>{if(status!=='unsaved')return;const timer=setTimeout(()=>void flush(),650);return()=>clearTimeout(timer);},[answers,status]);
 useEffect(()=>{
  const guard=(e:BeforeUnloadEvent)=>{if(JSON.stringify(draft.current)!==saved.current){e.preventDefault();e.returnValue='';}};
  window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);
 },[]);
 function reload(){const next={...structuredClone(onboardingFor(latest.current).answers),briefing:briefingFor(latest.current)};revision.current=onboardingFor(latest.current).revision;draft.current=next;saved.current=JSON.stringify(next);conflict.current=false;setAnswers(next);setError('');setStatus('saved');}
 return {answers,draft,update,flush,status,error,reload,adopt,latest,alive};
}
