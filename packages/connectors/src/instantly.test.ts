import { describe, expect, it, vi } from 'vitest';
import { createInstantlyClient, denyInstantlyLeadFinder, normalizeInstantlyWebhook, requireInstantlySubWorkspace } from './instantly';
import { executeInstantlyWrite } from './internal/instantly-writes';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const SUB = '019fdec8-4890-7870-a6bd-416bf4db2784';

describe('Instantly connector — no live send in these tests', () => {
  it('creates a campaign, adds leads in batches, and activates without SuperSearch', async () => {
    const paths: string[] = [];
    const asWorkspace: string[] = [];
    const http = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      paths.push(url);
      const headers = new Headers(init?.headers);
      asWorkspace.push(headers.get('x-as-workspace') ?? '');
      if (url.endsWith('/api/v2/campaigns')) return json({ id: '019fdec8-0356-788b-987b-d4b32f8bccbd' });
      return json({ ok: true });
    });
    const result = await executeInstantlyWrite('SYNTHETIC_KEY', SUB, {
      type: 'launch_campaign',
      campaign: { name: 'DAVID outbound', dailyLimit: 40, senderEmails: ['sender@example.invalid'], steps: [{ subject: 'Hello', body: 'Book: https://calendly.com/example' }] },
      leads: [{ email: 'lead@example.invalid', first_name: 'Riley' }],
    }, http);
    expect(result.campaignId).toMatch(/^019f/);
    expect(result.status).toBe('sending');
    expect(paths.join(' ')).not.toMatch(/supersearch|lead-finder/i);
    expect(paths.some(path => path.endsWith('/api/v2/campaigns'))).toBe(true);
    expect(paths.some(path => path.endsWith('/api/v2/leads/add'))).toBe(true);
    expect(asWorkspace.every(value => value === SUB)).toBe(true);
  });
  it('refuses Instantly lead-finder paths and a missing sub-workspace', () => {
    expect(() => denyInstantlyLeadFinder('/api/v2/supersearch/enrich')).toThrow(/does not use Instantly lead finder/);
    expect(() => denyInstantlyLeadFinder('/api/v2/lead-finder/search')).toThrow(/lead finder/);
    expect(() => requireInstantlySubWorkspace('fixture')).toThrow(/sub-workspace/);
    expect(() => requireInstantlySubWorkspace('')).toThrow(/admin Instantly workspace/);
    expect(() => createInstantlyClient({ apiKey: 'SYNTHETIC_KEY', asWorkspace: 'not-a-uuid' })).toThrow(/workspace UUID/);
  });
  it('reads Instantly organization as the tenant workspace hint', () => {
    expect(normalizeInstantlyWebhook({
      event_type: 'reply_received',
      lead_email: 'lead@example.invalid',
      organization: SUB,
      email_id: 'evt-1',
    })).toMatchObject({ workspaceHint: SUB, eventType: 'reply_received' });
  });
});
