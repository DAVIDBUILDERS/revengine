import {describe,it,expect} from 'vitest';
import {chooseBoundResource,inboundSince,validateCriticalSheet,type ApprovedSourceSnapshot} from './provider-evidence';
import type {MailMessage} from '../../connectors/src/index';
const source:ApprovedSourceSnapshot={proposal_id:'P-001',contact_email:'buyer@example.invalid',owner:'Avery',scope_summary:'Approved scope',version:1,valid_until:'2026-10-01T00:00:00Z',currency:'USD',amount_minor:150000,value_kind:'one_time',issued_at:'2026-09-01T00:00:00Z'};
const headers=['proposal_id','status','version','source_verified_at','email','owner','scope_summary','valid_until','currency','amount_minor','value_kind','issued_at'];
const row=['P-001','open','1','2026-09-10T00:00:00Z','buyer@example.invalid','Avery','Approved scope','2026-10-01T00:00:00Z','USD','150000','one_time','2026-09-01T00:00:00Z'];
function message(id:string,at:string|null,from:string,labels:string[]=[]):MailMessage{return{id,threadId:'thread',receivedAt:at,headers:{from},text:'reply',labels};}

describe('current provider evidence authorization',()=>{
 it('binds the approved Sheet ID rather than first connected file and rejects ambiguity',()=>{
  const bindings=[{resource_type:'sheet',resource_id:'unrelated',range_name:'A1:K100'},{resource_type:'sheet',resource_id:'approved',range_name:'Proposals!A1:K100'}];
  expect(chooseBoundResource(bindings,'sheet','approved')?.resource_id).toBe('approved');expect(()=>chooseBoundResource(bindings,'sheet')).toThrow('AMBIGUOUS');expect(()=>chooseBoundResource(bindings,'sheet','missing')).toThrow('MISSING');
 });
 it('finds a reply received before the draft and excludes original sent proposal/history before the proposal',()=>{
  const messages=[message('original','2026-09-01T01:00:00Z','Sender <sender@example.invalid>',['SENT']),message('reply-before-draft','2026-09-02T00:00:00Z','buyer@example.invalid'),message('old-history','2026-08-01T00:00:00Z','buyer@example.invalid'),message('sent-copy','2026-09-03T00:00:00Z','unexpected@example.invalid',['SENT'])];
  expect(inboundSince(messages,'sender@example.invalid',source.issued_at).map(m=>m.id)).toEqual(['reply-before-draft']);
 });
 it('a sender-spoofed From header cannot hide an incoming reply',()=>{expect(inboundSince([message('spoof','2026-09-02T00:00:00Z','sender@example.invalid',['INBOX'])],'sender@example.invalid',source.issued_at)).toHaveLength(1);});
 it('unknown inbound message timestamps block freshness instead of silently ignoring the message',()=>{expect(()=>inboundSince([message('unknown',null,'buyer@example.invalid')],'sender@example.invalid',source.issued_at)).toThrow('REPLY_TIME_UNVERIFIED');});
 it('validates every material source field against the immutable approved snapshot',()=>{expect(validateCriticalSheet([headers,row],{},source,'buyer@example.invalid')).toEqual({status:'open',verifiedAt:'2026-09-10T00:00:00.000Z'});});
 it.each([['email','other@example.invalid'],['owner','Someone else'],['scope_summary','Expanded commitment'],['valid_until','2026-12-01T00:00:00Z'],['currency','EUR'],['amount_minor','999999'],['value_kind','monthly_recurring'],['version','2'],['issued_at','2026-08-01T00:00:00Z']])('same-version critical %s change invalidates the original approval', (field,value)=>{
  const changed=[...row];changed[headers.indexOf(field)]=value;expect(()=>validateCriticalSheet([headers,changed],{},source,'buyer@example.invalid')).toThrow('SOURCE_MATERIAL_CHANGE');
 });
 it('a removed or duplicate critical field blocks mapping rather than choosing a different column',()=>{expect(()=>validateCriticalSheet([headers.filter(h=>h!=='owner'),row],{},source,'buyer@example.invalid')).toThrow('SOURCE_SCHEMA_DRIFT');expect(()=>validateCriticalSheet([[...headers,'email'],[...row,'attacker@example.invalid']],{},source,'buyer@example.invalid')).toThrow('SOURCE_SCHEMA_DRIFT');});
 it('duplicate source IDs and invented status names are explicit blockers',()=>{expect(()=>validateCriticalSheet([headers,row,row],{},source,'buyer@example.invalid')).toThrow('SOURCE_IDENTITY_CONFLICT');const changed=[...row];changed[1]='probably-open';expect(()=>validateCriticalSheet([headers,changed],{},source,'buyer@example.invalid')).toThrow('SOURCE_REVIEW_REQUIRED');});
 it('closed source state is returned for deterministic cancellation, not silently remapped',()=>{const changed=[...row];changed[1]='accepted';expect(validateCriticalSheet([headers,changed],{},source,'buyer@example.invalid').status).toBe('accepted');});
});
