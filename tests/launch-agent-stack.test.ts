import { describe, expect, it } from 'vitest';
import { catalog, prepareFromContext, createFixtureState } from '../packages/domain/src/index';
import { agentDelivery } from '../packages/domain/src/delivery';

describe('Launch agent stack decisions', () => {
  it('names HeyReach as the LinkedIn send/inbox layer while DAVID stays copy-out', () => {
    const linkedin = catalog.find(agent => agent.id === 'linkedin-outreach-assistant');
    expect(linkedin?.modes).toEqual(['preparation']);
    expect(linkedin?.releaseStatus).toBe('planned');
    expect(linkedin?.responsibility).toMatch(/HeyReach/);
    expect(linkedin?.responsibility).toMatch(/does not send LinkedIn/i);
    expect(linkedin?.toolNames).toContain('heyreach.copy_out');
    expect(linkedin?.fallback).toMatch(/HeyReach/);
    const state = createFixtureState();
    expect(agentDelivery(state, 'linkedin-outreach-assistant').detail).toMatch(/HeyReach/);
    expect(agentDelivery(state, 'linkedin-outreach-assistant').headline).toMatch(/HeyReach/);
  });

  it('keeps Technical SEO on a bounded DataForSEO crawl and SERP snapshot — no Search Console or CMS write-back', () => {
    const seo = catalog.find(agent => agent.id === 'technical-seo-monitor');
    expect(seo?.releaseStatus).toBe('pilot');
    expect(seo?.modes).toEqual(['preparation']);
    expect(seo?.responsibility).toMatch(/DataForSEO/);
    expect(seo?.responsibility).toMatch(/does not write the CMS/i);
    expect(seo?.responsibility).toMatch(/Search Console stays off/i);
    expect(seo?.toolNames).toEqual(expect.arrayContaining(['dataforseo.crawl', 'dataforseo.serp', 'dataforseo.ranked_keywords']));
    const state = createFixtureState();
    const artifact = prepareFromContext('technical-seo-monitor', state.company);
    expect(artifact.type).toBe('TechnicalSeoReport');
    expect(artifact.limitation).toMatch(/not a CMS write/i);
    expect(artifact.limitation).not.toMatch(/Search Console stays on/i);
    expect(agentDelivery(state, 'technical-seo-monitor').detail).toMatch(/does not change your website|Copy titles/i);
  });

  it('names ElevenLabs as the outbound voice dialer and keeps receptionist inbound', () => {
    expect(catalog).toHaveLength(33);
    const voice = catalog.find(agent => agent.id === 'outbound-voice-sdr');
    expect(voice?.name).toBe('Outbound Voice SDR');
    expect(voice?.modes).toEqual(['bounded_autonomous_execution']);
    expect(voice?.toolNames).toEqual(expect.arrayContaining(['elevenlabs.call', 'elevenlabs.agent', 'elevenlabs.webhooks']));
    expect(voice?.responsibility).toMatch(/does not find leads/i);
    expect(voice?.responsibility).toMatch(/ElevenLabs/);
    expect(catalog.some(agent => /bland/i.test(`${agent.id} ${agent.name} ${agent.responsibility}`))).toBe(false);
    const receptionist = catalog.find(agent => agent.id === 'ai-receptionist');
    expect(receptionist?.releaseStatus).toBe('planned');
    expect(receptionist?.toolNames).toEqual(expect.arrayContaining(['elevenlabs.agent']));
    expect(receptionist?.responsibility).toMatch(/inbound/i);
  });

  it('keeps Search Growth as the extra easy-to-launch agent and Concierge as an undeployed DAVID-hosted embed', () => {
    const search = catalog.find(agent => agent.id === 'search-growth');
    expect(search?.releaseStatus).toBe('implemented');
    expect(search?.modes).toEqual(['preparation']);
    const concierge = catalog.find(agent => agent.id === 'website-sales-concierge');
    expect(concierge?.releaseStatus).toBe('implemented');
    expect(concierge?.responsibility).toMatch(/DAVID-hosted embed/);
    expect(concierge?.responsibility).toMatch(/not deployed/);
    const state = createFixtureState();
    const faq = prepareFromContext('website-sales-concierge', state.company);
    expect(faq.limitation).toMatch(/no deployed chat/i);
    expect(agentDelivery(state, 'website-sales-concierge').detail).toMatch(/not deployed on the public site/i);
  });

  it('keeps Instantly parent tenancy as one sub-workspace per DAVID workspace', () => {
    const sdr = catalog.find(agent => agent.id === 'outbound-email-sdr');
    expect(sdr?.dependencies).toEqual(expect.arrayContaining(['managed_instantly_workspace']));
    expect(sdr?.responsibility).toMatch(/does not find leads/i);
  });
});
