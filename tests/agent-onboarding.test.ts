import { describe, it, expect } from 'vitest';
import { catalog } from '@david/domain';
import { AgentOnboardingRecord } from '@david/contracts';
import { createFixtureState, executeCommand, snapshot, onboardingReport, onboardingFor, requiredToolsFor, agentSystemRequirements } from '@david/domain';

describe('per-agent onboarding', () => {
  it('defines required tools for every catalog specialist', () => {
    expect(catalog.map(agent => agent.id).sort()).toEqual(Object.keys(agentSystemRequirements).sort());
    for (const agent of catalog) {
      const tools = requiredToolsFor(agent.id);
      expect(tools.tools).toEqual(agent.toolNames);
      expect(tools.capabilities).toEqual(agent.requiredCapabilities);
      expect(tools.systems).toEqual(agentSystemRequirements[agent.id]);
      expect(tools.prerequisites).toEqual(agent.prerequisites);
    }
    expect(requiredToolsFor('outbound-email-sdr').tools).toEqual(['instantly.campaign', 'instantly.leads', 'instantly.webhooks']);
    expect(requiredToolsFor('technical-seo-monitor').tools).toEqual(['dataforseo.crawl', 'dataforseo.serp', 'dataforseo.ranked_keywords', 'save_artifact']);
    expect(requiredToolsFor('deal-follow-up').tools).toEqual(['read_bound_source', 'propose_checked_action']);
    expect(requiredToolsFor('account-intelligence').tools).toEqual(['read_approved_snapshot', 'save_artifact']);
  });

  it('stores an onboarding envelope per specialist per client without copying company setup', async () => {
    const state = createFixtureState();
    const records = snapshot(state).agentOnboarding ?? [];
    expect(records).toHaveLength(33);
    expect(new Set(records.map(record => record.agentId)).size).toBe(33);
    expect(records.every(record => record.workspaceId === state.workspace.id && record.status === 'not_started')).toBe(true);
    expect(AgentOnboardingRecord.parse(records.find(record => record.agentId === 'outbound-email-sdr')!).requiredTools.prerequisites).toContain('customer_lead_list');
    const other = snapshot(createFixtureState('northstar')).agentOnboarding ?? [];
    expect(other[0].workspaceId).not.toBe(state.workspace.id);
    expect(onboardingReport(state).agents.find(agent => agent.id === 'account-intelligence')?.storedStatus).toBe('not_started');
  });

  it('saves this agent’s answers and leaves other specialists and company connections unchanged', async () => {
    const state = createFixtureState();
    const before = structuredClone(state.connections);
    await executeCommand(state, { type: 'save_agent_onboarding', agentId: 'outbound-email-sdr', expectedRevision: 0, answers: { bookingUrl: 'https://calendly.com/example' } });
    const current = snapshot(state).agentOnboarding ?? [];
    const sdr = current.find(record => record.agentId === 'outbound-email-sdr')!;
    const intelligence = current.find(record => record.agentId === 'account-intelligence')!;
    expect(sdr.status).toBe('in_progress');
    expect(sdr.revision).toBe(1);
    expect(sdr.answers).toEqual({ bookingUrl: 'https://calendly.com/example' });
    expect(intelligence.status).toBe('not_started');
    expect(intelligence.revision).toBe(0);
    expect(state.connections).toEqual(before);
    await expect(executeCommand(state, { type: 'save_agent_onboarding', agentId: 'outbound-email-sdr', expectedRevision: 0, answers: { bookingUrl: 'https://calendly.com/stale' } })).rejects.toThrow(/another session/);
    await expect(executeCommand(state, { type: 'save_agent_onboarding', agentId: 'outbound-email-sdr', expectedRevision: 1, answers: { bookingUrl: 'https://calendly.com/example' } }, { ...state.context, role: 'workspace_viewer' })).rejects.toThrow();
  });

  it('does not treat company briefing as agent onboarding', async () => {
    const state = createFixtureState();
    const answers = structuredClone(state.onboarding!.answers);
    Object.assign(answers.company, { website: 'https://example.invalid', offers: ['Advisory'], customers: ['Owners'], priorities: ['Replies'], successDefinition: 'Verified replies' });
    answers.team = ['account-intelligence'];
    await executeCommand(state, { type: 'save_onboarding', expectedRevision: 0, answers });
    expect(onboardingFor(state).answers.team).toEqual(['account-intelligence']);
    expect(snapshot(state).agentOnboarding?.find(record => record.agentId === 'account-intelligence')?.status).toBe('not_started');
    expect(onboardingReport(state).agents.find(agent => agent.id === 'account-intelligence')?.storedStatus).toBe('not_started');
  });
});
