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

function clipSubject(value: string, max = 60) {
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) return 'quick thought';
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function topicPhrase(company: WebsiteContext) {
  return (company.offers[0] ?? '').replace(/\s+/g, ' ').trim().replace(/[.;]+$/, '');
}

function audiencePhrase(company: WebsiteContext) {
  const joined = company.customerTypes.map(item => item.trim()).filter(item => item && !['your team', 'your customers', 'your offer'].includes(item.toLowerCase())).join(', ');
  if (!joined) return 'teams like yours';
  return joined.length > 40 ? 'teams like yours' : joined;
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function sequenceFrame(topic: string, who: string) {
  const text = topic.toLowerCase();
  if (/\b(audit|review|assessment|seo|search)\b/.test(text)) {
    return {
      subjects: ['after the deck', 'who owns the next 30 days', 'last note from me'],
      observation: `When ${topic} wraps, the findings are usually fine. The next 30 days are not. Nobody is named to change anything.`,
      angle: `If ${topic} already happened, who owns the first change that comes out of it?`,
    };
  }
  if (/\b(implement|implementation|onboard|rollout|adop|deploy)\b/.test(text)) {
    return {
      subjects: ['after the first tool', 'one decision owner', 'last note from me'],
      observation: `${topic} usually looks busy and still has no owner for what happens after the first tool is live.`,
      angle: `Who can approve ${topic} this quarter without turning it into a committee?`,
    };
  }
  if (/\b(recruit|hiring|hire|staff|talent)\b/.test(text)) {
    return {
      subjects: ['whose calendar', 'one hiring owner', 'last note from me'],
      observation: `${topic} slips when the role is everyone's job and nobody owns the calendar.`,
      angle: `Who can actually open a req for ${topic} this quarter?`,
    };
  }
  return {
    subjects: [clipSubject(topic), 'who can decide', 'last note from me'],
    observation: `${topic} for ${who} usually dies when three people are involved and nobody is accountable for the next step.`,
    angle: `Who can say yes or no to ${topic} this quarter?`,
  };
}

export function generateOutboundSequence(company: WebsiteContext, bookingUrl: string): OutboundSequenceStep[] {
  if (!company.confirmed) throw new DomainError('COMPANY_UNCONFIRMED', 'Confirm company facts before writing outbound copy.');
  const booking = bookingUrlInfo(bookingUrl);
  if (!booking.ok) throw new DomainError('BOOKING_URL_REQUIRED', booking.message);
  const topicFull = topicPhrase(company);
  if (!topicFull) throw new DomainError('SEQUENCE_TOPIC_REQUIRED', 'Say what these emails should be about.');
  const topic = topicFull.length > 80 ? `${topicFull.slice(0, 79).trimEnd()}…` : topicFull;
  const first = '{{firstName}}';
  const who = audiencePhrase(company);
  const sender = company.companyName.trim();
  const link = bookingUrl.trim();
  const frame = sequenceFrame(topic, who);
  const opener = `${first} —\n\n${frame.observation}\n\nIf that sits with you this quarter, here is 15 minutes:\n${link}\n\nIf I have the wrong person, reply and I will stop.\n\n${sender}`;
  const bump = `${first} —\n\nDifferent note than the last one.\n\n${frame.angle}\n\nIf that is you:\n${link}`;
  const close = `${first} —\n\nLast note from me on ${topic}. I will not follow up again.\n\nIf the timing is wrong, ignore this. If a conversation would help:\n${link}`;
  const sequence = [
    { subject: clipSubject(frame.subjects[0]), body: opener },
    { subject: clipSubject(frame.subjects[1]), body: bump },
    { subject: clipSubject(frame.subjects[2]), body: close },
  ];
  for (const step of sequence) {
    if (wordCount(step.body) > 120) throw new DomainError('SEQUENCE_TOO_LONG', 'Cold emails stay under 120 words.');
  }
  return sequence;
}

export function isStencilSequence(sequence: OutboundSequenceStep[]) {
  const text = sequence.map(step => `${step.subject} ${step.body}`).join('\n');
  return /stalls after the first pass|When .+ has three owners, nothing ships|should I close this out\?|helps .+ with|Book a conversation|Quick question for|Different note than the last one|usually looks busy and still has no owner|If that sits with you this quarter, here is 15 minutes/i.test(text);
}

export function repairColdSequence(sequence: OutboundSequenceStep[], company: WebsiteContext, bookingUrl: string): OutboundSequenceStep[] {
  const link = bookingUrl.trim();
  const topic = topicPhrase(company);
  const topicWords = topic.toLowerCase().split(/\s+/).filter(word => word.length >= 4);
  return sequence.slice(0, 3).map((step, index) => {
    let subject = clipSubject(step.subject.replace(/\{\{[\s\S]*?\}\}/g, ' ').replace(/^re:\s*/i, ' '));
    let body = step.body.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').replace(/\r/g, '').trim();
    body = body.replace(/\{\{\s*firstName\s*\}\}/gi, '{{firstName}}');
    body = body.replace(/\{\{(?!firstName\}\})[^}]+\}\}/g, '').trim();
    body = body.replace(/^hi\s+\{\{firstName\}\}[,.\s—-]*/i, '{{firstName}} —\n\n');
    if (!/^\{\{firstName\}\}/.test(body)) body = `{{firstName}} —\n\n${body}`;
    if (index === 0 && topicWords.length && !topicWords.some(word => `${subject} ${body}`.toLowerCase().includes(word))) {
      body = body.replace(/^\{\{firstName\}\}\s*—\s*/, `{{firstName}} —\n\nOn ${topic}: `);
    }
    if (!body.includes(link) && link) body = `${body.replace(/\s+$/, '')}\n\n${link}`;
    const words = body.trim().split(/\s+/);
    if (words.length > 150) {
      const kept = words.slice(0, 148).join(' ');
      body = kept.includes(link) ? kept : `${kept}\n\n${link}`;
    }
    body = body.replace(/\n{3,}/g, '\n\n').trim();
    return { subject, body };
  });
}

