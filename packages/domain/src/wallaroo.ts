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
      forbiddenClaims: 'Do not claim live Meta, Google Ads, Klaviyo, Shopify, LinkedIn, or SMS access. Do not invent named client revenue, sends, or RFP wins. Public retainer prices on wallaroomedia.com are Wallaroo’s agency fees, not DAVID pricing.',
      objective: WALLAROO_GOAL,
      desiredAction: 'Book 30 minutes with a senior strategist about the brand’s AI opportunity.',
    },
  };
}

function wallarooOnboarding(state: EngineState): OnboardingRecord {
  const base = emptyOnboarding(state.workspace, state.asOf);
  const owner = 'Fixture operator';
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
        priorities: ['Paid media for Shopify brands', 'Klaviyo email and SMS programs', 'Technical SEO and LLM optimization'],
        successDefinition: 'Revenue, margins, and LTV for Shopify brands. Impressions and follower counts are not the measure.',
        brandGuidance: 'AI-native ecommerce growth agency. Senior strategists run paid, email, and SEO. Partners, not vendors.',
        forbiddenClaims: 'No live Meta, Google Ads, Klaviyo, Shopify, LinkedIn, or SMS grants. No invented pipeline, sends, or RFP awards.',
      },
      team: [...WALLAROO_SELECTED_TEAM],
      systems: [
        { id: 'wallaroo-website', kind: 'website', tool: 'Company website', availability: 'available', resource: 'https://wallaroomedia.com/', owner, mapping: 'Public pages captured for this illustrative fixture. No live CMS write.', connectionId: '' },
        { id: 'wallaroo-ads', kind: 'advertising', tool: 'Meta, Google, TikTok', availability: 'available', resource: 'Client advertising accounts named on wallaroomedia.com', owner, mapping: 'Inventory only. Advertising providers are not implemented.', connectionId: '' },
        { id: 'wallaroo-social', kind: 'social', tool: 'LinkedIn / Meta', availability: 'available', resource: 'Company social channels for the LinkedIn specialist', owner, mapping: 'Inventory only. LinkedIn OAuth and sending are not implemented.', connectionId: '' },
        { id: 'wallaroo-commerce', kind: 'commerce', tool: 'Shopify Plus Partner', availability: 'available', resource: 'Client Shopify / Shopify Plus stores (Wallaroo is an agency, not a storefront)', owner, mapping: 'Inventory only. Shopify OAuth and catalog writes are not implemented.', connectionId: '' },
        { id: 'wallaroo-mail', kind: 'mail', tool: 'Klaviyo', availability: 'available', resource: 'Klaviyo email named on wallaroomedia.com', owner, mapping: 'Inventory only. Klaviyo send is not implemented. SMS is not a DAVID product.', connectionId: '' },
        { id: 'wallaroo-analytics', kind: 'analytics', tool: 'GA4', availability: 'available', resource: 'Google Analytics 4 named on ads and email pages', owner, mapping: 'Inventory only. Analytics providers are not implemented.', connectionId: '' },
        { id: 'wallaroo-proposals', kind: 'proposals', tool: 'Proposals & customer records', availability: 'available', resource: 'Company proposal records for partner and outbound roles', owner, mapping: 'Labeled inventory. No named prospect pipeline was invented.', connectionId: '' },
        { id: 'wallaroo-drive', kind: 'drive', tool: 'Files & knowledge', availability: 'available', resource: 'Company files for partner and RFP roles', owner, mapping: 'Inventory only. Drive access is not implemented.', connectionId: '' },
        { id: 'wallaroo-rfp', kind: 'rfp', tool: 'RFP sources', availability: 'available', resource: 'RFP sources for the opportunity scout', owner, mapping: 'Inventory only. No fake RFP wins or sourced opportunities.', connectionId: '' },
      ],
      people: [{ email: 'owner@example.invalid', name: owner, responsibility: 'owner', role: 'workspace_owner' }],
    },
  };
}

/** Replace the generic DAVID fixture with Wallaroo Media from public site facts. */
export function applyWallarooFixture(state: EngineState): void {
  const now = state.asOf;
  const workspaceId = state.workspace.id;
  const team = [...WALLAROO_SELECTED_TEAM];
  state.workspace.name = 'Wallaroo Media · illustrative workspace';
  state.workspace.businessModel = 'b2b_services';
  state.workspace.timeZone = 'America/Denver';
  state.company = wallarooCompany();
  state.company.evidence = [evidence(state, 'Public wallaroomedia.com pages captured for this illustrative fixture', 'fixture website')];
  state.contacts = [];
  state.opportunities = [];
  state.proposals = [];
  state.timeline = [];
  state.findings = [];
  state.artifacts = [];
  state.scenarios = [];
  state.connections = [{
    id: stableId(`${state.fixtureKey}:connection:google`),
    workspaceId,
    provider: 'google',
    identity: 'Not connected',
    resource: 'Google Workspace',
    scopes: [],
    operations: [],
    health: 'unconfigured',
    lastSyncAt: null,
    verifiedAt: null,
    owner: 'Workspace owner',
    freshnessSeconds: 3600,
  }];
  const recommendation = recommendationFor(stableId(`${state.fixtureKey}:recommendation`), workspaceId, WALLAROO_GOAL, 'b2b_services');
  recommendation.specialistIds = team;
  recommendation.rationale = Object.fromEntries(team.map(agentId => [agentId, catalog.find(agent => agent.id === agentId)!.responsibility]));
  recommendation.dependencies = [...new Set(team.flatMap(agentId => catalog.find(agent => agent.id === agentId)!.dependencies))];
  state.recommendation = recommendation;
  state.activation.selectedTeam = team;
  state.activation.owner = 'Fixture operator';
  state.installations = [...team, ALWAYS_ON_AGENT_ID].map(agentId => {
    const definition = catalog.find(agent => agent.id === agentId)!;
    const planned = definition.releaseStatus === 'planned';
    const preparation = preparationIds.includes(agentId as typeof preparationIds[number]);
    return {
      id: stableId(`${state.fixtureKey}:installation:${agentId}`),
      workspaceId,
      agentId,
      definitionVersion: '1.0.0',
      mode: definition.modes[0],
      status: planned ? 'selected' : 'installed',
      sourceMappings: preparation ? ['fixture-website'] : [],
      policyVersion: 1,
      dailyCapacity: 1,
      lastPreparationAt: null,
      lastBusinessActionAt: null,
      blockers: planned ? ['Missing engineering integration.'] : [],
    };
  });
  for (const agentId of state.installations.map(item => item.agentId).filter(id => preparationIds.includes(id as typeof preparationIds[number]))) {
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
    const installation = state.installations.find(item => item.agentId === agentId);
    if (installation) installation.lastPreparationAt = now;
  }
  state.onboardingCapture = {
    id: nextId(state, 'capture'),
    sourceHash: '0'.repeat(64),
    fixture: true,
    pages: state.company.pages.map(page => ({ url: page.url, title: page.title, description: page.description, text: page.text, capturedAt: page.capturedAt })),
  };
  state.onboarding = wallarooOnboarding(state);
}
