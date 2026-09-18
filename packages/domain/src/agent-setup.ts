import type { AppSnapshot } from '../../contracts/src/index';
import { SERP_LOCATIONS } from '../../contracts/src/technical-seo';
import { catalog, preparationIds, type WebsiteContext } from '../../agents/src/index';
import { companyConnectionCoverage } from './company-connections';
import { specialistWorkSnapshot } from './delivery';
import { bookingUrlInfo, companyFromSnapshot, generateOutboundSequence } from './outbound-sdr';
import { firstSetupAgentId, slotAgentIds, workbenchAgentIds } from './team';
import { companyWebsite, technicalSeoAnswers } from './technical-seo';

export type AgentSetupStepKind = 'text' | 'url' | 'choice' | 'file' | 'preview' | 'confirm';

export type AgentSetupStep = {
  id: string;
  title: string;
  description: string;
  kind: AgentSetupStepKind;
  requiredTools: string[];
  canContinue: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toolsFor(agentId: string) {
  return [...(catalog.find(agent => agent.id === agentId)?.toolNames ?? [])];
}

function operator(state: Pick<AppSnapshot, 'context'>) {
  return state.context.role === 'david_operator';
}

function instantlyBound(state: Pick<AppSnapshot, 'outboundSdr'>) {
  return UUID.test(state.outboundSdr?.instantlyWorkspaceId ?? '');
}

function elevenlabsBound(state: Pick<AppSnapshot, 'agentOnboarding'>, agentId: string) {
  const answers = state.agentOnboarding?.find(record => record.agentId === agentId)?.answers ?? {};
  return UUID.test(String(answers.elevenlabsAgentId ?? ''));
}

function engineCompany(state: AppSnapshot): WebsiteContext | undefined {
  return (state as AppSnapshot & { company?: WebsiteContext }).company;
}

export function setupPages(state: AppSnapshot) {
  return engineCompany(state)?.pages.length ? engineCompany(state)!.pages : state.onboardingCapture?.pages ?? [];
}

export function setupCompanyName(state: AppSnapshot) {
  return engineCompany(state)?.companyName || state.onboarding?.answers.company.name || state.workspace.name;
}

function factsReady(state: AppSnapshot) {
  return Boolean((engineCompany(state)?.confirmed || state.activation.confirmedFacts) && (setupPages(state).length || state.onboarding?.answers.company.offers.length));
}

function latestArtifact(state: AppSnapshot, agentId: string) {
  return state.artifacts.filter(item => item.agentId === agentId).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function answersFor(state: AppSnapshot, agentId: string) {
  return state.agentOnboarding?.find(record => record.agentId === agentId)?.answers ?? {};
}

function step(id: string, title: string, description: string, kind: AgentSetupStepKind, requiredTools: string[], canContinue: boolean): AgentSetupStep {
  return { id, title, description, kind, requiredTools, canContinue };
}

function emailPath(state: AppSnapshot): AgentSetupStep[] {
  const tools = toolsFor('outbound-email-sdr');
  const booking = bookingUrlInfo(state.outboundSdr?.bookingUrl);
  const leads = (state.outboundSdr?.leads ?? []).some(lead => lead.status !== 'skipped');
  const sequence = (state.outboundSdr?.sequence ?? []).length >= 3;
  const steps = [
    step('intro', 'Outbound Email SDR books meetings from your list.', 'DAVID writes the sequence. Instantly sends, warms inboxes, and handles replies. This agent does not find leads. Start send stays a gate after setup — not a question here.', 'confirm', tools, true),
    step('booking', 'Where should people book a meeting?', 'Any https link works. Calendly is optional; Instantly auto-book is strongest when Calendly is present.', 'url', tools, booking.ok),
    step('leads', 'Upload the people to email.', 'CSV with an email column. This agent does not find leads.', 'file', tools, leads),
    step('sequence', 'Here is the three-step sequence DAVID will send.', 'Written from confirmed company facts and your meeting link. Confirm it to save.', 'preview', tools, sequence),
  ];
  if (operator(state) && !instantlyBound(state)) {
    steps.push(step('bind', 'Bind the Instantly sub-workspace.', 'Operator only. Paste the Instantly workspace UUID. Customers never paste an Instantly key.', 'text', tools, instantlyBound(state)));
  }
  steps.push(step('ready', 'Outbound Email SDR is installed.', 'Lists, sequence, and meeting link are saved. Start send remains a separate ready gate.', 'confirm', tools, true));
  return steps;
}

function seoPath(state: AppSnapshot): AgentSetupStep[] {
  const tools = toolsFor('technical-seo-monitor');
  const setup = technicalSeoAnswers(state);
  const origin = companyWebsite(state) || 'the captured company website';
  const locationOk = SERP_LOCATIONS.some(item => item.name === setup.locationName);
  return [
    step('intro', 'Technical SEO crawls the confirmed site.', 'DataForSEO reads pages and Google ranks. DAVID does not write the CMS. Search Console stays off.', 'confirm', tools, true),
    step('keywords', 'Which keywords should we rank-check?', 'One to twenty phrases. One per line or separated by commas.', 'text', tools, setup.keywords.length >= 1 && setup.keywords.length <= 20),
    step('location', 'Which Google results location?', 'SERP snapshots use this country. Language follows the location.', 'choice', tools, locationOk),
    step('preview', `We will crawl ${origin}.`, 'Bounded to the confirmed company origin. Start crawl stays a gate after this setup.', 'preview', tools, Boolean(companyWebsite(state))),
    step('ready', 'Technical SEO is installed.', 'Keywords and location are saved. Start crawl when you are ready.', 'confirm', tools, true),
  ];
}

function accountIntelPath(state: AppSnapshot): AgentSetupStep[] {
  const tools = toolsFor('account-intelligence');
  const pages = setupPages(state);
  const artifact = latestArtifact(state, 'account-intelligence');
  return [
    step('facts', 'These are the captured facts this brief will use.', pages.length ? `${setupCompanyName(state)} · ${pages.length} page(s).` : 'Capture and confirm the company website in Connections first.', 'preview', tools, factsReady(state)),
    step('prepare', 'Run account preparation.', 'Saves a WebsiteProfile from approved facts. Nothing is published.', 'confirm', tools, factsReady(state)),
    step('artifact', artifact?.title ?? 'Website profile', artifact?.limitation ?? 'Run preparation to save the brief.', 'preview', tools, Boolean(artifact)),
    step('ready', 'Account Intelligence is installed.', 'Open the specialist workspace when you want another draft.', 'confirm', tools, true),
  ];
}

function dealFollowUpPath(state: AppSnapshot): AgentSetupStep[] {
  const tools = toolsFor('deal-follow-up');
  const coverage = companyConnectionCoverage(state);
  const proposals = coverage.systems.find(item => item.kind === 'proposals');
  const mail = coverage.systems.find(item => item.kind === 'mail');
  const source = String(state.onboarding?.answers.briefing?.proposalSource ?? answersFor(state, 'deal-follow-up').proposalSource ?? '').trim();
  const honest = [proposals?.status, mail?.status].some(status => status === 'needs_access' || status === 'needs_information' || status === 'engineering_required' || status === 'not_available')
    ? `Proposals: ${proposals?.detail ?? 'not connected'}. Mail: ${mail?.detail ?? 'not connected'}.`
    : `Proposals: ${proposals?.status ?? 'unknown'}. Mail: ${mail?.status ?? 'unknown'}.`;
  return [
    step('intro', 'Deal Follow-up works from current proposals.', 'It drafts grounded follow-up in Gmail after Connections are verified. It does not invent a pipeline.', 'confirm', tools, true),
    step('proposals', 'Where do current proposals live?', source ? 'Saved. Confirm or correct the source.' : 'A Google Sheet, CRM export, or folder. Connecting it happens in Connections.', 'text', tools, source.length >= 2),
    step('gmail', 'Gmail and the enrolled cohort still have to be current.', honest, 'preview', tools, true),
    step('ready', 'Deal Follow-up is installed.', mail?.status === 'verified' && proposals?.status === 'verified' ? 'Sources look current. Drafts still need approval.' : 'Setup is recorded. Missing Connections still block live send — that is honest, not a skip.', 'confirm', tools, true),
  ];
}

function conciergePath(state: AppSnapshot): AgentSetupStep[] {
  const tools = toolsFor('website-sales-concierge');
  const artifact = latestArtifact(state, 'website-sales-concierge');
  return [
    step('facts', 'FAQ answers come from confirmed company facts.', factsReady(state) ? `${setupCompanyName(state)} · ${(engineCompany(state)?.offers ?? state.onboarding?.answers.company.offers ?? []).join('; ')}.` : 'Confirm company facts first.', 'preview', tools, factsReady(state)),
    step('prepare', 'Generate the FAQ draft.', 'Saves a FaqDraft for review. The DAVID-hosted embed is not deployed on the public site.', 'confirm', tools, factsReady(state)),
    step('artifact', artifact?.title ?? 'FAQ draft', artifact?.limitation ?? 'Run preparation to save the FAQ draft.', 'preview', tools, Boolean(artifact)),
    step('ready', 'Website Sales Concierge is included.', 'Embed stays not-deployed. Copy the FAQ onto your site when you want it live.', 'confirm', tools, true),
  ];
}

function receptionistPath(state: AppSnapshot): AgentSetupStep[] {
  const tools = toolsFor('ai-receptionist');
  const answers = answersFor(state, 'ai-receptionist');
  const greeting = String(answers.greeting ?? '').trim();
  const hours = String(answers.hours ?? '').trim();
  const booking = bookingUrlInfo(String(answers.bookingUrl ?? state.outboundSdr?.bookingUrl ?? ''));
  const steps = [
    step('intro', 'AI Receptionist answers inbound calls.', 'ElevenLabs Conversational AI is the inbound layer. No live calls in this pass.', 'confirm', tools, true),
    step('greeting', 'How should it greet callers?', 'A short opening. DAVID will speak this once telephony is bound.', 'text', tools, greeting.length >= 4),
    step('booking', 'Where should it send people to book?', 'Any https meeting link. Calendar connect stays in Connections.', 'url', tools, booking.ok),
    step('hours', 'When should it say you are available?', 'For example: weekdays 9–17 America/Denver.', 'text', tools, hours.length >= 2),
  ];
  if (operator(state) && !elevenlabsBound(state, 'ai-receptionist')) {
    steps.push(step('bind', 'Bind the ElevenLabs inbound agent.', 'Operator only. Customers never paste an ElevenLabs key. No live answer in this pass.', 'text', tools, elevenlabsBound(state, 'ai-receptionist')));
  }
  steps.push(step('ready', 'AI Receptionist setup is recorded.', 'Inbound only. Live telephony is not enabled in this pass.', 'confirm', tools, true));
  return steps;
}

function voicePath(state: AppSnapshot): AgentSetupStep[] {
  const tools = toolsFor('outbound-voice-sdr');
  const answers = answersFor(state, 'outbound-voice-sdr');
  const listMode = String(answers.listMode ?? '');
  const script = String(answers.script ?? '').trim();
  const booking = bookingUrlInfo(String(answers.bookingUrl ?? state.outboundSdr?.bookingUrl ?? ''));
  const emailLeads = (state.outboundSdr?.leads ?? []).some(lead => lead.status !== 'skipped');
  const listOk = listMode === 'email' || (listMode === 'csv' && (Boolean(answers.leadsImported) || emailLeads));
  const steps = [
    step('intro', 'Outbound Voice SDR calls your list.', 'DAVID writes the opening. ElevenLabs is the intended dialer. This agent does not find leads. No live dial in this pass.', 'confirm', tools, true),
    step('list', 'Who should DAVID call?', emailLeads ? 'Reuse the Outbound Email SDR list, or upload a CSV.' : 'Upload a CSV, or reuse the email list once it exists.', 'choice', tools, listOk),
    step('script', 'DAVID will speak this.', 'Opening script from confirmed company facts. Confirm or edit it.', 'preview', tools, script.length >= 12),
    step('booking', 'Where should the call send people to book?', 'Any https meeting link. Calendly is optional.', 'url', tools, booking.ok),
  ];
  if (operator(state) && !elevenlabsBound(state, 'outbound-voice-sdr')) {
    steps.push(step('bind', 'Bind the ElevenLabs outbound agent.', 'Operator only. Customers never paste an ElevenLabs key. No live dial in this pass.', 'text', tools, elevenlabsBound(state, 'outbound-voice-sdr')));
  }
  steps.push(step('ready', 'Outbound Voice SDR is installed.', 'Script and list preference are saved. Live dial stays off until engineering enables it.', 'confirm', tools, true));
  return steps;
}

function genericPath(state: AppSnapshot, agentId: string): AgentSetupStep[] {
  const agent = catalog.find(item => item.id === agentId);
  if (!agent) return [];
  const tools = [...agent.toolNames];
  const planned = agent.releaseStatus === 'planned';
  const prep = agent.modes.includes('preparation') && preparationIds.includes(agentId as typeof preparationIds[number]);
  const artifact = latestArtifact(state, agentId);
  const steps = [
    step('intro', `Set up ${agent.name}.`, agent.responsibility, 'confirm', tools, true),
    step('tools', 'Tools this specialist needs.', tools.length ? 'You never paste provider keys. DAVID binds these.' : 'This role still needs engineering before tools exist.', 'preview', tools, true),
    step('facts', 'Confirm the company facts it will use.', factsReady(state) ? `${setupCompanyName(state)} · ${setupPages(state).length} captured page(s).` : 'Confirm company facts and a captured website first.', 'preview', tools, factsReady(state) || planned),
  ];
  if (planned) {
    steps.push(step('engineering', 'Engineering is still required.', 'This specialist is in the catalog. Live work is not implemented yet.', 'confirm', tools, true));
  } else if (prep) {
    steps.push(step('prepare', 'Run preparation.', 'Saves a source-grounded draft for review. Nothing is published.', 'confirm', tools, factsReady(state)));
    steps.push(step('artifact', artifact?.title ?? 'Saved draft', artifact?.limitation ?? 'Run preparation to save a draft.', 'preview', tools, Boolean(artifact)));
  }
  steps.push(step('ready', `${agent.name} is installed.`, planned ? 'Setup is recorded. Engineering still required before live work.' : 'Setup is recorded. Open the specialist workspace for ongoing work.', 'confirm', tools, true));
  return steps;
}

const named: Record<string, (state: AppSnapshot) => AgentSetupStep[]> = {
  'outbound-email-sdr': emailPath,
  'technical-seo-monitor': seoPath,
  'account-intelligence': accountIntelPath,
  'deal-follow-up': dealFollowUpPath,
  'website-sales-concierge': conciergePath,
  'ai-receptionist': receptionistPath,
  'outbound-voice-sdr': voicePath,
};

export function agentSetupPath(state: AppSnapshot, agentId: string): AgentSetupStep[] {
  const namedPath = named[agentId];
  return namedPath ? namedPath(state) : genericPath(state, agentId);
}

export function generateVoiceOpening(company: { companyName: string; offers: string[]; customerTypes: string[] }, bookingUrl: string) {
  const offer = company.offers[0] ?? 'our work';
  const audience = company.customerTypes.join(', ') || 'your team';
  const link = bookingUrl.trim() || 'your meeting link';
  return `Hi {{firstName}}, this is a call from ${company.companyName} for ${audience}. We help with ${offer}. If now is a bad time, say so and I will stop. Otherwise, grab a time here: ${link}.`;
}

export function sequencePreviewFromSnapshot(state: AppSnapshot, bookingUrl: string) {
  if (!bookingUrlInfo(bookingUrl).ok) return state.outboundSdr?.sequence ?? [];
  const company = engineCompany(state);
  if (company) {
    try { return generateOutboundSequence(company, bookingUrl); } catch { /* fall through */ }
  }
  try { return generateOutboundSequence(companyFromSnapshot(state), bookingUrl); } catch { /* fall through */ }
  const answers = state.onboarding?.answers.company;
  const name = answers?.name || state.workspace.name;
  const offers = answers?.offers.length ? answers.offers : ['your offer'];
  const customers = answers?.customers.length ? answers.customers : ['your customers'];
  const pages = setupPages(state);
  try {
    return generateOutboundSequence({
      companyName: name,
      confirmed: true,
      offers,
      customerTypes: customers,
      locations: [],
      pages: pages.length ? pages : [{ url: answers?.website || 'https://example.invalid', title: name, description: '', text: offers.join(' '), capturedAt: state.asOf }],
      evidence: [{ id: 'setup-preview', label: 'Setup preview', source: 'workspace', capturedAt: state.asOf, quality: 'fixture' }],
      fixture: state.workspace.mode === 'fixture',
      operatingGuidance: { brand: answers?.brandGuidance ?? '', forbiddenClaims: answers?.forbiddenClaims ?? '' },
    }, bookingUrl);
  } catch {
    return state.outboundSdr?.sequence ?? [];
  }
}

export function parseSetupKeywords(value: string) {
  return value.split(/\n|,/).map(item => item.trim()).filter(Boolean).slice(0, 20);
}

export function agentNeedsSetup(state: AppSnapshot, agentId: string) {
  const record = state.agentOnboarding?.find(item => item.agentId === agentId);
  if (record?.status === 'ready') return false;
  const work = specialistWorkSnapshot(state, agentId);
  return work.artifacts + work.actions + work.findings === 0;
}

export function nextSetupAgentId(state: AppSnapshot, except?: string) {
  const team = workbenchAgentIds(slotAgentIds(state.onboarding?.answers.team.length ? state.onboarding.answers.team : state.activation.selectedTeam));
  const remaining = team.filter(id => {
    if (id === except) return false;
    if (state.agentOnboarding?.find(item => item.agentId === id)?.status === 'ready') return false;
    return true;
  });
  const empty = remaining.filter(id => agentNeedsSetup(state, id));
  return firstSetupAgentId(empty) ?? empty[0] ?? firstSetupAgentId(remaining) ?? remaining[0];
}
