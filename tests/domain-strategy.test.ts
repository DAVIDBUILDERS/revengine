import { expect, it } from 'vitest';
import { createFixtureState, executeCommand, snapshot } from '../packages/domain/src/index';

it('creates grounded next-action, delayed-response and capacity findings without manufacturing outcomes',async()=>{
  const state=createFixtureState();const proposal=state.proposals[0];await executeCommand(state,{type:'reply',proposalId:proposal.id,eventId:'strategy-positive',text:"Let's schedule a meeting."});state.policy.calendarCapacity=0;state.asOf='2026-09-10T21:00:00.000Z';const current=snapshot(state);expect(current.findings.some(f=>f.evaluationRule.includes('missing_next_action'))).toBe(true);expect(current.findings.some(f=>f.evaluationRule.includes('delayed_response'))).toBe(true);expect(current.findings.some(f=>f.evaluationRule.includes('meeting_capacity'))).toBe(true);expect(current.outcomes.filter(o=>o.stage==='booked')).toHaveLength(0);const finding=current.findings.find(f=>f.evaluationRule.includes('meeting_capacity'))!;expect(finding.affectedIds).toContain(proposal.id);expect(finding.costMinor).toBeNull();expect(finding.evidence.length).toBeGreaterThan(0);
});

it('retires obsolete proposed findings after a reply and confirmed booking while retaining their original evidence',async()=>{
  const state=createFixtureState();const proposal=state.proposals[0];const original=state.findings.find(f=>f.evaluationRule.includes('/neglected:'))!;
  await executeCommand(state,{type:'reply',proposalId:proposal.id,eventId:'retire-finding',text:"Let's meet."});
  expect(original.status).toBe('reviewed');expect(original.evidence.length).toBeGreaterThan(0);
  const handoff=state.findings.find(f=>f.evaluationRule.includes('/missing_next_action:'))!;
  await executeCommand(state,{type:'book',proposalId:proposal.id,startAt:'2026-09-11T17:00:00.000Z',timeZone:'America/Denver'});
  await executeCommand(state,{type:'approve',actionId:state.actions[0].id});await executeCommand(state,{type:'dispatch',actionId:state.actions[0].id});
  expect(handoff.status).toBe('reviewed');expect(snapshot(state).findings.filter(f=>f.status==='proposed').some(f=>f.title==='Review a positive-reply appointment handoff')).toBe(false);
  expect(state.audit.some(entry=>entry.event==='finding.condition_resolved')).toBe(true);
});
