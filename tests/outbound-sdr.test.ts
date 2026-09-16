import { describe, expect, it } from 'vitest';
import { AgentDefinition } from '../packages/contracts/src/index';
import { createFixtureState, executeCommand, catalog, parseCsvImport, CSV_FIELDS, parseLeadCsv } from '../packages/domain/src/index';
import { agentDelivery } from '../packages/domain/src/delivery';
import { denyInstantlyLeadFinder, normalizeInstantlyWebhook, parseInstantlyAccounts } from '../packages/connectors/src/instantly';
import { launchManagedInstantlyCampaign } from '../packages/orchestration/src/action-service';
import { environment } from '../packages/orchestration/src/environment';

const leadCsv = `Work Email,First Name,Company
lead@example.invalid,Riley,Acme
`;

async function outboundReady() {
  const state = createFixtureState();
  await executeCommand(state, { type: 'select_team', agentIds: ['outbound-email-sdr', 'account-intelligence', 'search-growth', 'technical-seo-monitor', 'creative-performance'] });
  await executeCommand(state, { type: 'set_booking_url', url: 'https://calendly.com/example/30min' });
  await executeCommand(state, { type: 'import_lead_csv', csv: leadCsv, preview: false });
  await executeCommand(state, { type: 'generate_outbound_sequence' });
  return state;
}

