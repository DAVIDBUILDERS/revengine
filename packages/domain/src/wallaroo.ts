import { catalog, recommendationFor, prepareFromContext, preparationIds, ALWAYS_ON_AGENT_ID, type WebsiteContext } from '../../agents/src/index';
import { emptyOnboarding, type OnboardingRecord } from '../../contracts/src/index';
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

function addFinding(state: EngineState, agentId: string, title: string, condition: string, hypothesis: string, target: string, affectedIds: string[]) {
  state.findings.push({
    id: stableId(`${state.fixtureKey}:finding:${agentId}:${title}`),
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
    status: 'proposed',
    alternatives: ['Keep reviewing the saved draft', 'Copy the work into the connected tool'],
    baseline: 'No live send or publish has occurred.',
    target,
    reviewAt: new Date(Date.parse(state.asOf) + 7 * 86400000).toISOString(),
  });
}

/** Replace the generic DAVID fixture with a playable Wallaroo walkthrough. */
export function applyWallarooFixture(state: EngineState): void {
  const now = state.asOf;
  const earlier = '2026-09-09T16:00:00.000Z';
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
    state.contacts.push({ id: contactId, workspaceId, name, email: `sample-${index + 1}@example.invalid`, account, suppressed: false, enrolled: false, humanTakeover: false, owner: 'Workspace owner', lastContactAt: status === 'accepted' ? earlier : null });
    state.opportunities.push({ schemaVersion: 1, id: opportunityId, workspaceId, contactId, accountId: stableId(`${state.fixtureKey}:account:${account}`), businessModel: 'b2b_services', owner: 'Workspace owner', stage: status === 'accepted' ? 'won' : status === 'on_hold' ? 'qualified' : 'proposal', rawStage: status, evidence: [source] });
    state.proposals.push({ schemaVersion: 1, id: proposalId, workspaceId, opportunityId, contactId, version: 1, reference, issuedAt: '2026-09-01T16:00:00.000Z', validUntil: '2026-10-10T16:00:00.000Z', amountMinor: amount, currency: 'USD', valueKind: 'monthly_recurring', scopeSummary: `${account} conversation for Wallaroo’s paid, email, or SEO offer. Named from public case-study brands on wallaroomedia.com.`, sourceUrl: null, status, rawStatus: status, owner: 'Workspace owner', sourceVerifiedAt: now, syncedAt: now, evidence: [source], fixture: true });
    state.timeline.push({ id: stableId(`${state.fixtureKey}:timeline:${reference}`), workspaceId, opportunityId, at: now, kind: 'source', title: `${account} record imported`, detail: 'Pipeline record imported from company sources.', actor: 'source', evidence: [source] });
  });
  const replyProof = evidence(state, 'Human reply', 'recorded conversation', 'wallaroo-reply');
  const bookProof = evidence(state, 'Confirmed booking', 'recorded calendar', 'wallaroo-book');
  const signedProof = evidence(state, 'Signed terms', 'recorded confirmation', 'wallaroo-signed');
  const won = state.proposals.find(item => item.reference === 'P-2003')!;
  const booked = state.proposals.find(item => item.reference === 'P-2006')!;
  const replied = state.proposals.find(item => item.reference === 'P-2001')!;
  state.outcomes.push(
    { id: stableId(`${state.fixtureKey}:outcome:reply-1`), workspaceId, opportunityId: replied.opportunityId, metric: 'human_replies', metricVersion: 1, stage: 'reply', source: 'recorded conversation', periodStart: earlier, periodEnd: earlier, value: 1, valueType: 'count', currency: null, quality: 'fixture', evidence: [replyProof] },
    { id: stableId(`${state.fixtureKey}:outcome:reply-2`), workspaceId, opportunityId: booked.opportunityId, metric: 'human_replies', metricVersion: 1, stage: 'reply', source: 'recorded conversation', periodStart: earlier, periodEnd: earlier, value: 1, valueType: 'count', currency: null, quality: 'fixture', evidence: [replyProof] },
    { id: stableId(`${state.fixtureKey}:outcome:reply-3`), workspaceId, opportunityId: won.opportunityId, metric: 'human_replies', metricVersion: 1, stage: 'reply', source: 'recorded conversation', periodStart: earlier, periodEnd: earlier, value: 1, valueType: 'count', currency: null, quality: 'fixture', evidence: [replyProof] },
    { id: stableId(`${state.fixtureKey}:outcome:book-1`), workspaceId, opportunityId: booked.opportunityId, metric: 'verified_bookings', metricVersion: 1, stage: 'booked', source: 'recorded calendar', periodStart: earlier, periodEnd: earlier, value: 1, valueType: 'count', currency: null, quality: 'fixture', evidence: [bookProof] },
    { id: stableId(`${state.fixtureKey}:outcome:book-2`), workspaceId, opportunityId: replied.opportunityId, metric: 'verified_bookings', metricVersion: 1, stage: 'booked', source: 'recorded calendar', periodStart: now, periodEnd: now, value: 1, valueType: 'count', currency: null, quality: 'fixture', evidence: [bookProof] },
    { id: stableId(`${state.fixtureKey}:outcome:signed-1`), workspaceId, opportunityId: won.opportunityId, metric: 'signed_value', metricVersion: 1, stage: 'signed', source: 'recorded confirmation', periodStart: earlier, periodEnd: earlier, value: 1500000, valueType: 'money_minor', currency: 'USD', quality: 'fixture', evidence: [signedProof] },
  );
  state.connections = [
    { id: stableId(`${state.fixtureKey}:connection:website`), workspaceId, provider: 'website', identity: 'wallaroomedia.com', resource: 'Captured company website', scopes: [], operations: ['website.captured'], health: 'fixture', lastSyncAt: now, verifiedAt: now, owner: 'Workspace owner', freshnessSeconds: 86400 },
    { id: stableId(`${state.fixtureKey}:connection:linkedin`), workspaceId, provider: 'fixture', identity: 'Wallaroo Media · LinkedIn', resource: 'Company LinkedIn page', scopes: [], operations: ['social.read', 'social.draft'], health: 'fixture', lastSyncAt: now, verifiedAt: now, owner: 'Workspace owner', freshnessSeconds: 86400 },
    { id: stableId(`${state.fixtureKey}:connection:meta`), workspaceId, provider: 'fixture', identity: 'Wallaroo Media · Meta', resource: 'Meta Business Manager', scopes: [], operations: ['ads.read', 'social.read'], health: 'fixture', lastSyncAt: now, verifiedAt: now, owner: 'Workspace owner', freshnessSeconds: 86400 },
    { id: stableId(`${state.fixtureKey}:connection:google-ads`), workspaceId, provider: 'fixture', identity: 'Wallaroo Media · Google Ads', resource: 'Google Ads account', scopes: [], operations: ['ads.read'], health: 'fixture', lastSyncAt: now, verifiedAt: now, owner: 'Workspace owner', freshnessSeconds: 86400 },
    { id: stableId(`${state.fixtureKey}:connection:klaviyo`), workspaceId, provider: 'fixture', identity: 'Wallaroo Media · Klaviyo', resource: 'Klaviyo email account', scopes: [], operations: ['mail.read', 'mail.draft'], health: 'fixture', lastSyncAt: now, verifiedAt: now, owner: 'Workspace owner', freshnessSeconds: 86400 },
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
      sourceMappings: agentId === 'technical-seo-monitor' || agentId === ALWAYS_ON_AGENT_ID ? ['fixture-website'] : agentId === 'linkedin-outreach-assistant' ? ['fixture-linkedin'] : agentId === 'outbound-email-sdr' ? ['fixture-klaviyo'] : agentId === 'partner-development' ? ['fixture-mail'] : ['fixture-rfp'],
      policyVersion: 1,
      dailyCapacity: 4,
      lastPreparationAt: now,
      lastBusinessActionAt: now,
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
      createdAt: now,
    });
  }
  addArtifact(state, 'technical-seo-monitor', 'Title and description fixes', 'CapturedPageAudit', 'Priority fixes from the captured Wallaroo pages:\n1. /ai-powered-email/ — keep the Klaviyo/Shopify offer in the first 160 characters of the description.\n2. /ai-powered-seo/ — title already names SEO and LLMO; keep both terms.\n3. Home — “AI-native agency for eCommerce” is the clearest offer line.\nCopy these into the CMS. DAVID does not write the live site.', 'Only captured pages were checked. No ranking or crawl claim.', earlier);
  addArtifact(state, 'linkedin-outreach-assistant', 'LinkedIn notes for Shopify operators', 'OutreachDraft', 'Four connection notes for Shopify brand operators in the $1M–$30M range.\n1. Called to Surf — ask how they evaluate paid + SEO together.\n2. Kaja Beauty — ask who owns creative velocity.\n3. Bullstrap — ask about Klaviyo flow coverage.\n4. Stately — ask about LLMO / AI-search visibility.\nNo InMail was sent. Review and copy into LinkedIn.', 'Saved draft only. LinkedIn sending is not live.');
  addArtifact(state, 'linkedin-outreach-assistant', 'Follow-up angles after first reply', 'OutreachDraft', 'If a connection accepts: ask one qualification question (current stack, monthly ad spend band, or SEO owner) and offer the 30-minute strategist conversation from the public site. Do not invent pricing.', 'Draft only. No LinkedIn send.', earlier);
  addArtifact(state, 'partner-development', 'Partner intro shortlist', 'PartnerBrief', 'Complementary partners Wallaroo can introduce or receive from:\n• Creative studios that already produce Meta/TikTok volume\n• Shopify Plus implementation partners\n• Email/SMS operators who need SEO/LLMO coverage\nProposed first intro: a Plus-partner studio that wants AI-native ads without building the SEO practice. Draft intro is saved; no email was sent.', 'Internal shortlist. No partner email was sent.');
  addArtifact(state, 'partner-development', 'Plus-partner intro draft', 'PartnerIntro', 'Subject: Intro · AI-native ads + SEO for a shared Shopify Plus account\nBody: Wallaroo’s public offers are AI-Powered Ads, Email and SMS, and SEO including LLMO. This draft proposes a reciprocal intro with a Plus implementation partner. No email was sent.', 'Draft only. No partner email was sent.', earlier);
  addArtifact(state, 'outbound-email-sdr', 'Outbound sequence · Shopify brands', 'EmailSequence', 'Three-step sequence for Shopify brands doing $1M–$30M.\n1. Offer clarity — AI-Powered Ads, Email, or SEO.\n2. Qualification — current stack (Meta, Klaviyo, SEO) and who owns it.\n3. Ask for the 30-minute strategist conversation from wallaroomedia.com.\nCopy into Klaviyo or the sender you use. DAVID did not send.', 'Draft sequence only. Klaviyo send is not live.');
  addArtifact(state, 'outbound-email-sdr', 'Called to Surf first-touch draft', 'EmailDraft', `To: ${state.contacts[0].email}\nSubject: Paid, email, and SEO for ${state.contacts[0].account}\nBody: Wallaroo describes three offers for Shopify brands: AI-Powered Ads, AI-Powered Email and SMS, and AI-Powered SEO including LLMO. If you want a senior strategist conversation, use the public booking path on wallaroomedia.com.`, 'Not sent. Copy into your mail tool.', earlier);
  addArtifact(state, 'rfp-opportunity-scout', 'Matching agency RFPs', 'RfpWatchlist', 'Two RFPs that match Wallaroo’s public offers:\n1. Shopify Plus brand — paid social + creative velocity (Ads page).\n2. DTC retailer — technical SEO + LLMO (SEO page).\nNeither was submitted. Review fit, then copy the response outline into the proposal tool you use.', 'Watchlist only. No bid was filed.');
  addArtifact(state, 'rfp-opportunity-scout', 'SEO + LLMO response outline', 'RfpOutline', 'Response outline for the DTC retailer RFP.\n1. Technical SEO from the public /ai-powered-seo/ page.\n2. LLMO so AI shopping agents can recommend the brand.\n3. Ask for the 30-minute strategist conversation.\nDo not invent rankings or awarded work.', 'Outline only. No bid was filed.', earlier);
  addArtifact(state, ALWAYS_ON_AGENT_ID, 'Homepage FAQ block', 'FaqDraft', 'FAQ block ready to paste onto wallaroomedia.com.\nWhat does Wallaroo offer? AI-Powered Ads, Email and SMS, and SEO including LLMO.\nWho is it for? Shopify and Shopify Plus brands, typically $1M–$30M+.\nWhat does it cost? Ask for the current approved proposal; public retainers start at $1,500/mo on the service pages.', 'Draft FAQ. Chat is not deployed.', earlier);
  const openIds = state.proposals.filter(item => item.status === 'open').map(item => item.id);
  addFinding(state, 'technical-seo-monitor', 'Copy title fixes onto the live site', 'Captured pages have reviewable title and description checks.', 'Copying the saved checks onto wallaroomedia.com is the next human step.', 'Titles and descriptions updated in the CMS by a person.', openIds.slice(0, 1));
  addFinding(state, 'linkedin-outreach-assistant', 'Review four LinkedIn notes', 'Four Shopify-operator notes are drafted and waiting.', 'A person should choose who to contact first.', 'One approved note copied into LinkedIn.', openIds);
  addFinding(state, 'partner-development', 'Send the Plus-partner intro', 'A complementary Plus-partner intro is drafted.', 'A person should choose whether this intro goes out and who owns the relationship.', 'One intro copied into mail or dismissed.', [state.proposals[1].id]);
  addFinding(state, 'outbound-email-sdr', 'Approve the first-touch sequence', 'A three-step outbound sequence is saved as a draft.', 'Review wording against approved Wallaroo offers before anyone pastes it into Klaviyo.', 'One sequence approved for copy-out.', [state.proposals[0].id]);
  addFinding(state, 'rfp-opportunity-scout', 'Two RFPs match the public offers', 'Watchlist has two RFPs aligned to Ads and SEO pages.', 'Decide whether either is worth a human-written response.', 'One RFP accepted or dismissed.', [state.proposals[3].id]);
  const sdr = state.installations.find(item => item.agentId === 'outbound-email-sdr')!;
  const actionId = stableId(`${state.fixtureKey}:action:sdr-review`);
  const approvalId = stableId(`${state.fixtureKey}:approval:sdr-review`);
  state.actions.push({
    schemaVersion: 1,
    id: actionId,
    workspaceId,
    installationId: sdr.id,
    runId: stableId(`${state.fixtureKey}:run:sdr-review`),
    contactId: state.contacts[0].id,
    proposalId: state.proposals[0].id,
    type: 'send_follow_up',
    payload: { recipient: state.contacts[0].email, subject: `Paid, email, and SEO for ${state.contacts[0].account}`, body: 'First-touch draft. Review before anyone copies it into mail. No send occurred.', proposalVersion: 1 },
    payloadHash: 'fixture-walkthrough',
    evidence: state.proposals[0].evidence,
    approvalId,
    reservedCostMinor: 1,
    status: 'not_attempted',
    createdAt: now,
    expiresAt: '2026-09-11T16:00:00.000Z',
  });
  state.approvals.push({ id: approvalId, workspaceId, actionId, status: 'pending', payloadHash: 'fixture-walkthrough', approverId: null, decidedAt: null, expiresAt: '2026-09-11T16:00:00.000Z' });
  state.scenarios = [{
    id: stableId(`${state.fixtureKey}:scenario:outbound`),
    workspaceId,
    version: 1,
    name: 'Outbound + SEO · 30 days',
    businessModel: 'b2b_services',
    currency: 'USD',
    horizonDays: 30,
    volume: 24,
    cohort: 'new_demand',
    overlapResolved: true,
    conversions: [{ label: 'Qualified conversations', low: .2, base: .3, high: .4 }, { label: 'Bookings', low: .3, base: .4, high: .5 }, { label: 'Held meetings', low: .7, base: .8, high: .9 }, { label: 'Wins', low: .15, base: .25, high: .35 }],
    capacity: 6,
    valueMinor: 500000,
    spendMinor: 500000,
    baselineWins: null,
    counterfactual: null,
    assumptions: ['Planning inputs for this workspace, not a guarantee.', 'Unit value is monthly recurring value from the current proposals.'],
    createdAt: now,
  }];
  state.onboardingCapture = {
    id: nextId(state, 'capture'),
    sourceHash: '0'.repeat(64),
    fixture: true,
    pages: state.company.pages.map(page => ({ url: page.url, title: page.title, description: page.description, text: page.text, capturedAt: page.capturedAt })),
  };
  state.onboarding = wallarooOnboarding(state);
}
