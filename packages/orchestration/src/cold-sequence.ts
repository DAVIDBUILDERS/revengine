import { randomUUID } from 'node:crypto';
import {
  COLD_SEQUENCE_DEFAULT_COST_MINOR,
  COLD_SEQUENCE_DEFAULT_MODEL_ID,
  createColdOutreachAdapter,
  usableGatewayKey,
  type UsageBudget,
} from '../../ai/src/index';
import type { ColdSequenceModelPort } from '../../domain/src/outbound-sdr';

function commandBudget(): UsageBudget {
  return {
    async reserve() { return randomUUID(); },
    async settle() {},
    async fail() {},
  };
}

export function coldSequenceModelConfig(env: Record<string, string | undefined>) {
  const apiKey = usableGatewayKey(env.AI_GATEWAY_API_KEY);
  const modelId = env.AI_MODEL_ID?.trim() || COLD_SEQUENCE_DEFAULT_MODEL_ID;
  const maxCostMinor = env.AI_MAX_JOB_COST_MINOR === undefined ? COLD_SEQUENCE_DEFAULT_COST_MINOR : Number(env.AI_MAX_JOB_COST_MINOR);
  const usable = Boolean(modelId && Number.isSafeInteger(maxCostMinor) && maxCostMinor >= 1 && maxCostMinor <= 100000);
  return { apiKey, modelId, maxCostMinor, usable };
}

export function hostedColdSequenceModel(workspaceId: string, mode: string, env: Record<string, string | undefined> = process.env): ColdSequenceModelPort | undefined {
  if (mode === 'fixture') return undefined;
  const config = coldSequenceModelConfig(env);
  if (!config.usable) return undefined;
  void env.VERCEL_OIDC_TOKEN;
  void env.AI_GATEWAY_API_KEY;
  const adapter = createColdOutreachAdapter({
    apiKey: config.apiKey,
    modelId: config.modelId,
    maxCostMinor: config.maxCostMinor,
    maxOutputTokens: 1200,
  }, commandBudget());
  return {
    draftColdSequence: facts => adapter.draftColdSequence({ workspaceId, runId: randomUUID(), facts }),
  };
}