describe('Outbound Email SDR — Instantly, autonomous, no lead gen', () => {
  it('keeps a 32-agent catalog with Instantly-backed Email SDR and no voice dialer', () => {
    expect(catalog).toHaveLength(32);
    const sdr = catalog.find(agent => agent.id === 'outbound-email-sdr');
    expect(AgentDefinition.parse(sdr)).toMatchObject({
      releaseStatus: 'pilot',
      modes: ['bounded_autonomous_execution'],
    });
    expect(sdr?.responsibility).toMatch(/does not find leads/i);
    expect(sdr?.fallback).toMatch(/SuperSearch/i);
    expect(catalog.find(agent => agent.id === 'deal-follow-up')?.requiredCapabilities).toEqual(expect.arrayContaining(['gmail.send', 'gmail.reply_read']));
    expect(catalog.some(agent => /voice|bland|dialer/i.test(`${agent.id} ${agent.name}`))).toBe(false);
    expect(agentDelivery(createFixtureState(), 'outbound-email-sdr').detail).toMatch(/does not find leads/i);
  });

  it('maps messy email headers and rejects rows without email, without using the proposal CSV schema', () => {
    const preview = parseLeadCsv(leadCsv);
    expect(preview.mapping.email).toBe('Work Email');
    expect(preview.valid).toBe(1);
    expect(preview.errors).toEqual([]);
    expect(parseLeadCsv('name,company\nRiley,Acme').errors[0].message).toMatch(/email column/i);
    expect(parseLeadCsv('email\nnot-an-email').errors[0].message).toMatch(/invalid/i);
    expect(CSV_FIELDS).toContain('proposal_id');
    expect(parseLeadCsv('email\nlead@example.invalid').rows[0].proposal_id).toBeUndefined();
    expect(parseCsvImport(leadCsv).errors.length).toBeGreaterThan(0);
  });

  it('asks for a meeting link, writes copy from company facts, and starts without per-email approval', async () => {
    const state = createFixtureState();
    await executeCommand(state, { type: 'select_team', agentIds: ['outbound-email-sdr', 'account-intelligence', 'search-growth', 'technical-seo-monitor', 'creative-performance'] });
    await expect(executeCommand(state, { type: 'generate_outbound_sequence' })).rejects.toThrow(/Calendly or meeting URL/i);
    await expect(executeCommand(state, { type: 'start_outbound_sdr' })).rejects.toThrow(/does not find leads|meeting URL|sequence/i);
    const saved = await executeCommand(state, { type: 'set_booking_url', url: 'https://calendly.com/example/30min' });
    expect(saved.message).toMatch(/Calendly/i);
    await executeCommand(state, { type: 'import_lead_csv', csv: leadCsv, preview: false });
    expect(state.outboundSdr?.leads[0]?.email).toBe('lead@example.invalid');
    expect(state.contacts.find(contact => contact.email === 'lead@example.invalid')?.enrolled).toBe(false);
    const written = await executeCommand(state, { type: 'generate_outbound_sequence' });
    expect(written.message).toMatch(/Instantly will send/i);
    expect(state.outboundSdr?.sequence).toHaveLength(3);
    expect(state.outboundSdr?.sequence[0]?.body).toContain('{{firstName}}');
    expect(state.outboundSdr?.sequence[0]?.body).toContain('https://calendly.com/example/30min');
    const beforeActions = state.actions.length;
    const started = await executeCommand(state, { type: 'start_outbound_sdr' });
    expect(started.message).toMatch(/No live mailbox send/);
    expect(state.outboundSdr?.campaignId).toMatch(/^FIXTURE_ONLY_instantly_/);
    expect(state.outboundSdr?.status).toBe('sending');
    expect(state.actions).toHaveLength(beforeActions);
    expect(state.approvals.filter(item => item.status === 'pending')).toHaveLength(0);
    const artifact = state.artifacts.find(item => item.agentId === 'outbound-email-sdr' && item.type === 'EmailSequence');
    expect(artifact?.limitation).toMatch(/Instantly send is not live/i);
  });

  it('records Instantly replies in the conversation and books without a Gmail approval loop', async () => {
    const state = await outboundReady();
    await executeCommand(state, { type: 'start_outbound_sdr' });
    const reply = await executeCommand(state, {
      type: 'ingest_outbound_event',
      eventType: 'reply_received',
      email: 'lead@example.invalid',
      text: 'Thursday works.',
      providerEventId: 'instantly-reply-1',
    });
    expect(reply.message).toMatch(/reply_received/);
    expect(state.outboundSdr?.leads[0]?.status).toBe('replied');
    expect(state.timeline.some(item => item.kind === 'email_in' && item.detail.includes('Thursday'))).toBe(true);
    expect(state.outcomes.some(item => item.stage === 'reply')).toBe(true);
    await executeCommand(state, {
      type: 'ingest_outbound_event',
      eventType: 'lead_meeting_booked',
      email: 'lead@example.invalid',
      providerEventId: 'instantly-book-1',
    });
    expect(state.outboundSdr?.leads[0]?.status).toBe('booked');
    expect(state.outcomes.some(item => item.stage === 'booked')).toBe(true);
    const duplicate = await executeCommand(state, {
      type: 'ingest_outbound_event',
      eventType: 'reply_received',
      email: 'lead@example.invalid',
      text: 'Thursday works.',
      providerEventId: 'instantly-reply-1',
    });
    expect(duplicate.message).toMatch(/Duplicate/);
  });

  it('suppresses bounces, keeps HubSpot as needs-access, and refuses live webhook impersonation from commands', async () => {
    const state = await outboundReady();
    await executeCommand(state, { type: 'start_outbound_sdr' });
    const hubspot = await executeCommand(state, { type: 'set_outbound_crm', provider: 'hubspot' });
    expect(hubspot.message).toMatch(/CSV upload works now/);
    expect(state.outboundSdr?.crmStatus).toBe('needs_access');
    expect(state.outboundSdr?.status).toBe('sending');
    await executeCommand(state, {
      type: 'ingest_outbound_event',
      eventType: 'email_bounced',
      email: 'lead@example.invalid',
      providerEventId: 'bounce-1',
    });
    expect(state.contacts.find(contact => contact.email === 'lead@example.invalid')?.suppressed).toBe(true);
    state.workspace.mode = 'live';
    state.context.environment = 'live';
    await expect(executeCommand(state, {
      type: 'ingest_outbound_event',
      eventType: 'reply_received',
      email: 'lead@example.invalid',
      providerEventId: 'live-forged',
    })).rejects.toThrow(/authorized Instantly webhook/);
  });

  it('does not send through Instantly from a live workspace command path or from fixture credentials', async () => {
    const state = await outboundReady();
    state.outboundSdr!.warmupReady = true;
    state.outboundSdr!.sendingAccounts = [{ email: 'warmup@example.invalid', warmupReady: true, health: 'healthy' }];
    state.workspace.mode = 'live';
    state.context.environment = 'live';
    await expect(executeCommand(state, { type: 'start_outbound_sdr' })).rejects.toThrow(/hosted outbound launcher/);
    expect(environment({}).DAVID_MODE).toBe('fixture');
    expect(() => environment({ INSTANTLY_API_KEY: 'secret' })).toThrow(/FIXTURE_CREDENTIALS_DENIED/);
    await expect(launchManagedInstantlyCampaign({
      name: 'david:fixture',
      dailyLimit: 40,
      sequence: [{ subject: 'Hi', body: 'Book' }],
      leads: [{ email: 'lead@example.invalid' }],
      instantlyWorkspaceId: '019fdec8-4890-7870-a6bd-416bf4db2784',
    })).rejects.toThrow(/denied in fixture mode/);
  });

  it('refuses Instantly SuperSearch and normalizes Unibox webhooks', () => {
    expect(() => denyInstantlyLeadFinder('/api/v2/supersearch/enrich')).toThrow(/does not use Instantly lead finder/);
    expect(() => denyInstantlyLeadFinder('/api/v2/lead-finder')).toThrow(/lead finder/);
    const accounts = parseInstantlyAccounts({ items: [{ email: 'sender@example.invalid', status: 'active', warmup_status: 'healthy' }, { email: 'cold@example.invalid', status: 'active', warmup_status: 'pending' }] });
    expect(accounts.find(account => account.email === 'sender@example.invalid')?.warmupReady).toBe(true);
    expect(accounts.find(account => account.email === 'cold@example.invalid')?.warmupReady).toBe(false);
    expect(normalizeInstantlyWebhook({ event_type: 'reply_received', lead_email: 'lead@example.invalid', reply_text: 'Yes', email_id: 'evt-1', campaign_id: 'camp-1', timestamp: '2026-09-15T16:00:00.000Z' })).toMatchObject({
      eventType: 'reply_received',
      email: 'lead@example.invalid',
      providerEventId: 'evt-1',
    });
    expect(normalizeInstantlyWebhook({ event_type: 'lead_created' })).toBeNull();
    expect(normalizeInstantlyWebhook({
      event_type: 'reply_received',
      lead_email: 'lead@example.invalid',
      organization: '019fdec8-4890-7870-a6bd-416bf4db2784',
      email_id: 'evt-org',
    })?.workspaceHint).toBe('019fdec8-4890-7870-a6bd-416bf4db2784');
  });

  it('binds an Instantly sub-workspace UUID and will not treat fixture as a live tenant', async () => {
    const state = await outboundReady();
    await expect(executeCommand(state, { type: 'bind_instantly_workspace', instantlyWorkspaceId: 'fixture' })).rejects.toThrow(/sub-workspace/);
    const bound = await executeCommand(state, { type: 'bind_instantly_workspace', instantlyWorkspaceId: '019FDEC8-4890-7870-A6BD-416BF4DB2784' });
    expect(bound.message).toMatch(/x-as-workspace/);
    expect(state.outboundSdr?.instantlyWorkspaceId).toBe('019fdec8-4890-7870-a6bd-416bf4db2784');
    await executeCommand(state, { type: 'start_outbound_sdr' });
    expect(state.outboundSdr?.instantlyWorkspaceId).toBe('fixture');
  });
});
