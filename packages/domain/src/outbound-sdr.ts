import type { WebsiteContext } from '../../agents/src/index';
import type { AppSnapshot } from '../../contracts/src/index';
import { OutboundEvent, OutboundLead, OutboundSdrState, OutboundSequenceStep } from '../../contracts/src/outbound';
import { DomainError } from './action-service';
import { mappedLeadRow, parseLeadCsv } from './lead-csv';
import { audit, evidence, nextId, stableId, type EngineState } from './state';

function assertOutboundInstalled(state: EngineState) {
  const installation = state.installations.find(item => item.agentId === 'outbound-email-sdr');
  if (!installation || !state.activation.selectedTeam.includes('outbound-email-sdr')) throw new DomainError('ENTITLEMENT', 'Select Outbound Email SDR in the team.');
}

export function companyFromSnapshot(state: AppSnapshot): WebsiteContext {
  const capture = state.onboardingCapture;
  const company = state.onboarding?.answers.company;
  if (!capture?.pages.length || !company?.name || !company.offers.length || !company.customers.length) {
    throw new DomainError('COMPANY_UNCONFIRMED', 'Confirm company facts before writing outbound copy.');
  }
  return {
    companyName: company.name,
    confirmed: state.activation.confirmedFacts,
    offers: company.offers,
    customerTypes: company.customers,
    locations: [],
    pages: capture.pages,
    evidence: capture.evidence?.length ? capture.evidence : [{ id: capture.id, label: 'Captured company website', source: 'website capture', capturedAt: capture.pages[0].capturedAt, quality: capture.fixture ? 'fixture' : 'provider_verified' }],
    fixture: capture.fixture,
    operatingGuidance: { brand: company.brandGuidance, forbiddenClaims: company.forbiddenClaims },
  };
}

export function sequenceTopicFromState(state: Pick<AppSnapshot, 'agentOnboarding'>) {
  return String(state.agentOnboarding?.find(record => record.agentId === 'outbound-email-sdr')?.answers.sequenceTopic ?? '').trim();
}

export function suggestedSequenceTopic(state: AppSnapshot) {
  const saved = sequenceTopicFromState(state);
  if (saved) return saved;
  const engine = (state as AppSnapshot & { company?: WebsiteContext }).company;
  return String(engine?.offers[0] ?? state.onboarding?.answers.company.offers[0] ?? '').trim();
}

export function outboundSequenceCompany(state: AppSnapshot, topicOverride?: string): WebsiteContext {
  const topic = (topicOverride ?? suggestedSequenceTopic(state)).trim();
  if (!topic) throw new DomainError('SEQUENCE_TOPIC_REQUIRED', 'Say what these emails should be about.');
  const engine = (state as AppSnapshot & { company?: WebsiteContext }).company;
  const onboarding = state.onboarding?.answers.company;
  const name = engine?.companyName || onboarding?.name || state.workspace.name;
  const customers = engine?.customerTypes.length ? engine.customerTypes : onboarding?.customers.length ? onboarding.customers : ['your team'];
  const pages = engine?.pages.length ? engine.pages : state.onboardingCapture?.pages ?? [];
  const capturedAt = state.asOf;
  return {
    companyName: name,
    confirmed: true,
    offers: [topic],
    customerTypes: customers,
    locations: engine?.locations ?? [],
    pages: pages.length ? pages : [{ url: onboarding?.website || 'https://example.invalid', title: name, description: '', text: topic, capturedAt }],
    evidence: engine?.evidence.length ? engine.evidence : [{ id: 'sequence-topic', label: 'Outbound sequence topic', source: 'workspace', capturedAt, quality: 'fixture' }],
    fixture: state.workspace.mode === 'fixture',
    operatingGuidance: engine?.operatingGuidance ?? { brand: onboarding?.brandGuidance ?? '', forbiddenClaims: onboarding?.forbiddenClaims ?? '' },
  };
}

export function emptyOutboundSdr(workspaceId: string): OutboundSdrState {
  return OutboundSdrState.parse({
    workspaceId,
    bookingUrl: null,
    sequence: [],
    leads: [],
    campaignId: null,
    instantlyWorkspaceId: null,
    warmupReady: false,
    sendingAccounts: [],
    status: 'needs_setup',
    crmProvider: 'none',
    crmStatus: 'not_connected',
    lastError: null,
  });
}

export function ensureOutboundSdr(state: EngineState): OutboundSdrState {
  state.outboundSdr ??= emptyOutboundSdr(state.workspace.id);
  return state.outboundSdr;
}

