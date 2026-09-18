import { z } from 'zod';
import { AgentDefinition, type BusinessModel, type TeamRecommendation, EvidenceRef } from '../../contracts/src/index';

type Archetype = z.infer<typeof BusinessModel>;
const groups = [
  ['Find demand', ['Account Intelligence', 'Buying Signal Scout', 'Outbound Email SDR', 'Outbound Voice SDR', 'LinkedIn Outreach Assistant', 'Partner Development', 'RFP Opportunity Scout', 'Competitor Intelligence']],
  ['Create demand', ['Search Growth', 'Technical SEO', 'Local Search Manager', 'Creative Performance', 'Paid Campaign Operator', 'Landing Page Optimizer', 'Social Content Publisher', 'Video Script Producer', 'Product Merchandiser']],
  ['Convert demand', ['Speed-to-Lead Responder', 'AI Receptionist', 'Website Sales Concierge', 'Appointment Coordinator', 'Lead Qualification']],
  ['Close revenue', ['Proposal Operations', 'Deal Follow-up', 'Sales Call Coach', 'Estimate Recovery', 'Revenue Experiment Manager']],
  ['Retain and expand', ['Abandoned Cart Recovery', 'Lifecycle Email Manager', 'Customer Win-back', 'Expansion Opportunity Scout', 'Renewal and Retention', 'Review and Referral Manager']],
] as const;
export const preparationIds = ['account-intelligence', 'technical-seo-monitor', 'search-growth', 'creative-performance', 'landing-page-optimizer', 'social-content-publisher', 'video-script-producer', 'local-search-manager', 'website-sales-concierge'] as const;
/** Included with every workspace. Does not consume a paid team slot. */
export const ALWAYS_ON_AGENT_ID = 'website-sales-concierge' as const;
export const TEAM_SWAP_COOLDOWN_HOURS = 12;
export const EXTRA_AGENT_PRICE_MINOR = 100_000;
export const aliases: Record<string, string> = { 'Account Prospector': 'account-intelligence', 'SEO Content Writer': 'search-growth', 'Ad Creative Studio': 'creative-performance', 'Proposal Builder': 'proposal-operations', 'Proposal Follow-up': 'deal-follow-up', 'Technical SEO Monitor': 'technical-seo-monitor' };
export function canonicalAgentId(value: string): string { return aliases[value] ?? value; }
const prepOutputs: Record<string, string> = { 'account-intelligence': 'WebsiteProfile', 'technical-seo-monitor': 'TechnicalSeoReport', 'search-growth': 'ContentBrief', 'creative-performance': 'AdCopyConcepts', 'landing-page-optimizer': 'PageCopyHypothesis', 'social-content-publisher': 'SocialDraft', 'video-script-producer': 'VideoScript', 'local-search-manager': 'LocationChecklist', 'website-sales-concierge': 'FaqDraft' };
export const catalog: AgentDefinition[] = groups.flatMap(([category, names]) => names.map(name => {
  const id = name === 'Technical SEO' ? 'technical-seo-monitor' : name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
  const preparation = id in prepOutputs;
  const execution = id === 'deal-follow-up' || id === 'appointment-coordinator';
  const archetypes: Archetype[] = ['product-merchandiser','abandoned-cart-recovery'].includes(id) ? ['commerce'] : id === 'estimate-recovery' ? ['home_services'] : ['b2b_services', 'home_services', 'commerce'];
  if (id === 'outbound-email-sdr') return AgentDefinition.parse({
    id, name, version: '1.0.0', category,
    responsibility: 'Book meetings from a customer-supplied list. DAVID writes the sequence; Instantly sends, warms inboxes, handles replies, and books. This agent does not find leads.',
    supportedArchetypes: archetypes, modes: ['bounded_autonomous_execution'], releaseStatus: 'pilot',
    requiredCapabilities: ['company.confirmed', 'instantly.send', 'instantly.warmup', 'instantly.replies', 'calendar.booking_link'],
    triggers: ['ready_gates_pass'], allowedTasks: ['import_leads', 'generate_sequence', 'start_campaign', 'pause_campaign'],
    toolNames: ['instantly.campaign', 'instantly.leads', 'instantly.webhooks'], outputSchema: 'OutboundSdrState.v1',
    prerequisites: ['confirmed_company_facts', 'customer_lead_list', 'booking_url', 'warmed_sending_account'],
    stopConditions: ['workspace_paused', 'capacity_exhausted', 'warmup_unhealthy', 'missing_calendar_link', 'suppression', 'human_takeover', 'bounce', 'unsubscribe'],
    capacityUnit: 'leads/day', dependencies: ['managed_instantly_workspace', 'customer_lead_list'],
    failureModes: ['missing_booking_url', 'warmup_unhealthy', 'invalid_lead_csv', 'uncertain_provider_write'],
    fallback: 'Stop on the ready-gate blocker. Instantly SuperSearch and lead finder stay off.',
    metrics: ['human_replies', 'verified_bookings'],
    evaluationCases: ['csv_without_email', 'missing_calendly', 'warmup_blocks_send', 'no_supersearch', 'fixture_does_not_send'],
    aliases: [],
  });
  if (id === 'outbound-voice-sdr') return AgentDefinition.parse({
    id, name, version: '1.0.0', category,
    responsibility: 'Call a customer-supplied list. DAVID writes the opening script; ElevenLabs dials. This agent does not find leads. Live dial is not enabled in this pass.',
    supportedArchetypes: archetypes, modes: ['bounded_autonomous_execution'], releaseStatus: 'pilot',
    requiredCapabilities: ['company.confirmed', 'calendar.booking_link'],
    triggers: ['ready_gates_pass'], allowedTasks: ['import_leads', 'save_script', 'bind_agent'],
    toolNames: ['elevenlabs.call', 'elevenlabs.agent', 'elevenlabs.webhooks'], outputSchema: 'VoiceSdrSetup.v1',
    prerequisites: ['confirmed_company_facts', 'customer_lead_list', 'booking_url', 'managed_elevenlabs_agent'],
    stopConditions: ['workspace_paused', 'capacity_exhausted', 'missing_calendar_link', 'suppression', 'human_takeover'],
    capacityUnit: 'calls/day', dependencies: ['managed_elevenlabs_agent', 'customer_lead_list'],
    failureModes: ['missing_booking_url', 'invalid_lead_csv', 'elevenlabs_unbound'],
    fallback: 'Stop on the ready-gate blocker. No live dial until an operator binds ElevenLabs. This agent does not find leads.',
    metrics: ['verified_bookings'],
    evaluationCases: ['csv_without_phone_or_email', 'same_list_as_email', 'no_live_dial', 'fixture_does_not_call'],
    aliases: [],
  });
  if (id === 'ai-receptionist') return AgentDefinition.parse({
    id, name, version: '1.0.0', category,
    responsibility: 'Answer inbound calls with a greeting, hours, and a booking link. ElevenLabs Conversational AI is the inbound layer. Live telephony is not enabled in this pass.',
    supportedArchetypes: archetypes, modes: ['monitored_execution'], releaseStatus: 'planned',
    requiredCapabilities: ['engineering.implementation'],
    triggers: ['reviewed_manual_run'], allowedTasks: [],
    toolNames: ['elevenlabs.agent', 'calendar.availability', 'calendar.book'], outputSchema: 'Unavailable',
    prerequisites: ['missing_engineering_integration'],
    stopConditions: ['workspace_paused', 'capacity_exhausted', 'required_source_unavailable'],
    capacityUnit: 'calls/day', dependencies: ['managed_elevenlabs_agent', 'calendar'],
    failureModes: ['elevenlabs_unbound', 'missing_calendar_link'],
    fallback: 'Record the greeting and hours. An operator binds the ElevenLabs inbound agent. No live answer in this pass.',
    metrics: [], evaluationCases: ['unavailable_mode', 'no_live_telephony'], aliases: [],
  });
  if (id === 'linkedin-outreach-assistant') return AgentDefinition.parse({
    id, name, version: '1.0.0', category,
    responsibility: 'Prepare source-grounded LinkedIn notes for human review. HeyReach is the intended send/inbox layer; DAVID does not send LinkedIn today.',
    supportedArchetypes: archetypes, modes: ['preparation'], releaseStatus: 'planned',
    requiredCapabilities: ['engineering.implementation'],
    triggers: ['reviewed_manual_run'], allowedTasks: [],
    toolNames: ['heyreach.copy_out'], outputSchema: 'Unavailable',
    prerequisites: ['missing_engineering_integration'],
    stopConditions: ['workspace_paused', 'capacity_exhausted', 'required_source_unavailable'],
    capacityUnit: 'actions/day', dependencies: ['heyreach_unibox'],
    failureModes: ['missing_source', 'invalid_output'],
    fallback: 'Copy reviewed notes into HeyReach. DAVID does not send LinkedIn today.',
    metrics: [], evaluationCases: ['unavailable_mode'], aliases: [],
  });
  if (id === 'technical-seo-monitor') return AgentDefinition.parse({
    id, name, version: '1.0.0', category,
    responsibility: 'Prepare a bounded site crawl and observed Google ranks for human review. DataForSEO crawls the confirmed company origin and reads SERP/Labs; DAVID does not write the CMS. Search Console stays off.',
    supportedArchetypes: archetypes, modes: ['preparation'], releaseStatus: 'pilot',
    requiredCapabilities: ['website.captured', 'company.confirmed', 'dataforseo.onpage', 'dataforseo.serp'],
    triggers: ['ready_gates_pass', 'daily_due_work'], allowedTasks: ['save_keywords', 'start_crawl', 'pause_crawl', 'prepare_artifact'],
    toolNames: ['dataforseo.crawl', 'dataforseo.serp', 'dataforseo.ranked_keywords', 'save_artifact'], outputSchema: 'TechnicalSeoState.v1',
    prerequisites: ['confirmed_company_facts', 'approved_website_snapshot', 'keyword_list', 'serp_location'],
    stopConditions: ['workspace_paused', 'capacity_exhausted', 'missing_source', 'missing_keywords', 'human_takeover'],
    capacityUnit: 'artifacts/day', dependencies: ['managed_dataforseo_account', 'customer_keyword_list'],
    failureModes: ['missing_source', 'invalid_output', 'uncertain_provider_write'],
    fallback: 'Stop on the ready-gate blocker. Copy-out is complete delivery; no CMS write-back.',
    metrics: ['reviewed_preparation_artifacts'],
    evaluationCases: ['fixture_does_not_fetch', 'missing_keywords', 'origin_only', 'no_cms_write', 'no_gsc'],
    aliases: Object.entries(aliases).filter(([, value]) => value === id).map(([alias]) => alias),
  });
  return AgentDefinition.parse({ id, name, version: '1.0.0', category, responsibility: id === 'deal-follow-up' ? 'Follow up on eligible existing proposals; stop on replies and hand off checked appointments. Proposal Follow-up is the B2B playbook.' : id === 'website-sales-concierge' ? 'Prepare source-grounded FaqDraft for human review. Live chat is a DAVID-hosted embed; it is not deployed on the public site.' : preparation ? `Prepare source-grounded ${prepOutputs[id]} for human review.` : execution ? 'Coordinate an authorized sales appointment from a reviewed conversation handoff.' : `${name} is catalog scope; external execution is not implemented.`, supportedArchetypes: archetypes, modes: preparation ? ['preparation'] : ['monitored_execution'], releaseStatus: preparation ? 'implemented' : execution ? 'pilot' : 'planned', requiredCapabilities: preparation ? ['website.captured', 'company.confirmed'] : id === 'deal-follow-up' ? ['proposals.current', 'gmail.send', 'gmail.reply_read', 'cohort.enrolled'] : id === 'appointment-coordinator' ? ['calendar.availability', 'calendar.book', 'conversation.assignment'] : ['engineering.implementation'], triggers: ['reviewed_manual_run', ...(preparation ? ['daily_due_work'] : execution ? ['verified_source_change'] : [])], allowedTasks: preparation ? ['prepare_artifact'] : id === 'deal-follow-up' ? ['draft_follow_up', 'propose_send', 'stop_on_reply', 'assign_appointment'] : execution ? ['propose_appointment', 'check_availability', 'propose_booking'] : [], toolNames: preparation ? ['read_approved_snapshot', 'save_artifact'] : execution ? ['read_bound_source', 'propose_checked_action'] : [], outputSchema: prepOutputs[id] ?? (execution ? 'ActionProposal.v1' : 'Unavailable'), prerequisites: preparation ? ['confirmed_company_facts', 'approved_website_snapshot'] : execution ? ['current_policy', 'assigned_operator', 'selected_installation', 'approved_action', 'fresh_bound_sources'] : ['missing_engineering_integration'], stopConditions: ['workspace_paused', 'capacity_exhausted', 'required_source_unavailable', ...(execution ? ['suppression', 'human_takeover', 'source_stale', 'permission_revoked', 'ownership_conflict', 'reply_or_terminal_status'] : [])], capacityUnit: preparation ? 'artifacts/day' : 'actions/day', dependencies: id === 'appointment-coordinator' ? ['structured_conversation_handoff'] : preparation ? ['shared_company_context'] : ['shared_coordination'], failureModes: ['missing_source', 'invalid_output', 'capacity_exhausted', ...(execution ? ['uncertain_provider_write'] : [])], fallback: preparation ? 'Save a blocker with the missing facts; no publishing.' : 'Stop and assign the responsible operator; no implicit authority.', metrics: preparation ? ['reviewed_preparation_artifacts'] : execution ? ['human_replies', 'verified_bookings'] : [], evaluationCases: preparation ? ['source_grounding', 'missing_facts', 'pause', 'daily_limit', 'no_external_write'] : execution ? ['valid', 'suppressed', 'stale', 'concurrent', 'uncertain', 'reply_stops'] : ['unavailable_mode'], aliases: Object.entries(aliases).filter(([, value]) => value === id).map(([alias]) => alias) });
}));

