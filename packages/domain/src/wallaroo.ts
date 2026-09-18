import { catalog, recommendationFor, prepareFromContext, ALWAYS_ON_AGENT_ID, type WebsiteContext } from '../../agents/src/index';
import { emptyOnboarding, type OnboardingRecord } from '../../contracts/src/index';
import { OutboundLead, OutboundSdrState } from '../../contracts/src/outbound';
import { TechnicalSeoState } from '../../contracts/src/technical-seo';
import { generateOutboundSequence } from './outbound-sdr';
import { saveAgentOnboarding } from './agent-onboarding';
import { evidence, nextId, stableId, type EngineState } from './state';

/** Brandon’s five from the call. Website Sales Concierge is included separately and does not use a slot. */
export const WALLAROO_SELECTED_TEAM = [
  'technical-seo-monitor',
  'linkedin-outreach-assistant',
  'partner-development',
  'outbound-email-sdr',
  'rfp-opportunity-scout',
] as const;

export const WALLAROO_GOAL = 'Grow Shopify brand demand through paid media, email, SEO, partnerships and outbound';

const CAPTURED_AT = '2026-09-10T16:00:00.000Z';

/** Public wallaroomedia.com pages that exist. /services/ads/ returned 404 and is omitted. */
export const WALLAROO_PAGES: WebsiteContext['pages'] = [
  {
    url: 'https://wallaroomedia.com/',
    title: 'The AI-Native Ecommerce Growth Agency | Wallaroo Media',
    description: 'The AI-native agency for ecommerce. Senior strategists run paid, email, and SEO for Shopify brands.',
    text: [
      'The AI-Native Agency for eCommerce.',
      'Senior strategists run your paid, email, and SEO. Custom AI agents trained on your brand accelerate everything.',
      'Trusted partner mentions on this page: Meta Business Partner, Google Partner, Shopify Plus Partner, Klaviyo Partner.',
      'Three services: AI-Powered Ads (Meta, Google, TikTok campaign management); AI-Powered Email & SMS (Klaviyo for Shopify brands); AI-Powered SEO including LLM optimization (LLMO).',
      'Customers: Shopify brands doing $1M–$30M+ in revenue who want senior strategists, not a single-channel Meta vendor.',
      'Headquarters and positioning described on linked About, Ads, Email, and SEO pages.',
    ].join(' '),
    capturedAt: CAPTURED_AT,
  },
  {
    url: 'https://wallaroomedia.com/about',
    title: 'About Wallaroo Media | AI-Native Ecommerce Agency',
    description: 'Wallaroo Media was founded in 2007 in Provo, Utah by Brandon Doyle and Kade Hendershot.',
    text: [
      'Started in Provo. Scaled globally.',
      'Wallaroo Media was founded in 2007 by Brandon Doyle and Kade Hendershot. Justin Doyle serves as CTO and COO.',
      'Headquartered in Provo, Utah. Works with ecommerce brands across the United States and internationally.',
      'Wallaroo is an AI-native ecommerce growth agency for Shopify brands.',
      'Three services: AI-Powered Ads on Meta and Google, AI-Powered Email and SMS through Klaviyo, and AI-Powered SEO including LLM optimization.',
      'Works best with Shopify and Shopify Plus brands doing $1M–$30M+ in annual revenue, across categories like supplements, apparel, beauty, and home goods.',
      'The company says it celebrates revenue, margins, and LTV rather than impressions or follower counts.',
    ].join(' '),
    capturedAt: CAPTURED_AT,
  },
  {
    url: 'https://wallaroomedia.com/ai-powered-ads/',
    title: 'AI-Powered Ads for Shopify Brands | Wallaroo Media',
    description: 'AI-native campaign architecture for Meta and Google. Plans also name TikTok Ads, Shopify, and GA4.',
    text: [
      'Ads built on AI. Not bolted onto it.',
      'This page describes Meta Ads (Facebook and Instagram) and Google Ads (Search, Shopping, Display, YouTube).',
      'It also names TikTok Ads, Shopify, and GA4 as systems the ads service runs on.',
      'Deliverables listed: full account audit, AI creative engine, campaign architecture, weekly performance reports, budget optimization, strategy calls.',
      'Public page copy includes agency retainer tiers from $1,500/mo. Those figures are Wallaroo Media’s published ads retainers, not DAVID pricing or verified client results.',
      'Recommended ad spend on the page is at least $10K–$15K/month for Shopify brands doing $1M–$30M+ in annual revenue.',
    ].join(' '),
    capturedAt: CAPTURED_AT,
  },
  {
    url: 'https://wallaroomedia.com/ai-powered-email/',
    title: 'AI-Powered Email & SMS for Shopify Brands | Wallaroo Media',
    description: 'Klaviyo email and SMS for Shopify brands. Flows, campaigns, segmentation, and creative.',
    text: [
      'Every email an agent. Every flow an architecture.',
      'This page describes Klaviyo email and SMS for Shopify brands, including welcome, abandoned cart, browse abandonment, post-purchase, win-back, and VIP flows.',
      'It names Klaviyo, Shopify, and GA4 as systems the email service runs on.',
      'DAVID does not send email or SMS. Klaviyo SMS is recorded as company inventory only; SMS is not a DAVID product.',
      'Public page copy includes agency retainer tiers from $1,500/mo. Those figures are Wallaroo Media’s published email retainers, not DAVID pricing.',
    ].join(' '),
    capturedAt: CAPTURED_AT,
  },
  {
    url: 'https://wallaroomedia.com/ai-powered-seo/',
    title: 'AI-Powered SEO for Shopify Brands | Wallaroo Media',
    description: 'Technical SEO, content, and LLM optimization so brands stay discoverable in search and AI answers.',
    text: [
      'Own page one. And the AI answer.',
      'This page describes technical SEO (site speed, crawlability, indexation, schema, internal linking), content strategy, and off-page / link building.',
      'LLM optimization (LLMO) is described so AI systems such as ChatGPT, Perplexity, and AI shopping agents can recommend the brand.',
      'It names Google Search Console, GA4, Shopify, and AI search surfaces as related systems.',
      'Public page copy includes agency retainer tiers from $1,500/mo. Those figures are Wallaroo Media’s published SEO retainers, not DAVID pricing or ranking claims.',
    ].join(' '),
    capturedAt: CAPTURED_AT,
  },
];

function wallarooCompany(): WebsiteContext {
  return {
    companyName: 'Wallaroo Media',
    confirmed: true,
    offers: [
      'AI-Powered Ads',
      'AI-Powered Email and SMS',
      'AI-Powered SEO including LLM optimization (LLMO)',
    ],
    customerTypes: [
      'Shopify and Shopify Plus brands, typically $1M–$30M+ revenue',
    ],
    locations: ['Provo, Utah'],
    pages: WALLAROO_PAGES.map(page => ({ ...page })),
    evidence: [],
    fixture: true,
    operatingGuidance: {
      brand: 'AI-native ecommerce growth agency. Senior strategists run paid, email, and SEO for Shopify brands. Built on AI, not bolted on.',
      forbiddenClaims: 'Do not claim live Meta, Google Ads, Klaviyo, Shopify, LinkedIn, or SMS access. Named pipeline, drafts, and outcomes are labeled illustrative fixture records. Public retainer prices on wallaroomedia.com are Wallaroo’s agency fees, not DAVID pricing.',
      objective: WALLAROO_GOAL,
      desiredAction: 'Book 30 minutes with a senior strategist about the brand’s AI opportunity.',
    },
  };
}

