import { describe, expect, it } from 'vitest';
import { COLD_SEQUENCE_DEFAULT_MODEL_ID } from '../packages/ai/src/index';
import { coldSequenceModelConfig, hostedColdSequenceModel } from '../packages/orchestration/src/cold-sequence';

describe('hosted cold-sequence model', () => {
  it('does not invent a model in fixture mode', () => {
    expect(hostedColdSequenceModel('workspace', 'fixture', {})).toBeUndefined();
    expect(hostedColdSequenceModel('workspace', 'fixture', { VERCEL: '1' })).toBeUndefined();
  });

  it('uses the hosted gateway without requiring the four model env vars', () => {
    const config = coldSequenceModelConfig({});
    expect(config.usable).toBe(true);
    expect(config.modelId).toBe(COLD_SEQUENCE_DEFAULT_MODEL_ID);
    expect(config.maxCostMinor).toBe(25);
    expect(config.apiKey).toBeUndefined();
    expect(config.provider).toBeUndefined();
    expect(hostedColdSequenceModel('workspace', 'live', {})).toBeDefined();
  });

  it('keeps an explicit key, model, provider, and spend cap when they are set', () => {
    const config = coldSequenceModelConfig({
      AI_GATEWAY_API_KEY: 'SYNTHETIC_KEY',
      AI_MODEL_ID: 'anthropic/claude-sonnet-4',
      AI_ALLOWED_PROVIDER: 'anthropic',
      AI_MAX_JOB_COST_MINOR: '40',
    });
    expect(config).toMatchObject({
      usable: true,
      apiKey: 'SYNTHETIC_KEY',
      modelId: 'anthropic/claude-sonnet-4',
      provider: 'anthropic',
      maxCostMinor: 40,
    });
    expect(hostedColdSequenceModel('workspace', 'live', { AI_GATEWAY_API_KEY: 'SYNTHETIC_KEY' })).toBeDefined();
  });

  it('does not treat a zero spend cap as usable', () => {
    expect(coldSequenceModelConfig({ VERCEL: '1', AI_MAX_JOB_COST_MINOR: '0' }).usable).toBe(false);
    expect(hostedColdSequenceModel('workspace', 'live', { VERCEL: '1', AI_MAX_JOB_COST_MINOR: '0' })).toBeUndefined();
  });
});