export function recommendedAgentIds(goal: string, businessModel: Archetype): string[] {
  const ids = businessModel === 'commerce' ? ['account-intelligence', 'creative-performance', 'search-growth', 'product-merchandiser', 'abandoned-cart-recovery']
    : businessModel === 'home_services' ? ['account-intelligence', 'local-search-manager', 'appointment-coordinator', 'estimate-recovery', 'search-growth']
    : /demand|traffic|content|awareness/i.test(goal) ? ['account-intelligence', 'search-growth', 'technical-seo-monitor', 'creative-performance', 'landing-page-optimizer']
    : ['deal-follow-up', 'appointment-coordinator', 'account-intelligence', 'search-growth', 'technical-seo-monitor'];
  return ids.filter(id => id !== ALWAYS_ON_AGENT_ID);
}
export function nextAgentIds(goal: string, businessModel: Archetype, selected: string[], count = 3): string[] {
  const taken = new Set([...selected, ALWAYS_ON_AGENT_ID].map(canonicalAgentId));
  const rank = (id: string) => { const agent = catalog.find(item => item.id === id); return agent?.releaseStatus === 'implemented' ? 0 : agent?.releaseStatus === 'pilot' ? 1 : 2; };
  const recommended = recommendedAgentIds(goal, businessModel).filter(id => !taken.has(id));
  const rest = catalog.filter(agent => agent.supportedArchetypes.includes(businessModel) && !taken.has(agent.id) && !recommended.includes(agent.id)).sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name)).map(agent => agent.id);
  return [...recommended, ...rest].slice(0, count);
}
export function recommendationFor(id: string, workspaceId: string, goal: string, businessModel: Archetype): TeamRecommendation {
  const specialistIds = recommendedAgentIds(goal, businessModel);
  return { id, workspaceId, goal, businessModel, specialistIds, rationale: Object.fromEntries(specialistIds.map(agentId => [agentId, catalog.find(a => a.id === agentId)!.responsibility])), dependencies: [...new Set(specialistIds.flatMap(agentId => catalog.find(a => a.id === agentId)!.dependencies))], limitations: ['Five selected responsibilities do not establish action readiness.', 'Website Sales Concierge is included with every workspace and does not use a team slot.', 'Planned capabilities need engineering; preparation drafts do not publish or prove revenue.'] };
}

