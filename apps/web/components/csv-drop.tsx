'use client';
import {useEffect,useRef,useState,type DragEvent} from 'react';
import {leadCsvFileError} from '@david/domain';

export function CsvDropInput({
  label,
  onText,
  onError,
}: {
  label: string;
  onText: (text: string) => void;
  onError: (message: string) => void;
}) {
  const [over,setOver]=useState(false);
  const [name,setName]=useState('');
  const depth=useRef(0);

  useEffect(()=>{
    const block=(event:globalThis.DragEvent)=>{event.preventDefault();};
    window.addEventListener('dragover',block);
    window.addEventListener('drop',block);
    return()=>{
      window.removeEventListener('dragover',block);
      window.removeEventListener('drop',block);
    };
  },[]);

  async function take(file: File | undefined) {
    if (!file) return;
    const issue=leadCsvFileError(file);
    if (issue) { onError(issue); return; }
    onError('');
    setName(file.name);
    onText(await file.text());
  }

  function enter(event: DragEvent<HTMLSpanElement>) {
    event.preventDefault();
    event.stopPropagation();
    depth.current+=1;
    setOver(true);
  }

  function leave(event: DragEvent<HTMLSpanElement>) {
    event.preventDefault();
    event.stopPropagation();
    depth.current=Math.max(0,depth.current-1);
    if (!depth.current) setOver(false);
  }

  function overZone(event: DragEvent<HTMLSpanElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect='copy';
  }

  function drop(event: DragEvent<HTMLSpanElement>) {
    event.preventDefault();
    event.stopPropagation();
    depth.current=0;
    setOver(false);
    void take(event.dataTransfer.files[0]);
  }

  return <label className={`field csv-drop ${over?'is-over':''} ${name?'has-file':''}`}>
    {label}
    <span className="csv-drop-target" role="group" aria-label={`${label} drop zone`} onDragEnter={enter} onDragOver={overZone} onDragLeave={leave} onDrop={drop}>
      <input aria-label={label} className="sr-only" type="file" accept=".csv,text/csv" onChange={event=>void take(event.target.files?.[0])}/>
      <span>{name || 'Drop a CSV here or choose a file'}</span>
    </span>
  </label>;
}
