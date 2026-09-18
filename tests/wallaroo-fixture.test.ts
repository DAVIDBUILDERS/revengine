import { describe, expect, it } from 'vitest';
import { ActionProposal, ConnectionCapability, ForecastScenario, PreparedArtifact, WorkOpportunity } from '@david/contracts';
import { ALWAYS_ON_AGENT_ID, WALLAROO_PAGES, WALLAROO_SELECTED_TEAM, companyConnectionCoverage, conversationPulse, conversationThread, createFixtureState, hasConfiguredCompanySource, snapshot } from '@david/domain';

describe('Wallaroo Media walkthrough fixture', () => {
  it('keeps Brandon’s five plus the included website agent and seeds playable fixture work', () => {
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
    expect(state.installations.every(item => item.status === 'monitoring' && item.blockers.length === 0)).toBe(true);
    for (const id of [...WALLAROO_SELECTED_TEAM, ALWAYS_ON_AGENT_ID]) {
      expect(state.artifacts.some(item => item.agentId === id), id).toBe(true);
    }
    const seo = state.artifacts.find(item => item.agentId === 'technical-seo-monitor' && item.title === 'Captured-page technical check');
    expect(seo?.content).toContain('https://wallaroomedia.com/');
    expect(seo?.content).toContain('https://wallaroomedia.com/ai-powered-seo/');
    expect(seo?.limitation).toMatch(/not a CMS write|not Search Console|Fixture/i);
    expect(engine.technicalSeo?.fixture).toBe(true);
    expect(engine.technicalSeo?.crawlTaskId).toMatch(/^FIXTURE_ONLY_dataforseo_/);
    expect(engine.technicalSeo?.pages.length).toBeGreaterThan(0);
    const concierge = state.artifacts.find(item => item.agentId === ALWAYS_ON_AGENT_ID && item.title === 'FAQ and qualification draft');
    expect(concierge?.content).toContain('AI-Powered Ads');
    expect(concierge?.limitation).toMatch(/no deployed chat/i);
    expect(state.artifacts.find(item => item.agentId === 'linkedin-outreach-assistant')?.content).toMatch(/Called to Surf/);
    expect(state.contacts.map(item => item.account)).toEqual(['Called to Surf', 'Kaja Beauty', 'MaxPro', 'Bullstrap', 'Stately', 'Jantzen']);
    expect(state.proposals).toHaveLength(6);
    expect(state.proposals.every(item => item.fixture && item.status !== 'unknown')).toBe(true);
    expect(state.contacts.every(item => item.enrolled)).toBe(true);
    expect(state.findings.filter(item => item.status === 'approved' && item.evaluationRule.startsWith('fixture.v1/'))).toHaveLength(6);
    expect(state.initiatives).toHaveLength(6);
    expect(state.initiatives.every(item => item.status === 'supported')).toBe(true);
    expect(state.findings.some(item => item.evaluationRule.startsWith('strategy.v1/'))).toBe(false);
    expect(state.approvals.every(item => item.status === 'approved')).toBe(true);
    expect(state.actions.every(item => item.status === 'confirmed')).toBe(true);
    expect(state.installations.find(item => item.agentId === 'outbound-email-sdr')?.lastBusinessActionAt).toBe('2026-09-10T14:05:00.000Z');
    expect(state.installations.find(item => item.agentId === 'linkedin-outreach-assistant')?.lastBusinessActionAt).toBeTruthy();
    expect(new Set(state.installations.map(item => item.lastPreparationAt)).size).toBeGreaterThan(3);
    expect(state.metrics.find(item => item.key === 'human_replies')?.value).toBe(5);
    expect(state.metrics.find(item => item.key === 'verified_bookings')?.value).toBe(4);
    expect(state.metrics.find(item => item.key === 'attended_meetings')?.value).toBe(2);
    expect(state.metrics.find(item => item.key === 'signed_value')?.value).toBe(1500000);
    expect(state.connections.map(item => item.identity)).toEqual(expect.arrayContaining([
      'wallaroomedia.com',
      'Wallaroo Media · LinkedIn',
      'Wallaroo Media · Meta',
      'Wallaroo Media · Google Ads',
      'Wallaroo Media · Klaviyo',
      'Shopify Plus Partner',
      'Wallaroo Media · GA4',
    ]));
    expect(state.connections.every(item => item.health !== 'healthy')).toBe(true);
    expect(state.connections.some(item => item.provider === 'fixture' && item.health === 'fixture')).toBe(true);
    expect(hasConfiguredCompanySource(state, 'website')).toBe(false);
    expect(hasConfiguredCompanySource(state, 'social')).toBe(false);
    const coverage = companyConnectionCoverage(state);
    expect(coverage.systems.find(item => item.kind === 'website')?.status).toBe('demo_only');
    expect(coverage.systems.find(item => item.kind === 'social')?.status).toBe('engineering_required');
    expect(coverage.systems.find(item => item.kind === 'advertising')?.status).toBe('engineering_required');
    expect(coverage.agents.find(item => item.id === 'linkedin-outreach-assistant')).toMatchObject({ selected: true, engineeringRequired: true });
    expect(state.onboarding?.answers.systems.some(item => item.kind === 'social' && /LinkedIn/.test(item.tool))).toBe(true);
    expect(state.onboarding?.answers.systems.some(item => item.kind === 'mail' && /SMS is not a DAVID product/.test(item.mapping))).toBe(true);
    expect(state.artifacts.find(item => item.agentId === 'outbound-email-sdr' && item.title.startsWith('Called to Surf'))?.content).toMatch(/Book 30 minutes/);
    const called = state.proposals.find(item => item.reference === 'P-2001')!;
    const kaja = state.proposals.find(item => item.reference === 'P-2002')!;
    const stately = state.proposals.find(item => item.reference === 'P-2005')!;
    expect(conversationThread(state, called.opportunityId).some(item => item.channel === 'linkedin' && item.kind === 'event')).toBe(true);
    expect(conversationThread(state, called.opportunityId).some(item => item.body.includes('Book 30 minutes'))).toBe(true);
    expect(conversationThread(state, kaja.opportunityId).some(item => item.channel === 'linkedin')).toBe(true);
    expect(conversationThread(state, stately.opportunityId).some(item => item.channel === 'website')).toBe(true);
    const pulse = conversationPulse(state);
    expect(pulse.linkedinSent).toBe(4);
    expect(pulse.linkedinAccepted).toBe(3);
    expect(pulse.meetingsBooked).toBe(4);
    expect(state.scenarios).toHaveLength(2);
    expect(state.scenarios.every(item => item.baselineWins !== null && item.counterfactual && item.spendMinor !== null && item.valueMinor !== null)).toBe(true);
    expect(state.usage).toHaveLength(5);
    for (const artifact of state.artifacts) PreparedArtifact.parse(artifact);
    for (const finding of state.findings) WorkOpportunity.parse(finding);
    for (const connection of state.connections) ConnectionCapability.parse(connection);
    for (const action of state.actions) ActionProposal.parse(action);
    for (const scenario of state.scenarios) ForecastScenario.parse(scenario);
  });

  it('leaves the DAVID and northstar fixtures on their original teams', () => {
    const david = createFixtureState();
    expect(david.workspace.name).toMatch(/DAVID AI/);
    expect(david.activation.selectedTeam).toEqual(['deal-follow-up', 'appointment-coordinator', 'account-intelligence', 'search-growth', 'technical-seo-monitor']);
    expect(createFixtureState('northstar').activation.selectedTeam).toEqual(david.activation.selectedTeam);
  });
});
