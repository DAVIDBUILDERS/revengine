'use client';
import {useEffect,useRef,type ReactNode} from 'react';
export function Question({id,title,description,children,onContinue,disabled,label='Continue'}:{id:string;title:string;description?:string;children?:ReactNode;onContinue?:()=>void;disabled?:boolean;label?:string}){
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{heading.current?.focus();document.title=`${title} · DAVID Engine`;window.scrollTo(0,0);},[id,title]);
 useEffect(()=>{
  const enter=(event:KeyboardEvent)=>{
   const target=event.target;
   if(event.key!=='Enter'||event.repeat||event.isComposing||disabled||!onContinue||heading.current?.closest('fieldset')?.disabled)return;
   if(target instanceof HTMLElement&&(target.isContentEditable||target.closest('textarea,button,a,summary,select')))return;
   event.preventDefault();onContinue();
  };
  window.addEventListener('keydown',enter);return()=>window.removeEventListener('keydown',enter);
 },[onContinue,disabled]);
 return <section className="briefing-question" aria-labelledby="briefing-question-title" key={id}>
  <h1 id="briefing-question-title" ref={heading} tabIndex={-1}>{title}</h1>
  {description&&<p className="briefing-description">{description}</p>}
  <form onSubmit={e=>{e.preventDefault();if(!disabled)onContinue?.();}} onKeyDown={e=>{if(e.key==='Enter'&&e.target instanceof HTMLTextAreaElement)e.stopPropagation();}} className="stack">
   {children}
   {onContinue&&<div className="briefing-continue"><button type="submit" className="btn btn-primary" disabled={disabled}>{label}<span aria-hidden="true"> →</span></button><span className="help">Enter to continue</span></div>}
  </form>
 </section>;
}
export function Answer({label,value,onChange,multiline=false,type='text',maxLength=4000}:{label:string;value:string;onChange:(value:string)=>void;multiline?:boolean;type?:string;maxLength?:number}){
 return <label className="field">{label}{multiline?<textarea aria-label={label} className="input briefing-input" rows={3} value={value} onChange={e=>onChange(e.target.value)} maxLength={maxLength}/>:<input aria-label={label} className="input briefing-input" type={type} value={value} onChange={e=>onChange(e.target.value)} maxLength={maxLength}/>}</label>;
}