function wallarooOnboarding(state: EngineState): OnboardingRecord {
  const base = emptyOnboarding(state.workspace, state.asOf);
  const owner = 'Workspace owner';
  return {
    ...base,
    revision: 1,
    configurationRevision: 1,
    configurationUpdatedAt: state.asOf,
    updatedAt: state.asOf,
    updatedBy: state.context.actorId,
    history: [{ revision: 1, at: state.asOf, actor: state.context.actorId, summary: 'Wallaroo Media illustrative fixture seeded from public wallaroomedia.com pages. No live account was connected.' }],
    answers: {
      ...base.answers,
      company: {
        name: 'Wallaroo Media',
        website: 'https://wallaroomedia.com/',
        businessModel: 'b2b_services',
        timeZone: 'America/Denver',
        offers: [
          'AI-Powered Ads',
          'AI-Powered Email and SMS',
          'AI-Powered SEO including LLM optimization (LLMO)',
        ],
        customers: ['Shopify and Shopify Plus brands, typically $1M–$30M+ revenue'],
        priorities: [WALLAROO_GOAL, 'Klaviyo email and SMS programs', 'Technical SEO and LLM optimization'],
        successDefinition: 'Revenue, margins, and LTV for Shopify brands. Impressions and follower counts are not the measure.',
        brandGuidance: 'AI-native ecommerce growth agency. Senior strategists run paid, email, and SEO. Partners, not vendors.',
        forbiddenClaims: 'No live Meta, Google Ads, Klaviyo, Shopify, LinkedIn, or SMS grants. Pipeline, drafts, and outcomes are labeled illustrative fixture records.',
      },
      team: [...WALLAROO_SELECTED_TEAM],
      systems: [
        { id: 'wallaroo-website', kind: 'website', tool: 'Company website', availability: 'available', resource: 'https://wallaroomedia.com/', owner, mapping: 'Public pages captured for this workspace. No live CMS write.', connectionId: '' },
        { id: 'wallaroo-ads', kind: 'advertising', tool: 'Meta, Google, TikTok', availability: 'available', resource: 'Wallaroo Media · Meta and Google Ads', owner, mapping: 'Ads accounts available to this workspace. External campaign changes stay in your ad tools.', connectionId: '' },
        { id: 'wallaroo-social', kind: 'social', tool: 'LinkedIn / Meta', availability: 'available', resource: 'Wallaroo Media · LinkedIn', owner, mapping: 'LinkedIn available for drafts. Sending stays in LinkedIn.', connectionId: '' },
        { id: 'wallaroo-commerce', kind: 'commerce', tool: 'Shopify Plus Partner', availability: 'available', resource: 'Shopify Plus Partner directory', owner, mapping: 'Shopify Plus Partner context for this workspace.', connectionId: '' },
        { id: 'wallaroo-mail', kind: 'mail', tool: 'Klaviyo', availability: 'available', resource: 'Wallaroo Media · Klaviyo', owner, mapping: 'Klaviyo available for drafts. Sending stays in Klaviyo. SMS is not a DAVID product.', connectionId: '' },
        { id: 'wallaroo-analytics', kind: 'analytics', tool: 'GA4', availability: 'available', resource: 'Wallaroo Media · GA4', owner, mapping: 'GA4 listed for this workspace.', connectionId: '' },
        { id: 'wallaroo-proposals', kind: 'proposals', tool: 'Proposals & customer records', availability: 'available', resource: 'Shopify-brand pipeline', owner, mapping: 'Records named from public case-study brands on wallaroomedia.com.', connectionId: '' },
        { id: 'wallaroo-drive', kind: 'drive', tool: 'Files & knowledge', availability: 'available', resource: 'Company files for partner and RFP roles', owner, mapping: 'Company files listed for partner and RFP work.', connectionId: '' },
        { id: 'wallaroo-rfp', kind: 'rfp', tool: 'RFP sources', availability: 'available', resource: 'RFP watchlist', owner, mapping: 'Watchlist for this workspace. No bid was filed.', connectionId: '' },
      ],
      people: [{ email: 'owner@example.invalid', name: owner, responsibility: 'owner', role: 'workspace_owner' }],
    },
  };
}

function addArtifact(state: EngineState, agentId: string, title: string, type: string, content: string, limitation: string, createdAt = state.asOf) {
  state.artifacts.push({
    id: stableId(`${state.fixtureKey}:artifact:${agentId}:${title}`),
    workspaceId: state.workspace.id,
    agentId,
    type,
    title,
    content,
    factualInputs: [`Company: ${state.company.companyName}`, ...state.company.offers.map(offer => `Approved offer: ${offer}`)],
    sourceSnapshot: state.company.evidence,
    reviewState: 'draft',
    capabilityVersion: '1.0.0',
    runId: stableId(`${state.fixtureKey}:artifact-run:${agentId}:${title}`),
    createdAt,
    limitation,
  });
}

function addFinding(state: EngineState, agentId: string, title: string, condition: string, hypothesis: string, target: string, affectedIds: string[], at = state.asOf, assignments: string[] = []) {
  const id = stableId(`${state.fixtureKey}:finding:${agentId}:${title}`);
  const baseline = 'Before this overnight pass, this specialist had no recorded customer movement in the log.';
  state.findings.push({
    id,
    workspaceId: state.workspace.id,
    title,
    affectedIds,
    observedCondition: condition,
    evidence: state.company.evidence,
    hypothesis,
    agentId,
    effortMinutes: 15,
    costMinor: null,
    owner: 'Workspace owner',
    evaluationRule: `fixture.v1/${agentId}: labeled walkthrough work. Not a live outcome.`,
    status: 'approved',
    alternatives: ['Could have held the pass for a person', 'Could have left the log empty overnight'],
    baseline,
    target,
    reviewAt: new Date(Date.parse(at) + 7 * 86400000).toISOString(),
  });
  state.initiatives.push({
    id: stableId(`${state.fixtureKey}:initiative:${agentId}:${title}`),
    workspaceId: state.workspace.id,
    findingId: id,
    title,
    owner: 'Workspace owner',
    baseline,
    target,
    reviewAt: new Date(Date.parse(at) + 7 * 86400000).toISOString(),
    status: 'supported',
    assignments: assignments.length ? assignments : [target],
  });
}

const BOOKING_CTA = 'Book 30 minutes with a senior strategist: https://wallaroomedia.com/';

function addMessage(state: EngineState, opportunityId: string, at: string, kind: string, actor: 'david' | 'human', title: string, body: string) {
  const source = state.proposals.find(item => item.opportunityId === opportunityId)?.evidence ?? [];
  state.timeline.push({
    id: stableId(`${state.fixtureKey}:message:${kind}:${title}:${at}`),
    workspaceId: state.workspace.id,
    opportunityId,
    at,
    kind,
    title,
    detail: body,
    actor,
    evidence: source,
  });
}

