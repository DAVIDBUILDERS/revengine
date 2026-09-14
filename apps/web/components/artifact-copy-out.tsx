"use client";
import {useState} from 'react';
import {Copy,Download} from 'lucide-react';
import type {PreparedArtifact} from '@david/contracts';
import {artifactCopyText,type AgentDelivery} from '@david/domain/delivery';
import {Button} from './ui';

function slug(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'work-product';}

export function ArtifactCopyOut({artifact,delivery}:{artifact:PreparedArtifact;delivery:AgentDelivery}){
 const [copied,setCopied]=useState(false);
 const text=artifactCopyText(artifact);
 async function copy(){
  try{await navigator.clipboard.writeText(text);}
  catch{
   const area=document.createElement('textarea');
   area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.left='-9999px';
   document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();
  }
  setCopied(true);window.setTimeout(()=>setCopied(false),2000);
 }
 function download(){
  const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=`${slug(artifact.title)}.md`;
  document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
 }
 return <div className="artifact-copy-out">
  <p>{delivery.detail}</p>
  <div className="artifact-copy-actions">
   <Button className="btn-small" onClick={()=>void copy()}><Copy size={14}/>{copied?'Copied':'Copy'}</Button>
   <Button className="btn-small" onClick={download}><Download size={14}/>Download</Button>
   {copied&&<span role="status">Copied to clipboard</span>}
  </div>
 </div>;
}
