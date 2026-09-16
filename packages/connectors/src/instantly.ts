import { z } from 'zod';

export class InstantlyError extends Error {
  constructor(public code: string, message: string, public status: number | null = null, public uncertain = false) {
    super(message);
    this.name = 'InstantlyError';
  }
}

export type InstantlyCampaignInput = {
  name: string;
  dailyLimit: number;
  senderEmails: string[];
  steps: { subject: string; body: string }[];
};

export type InstantlyLeadInput = {
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  website?: string;
  custom_variables?: Record<string, string>;
};

const INSTANTLY_WORKSPACE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireInstantlySubWorkspace(id: string | null | undefined): string {
  const value = String(id ?? '').trim();
  if (!value || value === 'fixture' || /^FIXTURE_ONLY/i.test(value)) {
    throw new InstantlyError('workspace_required', 'Bind a DAVID Instantly sub-workspace before live send. Do not send from the admin Instantly workspace.');
  }
  if (!INSTANTLY_WORKSPACE_ID.test(value)) {
    throw new InstantlyError('workspace_invalid', 'Instantly sub-workspace id must be the Instantly workspace UUID.');
  }
  return value;
}

type InstantlyConfig = { apiKey: string; asWorkspace: string; fetch?: typeof fetch };

export function denyInstantlyLeadFinder(path: string) {
  if (/supersearch|lead-finder|lead_finder|aisearch/i.test(path)) throw new InstantlyError('supersearch_denied', 'Outbound Email SDR does not use Instantly lead finder.');
}

export function parseInstantlyAccounts(raw: unknown): { email: string; warmupReady: boolean; health: string }[] {
  const rows = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown[] }).items) ? (raw as { items: unknown[] }).items : [];
  return rows.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const email = String(record.email ?? record.username ?? '').trim().toLowerCase();
    if (!email.includes('@')) return [];
    const status = String(record.status ?? '').toLowerCase();
    const warmup = String(record.warmup_status ?? record.warmupStatus ?? '').toLowerCase();
    const active = ['active', 'success', 'healthy', 'connected'].includes(status) || record.status === 1 || record.status === true;
    const warmed = record.warmup === true || ['active', 'completed', 'healthy', 'warmed'].includes(warmup);
    return [{ email, warmupReady: Boolean(active && warmed), health: status || warmup || 'unknown' }];
  });
}

export function createInstantlyClient(config: InstantlyConfig) {
  if (!config.apiKey.trim()) throw new InstantlyError('unconfigured', 'INSTANTLY_API_KEY is required for live send.');
  const asWorkspace = requireInstantlySubWorkspace(config.asWorkspace);
  const request = async (path: string, init: RequestInit = {}) => {
    denyInstantlyLeadFinder(path);
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${config.apiKey}`);
    headers.set('Content-Type', 'application/json');
    headers.set('x-as-workspace', asWorkspace);
    const response = await (config.fetch ?? fetch)(`https://api.instantly.ai${path}`, {
      ...init,
      headers,
    });
    const body = await response.text();
    let parsed: unknown = {};
    try { parsed = body ? JSON.parse(body) : {}; } catch { throw new InstantlyError('invalid_json', 'Instantly returned a non-JSON body.', response.status, response.status >= 500); }
    if (!response.ok) throw new InstantlyError('request_failed', `Instantly ${path} failed.`, response.status, response.status >= 500 || response.status === 0);
    return parsed;
  };
  return {
    listAccounts: () => request('/api/v2/accounts'),
    enableWarmup: (emails: string[]) => request('/api/v2/accounts/warmup/enable', { method: 'POST', body: JSON.stringify({ emails }) }),
    warmupAnalytics: (emails: string[]) => request('/api/v2/accounts/warmup-analytics', { method: 'POST', body: JSON.stringify({ emails }) }),
    createCampaign: (input: InstantlyCampaignInput) => request('/api/v2/campaigns', { method: 'POST', body: JSON.stringify({
      name: input.name,
      email_list: input.senderEmails,
      daily_limit: input.dailyLimit,
      stop_on_reply: true,
      stop_on_auto_reply: true,
      sequences: [{ steps: input.steps.map((step, index) => ({ type: 'email', delay: index === 0 ? 0 : 2, variants: [{ subject: step.subject, body: step.body }] })) }],
    }) }),
    activateCampaign: (id: string) => request(`/api/v2/campaigns/${id}/activate`, { method: 'POST' }),
    pauseCampaign: (id: string) => request(`/api/v2/campaigns/${id}/pause`, { method: 'POST' }),
    addLeads: (campaignId: string, leads: InstantlyLeadInput[]) => request('/api/v2/leads/add', { method: 'POST', body: JSON.stringify({ campaign_id: campaignId, leads, verify_leads_on_import: false }) }),
  };
}

export const InstantlyWebhookEvent = z.object({
  event_type: z.string().min(1),
  lead_email: z.string().optional(),
  campaign_id: z.string().optional(),
  timestamp: z.string().optional(),
  email_id: z.string().optional(),
  reply_text: z.string().optional(),
  email_text: z.string().optional(),
  workspace_id: z.string().optional(),
  organization: z.string().optional(),
}).passthrough();

const WEBHOOK_TYPES = {
  email_sent: 'email_sent',
  reply_received: 'reply_received',
  auto_reply_received: 'auto_reply_received',
  email_bounced: 'email_bounced',
  lead_unsubscribed: 'lead_unsubscribed',
  lead_meeting_booked: 'lead_meeting_booked',
} as const;

export function normalizeInstantlyWebhook(raw: unknown) {
  const parsed = InstantlyWebhookEvent.safeParse(raw);
  if (!parsed.success) return null;
  const record = parsed.data as Record<string, unknown>;
  const typeKey = String(parsed.data.event_type || record.eventType || '');
  const eventType = WEBHOOK_TYPES[typeKey as keyof typeof WEBHOOK_TYPES];
  const email = String(parsed.data.lead_email ?? record.email ?? '').trim().toLowerCase();
  if (!eventType || !email) return null;
  const occurred = parsed.data.timestamp ?? (typeof record.occurredAt === 'string' ? record.occurredAt : undefined);
  const campaignId = parsed.data.campaign_id ?? (typeof record.campaignId === 'string' ? record.campaignId : undefined);
  const providerEventId = parsed.data.email_id || (typeof record.providerEventId === 'string' ? record.providerEventId : '') || `${typeKey}:${email}:${occurred ?? 'undated'}`;
  return {
    eventType,
    email,
    text: parsed.data.reply_text ?? parsed.data.email_text ?? (typeof record.text === 'string' ? record.text : undefined),
    providerEventId,
    campaignId,
    occurredAt: occurred && /^\d{4}-\d{2}-\d{2}T/.test(occurred) ? occurred : undefined,
    workspaceHint: instantlyWebhookWorkspaceHint(parsed.data, record),
  };
}

function instantlyWebhookWorkspaceHint(parsed: { workspace_id?: string; organization?: string }, record: Record<string, unknown>): string | undefined {
  const hint = String(parsed.workspace_id ?? parsed.organization ?? record.workspaceId ?? record.workspaceHint ?? '').trim();
  return hint || undefined;
}