export const WebsiteContext = z.object({ operatingGuidance: z.object({brand:z.string().max(4000),forbiddenClaims:z.string().max(4000),objective:z.string().max(4000).optional(),desiredAction:z.string().max(4000).optional()}).strict().optional(), companyName: z.string().min(1), confirmed: z.boolean(), offers: z.array(z.string().min(1)).min(1), customerTypes: z.array(z.string().min(1)).min(1), locations: z.array(z.string()), pages: z.array(z.object({ url: z.url(), title: z.string(), description: z.string(), text: z.string().max(100000), capturedAt: z.iso.datetime() }).strict()).min(1).max(10), evidence: z.array(EvidenceRef).min(1), fixture: z.boolean() }).strict();
export type WebsiteContext = z.infer<typeof WebsiteContext>;
export type PreparationOutput = { type: string; title: string; content: string; factualInputs: string[]; limitation: string };
export function prepareFromContext(agentId: string, input: WebsiteContext): PreparationOutput {
  const context = WebsiteContext.parse(input);
  if (!context.confirmed) throw new Error('Confirm company facts before preparation.');
  if (!(agentId in prepOutputs)) throw new Error('This specialist has no implemented preparation capability.');
  const offer = context.offers[0]; const audience = context.customerTypes.join(', ');
  const sources = context.pages.map(page => page.url).join('\n');
  const factualInputs = [...(context.operatingGuidance?.desiredAction?[`Owner-selected visitor action: ${context.operatingGuidance.desiredAction}`]:[]),...(context.operatingGuidance?.objective?[`Owner-selected objective: ${context.operatingGuidance.objective}`]:[]),...(context.operatingGuidance?[`Owner-approved brand guidance: ${context.operatingGuidance.brand}`,`Owner-prohibited claims: ${context.operatingGuidance.forbiddenClaims}`]:[]),`Company: ${context.companyName}`, ...context.offers.map(value => `Approved offer: ${value}`), ...context.customerTypes.map(value => `Confirmed customer type: ${value}`)];
  const templates: Record<string, [string, string, string]> = {
    'account-intelligence': ['Company positioning profile', `${context.companyName}\nApproved offers: ${context.offers.join('; ')}\nCustomer types: ${audience}\nSource coverage: ${context.pages.length} approved page(s).\nPositioning hypothesis for review: Explain how ${offer} serves ${audience}.\nUnverified: named prospect accounts, market size, pricing outside approved facts.`, 'A website profile is shared context, not a sourced prospect list.'],
    'technical-seo-monitor': ['Captured-page technical check', `${context.fixture ? 'ILLUSTRATIVE FIXTURE — DataForSEO did not fetch the live site.\n' : ''}Priority URLs for a bounded crawl (max 50 pages) of the confirmed origin:\n${context.pages.map(page => `${page.url}\nTitle: ${page.title || 'MISSING — add a descriptive page title'}\nDescription: ${page.description || 'MISSING — write an accurate page description'}\nReadable text: ${page.text.trim().length} characters${page.text.trim().length < 100 ? ' — limited readable content; inspect rendering' : ''}\nCaptured: ${page.capturedAt}`).join('\n\n')}\n\nStart Technical SEO with keywords and a SERP location to record crawl issues and observed ranks. Copy fixes into the CMS.`, 'Bounded crawl and observed SERP/Labs snapshot after DataForSEO runs. Not Search Console, not a CMS write, not a full-internet claim. Fixture must not be called live.'],
    'search-growth': ['Source-grounded content brief', `Working title: A practical guide to ${offer}\nAudience: ${audience}\nQuestion to answer: What does ${offer} include, and who is it suited to?\nOutline: customer problem; approved offer; evaluation questions; next conversation.\nEvidence requirement: quote only approved facts. Ask the owner for examples and proof before adding claims.\nReview: confirm the intent with actual search data before prioritizing.`, 'No keyword-volume estimates or search-demand claims. This brief is not published content.'],
    'creative-performance': ['Ad-copy concepts and test angles', `Concept A — offer clarity\nHeadline: Explore ${offer}\nBody: See how ${context.companyName} describes its work for ${audience}.\nConcept B — informed evaluation\nHeadline: Is ${offer} right for your team?\nBody: Review the scope and ask a practical question.\nProposed test: compare qualified responses to clarity-led and question-led copy with equal budgets after approval.`, 'Text concepts only: no image/video generation, account change or campaign launch.'],
    'landing-page-optimizer': ['Landing-page copy and hypothesis', `Proposed heading: ${offer} for ${audience}\nSupporting copy: Learn what ${context.companyName} offers and whether it matches your needs.\nCTA: ${context.operatingGuidance?.desiredAction||'Discuss your requirements'}\nHypothesis: clearer offer and audience wording may improve relevant inquiries.\nBaseline: not supplied.\nEvaluation: obtain current qualified inquiry rate, define the conversion event and review an approved test.`, 'Proposed copy has not been deployed; uplift is unknown without measurement.'],
    'social-content-publisher': ['Social post draft', `Opening: Choosing ${offer} starts with clear questions.\nDraft: Ask what is included, who the work is for, and what information is needed to assess fit. ${context.companyName} describes its offer for ${audience}.\nClose: Review the approved source and bring your questions.\nOutline: context → practical evaluation questions → source link.`, 'Saved draft only; no social account publishing capability or permission.'],
    'video-script-producer': ['Video script and shot list', `Format: 45–60 second explainer (proposed).\n0–10s — speaker: “Considering ${offer}? Start with the scope.” Shot: presenter, neutral background.\n10–35s — speaker: “${context.companyName} describes this offer for ${audience}. Review the details and ask what information your team needs.” Shot: approved website excerpt.\n35–50s — speaker: “Bring your requirements to a conversation.” Shot: presenter and approved call to action.\nBefore recording: approve wording, source permissions and accessibility captions.`, 'Script/storyboard only. No rendered video, likeness or media output exists.'],
    'local-search-manager': ['Location setup checklist', `Confirmed locations: ${context.locations.length ? context.locations.join('; ') : 'None supplied — owner must confirm eligible business locations.'}\nChecklist:\n1. Confirm each location and who owns it.\n2. Verify business name, address/service area, phone, hours and category.\n3. Confirm eligibility and account ownership.\n4. Collect approved photos and service details.\n5. Request separate supported listing access and review proposed changes.`, 'No inferred location, verified listing or external listing changes.'],
    'website-sales-concierge': ['FAQ and qualification draft', `FAQ: What does ${context.companyName} offer?\nAnswer: ${context.offers.join('; ')}.\nFAQ: Who is the offer for?\nAnswer: ${audience}.\nFAQ: What does it cost?\nAnswer: Request the current approved proposal; no price was supplied in these facts.\nQualification questions: What outcome do you want? What is your current process? Who owns the decision? What timing should a person review?\nHandoff: collect consent and route to an assigned person after a supported implementation is approved.`, 'Draft FAQ only; no deployed chat, lead capture or automatic handoff.'],
  };
  const [title, content, limitation] = templates[agentId];
  return { type: prepOutputs[agentId], title, content: `${context.fixture && context.companyName !== 'Wallaroo Media' ? 'ILLUSTRATIVE FIXTURE — ' : ''}${content}\n\nApproved source references:\n${sources}`, factualInputs, limitation };
}