export function bookingUrlInfo(url: string | null | undefined) {
  const value = url?.trim() ?? '';
  if (!value) return { ok: false, calendly: false, message: 'Add a Calendly or meeting URL before Instantly can book.' };
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return { ok: false, calendly: false, message: 'Meeting link must be an http(s) URL.' };
    const calendly = /(^|\.)calendly\.com$/i.test(parsed.hostname);
    return { ok: true, calendly, message: calendly ? 'Calendly is present for Instantly auto-book.' : 'A meeting link is saved. Instantly auto-book is strongest with Calendly.' };
  } catch {
    return { ok: false, calendly: false, message: 'Meeting link must be a valid URL.' };
  }
}

export function generateOutboundSequence(company: WebsiteContext, bookingUrl: string): OutboundSequenceStep[] {
  if (!company.confirmed) throw new DomainError('COMPANY_UNCONFIRMED', 'Confirm company facts before writing outbound copy.');
  const booking = bookingUrlInfo(bookingUrl);
  if (!booking.ok) throw new DomainError('BOOKING_URL_REQUIRED', booking.message);
  const offer = company.offers[0];
  const audience = company.customerTypes.join(', ');
  const first = '{{firstName}}';
  const brand = company.operatingGuidance?.brand?.trim();
  const forbidden = company.operatingGuidance?.forbiddenClaims?.trim();
  const cta = `Book a conversation: ${bookingUrl.trim()}`;
  const guard = [brand ? `Stay inside approved brand guidance.` : '', forbidden ? `Do not claim: ${forbidden}` : ''].filter(Boolean).join(' ');
  return [
    {
      subject: `${offer} for ${first}`.slice(0, 200),
      body: `Hi ${first},\n\n${company.companyName} helps ${audience} with ${company.offers.join(', ')}.\n\n${cta}\n\nIf this is not useful, reply and we will stop.\n\n${guard}`.trim(),
    },
    {
      subject: `Quick question for ${first}`.slice(0, 200),
      body: `Hi ${first},\n\nChecking whether ${offer} is still relevant for ${audience.includes(',') ? 'your team' : audience}.\n\nOne question: who owns this today?\n\n${cta}\n\n${guard}`.trim(),
    },
    {
      subject: `Close the loop with ${first}`.slice(0, 200),
      body: `Hi ${first},\n\nLast note from me. If a conversation would help, grab a time here:\n${bookingUrl.trim()}\n\nOtherwise I will not follow up again.\n\n${guard}`.trim(),
    },
  ];
}

export function outboundReadyReasons(state: EngineState): string[] {
  const sdr = ensureOutboundSdr(state);
  const reasons: string[] = [];
  const installation = state.installations.find(item => item.agentId === 'outbound-email-sdr');
  if (!installation || !state.activation.selectedTeam.includes('outbound-email-sdr')) reasons.push('Select Outbound Email SDR in the team.');
  if (state.workspace.paused) reasons.push('Workspace is paused.');
  if (!state.company.confirmed) reasons.push('Confirm company facts before sending.');
  const booking = bookingUrlInfo(sdr.bookingUrl);
  if (!booking.ok) reasons.push(booking.message);
  if (!sdr.sequence.length) reasons.push('Generate the sequence before Instantly can send.');
  if (!sdr.leads.some(lead => lead.status !== 'skipped')) reasons.push('Upload a CSV or connect a CRM list. This agent does not find leads.');
  if (state.workspace.mode !== 'fixture' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sdr.instantlyWorkspaceId ?? '')) {
    reasons.push('Bind a DAVID Instantly sub-workspace before live send. Do not send from the admin Instantly workspace.');
  }
  if (state.workspace.mode !== 'fixture' && !sdr.warmupReady) reasons.push('Wait until Instantly warmup is healthy. Cold inboxes do not send.');
  if (state.workspace.mode !== 'fixture' && !sdr.sendingAccounts.length) reasons.push('DAVID still needs at least one Instantly sending inbox.');
  return reasons;
}

function refreshOutboundStatus(state: EngineState) {
  const sdr = ensureOutboundSdr(state);
  if (sdr.status === 'paused' || sdr.status === 'sending') return;
  const reasons = outboundReadyReasons(state);
  sdr.status = reasons.length ? (sdr.warmupReady || state.workspace.mode === 'fixture' ? 'needs_setup' : 'warming') : 'ready';
  sdr.lastError = reasons[0] ?? null;
}

