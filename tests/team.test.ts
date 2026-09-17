import {describe,expect,it} from 'vitest';
import {createFixtureState,executeCommand,snapshot,ALWAYS_ON_AGENT_ID,EXTRA_AGENT_PRICE_MINOR,firstSetupAgentId,nextAgentIds,slotAgentIds,teamSwapReadyAt} from '../packages/domain/src/index';

describe('included website specialist, extra seats and team settle',()=>{
 it('keeps Website Sales Concierge installed outside the paid slots',async()=>{
  const state=createFixtureState();
  expect(state.installations.some(item=>item.agentId===ALWAYS_ON_AGENT_ID)).toBe(true);
  expect(state.activation.selectedTeam).not.toContain(ALWAYS_ON_AGENT_ID);
  expect(state.artifacts.some(item=>item.agentId==='account-intelligence')).toBe(true);
  expect(state.artifacts.some(item=>item.agentId===ALWAYS_ON_AGENT_ID)).toBe(true);
  await executeCommand(state,{type:'select_team',agentIds:['account-intelligence']});
  expect(state.activation.selectedTeam).toEqual(['account-intelligence']);
  expect(state.installations.map(item=>item.agentId).sort()).toEqual(['account-intelligence',ALWAYS_ON_AGENT_ID]);
  await executeCommand(state,{type:'pause',paused:false});
  await executeCommand(state,{type:'prepare',agentId:ALWAYS_ON_AGENT_ID});
  expect(state.artifacts.filter(item=>item.agentId===ALWAYS_ON_AGENT_ID).length).toBeGreaterThan(1);
 });
 it('does not spend a slot on the included specialist',()=>{
  expect(slotAgentIds(['account-intelligence',ALWAYS_ON_AGENT_ID,'search-growth'])).toEqual(['account-intelligence','search-growth']);
  expect(EXTRA_AGENT_PRICE_MINOR).toBe(100_000);
  expect(nextAgentIds('Recover proposals','b2b_services',['deal-follow-up','appointment-coordinator','account-intelligence','search-growth','technical-seo-monitor'],3)).toHaveLength(3);
  expect(nextAgentIds('Recover proposals','b2b_services',['deal-follow-up','appointment-coordinator','account-intelligence','search-growth','technical-seo-monitor'],3)).not.toContain(ALWAYS_ON_AGENT_ID);
  expect(firstSetupAgentId(['account-intelligence','outbound-email-sdr','search-growth'])).toBe('outbound-email-sdr');
  expect(firstSetupAgentId(['deal-follow-up','appointment-coordinator'])).toBe('deal-follow-up');
  expect(firstSetupAgentId([ALWAYS_ON_AGENT_ID])).toBeUndefined();
 });
 it('settles live removals for 12 hours unless an operator applies the change',async()=>{
  const state=createFixtureState();
  await executeCommand(state,{type:'select_team',agentIds:['account-intelligence','search-growth']});
  expect(teamSwapReadyAt(snapshot(state))).toBeTruthy();
  await expect(executeCommand(state,{type:'select_team',agentIds:['account-intelligence']})).rejects.toThrow(/12 hours/);
  await executeCommand(state,{type:'select_team',agentIds:['account-intelligence','search-growth','technical-seo-monitor']});
  expect(state.activation.selectedTeam).toEqual(['account-intelligence','search-growth','technical-seo-monitor']);
  state.context.role='david_operator';state.context.assurance='aal1';
  await executeCommand(state,{type:'select_team',agentIds:['account-intelligence']});
  expect(state.activation.selectedTeam).toEqual(['account-intelligence']);
 });
});
