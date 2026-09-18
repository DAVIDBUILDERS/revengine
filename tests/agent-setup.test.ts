import { describe, expect, it } from 'vitest';
import { createFixtureState, executeCommand, agentSetupPath, generateVoiceOpening, catalog, nextSetupAgentId } from '@david/domain';

const team = ['outbound-email-sdr', 'account-intelligence', 'search-growth', 'technical-seo-monitor', 'creative-performance'] as const;

describe('agent setup path', () => {
  it('walks Outbound Email SDR meeting → list → sequence, accepts any https, and binds Instantly only for operators', async () => {
    const state = createFixtureState();
    await executeCommand(state, { type: 'select_team', agentIds: [...team] });
    const ids = () => agentSetupPath(state, 'outbound-email-sdr').map(step => step.id);
    expect(ids().indexOf('booking')).toBeLessThan(ids().indexOf('leads'));
    expect(ids().indexOf('leads')).toBeLessThan(ids().indexOf('sequence'));
    expect(agentSetupPath(state, 'outbound-email-sdr').find(step => step.id === 'leads')?.description).toMatch(/Name the email column email/);
    expect(ids()).toContain('ready');
    expect(ids()).not.toContain('bind');

    const booking = agentSetupPath(state, 'outbound-email-sdr').find(step => step.id === 'booking')!;
    expect(booking.canContinue).toBe(false);
    await executeCommand(state, { type: 'set_booking_url', url: 'https://meet.example.com/demo' });
    expect(agentSetupPath(state, 'outbound-email-sdr').find(step => step.id === 'booking')?.canContinue).toBe(true);
    expect(state.outboundSdr?.bookingUrl).toBe('https://meet.example.com/demo');

    state.context.role = 'david_operator';
    expect(ids()).toContain('bind');
    expect(agentSetupPath(state, 'outbound-email-sdr').find(step => step.id === 'bind')?.canContinue).toBe(false);
    await executeCommand(state, { type: 'bind_instantly_workspace', instantlyWorkspaceId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' });
    expect(ids()).not.toContain('bind');

    state.context.role = 'workspace_owner';
    expect(ids()).not.toContain('bind');
  });

  it('keeps Calendly optional and shows Instantly tools as chips, not a first-screen secret', () => {
    const state = createFixtureState();
    const [first, ...rest] = agentSetupPath(state, 'outbound-email-sdr');
    expect(first.id).toBe('intro');
    expect(first.title).not.toMatch(/UUID|Instantly sub-workspace/i);
    expect(rest.some(step => step.requiredTools.includes('instantly.campaign'))).toBe(true);
  });

  it('uses named questionnaires for SEO, account intel, deal follow-up, concierge, receptionist, and voice', () => {
    const state = createFixtureState();
    expect(agentSetupPath(state, 'technical-seo-monitor').map(step => step.id)).toEqual(['intro', 'keywords', 'location', 'preview', 'ready']);
    expect(agentSetupPath(state, 'account-intelligence').map(step => step.id)).toEqual(['facts', 'prepare', 'artifact', 'ready']);
    expect(agentSetupPath(state, 'deal-follow-up').map(step => step.id)).toEqual(['intro', 'proposals', 'gmail', 'ready']);
    expect(agentSetupPath(state, 'website-sales-concierge').map(step => step.id)).toContain('prepare');
    expect(agentSetupPath(state, 'ai-receptionist').map(step => step.id)).toEqual(['intro', 'greeting', 'booking', 'hours', 'ready']);
    expect(agentSetupPath(state, 'outbound-voice-sdr').map(step => step.id)).toEqual(['intro', 'list', 'script', 'booking', 'ready']);
    expect(generateVoiceOpening(state.company, 'https://meet.example.com/x')).toMatch(/DAVID|call from/i);
    state.context.role = 'david_operator';
    expect(agentSetupPath(state, 'outbound-voice-sdr').some(step => step.id === 'bind')).toBe(true);
    expect(agentSetupPath(state, 'ai-receptionist').some(step => step.id === 'bind')).toBe(true);
  });

  it('gives other catalog agents a short generic path', () => {
    const state = createFixtureState();
    const planned = agentSetupPath(state, 'paid-campaign-operator').map(step => step.id);
    expect(planned).toEqual(['intro', 'tools', 'facts', 'engineering', 'ready']);
    const prep = agentSetupPath(state, 'search-growth').map(step => step.id);
    expect(prep).toEqual(['intro', 'tools', 'facts', 'prepare', 'artifact', 'ready']);
    expect(catalog).toHaveLength(33);
  });

  it('offers the next unfinished specialist after Outbound Email SDR even when fixture artifacts exist', async () => {
    const state = createFixtureState();
    await executeCommand(state, { type: 'select_team', agentIds: [...team] });
    await executeCommand(state, { type: 'save_agent_onboarding', agentId: 'outbound-email-sdr', expectedRevision: 0, answers: { completed: true } });
    const next = nextSetupAgentId(state, 'outbound-email-sdr');
    expect(next).toBeTruthy();
    expect(next).not.toBe('outbound-email-sdr');
    expect(state.agentOnboarding?.find(record => record.agentId === next)?.status).not.toBe('ready');
  });
});