export function bindInstantlyWorkspace(state: EngineState, instantlyWorkspaceId: string) {
  assertOutboundInstalled(state);
  const sdr = ensureOutboundSdr(state);
  const bound = instantlyWorkspaceId.trim();
  if (!bound || bound === 'fixture' || /^FIXTURE_ONLY/i.test(bound)) {
    throw new DomainError('INSTANTLY_WORKSPACE_REQUIRED', 'Bind a DAVID Instantly sub-workspace before live send. Do not send from the admin Instantly workspace.');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bound)) {
    throw new DomainError('INSTANTLY_WORKSPACE_INVALID', 'Instantly sub-workspace id must be the Instantly workspace UUID.');
  }
  sdr.instantlyWorkspaceId = bound.toLowerCase();
  refreshOutboundStatus(state);
  audit(state, 'outbound.instantly_workspace', sdr.instantlyWorkspaceId);
  return 'Instantly sub-workspace bound. Live send will use x-as-workspace for this DAVID workspace only.';
}

export function setOutboundBookingUrl(state: EngineState, url: string) {
  assertOutboundInstalled(state);
  const sdr = ensureOutboundSdr(state);
  const info = bookingUrlInfo(url);
  if (!info.ok) throw new DomainError('BOOKING_URL_REQUIRED', info.message);
  sdr.bookingUrl = url.trim();
  refreshOutboundStatus(state);
  audit(state, 'outbound.booking_url', info.calendly ? 'calendly' : 'meeting-link');
  return info.calendly
    ? 'Calendly saved. Instantly can auto-book from replies.'
    : 'Meeting link saved. Instantly will include it; auto-book is strongest with Calendly.';
}

export function setOutboundCrm(state: EngineState, provider: 'none' | 'hubspot') {
  assertOutboundInstalled(state);
  const sdr = ensureOutboundSdr(state);
  sdr.crmProvider = provider;
  sdr.crmStatus = provider === 'none' ? 'not_connected' : 'needs_access';
  refreshOutboundStatus(state);
  audit(state, 'outbound.crm', provider);
  return provider === 'hubspot'
    ? 'HubSpot is the first CRM path. Authorize it so DAVID can pull contacts into Instantly. CSV upload works now.'
    : 'CRM disconnected. Upload a CSV to send.';
}

export function saveOutboundSequence(state: EngineState) {
  assertOutboundInstalled(state);
  const sdr = ensureOutboundSdr(state);
  const booking = bookingUrlInfo(sdr.bookingUrl);
  if (!booking.ok) throw new DomainError('BOOKING_URL_REQUIRED', booking.message);
  const company = outboundSequenceCompany(state);
  sdr.sequence = generateOutboundSequence(company, sdr.bookingUrl!);
  const id = nextId(state, 'artifact');
  state.artifacts.push({
    id,
    workspaceId: state.workspace.id,
    agentId: 'outbound-email-sdr',
    type: 'EmailSequence',
    sourceSnapshot: company.evidence,
    factualInputs: [
      `Company: ${company.companyName}`,
      `Email topic: ${company.offers[0]}`,
      `Booking URL: ${sdr.bookingUrl}`,
    ],
    title: 'Outbound sequence',
    content: sdr.sequence.map((step, index) => `${index + 1}. ${step.subject}\n${step.body}`).join('\n\n'),
    reviewState: 'draft',
    capabilityVersion: '1.0.0',
    runId: nextId(state, 'run'),
    createdAt: state.asOf,
    limitation: state.workspace.mode === 'fixture'
      ? 'Sequence saved in this workspace. Instantly send is not live in the fixture.'
      : 'Sequence is pushed to Instantly when ready gates pass. DAVID does not generate leads.',
  });
  const installation = state.installations.find(item => item.agentId === 'outbound-email-sdr');
  if (installation) installation.lastPreparationAt = state.asOf;
  refreshOutboundStatus(state);
  audit(state, 'outbound.sequence', id);
  return 'Three-step sequence written from what these emails are about. Instantly will send it; no copy-out to another mail tool.';
}