export type ColdSequenceFacts = {
  topic: string;
  audience: string;
  companyName: string;
  bookingUrl: string;
  brandGuidance: string;
  forbiddenClaims: string;
  brief: string;
};

export type ColdSequenceModelPort = {
  draftColdSequence(facts: ColdSequenceFacts): Promise<OutboundSequenceStep[]>;
};

export function coldSequenceFacts(company: WebsiteContext, bookingUrl: string): ColdSequenceFacts {
  const topic = topicPhrase(company);
  if (!topic) throw new DomainError('SEQUENCE_TOPIC_REQUIRED', 'Say what these emails should be about.');
  return {
    topic,
    audience: audiencePhrase(company),
    companyName: company.companyName.trim(),
    bookingUrl: bookingUrl.trim(),
    brandGuidance: company.operatingGuidance?.brand?.trim() ?? '',
    forbiddenClaims: company.operatingGuidance?.forbiddenClaims?.trim() ?? '',
    brief: `Write like a sharp SDR, not a sequence tool. Specific to "${topic}" for ${audiencePhrase(company)}. Do not reuse "usually stalls after the first pass" or "three owners, nothing ships".`,
  };
}

const BANNED_COLD = /just checking in|checking whether|circling back|touching base|hope this finds you|just following up|book a conversation|friendly reminder|quick question|helps .+ with|stay inside approved brand|do not claim:|bumping this/i;
const INVENTED_PROOF = /\$\d|\d+%|\b\d{2,}\s*x\b|case study|guaranteed|our clients? (saw|grew|increased)/i;

