import { describe, expect, it } from 'vitest';
import { ALWAYS_ON_AGENT_ID, WALLAROO_PAGES, WALLAROO_SELECTED_TEAM, companyConnectionCoverage, createFixtureState, hasConfiguredCompanySource, snapshot } from '@david/domain';

describe('Wallaroo Media walkthrough fixture', () => {
  it('keeps Brandon’s five plus the included website agent and does not invent live access', () => {
    const engine = createFixtureState('wallaroo');
    const state = snapshot(engine);
    expect(state.workspace.name).toMatch(/Wallaroo Media/);
    expect(engine.company.companyName).toBe('Wallaroo Media');
    expect(engine.company.offers).toEqual([
      'AI-Powered Ads',
      'AI-Powered Email and SMS',
      'AI-Powered SEO including LLM optimization (LLMO)',
    ]);
    expect(engine.company.locations).toEqual(['Provo, Utah']);
    expect(engine.company.pages.map(page => page.url)).toEqual(WALLAROO_PAGES.map(page => page.url));
    expect(engine.company.pages.every(page => page.url.startsWith('https://wallaroomedia.com'))).toBe(true);
    expect(state.activation.selectedTeam).toEqual([...WALLAROO_SELECTED_TEAM]);
    expect(state.installations.map(item => item.agentId)).toEqual([...WALLAROO_SELECTED_TEAM, ALWAYS_ON_AGENT_ID]);
    expect(state.installations).toHaveLength(6);
    expect(state.catalog).toHaveLength(32);
    expect(state.artifacts.map(item => item.agentId).sort()).toEqual(['technical-seo-monitor', ALWAYS_ON_AGENT_ID].sort());
    const seo = state.artifacts.find(item => item.agentId === 'technical-seo-monitor');
    expect(seo?.content).toContain('https://wallaroomedia.com/');
    expect(seo?.content).toContain('https://wallaroomedia.com/ai-powered-seo/');
    expect(seo?.limitation).toMatch(/Only captured pages/);
    const concierge = state.artifacts.find(item => item.agentId === ALWAYS_ON_AGENT_ID);
    expect(concierge?.content).toContain('AI-Powered Ads');
    expect(concierge?.limitation).toMatch(/no deployed chat/i);
    for (const id of ['linkedin-outreach-assistant', 'partner-development', 'outbound-email-sdr', 'rfp-opportunity-scout']) {
      const installation = state.installations.find(item => item.agentId === id)!;
      expect(installation.status).toBe('selected');
      expect(installation.blockers.join(' ')).toMatch(/engineering/i);
      expect(state.artifacts.some(item => item.agentId === id)).toBe(false);
    }
    expect(state.proposals).toHaveLength(0);
    expect(state.contacts).toHaveLength(0);
    expect(state.connections.every(item => item.health !== 'healthy')).toBe(true);
    expect(state.connections.every(item => item.operations.length === 0)).toBe(true);
    expect(hasConfiguredCompanySource(state, 'website')).toBe(false);
    expect(hasConfiguredCompanySource(state, 'social')).toBe(false);
    const coverage = companyConnectionCoverage(state);
    expect(coverage.systems.find(item => item.kind === 'website')?.status).toBe('demo_only');
    expect(coverage.systems.find(item => item.kind === 'social')?.status).toBe('engineering_required');
    expect(coverage.systems.find(item => item.kind === 'advertising')?.status).toBe('engineering_required');
    expect(coverage.agents.find(item => item.id === 'linkedin-outreach-assistant')).toMatchObject({ selected: true, engineeringRequired: true });
    expect(state.onboarding?.answers.systems.some(item => item.kind === 'social' && /LinkedIn/.test(item.tool))).toBe(true);
    expect(state.onboarding?.answers.systems.some(item => item.kind === 'mail' && /SMS is not a DAVID product/.test(item.mapping))).toBe(true);
  });

  it('leaves the DAVID and northstar fixtures on their original teams', () => {
    const david = createFixtureState();
    expect(david.workspace.name).toMatch(/DAVID AI/);
    expect(david.activation.selectedTeam).toEqual(['deal-follow-up', 'appointment-coordinator', 'account-intelligence', 'search-growth', 'technical-seo-monitor']);
    expect(createFixtureState('northstar').activation.selectedTeam).toEqual(david.activation.selectedTeam);
  });
});
