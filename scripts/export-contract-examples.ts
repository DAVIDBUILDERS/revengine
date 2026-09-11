import { mkdir, writeFile } from 'node:fs/promises';
import * as C from '../packages/contracts/src/index';
import { createFixtureState, executeCommand, snapshot, stableId } from '../packages/domain/src/index';

/** Reproducible synthetic examples; no providers, credentials, database or model calls. */
export async function contractExamples() {
  const state = createFixtureState('contract-examples');
  const proposal = state.proposals[0];
  await executeCommand(state, { type: 'draft', proposalId: proposal.id });
  await executeCommand(state, { type: 'approve', actionId: state.actions[0].id });
  await executeCommand(state, { type: 'dispatch', actionId: state.actions[0].id });
  await executeCommand(state, { type: 'reply', proposalId: proposal.id, eventId: 'contract-example-reply', text: "Yes, let's meet to discuss the proposal." });
  await executeCommand(state, { type: 'prepare', agentId: 'account-intelligence' });
  await executeCommand(state, { type: 'brief' });
  const current = snapshot(state);
  const sourceEvent = C.SourceEvent.parse({ schemaVersion: 1, id: stableId('contract-source-event'), workspaceId: state.workspace.id, connectionId: state.connections[0].id, sourceId: 'synthetic-proposals', providerEventId: 'FIXTURE_EVENT_contract_example', entityId: proposal.id, occurredAt: state.asOf, receivedAt: state.asOf, sourceVersion: '1', correlationId: stableId('contract-correlation'), evidenceId: proposal.evidence[0].id });
  return {
    WorkspaceContext: C.WorkspaceContext.parse(current.context),
    ConnectionCapability: C.ConnectionCapability.parse(current.connections[0]),
    ContactRecord: C.ContactRecord.parse(current.contacts[0]),
    OpportunityRecord: C.OpportunityRecord.parse(current.opportunities[0]),
    ProposalRecord: C.ProposalRecord.parse(current.proposals[0]),
    AgentDefinition: C.AgentDefinition.parse(current.catalog.find(agent => agent.id === 'deal-follow-up')),
    AgentInstallation: C.AgentInstallation.parse(current.installations[0]),
    SourceEvent: sourceEvent,
    ReadinessResult: C.ReadinessResult.parse(current.readiness),
    ActionProposal: C.ActionProposal.parse(current.actions[0]),
    Approval: C.Approval.parse(current.approvals[0]),
    ActionReceipt: C.ActionReceipt.parse(current.receipts.find(receipt => receipt.status === 'provider_accepted')),
    OutcomeObservation: C.OutcomeObservation.parse(current.outcomes[0]),
    BriefSnapshot: C.BriefSnapshot.parse(current.brief),
    TeamRecommendation: C.TeamRecommendation.parse(current.recommendation),
    ActivationPlan: C.ActivationPlan.parse(current.activation),
    WorkOpportunity: C.WorkOpportunity.parse(current.findings[0]),
    PreparedArtifact: C.PreparedArtifact.parse(current.artifacts[0]),
    ForecastScenario: C.ForecastScenario.parse(current.scenarios[0]),
    RuntimeHealth: C.RuntimeHealth.parse(current.health[0]),
  };
}

if (process.argv[1]?.endsWith('export-contract-examples.ts')) {
  const examples = await contractExamples();
  await mkdir('docs/examples', { recursive: true });
  await writeFile('docs/examples/contracts.v1.json', `${JSON.stringify(examples, null, 2)}\n`);
  console.log(`PASS ${Object.keys(examples).length} executable schema examples → docs/examples/contracts.v1.json`);
}
