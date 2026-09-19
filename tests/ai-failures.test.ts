import { describe, expect, it, vi } from 'vitest';
vi.mock('ai', () => ({ generateText: vi.fn(), Output: { object: (input: unknown) => input } }));
import { generateText } from 'ai';
import { COLD_OUTREACH_PROMPT, COLD_SEQUENCE_SYSTEM, buildColdOutreachUserMessage, createModelAdapter, type UsageBudget } from '../packages/ai/src/index';

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
  it('drafts a cold sequence from the same outreach prompt every time', async () => {
    expect(COLD_SEQUENCE_SYSTEM).toBe(COLD_OUTREACH_PROMPT);
    expect(COLD_OUTREACH_PROMPT).toMatch(/Three touches capture almost all replies/i);
    expect(COLD_OUTREACH_PROMPT).toMatch(/Email 3 is a breakup/i);
    expect(COLD_OUTREACH_PROMPT).toMatch(/Do not invent proof/i);
    const facts = { topic: 'paid search audits', audience: 'teams like yours', companyName: 'DAVID AI', bookingUrl: 'https://calendly.com/example/30min', brandGuidance: '', forbiddenClaims: '' };
    expect(buildColdOutreachUserMessage(facts)).toMatch(/Service they provide \(what the emails are about\): paid search audits/);
    const { budget, adapter } = setup();
    vi.mocked(generateText).mockResolvedValueOnce({ output: { steps: [
      { subject: 'paid search audits', body: '{{firstName}} —\n\nMost audits die in a deck.\n\nhttps://calendly.com/example/30min' },
      { subject: 'who owns this?', body: '{{firstName}} —\n\nWho can say yes?\n\nhttps://calendly.com/example/30min' },
      { subject: 'closing this out', body: '{{firstName}} —\n\nLast note.\n\nhttps://calendly.com/example/30min' },
    ] }, usage: { inputTokens: 20, outputTokens: 40 } } as unknown as Awaited<ReturnType<typeof generateText>>);
    const steps = await adapter.draftColdSequence({
      workspaceId: 'fixture-workspace',
      runId: 'fixture-run',
      facts,
    });
    expect(steps).toHaveLength(3);
    const request = vi.mocked(generateText).mock.calls.at(-1)?.[0];
    expect(request?.system).toBe(COLD_OUTREACH_PROMPT);
    expect(request?.prompt).toBe(buildColdOutreachUserMessage(facts));
    expect(budget.settle).toHaveBeenCalled();
  });
});
