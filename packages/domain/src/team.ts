import type {AppSnapshot} from '../../contracts/src/index';
import {ALWAYS_ON_AGENT_ID, TEAM_SWAP_COOLDOWN_HOURS, canonicalAgentId, catalog, nextAgentIds} from '../../agents/src/index';

export {ALWAYS_ON_AGENT_ID, TEAM_SWAP_COOLDOWN_HOURS, EXTRA_AGENT_PRICE_MINOR, nextAgentIds} from '../../agents/src/index';

/** Slot specialists the customer pays for. The included website agent is never a slot. */
export function slotAgentIds(ids:string[]):string[] {
 const seen=new Set<string>();
 const selected:string[]=[];
 for(const id of ids.map(canonicalAgentId)){
  if(id===ALWAYS_ON_AGENT_ID||seen.has(id))continue;
  seen.add(id);selected.push(id);
 }
 return selected;
}

export function includedAgentIds():string[] {return [ALWAYS_ON_AGENT_ID];}

export function workbenchAgentIds(slotIds:string[]):string[] {
 return [...includedAgentIds(),...slotAgentIds(slotIds)];
}

export function isIncludedAgent(agentId:string):boolean {
 return canonicalAgentId(agentId)===ALWAYS_ON_AGENT_ID;
}

/** First paid specialist to set up after the lineup is saved. Instantly-backed outbound goes first. */
export function firstSetupAgentId(ids:string[]):string|undefined {
 const paid=slotAgentIds(ids);
 if(paid.includes('outbound-email-sdr'))return 'outbound-email-sdr';
 return paid[0];
}

/** Live removals settle for 12 hours. Draft on/off stays available; operators can apply sooner. */
export function teamSwapReadyAt(state:Pick<AppSnapshot,'activation'|'asOf'|'context'>):string|null {
 if(state.context.role==='david_operator')return null;
 const at=state.activation.teamSelectedAt;
 if(!at)return null;
 const ready=Date.parse(at)+TEAM_SWAP_COOLDOWN_HOURS*3600000;
 return ready>Date.parse(state.asOf)?new Date(ready).toISOString():null;
}

export function nextThreeFor(state:Pick<AppSnapshot,'recommendation'|'workspace'>,selected:string[]):ReturnType<typeof catalog.find>[] {
 return nextAgentIds(state.recommendation.goal,state.workspace.businessModel,selected,3).map(id=>catalog.find(agent=>agent.id===id)!);
}
