import { describe, expect, it, vi } from 'vitest';
vi.mock('ai', () => ({ generateText: vi.fn(), Output: { object: (input: unknown) => input } }));
import { generateText } from 'ai';
import { createModelAdapter, type UsageBudget } from '../packages/ai/src/index';

function setup() {
  const budget: UsageBudget = { reserve: vi.fn(async () => 'synthetic-reservation'), settle: vi.fn(async () => {}), fail: vi.fn(async () => {}) };
  const adapter = createModelAdapter({ apiKey: 'SYNTHETIC_KEY_NO_NETWORK', modelId: 'openai/synthetic-test-model', provider: 'openai', maxCostMinor: 5 }, budget);
  return { budget, adapter };
}
describe('model failure/resource handling using mocked inference only', () => {
  it('a real adapter preparation selection returns only supplied facts and records unknown actual cost', async () => {
    const { budget, adapter } = setup();
    vi.mocked(generateText).mockResolvedValueOnce({ output: { framing: 'offer_clarity', factIds: ['offer-0'] }, usage: { inputTokens: 40, outputTokens: 12 } } as unknown as Awaited<ReturnType<typeof generateText>>);
    const result=await adapter.prepare({workspaceId:'fixture-workspace',runId:'fixture-run',agentId:'search-growth',facts:[{id:'offer-0',text:'Approved offer: reviewed business workflow',sourceId:'confirmed-source',confirmed:true}]});
    expect(result).toEqual({wording:'Clarify the approved offer\nApproved offer: reviewed business workflow',sourceIds:['confirmed-source']});
    expect(budget.settle).toHaveBeenCalledWith('synthetic-reservation',{inputTokens:40,outputTokens:12,model:'openai/synthetic-test-model',costMinor:null});
  });
  it('an unavailable configured model preserves a failed reservation and never silently changes provider', async () => {
    const { budget, adapter } = setup();
    vi.mocked(generateText).mockRejectedValueOnce(new Error('synthetic unavailable model'));
    await expect(adapter.draft({ workspaceId: 'fixture-workspace', runId: 'fixture-run', facts: [{ id: 'scope', text: 'Approved scope', sourceId: 'proposal-v1', confirmed: true }] })).rejects.toThrow('MODEL_JOB_BLOCKED');
    expect(budget.reserve).toHaveBeenCalledOnce(); expect(budget.fail).toHaveBeenCalledWith('synthetic-reservation', 'generation_or_validation_failed'); expect(budget.settle).not.toHaveBeenCalled();
    const request = vi.mocked(generateText).mock.calls.at(-1)?.[0];
    expect(request?.providerOptions).toEqual({ gateway: { only: ['openai'], order: ['openai'] } });
  });
  it('rejects oversized model input before spending or inference', async () => {
    const { budget, adapter } = setup(); const calls = vi.mocked(generateText).mock.calls.length;
    await expect(adapter.interpretReply({ workspaceId: 'fixture-workspace', runId: 'fixture-run', text: 'x'.repeat(20001) })).rejects.toThrow('MODEL_INPUT_LIMIT');
    expect(budget.reserve).not.toHaveBeenCalled(); expect(vi.mocked(generateText).mock.calls).toHaveLength(calls);
  });
  it('malformed model output cannot become an approved draft and records the failed job', async () => {
    const { budget, adapter } = setup();
    vi.mocked(generateText).mockResolvedValueOnce({ output: { opening: 'invent_discount', factIds: ['scope'], closing: 'questions' }, usage: { inputTokens: 10, outputTokens: 10 } } as unknown as Awaited<ReturnType<typeof generateText>>);
    await expect(adapter.draft({ workspaceId: 'fixture-workspace', runId: 'fixture-run', facts: [{ id: 'scope', text: 'Approved scope', sourceId: 'proposal-v1', confirmed: true }] })).rejects.toThrow('MODEL_JOB_BLOCKED');
    expect(budget.fail).toHaveBeenCalled(); expect(budget.settle).not.toHaveBeenCalled();
  });
});