function addLoggedAction(
  state: EngineState,
  input: {
    key: string;
    agentId: string;
    contactId: string;
    proposalId: string;
    type: 'send_follow_up' | 'book_appointment';
    at: string;
    subject: string;
    body: string;
    startAt?: string;
  },
) {
  const actionId = stableId(`${state.fixtureKey}:action:${input.key}`);
  const approvalId = stableId(`${state.fixtureKey}:approval:${input.key}`);
  const contact = state.contacts.find(item => item.id === input.contactId)!;
  const proposal = state.proposals.find(item => item.id === input.proposalId)!;
  const installation = state.installations.find(item => item.agentId === input.agentId)!;
  state.actions.push({
    schemaVersion: 1,
    id: actionId,
    workspaceId: state.workspace.id,
    installationId: installation.id,
    runId: stableId(`${state.fixtureKey}:run:${input.key}`),
    contactId: input.contactId,
    proposalId: input.proposalId,
    type: input.type,
    payload: {
      recipient: contact.email,
      subject: input.subject,
      body: input.body,
      proposalVersion: proposal.version,
      ...(input.startAt
        ? {
            calendarId: 'fixture-calendar-primary',
            startAt: input.startAt,
            endAt: new Date(Date.parse(input.startAt) + 30 * 60000).toISOString(),
            timeZone: state.workspace.timeZone,
          }
        : {}),
    },
    payloadHash: 'fixture-walkthrough',
    evidence: proposal.evidence,
    approvalId,
    reservedCostMinor: 1,
    status: 'confirmed',
    createdAt: input.at,
    expiresAt: '2026-09-11T16:00:00.000Z',
  });
  state.approvals.push({
    id: approvalId,
    workspaceId: state.workspace.id,
    actionId,
    status: 'approved',
    payloadHash: 'fixture-walkthrough',
    approverId: state.context.actorId,
    decidedAt: input.at,
    expiresAt: '2026-09-11T16:00:00.000Z',
  });
  state.receipts.push({
    id: stableId(`${state.fixtureKey}:receipt:${input.key}`),
    workspaceId: state.workspace.id,
    actionId,
    status: 'confirmed',
    provider: 'fixture',
    providerId: `fixture-log:${input.key}`,
    message: 'Recorded in the workspace log. No live send.',
    reconciliation: 'resolved',
    observedAt: input.at,
    evidence: proposal.evidence,
  });
}
export function applyWallarooFixture(state: EngineState): void {
  const now = state.asOf;
  const earlier = '2026-09-09T16:00:00.000Z';
  const night = {
    concierge: '2026-09-10T03:40:00.000Z',
    seoCheck: '2026-09-10T04:14:00.000Z',
    seoFixes: '2026-09-10T05:02:00.000Z',
    statelyChat: '2026-09-10T04:22:00.000Z',
    statelyReply: '2026-09-10T04:36:00.000Z',
    statelyBook: '2026-09-10T04:48:00.000Z',
    linkedinConnect: '2026-09-10T06:20:00.000Z',
    linkedinFollow: '2026-09-10T06:41:00.000Z',
    linkedinNotes: '2026-09-10T07:18:00.000Z',
    kajaAccept: '2026-09-10T07:44:00.000Z',
    kajaThread: '2026-09-10T08:02:00.000Z',
    partnerList: '2026-09-10T08:05:00.000Z',
    partnerIntro: '2026-09-10T08:47:00.000Z',
    rfpWatch: '2026-09-10T10:18:00.000Z',
    rfpOutline: '2026-09-10T11:02:00.000Z',
    sdrSeq: '2026-09-10T11:51:00.000Z',
    sdrDraft: '2026-09-10T12:20:00.000Z',
    firstTouch: '2026-09-10T12:28:00.000Z',
    reply: '2026-09-10T13:12:00.000Z',
    qualify: '2026-09-10T13:40:00.000Z',
    book: '2026-09-10T14:05:00.000Z',
  };
  const workspaceId = state.workspace.id;
  const team = [...WALLAROO_SELECTED_TEAM];
  state.workspace.name = 'Wallaroo Media';
  state.workspace.businessModel = 'b2b_services';
  state.workspace.timeZone = 'America/Denver';
  state.company = wallarooCompany();
  state.company.evidence = [evidence(state, 'Public wallaroomedia.com pages captured for this workspace', 'company website')];
  state.contacts = [];
  state.opportunities = [];
  state.proposals = [];
  state.timeline = [];
  state.findings = [];
  state.artifacts = [];
  state.outcomes = [];
  state.actions = [];
  state.approvals = [];
  state.receipts = [];
  state.scenarios = [];
  state.initiatives = [];
  state.usage = [];
  const accounts: [string, string, string, EngineState['proposals'][number]['status'], number][] = [
    ['P-2001', 'Riley Chen', 'Called to Surf', 'open', 800000],
    ['P-2002', 'Avery Patel', 'Kaja Beauty', 'open', 500000],
    ['P-2003', 'Morgan Hale', 'MaxPro', 'accepted', 1500000],
    ['P-2004', 'Jordan Ellis', 'Bullstrap', 'open', 300000],
    ['P-2005', 'Casey Nguyen', 'Stately', 'on_hold', 450000],
    ['P-2006', 'Sam Brooks', 'Jantzen', 'accepted', 900000],
  ];
  accounts.forEach(([reference, name, account, status, amount], index) => {
    const contactId = stableId(`${state.fixtureKey}:contact:${reference}`);
    const opportunityId = stableId(`${state.fixtureKey}:opportunity:${reference}`);
    const proposalId = stableId(`${state.fixtureKey}:proposal:${reference}`);
    const source = evidence(state, `${account} pipeline record`, 'company pipeline', reference);
    state.contacts.push({ id: contactId, workspaceId, name, email: `sample-${index + 1}@example.invalid`, account, suppressed: false, enrolled: true, humanTakeover: reference === 'P-2003', owner: 'Workspace owner', lastContactAt: status === 'accepted' || status === 'on_hold' ? earlier : null });
    state.opportunities.push({ schemaVersion: 1, id: opportunityId, workspaceId, contactId, accountId: stableId(`${state.fixtureKey}:account:${account}`), businessModel: 'b2b_services', owner: 'Workspace owner', stage: status === 'accepted' ? 'won' : status === 'on_hold' ? 'qualified' : 'proposal', rawStage: status, evidence: [source] });
    state.proposals.push({ schemaVersion: 1, id: proposalId, workspaceId, opportunityId, contactId, version: 1, reference, issuedAt: '2026-09-01T16:00:00.000Z', validUntil: '2026-10-10T16:00:00.000Z', amountMinor: amount, currency: 'USD', valueKind: 'monthly_recurring', scopeSummary: `${account} conversation for Wallaroo’s paid, email, or SEO offer. Named from public case-study brands on wallaroomedia.com.`, sourceUrl: null, status, rawStatus: status, owner: 'Workspace owner', sourceVerifiedAt: now, syncedAt: now, evidence: [source], fixture: true });
    state.timeline.push({ id: stableId(`${state.fixtureKey}:timeline:${reference}`), workspaceId, opportunityId, at: now, kind: 'source', title: `${account} record imported`, detail: 'Pipeline record imported from company sources.', actor: 'source', evidence: [source] });
  });
  const replyProof = evidence(state, 'Human reply', 'recorded conversation', 'wallaroo-reply');
  const bookProof = evidence(state, 'Confirmed booking', 'recorded calendar', 'wallaroo-book');
  const attendProof = evidence(state, 'Meeting attended', 'recorded calendar', 'wallaroo-attend');
  const signedProof = evidence(state, 'Signed terms', 'recorded confirmation', 'wallaroo-signed');
  const won = state.proposals.find(item => item.reference === 'P-2003')!;
  const booked = state.proposals.find(item => item.reference === 'P-2006')!;
  const replied = state.proposals.find(item => item.reference === 'P-2001')!;
  const kaja = state.proposals.find(item => item.reference === 'P-2002')!;
  const bullstrap = state.proposals.find(item => item.reference === 'P-2004')!;
  const stately = state.proposals.find(item => item.reference === 'P-2005')!;
  const calledContact = state.contacts.find(item => item.id === replied.contactId)!;
  const kajaContact = state.contacts.find(item => item.id === kaja.contactId)!;
  const statelyContact = state.contacts.find(item => item.id === stately.contactId)!;
  const jantzenContact = state.contacts.find(item => item.id === booked.contactId)!;
  calledContact.lastContactAt = night.reply;
  kajaContact.lastContactAt = night.kajaThread;
  statelyContact.lastContactAt = night.statelyBook;
  jantzenContact.lastContactAt = '2026-09-09T19:40:00.000Z';
  state.outcomes.push(
    { id: stableId(`${state.fixtureKey}:outcome:reply-1`), workspaceId, opportunityId: replied.opportunityId, metric: 'human_replies', metricVersion: 1, stage: 'reply', source: 'recorded conversation', periodStart: earlier, periodEnd: night.reply, value: 1, valueType: 'count', currency: null, quality: 'fixture', evidence: [replyProof] },
    { id: stableId(`${state.fixtureKey}:outcome:reply-2`), workspaceId, opportunityId: booked.opportunityId, metric: 'human_replies', metricVersion: 1, stage: 'reply', source: 'recorded conversation', periodStart: earlier, periodEnd: earlier, value: 1, valueType: 'count', currency: null, quality: 'fixture', evidence: [replyProof] },
    { id: stableId(`${state.fixtureKey}:outcome:reply-3`), workspaceId, opportunityId: won.opportunityId, metric: 'human_replies', metricVersion: 1, stage: 'reply', source: 'recorded conversation', periodStart: earlier, periodEnd: earlier, value: 1, valueType: 'count', currency: null, quality: 'fixture', evidence: [replyProof] },
    { id: stableId(`${state.fixtureKey}:outcome:reply-4`), workspaceId, opportunityId: kaja.opportunityId, metric: 'human_replies', metricVersion: 1, stage: 'reply', source: 'recorded conversation', periodStart: night.kajaThread, periodEnd: night.kajaThread, value: 1, valueType: 'count', currency: null, quality: 'fixture', evidence: [replyProof] },
    { id: stableId(`${state.fixtureKey}:outcome:reply-5`), workspaceId, opportunityId: stately.opportunityId, metric: 'human_replies', metricVersion: 1, stage: 'reply', source: 'recorded conversation', periodStart: night.statelyReply, periodEnd: night.statelyReply, value: 1, valueType: 'count', currency: null, quality: 'fixture', evidence: [replyProof] },
    { id: stableId(`${state.fixtureKey}:outcome:book-1`), workspaceId, opportunityId: booked.opportunityId, metric: 'verified_bookings', metricVersion: 1, stage: 'booked', source: 'recorded calendar', periodStart: earlier, periodEnd: earlier, value: 1, valueType: 'count', currency: null, quality: 'fixture', evidence: [bookProof] },
    { id: stableId(`${state.fixtureKey}:outcome:book-2`), workspaceId, opportunityId: replied.opportunityId, metric: 'verified_bookings', metricVersion: 1, stage: 'booked', source: 'recorded calendar', periodStart: night.book, periodEnd: night.book, value: 1, valueType: 'count', currency: null, quality: 'fixture', evidence: [bookProof] },
    { id: stableId(`${state.fixtureKey}:outcome:book-3`), workspaceId, opportunityId: kaja.opportunityId, metric: 'verified_bookings', metricVersion: 1, stage: 'booked', source: 'recorded calendar', periodStart: night.kajaThread, periodEnd: night.kajaThread, value: 1, valueType: 'count', currency: null, quality: 'fixture', evidence: [bookProof] },
    { id: stableId(`${state.fixtureKey}:outcome:book-4`), workspaceId, opportunityId: stately.opportunityId, metric: 'verified_bookings', metricVersion: 1, stage: 'booked', source: 'recorded calendar', periodStart: night.statelyBook, periodEnd: night.statelyBook, value: 1, valueType: 'count', currency: null, quality: 'fixture', evidence: [bookProof] },
    { id: stableId(`${state.fixtureKey}:outcome:attend-1`), workspaceId, opportunityId: booked.opportunityId, metric: 'attended_meetings', metricVersion: 1, stage: 'attended', source: 'recorded calendar', periodStart: earlier, periodEnd: earlier, value: 1, valueType: 'count', currency: null, quality: 'fixture', evidence: [attendProof] },
    { id: stableId(`${state.fixtureKey}:outcome:attend-2`), workspaceId, opportunityId: won.opportunityId, metric: 'attended_meetings', metricVersion: 1, stage: 'attended', source: 'recorded calendar', periodStart: earlier, periodEnd: earlier, value: 1, valueType: 'count', currency: null, quality: 'fixture', evidence: [attendProof] },
    { id: stableId(`${state.fixtureKey}:outcome:signed-1`), workspaceId, opportunityId: won.opportunityId, metric: 'signed_value', metricVersion: 1, stage: 'signed', source: 'recorded confirmation', periodStart: earlier, periodEnd: earlier, value: 1500000, valueType: 'money_minor', currency: 'USD', quality: 'fixture', evidence: [signedProof] },
  );
  state.connections = [
    { id: stableId(`${state.fixtureKey}:connection:website`), workspaceId, provider: 'website', identity: 'wallaroomedia.com', resource: 'Captured company website', scopes: [], operations: ['website.captured'], health: 'fixture', lastSyncAt: now, verifiedAt: now, owner: 'Workspace owner', freshnessSeconds: 86400 },
    { id: stableId(`${state.fixtureKey}:connection:linkedin`), workspaceId, provider: 'fixture', identity: 'Wallaroo Media · LinkedIn', resource: 'Company LinkedIn page', scopes: [], operations: ['social.read', 'social.draft'], health: 'fixture', lastSyncAt: now, verifiedAt: now, owner: 'Workspace owner', freshnessSeconds: 86400 },
    { id: stableId(`${state.fixtureKey}:connection:meta`), workspaceId, provider: 'fixture', identity: 'Wallaroo Media · Meta', resource: 'Meta Business Manager', scopes: [], operations: ['ads.read', 'social.read'], health: 'fixture', lastSyncAt: now, verifiedAt: now, owner: 'Workspace owner', freshnessSeconds: 86400 },
    { id: stableId(`${state.fixtureKey}:connection:google-ads`), workspaceId, provider: 'fixture', identity: 'Wallaroo Media · Google Ads', resource: 'Google Ads account', scopes: [], operations: ['ads.read'], health: 'fixture', lastSyncAt: now, verifiedAt: now, owner: 'Workspace owner', freshnessSeconds: 86400 },
    { id: stableId(`${state.fixtureKey}:connection:klaviyo`), workspaceId, provider: 'fixture', identity: 'Wallaroo Media · Klaviyo', resource: 'Klaviyo email account', scopes: [], operations: ['mail.read', 'mail.draft'], health: 'fixture', lastSyncAt: now, verifiedAt: now, owner: 'Workspace owner', freshnessSeconds: 86400 },
    { id: stableId(`${state.fixtureKey}:connection:instantly`), workspaceId, provider: 'fixture', identity: 'DAVID-managed Instantly (fixture)', resource: 'Instantly campaign', scopes: [], operations: ['instantly.send', 'instantly.warmup', 'instantly.replies'], health: 'fixture', lastSyncAt: now, verifiedAt: now, owner: 'DAVID operator', freshnessSeconds: 86400 },
    { id: stableId(`${state.fixtureKey}:connection:dataforseo`), workspaceId, provider: 'fixture', identity: 'DAVID-managed DataForSEO (fixture)', resource: 'On-Page crawl and Google organic SERP', scopes: [], operations: ['dataforseo.onpage', 'dataforseo.serp'], health: 'fixture', lastSyncAt: now, verifiedAt: now, owner: 'DAVID operator', freshnessSeconds: 86400 },
    { id: stableId(`${state.fixtureKey}:connection:shopify`), workspaceId, provider: 'fixture', identity: 'Shopify Plus Partner', resource: 'Partner directory / client stores', scopes: [], operations: ['commerce.read'], health: 'fixture', lastSyncAt: now, verifiedAt: now, owner: 'Workspace owner', freshnessSeconds: 86400 },
    { id: stableId(`${state.fixtureKey}:connection:ga4`), workspaceId, provider: 'fixture', identity: 'Wallaroo Media · GA4', resource: 'Google Analytics 4', scopes: [], operations: ['analytics.read'], health: 'fixture', lastSyncAt: now, verifiedAt: now, owner: 'Workspace owner', freshnessSeconds: 86400 },
  ];
  const recommendation = recommendationFor(stableId(`${state.fixtureKey}:recommendation`), workspaceId, WALLAROO_GOAL, 'b2b_services');
  recommendation.specialistIds = team;
  recommendation.rationale = Object.fromEntries(team.map(agentId => [agentId, catalog.find(agent => agent.id === agentId)!.responsibility]));
  recommendation.dependencies = [...new Set(team.flatMap(agentId => catalog.find(agent => agent.id === agentId)!.dependencies))];
  state.recommendation = recommendation;
  state.activation.selectedTeam = team;
  state.activation.owner = 'Workspace owner';
  state.activation.milestone = 'preparation_artifact';
  state.installations = [...team, ALWAYS_ON_AGENT_ID].map(agentId => {
    const definition = catalog.find(agent => agent.id === agentId)!;
    return {
      id: stableId(`${state.fixtureKey}:installation:${agentId}`),
      workspaceId,
      agentId,
      definitionVersion: '1.0.0',
      mode: definition.modes[0],
      status: 'monitoring',
      sourceMappings: agentId === 'technical-seo-monitor' || agentId === ALWAYS_ON_AGENT_ID ? ['fixture-website'] : agentId === 'linkedin-outreach-assistant' ? ['fixture-linkedin'] : agentId === 'outbound-email-sdr' ? ['fixture-instantly'] : agentId === 'partner-development' ? ['fixture-mail'] : ['fixture-rfp'],
      policyVersion: 1,
      dailyCapacity: 4,
      lastPreparationAt: null,
      lastBusinessActionAt: null,
      blockers: [],
    };
  });
  for (const agentId of [ALWAYS_ON_AGENT_ID, 'technical-seo-monitor'] as const) {
    const output = prepareFromContext(agentId, state.company);
    state.artifacts.push({
      id: stableId(`${state.fixtureKey}:artifact:${agentId}`),
      workspaceId,
      agentId,
      ...output,
      sourceSnapshot: state.company.evidence,
      reviewState: 'draft',
      capabilityVersion: '1.0.0',
      runId: stableId(`${state.fixtureKey}:artifact-run:${agentId}`),
      createdAt: agentId === 'technical-seo-monitor' ? now : night.concierge,
    });
  }
  addArtifact(state, 'technical-seo-monitor', 'Title and description fixes', 'TechnicalSeoReport', 'Priority fixes from the captured Wallaroo pages:\n1. /ai-powered-email/ — keep the Klaviyo/Shopify offer in the first 160 characters of the description.\n2. /ai-powered-seo/ — title already names SEO and LLMO; keep both terms.\n3. Home — “AI-native agency for eCommerce” is the clearest offer line.\nCopy these into the CMS. DAVID does not write the live site.', 'ILLUSTRATIVE FIXTURE — DataForSEO did not crawl or read Google. Copy-out is complete delivery; not Search Console, not a CMS write.', night.seoFixes);
  addArtifact(state, 'linkedin-outreach-assistant', 'LinkedIn notes for Shopify operators', 'OutreachDraft', `Overnight LinkedIn pass for Shopify operators in the $1M–$30M range.\nConnection requests recorded: 4\nAccepted: 3 — Called to Surf, Kaja Beauty, Bullstrap\nStill open: Stately\nEach accepted thread includes the booking CTA.\n${BOOKING_CTA}`, 'Recorded in the workspace log. LinkedIn sending is not a live OAuth send.', night.linkedinNotes);
  addArtifact(state, 'linkedin-outreach-assistant', 'Follow-up angles after first reply', 'OutreachDraft', `After a connection accepts: one qualification question, then the booking CTA. Do not invent pricing.\n${BOOKING_CTA}`, 'Recorded follow-up pattern. No live LinkedIn send.', night.linkedinFollow);
  addArtifact(state, 'partner-development', 'Partner intro shortlist', 'PartnerBrief', 'Complementary partners Wallaroo can introduce or receive from:\n• Creative studios that already produce Meta/TikTok volume\n• Shopify Plus implementation partners\n• Email/SMS operators who need SEO/LLMO coverage\nFirst intro is already in the log with a Plus-partner studio that wants AI-native ads without building the SEO practice.', 'Internal shortlist plus one recorded intro. No live partner mailbox send.', night.partnerList);
  addArtifact(state, 'partner-development', 'Plus-partner intro draft', 'PartnerIntro', `Subject: Intro · AI-native ads + SEO for a shared Shopify Plus account\nBody: Wallaroo’s public offers are AI-Powered Ads, Email and SMS, and SEO including LLMO. Reciprocal intro with a Plus implementation partner is in the log.\n${BOOKING_CTA}`, 'Recorded in the workspace log. No live partner email.', night.partnerIntro);
  addArtifact(state, 'outbound-email-sdr', 'Outbound sequence · Shopify brands', 'EmailSequence', `Three-step sequence already running in the log for Shopify brands doing $1M–$30M.\n1. Offer clarity — AI-Powered Ads, Email, or SEO.\n2. Qualification — current stack (Meta, Klaviyo, SEO) and who owns it.\n3. ${BOOKING_CTA}\nEach email has one job: get the 30-minute strategist conversation on the calendar.`, 'Sequence recorded in the workspace log. Instantly send is not live in this fixture.', night.sdrSeq);
  addArtifact(state, 'outbound-email-sdr', 'Called to Surf first-touch draft', 'EmailDraft', `To: ${state.contacts[0].email}\nSubject: 30 minutes on paid, email, and SEO for ${state.contacts[0].account}\n\nRiley —\n\nWallaroo runs paid, email, and SEO together for Shopify brands in your range. One strategist conversation covers the stack, not three vendors.\n\n${BOOKING_CTA}\n\nIf that time is not right, reply with two windows this week.`, 'Recorded in the workspace log. Not a live mailbox send.', night.sdrDraft);
  addArtifact(state, 'rfp-opportunity-scout', 'Matching agency RFPs', 'RfpWatchlist', 'Two RFPs that match Wallaroo’s public offers are already outlined:\n1. Shopify Plus brand — paid social + creative velocity (Ads page).\n2. DTC retailer — technical SEO + LLMO (SEO page).\nResponse outlines are in the log. No bid was filed on a live portal.', 'Watchlist and outlines recorded. No live bid filing.', night.rfpWatch);
  addArtifact(state, 'rfp-opportunity-scout', 'SEO + LLMO response outline', 'RfpOutline', `Response outline for the DTC retailer RFP, already in the log.\n1. Technical SEO from the public /ai-powered-seo/ page.\n2. LLMO so AI shopping agents can recommend the brand.\n3. ${BOOKING_CTA}\nDo not invent rankings or awarded work.`, 'Outline recorded. No bid was filed.', night.rfpOutline);
  addArtifact(state, ALWAYS_ON_AGENT_ID, 'Homepage FAQ block', 'FaqDraft', `FAQ the website concierge already used in chat.\nWhat does Wallaroo offer? AI-Powered Ads, Email and SMS, and SEO including LLMO.\nWho is it for? Shopify and Shopify Plus brands, typically $1M–$30M+.\nWhat is the next step? ${BOOKING_CTA}`, 'Concierge answers recorded in the workspace log. Live chat is not deployed on the public site.', '2026-09-10T03:55:00.000Z');
  const openIds = state.proposals.filter(item => item.status === 'open').map(item => item.id);
  addFinding(state, 'technical-seo-monitor', 'Title fixes are already in the log', 'Five public pages were checked overnight. Priority title and description fixes are written to the log.', 'The specialist already finished the pass. A person copies onto the CMS when they want the live site changed.', 'Fixes remain in the log until a person pastes them into the CMS.', openIds.slice(0, 1), night.seoCheck, ['5 pages checked overnight', '3 title and description fixes written to the log']);
  addFinding(state, 'linkedin-outreach-assistant', 'LinkedIn connections already moving', 'Four Shopify-operator connection requests were recorded overnight. Three accepted — Called to Surf, Kaja Beauty, and Bullstrap — and have threads with a booking CTA.', 'The specialist already ran the pass. Accepted connections are in conversation.', 'Keep accepted threads moving toward the 30-minute strategist conversation.', openIds, night.linkedinNotes, ['4 connection requests recorded', '3 accepted overnight', 'Booking CTA on every accepted thread']);
  addFinding(state, 'partner-development', 'Plus-partner intro is already in motion', 'A complementary Plus-partner intro is recorded in the log.', 'The specialist already wrote the intro. A person owns the relationship from here.', 'One intro sitting in the partner log with a booking path for a shared account.', [kaja.id], night.partnerIntro, ['1 Plus-partner intro recorded', 'Booking path included']);
  addFinding(state, 'outbound-email-sdr', 'First-touch sequence is already live in the log', 'The three-step outbound sequence ran overnight with a book-a-meeting CTA on every email.', 'The specialist already wrote the emails into the log. Replies and bookings are on the record.', 'Keep booking CTAs on every outbound email.', [replied.id], night.sdrSeq, ['Emails with a book-a-meeting CTA', 'Replies already on the record', 'Meetings booked from the sequence']);
  addFinding(state, 'rfp-opportunity-scout', 'RFP outlines are already ready', 'Two RFPs matching Ads and SEO pages have response outlines in the log.', 'The specialist already prepared the outlines. A person files if they choose.', 'Outlines stay ready without waiting for another approval cycle.', [bullstrap.id], night.rfpWatch, ['2 matching RFPs outlined', 'Booking CTA in the SEO + LLMO response']);
  addFinding(state, ALWAYS_ON_AGENT_ID, 'Website concierge already booked a conversation', 'An inbound site visitor asked whether Wallaroo runs Klaviyo and SEO together. The concierge answered from the public FAQ and sent the booking CTA.', 'The included website agent already ran the chat. A meeting is on the record.', 'Keep the public booking path as the only next step from site chat.', [stately.id], night.statelyChat, ['Inbound website chat answered', '30-minute strategist conversation booked']);
  addLoggedAction(state, {
    key: 'sdr-called',
    agentId: 'outbound-email-sdr',
    contactId: calledContact.id,
    proposalId: replied.id,
    type: 'send_follow_up',
    at: night.firstTouch,
    subject: `30 minutes on paid, email, and SEO for ${calledContact.account}`,
    body: `Riley — Wallaroo runs paid, email, and SEO together for Shopify brands in your range. ${BOOKING_CTA}`,
  });
  addLoggedAction(state, {
    key: 'book-called',
    agentId: 'outbound-email-sdr',
    contactId: calledContact.id,
    proposalId: replied.id,
    type: 'book_appointment',
    at: night.book,
    subject: `Strategist conversation · ${calledContact.account}`,
    body: `30-minute strategist conversation booked from the email CTA. ${BOOKING_CTA}`,
    startAt: '2026-09-11T16:00:00.000Z',
  });
  addLoggedAction(state, {
    key: 'book-jantzen',
    agentId: 'outbound-email-sdr',
    contactId: jantzenContact.id,
    proposalId: booked.id,
    type: 'book_appointment',
    at: '2026-09-09T19:45:00.000Z',
    subject: `Strategist conversation · ${jantzenContact.account}`,
    body: `30-minute strategist conversation booked from the email CTA. ${BOOKING_CTA}`,
    startAt: '2026-09-10T17:00:00.000Z',
  });
  const actedAt: Record<string, string> = {
    'outbound-email-sdr': night.book,
    'linkedin-outreach-assistant': night.kajaThread,
    [ALWAYS_ON_AGENT_ID]: night.statelyBook,
    'partner-development': night.partnerIntro,
  };
  for (const installation of state.installations) {
    const latest = state.artifacts.filter(item => item.agentId === installation.agentId).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    installation.lastPreparationAt = latest?.createdAt ?? null;
    installation.lastBusinessActionAt = actedAt[installation.agentId] ?? null;
  }
  addMessage(state, replied.opportunityId, night.linkedinConnect, 'linkedin_connect', 'david', 'Called to Surf · connection sent', 'Connection request recorded for Riley Chen, operator at Called to Surf.');
  addMessage(state, replied.opportunityId, '2026-09-10T06:55:00.000Z', 'linkedin_accept', 'human', 'Riley Chen · connection accepted', 'Riley accepted the LinkedIn connection.');
  addMessage(state, replied.opportunityId, '2026-09-10T07:08:00.000Z', 'linkedin_out', 'david', 'Called to Surf · LinkedIn note', `Riley — curious how you evaluate paid and SEO together at Called to Surf, instead of as two vendors. ${BOOKING_CTA}`);
  addMessage(state, replied.opportunityId, night.firstTouch, 'email_out', 'david', 'Called to Surf · first touch', `Riley —\n\nWallaroo runs paid, email, and SEO together for Shopify brands in your range. One strategist conversation covers the stack.\n\n${BOOKING_CTA}\n\nIf that time is not right, reply with two windows this week.`);
  addMessage(state, replied.opportunityId, night.reply, 'email_in', 'human', 'Riley Chen · reply', 'Who on your side owns paid, email, and SEO together? We are comparing a few partners and want one conversation, not three vendors.');
  addMessage(state, replied.opportunityId, night.qualify, 'email_out', 'david', 'Called to Surf · qualification', `One strategist conversation covers the stack. No new commercial terms.\n\n${BOOKING_CTA}`);
  addMessage(state, replied.opportunityId, night.book, 'meeting_booked', 'david', 'Called to Surf · meeting booked', 'Riley booked the 30-minute strategist conversation from the email CTA.');
  addMessage(state, kaja.opportunityId, night.linkedinConnect, 'linkedin_connect', 'david', 'Kaja Beauty · connection sent', 'Connection request recorded for Avery Patel, operator at Kaja Beauty.');
  addMessage(state, kaja.opportunityId, night.kajaAccept, 'linkedin_accept', 'human', 'Avery Patel · connection accepted', 'Avery accepted the LinkedIn connection.');
  addMessage(state, kaja.opportunityId, night.kajaThread, 'linkedin_out', 'david', 'Kaja Beauty · LinkedIn note', `Avery — who owns creative velocity on Meta right now? Wallaroo’s ads offer sits next to email and SEO so the stack is not three vendors.\n\n${BOOKING_CTA}`);
  addMessage(state, kaja.opportunityId, '2026-09-10T08:18:00.000Z', 'linkedin_in', 'human', 'Avery Patel · reply', 'Creative is in-house and stretched. A 30-minute look at the stack would help. Thursday or Friday morning Mountain time.');
  addMessage(state, kaja.opportunityId, '2026-09-10T08:26:00.000Z', 'linkedin_out', 'david', 'Kaja Beauty · booking', `Thursday 10:00 AM Mountain is held.\n\n${BOOKING_CTA}`);
  addMessage(state, kaja.opportunityId, '2026-09-10T08:27:00.000Z', 'meeting_booked', 'david', 'Kaja Beauty · meeting booked', 'Avery booked the 30-minute strategist conversation from LinkedIn.');
  addMessage(state, bullstrap.opportunityId, night.linkedinConnect, 'linkedin_connect', 'david', 'Bullstrap · connection sent', 'Connection request recorded for Jordan Ellis, operator at Bullstrap.');
  addMessage(state, bullstrap.opportunityId, '2026-09-10T07:51:00.000Z', 'linkedin_accept', 'human', 'Jordan Ellis · connection accepted', 'Jordan accepted the LinkedIn connection.');
  addMessage(state, bullstrap.opportunityId, night.linkedinNotes, 'linkedin_out', 'david', 'Bullstrap · LinkedIn note', `Jordan — asking how Klaviyo flow coverage looks next to paid and SEO.\n\n${BOOKING_CTA}`);
  addMessage(state, stately.opportunityId, night.linkedinConnect, 'linkedin_connect', 'david', 'Stately · connection sent', 'Connection request recorded for Casey Nguyen. Still open; the live thread moved to website chat.');
  addMessage(state, stately.opportunityId, night.statelyChat, 'website_in', 'human', 'Casey Nguyen · site chat', 'Do you run Klaviyo and SEO together, or is that two different teams?');
  addMessage(state, stately.opportunityId, night.statelyReply, 'website_out', 'david', 'Website concierge · answer', `Wallaroo’s public offers are AI-Powered Ads, Email and SMS through Klaviyo, and SEO including LLMO. Senior strategists run them together.\n\n${BOOKING_CTA}`);
  addMessage(state, stately.opportunityId, '2026-09-10T04:41:00.000Z', 'website_in', 'human', 'Casey Nguyen · site chat', 'That is the conversation we need. Holding 30 minutes.');
  addMessage(state, stately.opportunityId, night.statelyBook, 'meeting_booked', 'david', 'Stately · meeting booked', 'Casey booked the 30-minute strategist conversation from website chat.');
  addMessage(state, won.opportunityId, '2026-09-09T18:20:00.000Z', 'email_out', 'david', 'MaxPro · first touch', `Morgan — Wallaroo’s Ads, Email, and SEO offers are on the public site.\n\n${BOOKING_CTA}`);
  addMessage(state, won.opportunityId, '2026-09-09T21:05:00.000Z', 'email_in', 'human', 'Morgan Hale · reply', 'We signed the existing proposal. Hold further automated contact unless we ask.');
  addMessage(state, booked.opportunityId, '2026-09-09T17:10:00.000Z', 'email_out', 'david', 'Jantzen · first touch', `Sam — checking fit against Wallaroo’s public Ads, Email, and SEO offers.\n\n${BOOKING_CTA}`);
  addMessage(state, booked.opportunityId, '2026-09-09T19:40:00.000Z', 'email_in', 'human', 'Sam Brooks · reply', 'Holding the 30 minutes. We will come with current Meta and Klaviyo context.');
  addMessage(state, booked.opportunityId, '2026-09-09T19:45:00.000Z', 'meeting_booked', 'david', 'Jantzen · meeting booked', 'Sam booked the 30-minute strategist conversation from the email CTA.');
  addMessage(state, kaja.opportunityId, night.partnerIntro, 'partner_out', 'david', 'Plus-partner intro', `Intro recorded with a Shopify Plus implementation partner around a shared account pattern. ${BOOKING_CTA}`);
  addMessage(state, kaja.opportunityId, '2026-09-10T09:10:00.000Z', 'partner_in', 'human', 'Plus-partner studio · reply', 'Open to a reciprocal intro. Send the 30-minute path.');
  state.replies[replied.id] = { eventId: 'wallaroo-reply-p2001', classification: 'ambiguous', text: 'Who on your side owns paid, email, and SEO together?', at: night.reply };
  state.replies[won.id] = { eventId: 'wallaroo-reply-p2003', classification: 'ambiguous', text: 'We signed the existing proposal. Hold further automated contact unless we ask.', at: '2026-09-10T15:00:00.000Z' };
  state.replies[booked.id] = { eventId: 'wallaroo-reply-p2006', classification: 'ambiguous', text: 'Holding the 30 minutes. We will come with current Meta and Klaviyo context.', at: '2026-09-09T19:40:00.000Z' };
  state.replies[kaja.id] = { eventId: 'wallaroo-reply-p2002', classification: 'ambiguous', text: 'Creative is in-house and stretched. A 30-minute look at the stack would help.', at: '2026-09-10T08:18:00.000Z' };
  state.replies[stately.id] = { eventId: 'wallaroo-reply-p2005', classification: 'ambiguous', text: 'That is the conversation we need. Holding 30 minutes.', at: night.statelyBook };
  state.scenarios = [{
    id: stableId(`${state.fixtureKey}:scenario:outbound`),
    workspaceId,
    version: 1,
    name: 'Overnight outbound + LinkedIn · 30 days',
    businessModel: 'b2b_services',
    currency: 'USD',
    horizonDays: 30,
    volume: 80,
    cohort: 'new_demand',
    overlapResolved: true,
    conversions: [
      { label: 'Qualified conversations', low: .28, base: .35, high: .42 },
      { label: 'Bookings', low: .38, base: .45, high: .52 },
      { label: 'Held meetings', low: .78, base: .85, high: .92 },
      { label: 'Wins', low: .22, base: .3, high: .38 },
    ],
    capacity: 6,
    valueMinor: 800000,
    spendMinor: 250000,
    baselineWins: 1,
    counterfactual: 'Same 30 days with specialists idle overnight: the plan stays at the existing MaxPro signature only.',
    assumptions: [
      'Starting volume is 80 reachable Shopify operators in the $1M–$30M band.',
      'Unit value is $8,000 monthly recurring from the current proposals.',
      'Planning spend is $2,500 for the 30-day outbound and LinkedIn pass.',
      'Baseline is the 1 signed conversation already on the record (MaxPro) before the overnight pass.',
      'Planning cases, not a guarantee of collected revenue.',
    ],
    createdAt: now,
  }, {
    id: stableId(`${state.fixtureKey}:scenario:website`),
    workspaceId,
    version: 1,
    name: 'Website concierge · 30 days',
    businessModel: 'b2b_services',
    currency: 'USD',
    horizonDays: 30,
    volume: 120,
    cohort: 'new_demand',
    overlapResolved: true,
    conversions: [
      { label: 'Qualified conversations', low: .18, base: .25, high: .32 },
      { label: 'Bookings', low: .32, base: .4, high: .48 },
      { label: 'Held meetings', low: .74, base: .8, high: .88 },
      { label: 'Wins', low: .16, base: .2, high: .28 },
    ],
    capacity: 8,
    valueMinor: 800000,
    spendMinor: 120000,
    baselineWins: 0,
    counterfactual: 'Public site with no concierge chat: visitors leave without a strategist conversation on the calendar.',
    assumptions: [
      'Starting volume is 120 site conversations in 30 days.',
      'Unit value is $8,000 monthly recurring.',
      'Planning spend is $1,200 for concierge coverage.',
      'Baseline is 0 booked conversations from the public site before the concierge pass.',
      'Planning cases, not a guarantee of collected revenue.',
    ],
    createdAt: now,
  }];
  state.usage = [
    { id: stableId(`${state.fixtureKey}:usage:setup`), workspaceId, category: 'setup', minutes: 180, costMinor: 150000, note: 'Workspace stand-up and public page capture', at: earlier },
    { id: stableId(`${state.fixtureKey}:usage:support`), workspaceId, category: 'recurring_support', minutes: 45, costMinor: 40000, note: 'Owner review of the overnight log', at: now },
    { id: stableId(`${state.fixtureKey}:usage:provider`), workspaceId, category: 'provider', minutes: 20, costMinor: 15000, note: 'Fixture channel logging', at: now },
    { id: stableId(`${state.fixtureKey}:usage:infra`), workspaceId, category: 'infrastructure', minutes: 30, costMinor: 25000, note: 'Workspace runtime', at: now },
    { id: stableId(`${state.fixtureKey}:usage:research`), workspaceId, category: 'research', minutes: 60, costMinor: 20000, note: 'Public wallaroomedia.com capture', at: earlier },
  ];
  state.onboardingCapture = {
    id: nextId(state, 'capture'),
    sourceHash: '0'.repeat(64),
    fixture: true,
    pages: state.company.pages.map(page => ({ url: page.url, title: page.title, description: page.description, text: page.text, capturedAt: page.capturedAt })),
  };
  state.onboarding = wallarooOnboarding(state);
  const bookingUrl = 'https://wallaroomedia.com/';
  const installation = state.installations.find(item => item.agentId === 'outbound-email-sdr');
  state.outboundSdr = OutboundSdrState.parse({
    workspaceId,
    bookingUrl,
    sequence: generateOutboundSequence(state.company, bookingUrl),
    leads: state.contacts.map(contact => OutboundLead.parse({
      id: stableId(`${state.fixtureKey}:outbound-lead:${contact.email}`),
      workspaceId,
      opportunityId: state.opportunities.find(item => item.contactId === contact.id)?.id ?? null,
      email: contact.email,
      firstName: contact.name.split(' ')[0] ?? '',
      lastName: contact.name.split(' ').slice(1).join(' '),
      company: contact.account,
      title: '',
      website: '',
      custom: {},
      status: contact.account === 'Called to Surf' ? 'booked' : contact.account === 'MaxPro' || contact.account === 'Jantzen' ? 'replied' : 'sent',
      lastReply: null,
      lastEventAt: now,
    })),
    campaignId: installation ? `FIXTURE_ONLY_instantly_${installation.id}` : 'FIXTURE_ONLY_instantly_wallaroo',
    instantlyWorkspaceId: 'fixture',
    warmupReady: true,
    sendingAccounts: [{ email: 'warmup@example.invalid', warmupReady: true, health: 'fixture' }],
    status: 'sending',
    crmProvider: 'none',
    crmStatus: 'not_connected',
    lastError: null,
  });
  const seoInstallation = state.installations.find(item => item.agentId === 'technical-seo-monitor');
  saveAgentOnboarding(state, 'technical-seo-monitor', 0, {
    keywords: ['AI-Powered SEO', 'LLMO', 'Shopify SEO'],
    locationName: 'United States',
    languageCode: 'en',
  });
  state.technicalSeo = TechnicalSeoState.parse({
    workspaceId,
    status: 'ready',
    target: 'wallaroomedia.com',
    crawlTaskId: seoInstallation ? `FIXTURE_ONLY_dataforseo_${seoInstallation.id}` : 'FIXTURE_ONLY_dataforseo_wallaroo',
    maxPages: 50,
    keywords: ['AI-Powered SEO', 'LLMO', 'Shopify SEO'],
    locationName: 'United States',
    languageCode: 'en',
    pages: state.company.pages.slice(0, 50).map(page => ({
      url: page.url,
      statusCode: 200,
      title: page.title,
      description: page.description,
      score: page.title && page.description ? 82 : 54,
      failedChecks: [
        ...(!page.title ? ['title_too_short'] : []),
        ...(!page.description ? ['no_description'] : []),
        ...(page.text.trim().length < 100 ? ['low_character_count'] : []),
      ],
    })),
    rankings: [
      { keyword: 'AI-Powered SEO', source: 'tracked', rank: 7, resultUrl: state.company.pages[0]?.url ?? '', locationName: 'United States', languageCode: 'en' },
      { keyword: 'LLMO', source: 'tracked', rank: null, resultUrl: '', locationName: 'United States', languageCode: 'en' },
      { keyword: 'Shopify SEO', source: 'inventory', rank: 12, resultUrl: state.company.pages[0]?.url ?? '', locationName: 'United States', languageCode: 'en' },
    ],
    fixture: true,
    lastError: null,
    updatedAt: now,
  });
}