export function importOutboundLeads(state: EngineState, csv: string, preview: boolean, mapping?: Record<string, string>) {
  if (!preview) assertOutboundInstalled(state);
  const parsed = parseLeadCsv(csv, mapping);
  if (preview) return parsed;
  if (parsed.errors.length) throw new DomainError('CSV_INVALID', `Lead import blocked: ${parsed.errors.map(error => `row ${error.row}: ${error.message}`).join(' | ')}`);
  const sdr = ensureOutboundSdr(state);
  const existing = new Set(sdr.leads.map(lead => lead.email));
  for (const row of parsed.rows) {
    const mapped = mappedLeadRow(row, parsed.mapping);
    if (existing.has(mapped.email)) continue;
    const leadId = stableId(`${state.workspace.id}:outbound-lead:${mapped.email}`);
    const opportunityId = stableId(`${state.workspace.id}:outbound-opportunity:${mapped.email}`);
    const contactId = stableId(`${state.workspace.id}:outbound-contact:${mapped.email}`);
    const account = mapped.company || mapped.email.split('@')[1] || 'Unknown account';
    if (!state.contacts.some(contact => contact.id === contactId)) {
      state.contacts.push({
        id: contactId,
        workspaceId: state.workspace.id,
        name: [mapped.firstName, mapped.lastName].filter(Boolean).join(' ') || mapped.email,
        email: mapped.email,
        account,
        suppressed: false,
        enrolled: false,
        humanTakeover: false,
        owner: state.policy.operator || 'Workspace owner',
        lastContactAt: null,
      });
    }
    if (!state.opportunities.some(item => item.id === opportunityId)) {
      state.opportunities.push({
        schemaVersion: 1,
        id: opportunityId,
        workspaceId: state.workspace.id,
        contactId,
        accountId: stableId(`${state.workspace.id}:outbound-account:${account}`),
        businessModel: state.workspace.businessModel,
        owner: state.policy.operator || 'Workspace owner',
        stage: 'inquiry',
        rawStage: 'outbound_list',
        evidence: [evidence(state, `Outbound list ${mapped.email}`, 'lead csv', mapped.email)],
      });
    }
    sdr.leads.push(OutboundLead.parse({
      id: leadId,
      workspaceId: state.workspace.id,
      opportunityId,
      email: mapped.email,
      firstName: mapped.firstName,
      lastName: mapped.lastName,
      company: mapped.company,
      title: mapped.title,
      website: mapped.website,
      custom: mapped.custom,
      status: 'imported',
      lastReply: null,
      lastEventAt: null,
    }));
    if (!state.proposals.some(item => item.id === stableId(`${state.workspace.id}:outbound-proposal:${mapped.email}`))) {
      const proof = evidence(state, `Outbound list ${mapped.email}`, 'lead csv', mapped.email);
      state.proposals.push({
        schemaVersion: 1,
        id: stableId(`${state.workspace.id}:outbound-proposal:${mapped.email}`),
        workspaceId: state.workspace.id,
        opportunityId,
        contactId,
        version: 1,
        reference: `OUT-${mapped.email.replace(/@.*/, '')}`.slice(0, 40),
        issuedAt: state.asOf,
        validUntil: null,
        amountMinor: null,
        currency: state.workspace.currency,
        valueKind: 'unknown',
        scopeSummary: 'Outbound Email SDR list row. Not a priced proposal. Instantly sends after ready gates.',
        sourceUrl: null,
        status: 'open',
        rawStatus: 'outbound_list',
        owner: state.policy.operator || 'Workspace owner',
        sourceVerifiedAt: state.asOf,
        syncedAt: state.asOf,
        evidence: [proof],
        fixture: state.workspace.mode === 'fixture',
      });
    }
    existing.add(mapped.email);
  }
  refreshOutboundStatus(state);
  audit(state, 'outbound.leads_imported', String(sdr.leads.length));
  return `Imported ${sdr.leads.length} lead(s) for Instantly. This agent does not generate leads.`;
}

export function startOutboundSdr(state: EngineState) {
  const sdr = ensureOutboundSdr(state);
  if (state.workspace.mode !== 'fixture') throw new DomainError('HOSTED_ACTION_SERVICE', 'Live Instantly send must use the hosted outbound launcher.');
  const reasons = outboundReadyReasons(state);
  if (reasons.length) throw new DomainError('OUTBOUND_NOT_READY', reasons.join(' '));
  const installation = state.installations.find(item => item.agentId === 'outbound-email-sdr')!;
  sdr.campaignId = `FIXTURE_ONLY_instantly_${installation.id}`;
  sdr.instantlyWorkspaceId = 'fixture';
  sdr.warmupReady = true;
  sdr.sendingAccounts = [{ email: 'warmup@example.invalid', warmupReady: true, health: 'fixture' }];
  sdr.status = 'sending';
  sdr.lastError = null;
  installation.lastBusinessActionAt = state.asOf;
  installation.status = 'monitoring';
  const proof = evidence(state, 'Instantly fixture campaign', 'fixture instantly', sdr.campaignId);
  for (const lead of sdr.leads.filter(item => item.status === 'imported' || item.status === 'queued')) {
    lead.status = 'sent';
    lead.lastEventAt = state.asOf;
    const opportunityId = lead.opportunityId;
    if (!opportunityId) continue;
    state.timeline.push({
      id: nextId(state, 'timeline'),
      workspaceId: state.workspace.id,
      opportunityId,
      at: state.asOf,
      kind: 'email_out',
      title: `${lead.firstName || lead.email} · outbound sequence`,
      detail: sdr.sequence[0]?.body ?? 'Sequence enrolled on the Instantly fixture.',
      actor: 'david',
      evidence: [proof],
    });
  }
  audit(state, 'outbound.started', sdr.campaignId);
  return 'Sequence enrolled on the Instantly fixture. No live mailbox send.';
}

