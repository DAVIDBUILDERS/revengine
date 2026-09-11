import { expect, it } from 'vitest';
import { contractExamples } from '../scripts/export-contract-examples';
import { Command, SourceEvent } from '../packages/contracts/src/index';

it('round-trips every documented contract example from a real fixture journey with strict schema versions', async () => {
  const examples = await contractExamples();
  expect(Object.keys(examples)).toHaveLength(20);
  const restored = JSON.parse(JSON.stringify(examples));
  expect(SourceEvent.parse(restored.SourceEvent)).toEqual(examples.SourceEvent);
  expect(restored.ActionReceipt.providerId).toMatch(/^FIXTURE_ONLY_/);
  expect(restored.ActionReceipt.status).toBe('provider_accepted');
  expect(restored.BriefSnapshot.metrics.find((metric: { key: string }) => metric.key === 'collected_revenue').value).toBeNull();
  expect(SourceEvent.safeParse({ ...restored.SourceEvent, schemaVersion: 2 }).success).toBe(false);
  expect(Command.safeParse({ type: 'approve', actionId: restored.ActionProposal.id, workspaceId: 'attacker-workspace' }).success).toBe(false);
});