export function acceptColdSequence(sequence: OutboundSequenceStep[], company: WebsiteContext, bookingUrl: string): OutboundSequenceStep[] {
  const facts = coldSequenceFacts(company, bookingUrl);
  if (sequence.length !== 3) throw new DomainError('SEQUENCE_INVALID', 'Cold sequences are exactly three emails.');
  const subjects = new Set(sequence.map(step => step.subject.trim().toLowerCase()));
  if (subjects.size !== 3) throw new DomainError('SEQUENCE_INVALID', 'Each email needs a different subject.');
  const topicWords = facts.topic.toLowerCase().split(/\s+/).filter(word => word.length >= 4);
  const firstText = `${sequence[0].subject} ${sequence[0].body}`.toLowerCase();
  if (topicWords.length && !topicWords.some(word => firstText.includes(word))) throw new DomainError('SEQUENCE_INVALID', 'The first email has to be about the topic you gave.');
  for (const step of sequence) {
    if (/\{\{/.test(step.subject) || /^re:/i.test(step.subject)) throw new DomainError('SEQUENCE_INVALID', 'Subjects cannot use merge tags or Re:');
    if (!/^\{\{firstName\}\}/.test(step.body.trim())) throw new DomainError('SEQUENCE_INVALID', 'Greet with {{firstName}} only.');
    if ((step.body.match(/\{\{/g) ?? []).length !== 1) throw new DomainError('SEQUENCE_INVALID', 'The only Instantly field is {{firstName}} in the greeting.');
    if (!step.body.includes(facts.bookingUrl)) throw new DomainError('SEQUENCE_INVALID', 'Every email must include the meeting link.');
    const words = wordCount(step.body);
    if (words < 12 || words > 160) throw new DomainError('SEQUENCE_INVALID', 'Cold emails stay between 12 and 160 words.');
    if (BANNED_COLD.test(`${step.subject} ${step.body}`) || INVENTED_PROOF.test(step.body)) throw new DomainError('SEQUENCE_INVALID', 'Cold emails cannot pitch, check in, or invent proof.');
    if (facts.forbiddenClaims && step.body.includes(facts.forbiddenClaims)) throw new DomainError('SEQUENCE_INVALID', 'Forbidden claims cannot appear in sendable copy.');
    if (facts.brandGuidance.length > 24 && step.body.includes(facts.brandGuidance)) throw new DomainError('SEQUENCE_INVALID', 'Brand notes stay internal.');
  }
  return sequence;
}

export async function writeOutboundSequence(company: WebsiteContext, bookingUrl: string, model?: ColdSequenceModelPort, options?: { requireModel?: boolean }): Promise<{ sequence: OutboundSequenceStep[]; source: 'model' | 'fallback' }> {
  const fallback = generateOutboundSequence(company, bookingUrl);
  if (options?.requireModel && !model) throw new DomainError('MODEL_ACCESS_MISSING', 'DAVID cannot draft these emails until the model is configured.');
  if (!model) return { sequence: fallback, source: 'fallback' };
  const facts = coldSequenceFacts(company, bookingUrl);
  try {
    const drafted = acceptColdSequence(repairColdSequence(await model.draftColdSequence(facts), company, bookingUrl), company, bookingUrl);
    if (isStencilSequence(drafted)) throw new DomainError('SEQUENCE_INVALID', 'The draft reused the template. Write a new sequence.');
    return { sequence: drafted, source: 'model' };
  } catch (error) {
    if (options?.requireModel) throw coldSequenceDraftError(error);
    return { sequence: fallback, source: 'fallback' };
  }
}

export function coldSequenceDraftError(error: unknown) {
  if (error instanceof DomainError) return error;
  const text = error instanceof Error ? `${error.message} ${error.cause instanceof Error ? error.cause.message : ''}` : '';
  if (/auth|oidc|api key|401|403|GatewayAuthentication|No authentication/i.test(text)) {
    return new DomainError('MODEL_ACCESS_MISSING', 'The hosted model is not connected on this app. DAVID cannot draft until Vercel AI Gateway can sign in.');
  }
  if (/timeout|aborted|AbortError/i.test(text)) return new DomainError('SEQUENCE_DRAFT_FAILED', 'The model ran out of time. Try again.');
  if (/not 3 emails/i.test(text)) return new DomainError('SEQUENCE_DRAFT_FAILED', 'The model returned copy DAVID could not use. Try again.');
  return new DomainError('SEQUENCE_DRAFT_FAILED', 'DAVID could not finish these emails. Try again.');
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
  return 'Three cold emails: a short opener, one ownership question, then a close. Instantly will send them; no copy-out to another mail tool.';
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
