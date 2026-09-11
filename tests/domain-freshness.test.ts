import { describe, expect, it } from 'vitest';
import { createFixtureState, executeCommand, dispatchAction, type ActionProviderPort } from '../packages/domain/src/index';

describe('fresh checks immediately before submission',()=>{
  it('reloads a replaced source record after refresh and invalidates its old approval',async()=>{const state=createFixtureState();const proposal=state.proposals[0];await executeCommand(state,{type:'draft',proposalId:proposal.id});const action=state.actions[0];await executeCommand(state,{type:'approve',actionId:action.id});let calls=0;const port:ActionProviderPort={async refresh(){state.proposals=state.proposals.map(p=>p.id===proposal.id?{...p,version:2}:p);},async submit(){calls++;return {providerId:'SHOULD_NOT_SEND'};},async reconcile(){return {status:'unknown'};}};await expect(dispatchAction(state,action.id,port)).rejects.toThrow(/Fresh source version/);expect(calls).toBe(0);expect(state.approvals[0].status).toBe('invalidated');expect(state.budget.reservedMinor).toBe(0);});
  it('uses the bound calendar zone, end time, working days and buffers instead of the display zone',async()=>{const state=createFixtureState();const proposal=state.proposals[0];await executeCommand(state,{type:'reply',proposalId:proposal.id,eventId:'booking',text:"Let's meet."});
    await expect(executeCommand(state,{type:'book',proposalId:proposal.id,startAt:'2026-09-12T17:00:00.000Z',timeZone:'America/Denver'})).rejects.toThrow(/working hours/);
    await expect(executeCommand(state,{type:'book',proposalId:proposal.id,startAt:'2026-09-11T23:45:00.000Z',timeZone:'America/Los_Angeles'})).rejects.toThrow(/working hours/);
    state.appointmentBusy.push({calendarId:state.policy.calendarId,startAt:'2026-09-11T16:30:00.000Z',endAt:'2026-09-11T16:55:00.000Z'});
    await expect(executeCommand(state,{type:'book',proposalId:proposal.id,startAt:'2026-09-11T17:00:00.000Z',timeZone:'America/Denver'})).rejects.toThrow(/conflicting/);
    expect(state.actions).toHaveLength(0);
  });
});
