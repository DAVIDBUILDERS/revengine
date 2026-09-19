import { randomUUID } from 'node:crypto';
import { createModelAdapter, type UsageBudget } from '../../ai/src/index';
import type { ColdSequenceModelPort } from '../../domain/src/outbound-sdr';
import { preparationModelConfig } from './model-budget';

function commandBudget(): UsageBudget {
  return {
    async reserve() { return randomUUID(); },
    async settle() {},
    async fail() {},
  };
}

export function hostedColdSequenceModel(workspaceId: string, mode: string): ColdSequenceModelPort | undefined {
  if (mode === 'fixture') return undefined;
  try {
    const adapter = createModelAdapter(preparationModelConfig(process.env), commandBudget());
    return {
      draftColdSequence: facts => adapter.draftColdSequence({ workspaceId, runId: randomUUID(), facts }),
    };
  } catch {
    return undefined;
  }
}