export function pauseOutboundSdr(state: EngineState) {
  const sdr = ensureOutboundSdr(state);
  sdr.status = 'paused';
  const installation = state.installations.find(item => item.agentId === 'outbound-email-sdr');
  if (installation) installation.status = 'paused';
  audit(state, 'outbound.paused', sdr.campaignId ?? 'no-campaign');
  return 'Outbound Email SDR paused. Instantly will not start new sends.';
}

export function applyOutboundEvent(state: EngineState, input: unknown) {
  const event = OutboundEvent.parse(input);
  const key = `outbound:${event.providerEventId}`;
  if (state.seenEvents.includes(key)) return 'Duplicate Instantly event ignored.';
  state.seenEvents.push(key);
  const sdr = ensureOutboundSdr(state);
  const lead = sdr.leads.find(item => item.email === event.email);
  if (!lead) return 'Instantly event did not match an enrolled outbound lead.';
  const contact = state.contacts.find(item => item.email === lead.email);
  const occurredAt = event.occurredAt ?? state.asOf;
  lead.lastEventAt = occurredAt;
  if (event.eventType === 'email_sent' && lead.status === 'imported') lead.status = 'sent';
  if (event.eventType === 'reply_received' || event.eventType === 'auto_reply_received') {
    lead.status = 'replied';
    lead.lastReply = event.text ?? lead.lastReply;
    if (contact) contact.lastContactAt = occurredAt;
  }
  if (event.eventType === 'email_bounced') {
    lead.status = 'bounced';
    if (contact) contact.suppressed = true;
  }
  if (event.eventType === 'lead_unsubscribed') {
    lead.status = 'unsubscribed';
    if (contact) contact.suppressed = true;
  }
  if (event.eventType === 'lead_meeting_booked') lead.status = 'booked';
  const opportunityId = lead.opportunityId;
  if (opportunityId) {
    const kind = event.eventType === 'lead_meeting_booked' ? 'meeting_booked' : event.eventType === 'email_sent' ? 'email_out' : event.eventType === 'email_bounced' || event.eventType === 'lead_unsubscribed' ? 'email_in' : 'email_in';
    const proof = evidence(state, `Instantly ${event.eventType}`, 'instantly webhook', event.providerEventId);
    state.timeline.push({
      id: nextId(state, 'timeline'),
      workspaceId: state.workspace.id,
      opportunityId,
      at: occurredAt,
      kind,
      title: `${lead.firstName || lead.email} · ${event.eventType.replaceAll('_', ' ')}`,
      detail: event.text ?? event.eventType,
      actor: event.eventType === 'email_sent' ? 'david' : 'source',
      evidence: [proof],
    });
    const opportunity = state.opportunities.find(item => item.id === opportunityId);
    if (event.eventType === 'reply_received' && opportunity && !state.outcomes.some(item => item.opportunityId === opportunityId && item.stage === 'reply')) {
      state.outcomes.push({
        id: nextId(state, 'outcome'),
        workspaceId: state.workspace.id,
        opportunityId,
        metric: 'human_replies',
        metricVersion: 1,
        stage: 'reply',
        source: 'instantly webhook',
        periodStart: occurredAt,
        periodEnd: occurredAt,
        value: 1,
        valueType: 'count',
        currency: null,
        quality: state.workspace.mode === 'fixture' ? 'fixture' : 'provider_verified',
        evidence: [proof],
      });
    }
    if (event.eventType === 'lead_meeting_booked' && opportunity && !state.outcomes.some(item => item.opportunityId === opportunityId && item.stage === 'booked')) {
      state.outcomes.push({
        id: nextId(state, 'outcome'),
        workspaceId: state.workspace.id,
        opportunityId,
        metric: 'verified_bookings',
        metricVersion: 1,
        stage: 'booked',
        source: 'instantly webhook',
        periodStart: occurredAt,
        periodEnd: occurredAt,
        value: 1,
        valueType: 'count',
        currency: null,
        quality: state.workspace.mode === 'fixture' ? 'fixture' : 'provider_verified',
        evidence: [proof],
      });
    }
  }
  audit(state, 'outbound.event', `${event.eventType}:${lead.email}`);
  return `Recorded ${event.eventType} for ${lead.email}.`;
}
