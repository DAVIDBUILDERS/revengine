import type { AppSnapshot } from '../../contracts/src/index';
import { TechnicalSeoSetup, TechnicalSeoState, TECHNICAL_SEO_MAX_KEYWORDS, TECHNICAL_SEO_MAX_PAGES, companyOriginHost, requireSerpLocation } from '../../contracts/src/technical-seo';
import { DomainError } from './action-service';
import { audit, evidence, nextId, type EngineState } from './state';
import { saveAgentOnboarding } from './agent-onboarding';

export function emptyTechnicalSeo(workspaceId: string, now: string): TechnicalSeoState {
  return TechnicalSeoState.parse({
    workspaceId,
    status: 'needs_setup',
    target: null,
    crawlTaskId: null,
    maxPages: TECHNICAL_SEO_MAX_PAGES,
    keywords: [],
    locationName: '',
    languageCode: 'en',
    pages: [],
    rankings: [],
    fixture: false,
    lastError: null,
    updatedAt: now,
  });
}

export function ensureTechnicalSeo(state: EngineState): TechnicalSeoState {
  state.technicalSeo ??= emptyTechnicalSeo(state.workspace.id, state.asOf);
  return state.technicalSeo;
}

export function technicalSeoAnswers(state: Pick<AppSnapshot, 'agentOnboarding'>) {
  const answers = state.agentOnboarding?.find(record => record.agentId === 'technical-seo-monitor')?.answers ?? {};
  const rawKeywords = answers.keywords;
  const keywords = Array.isArray(rawKeywords)
    ? rawKeywords.map(value => String(value).trim()).filter(Boolean)
    : String(rawKeywords ?? '').split(/\n|,/).map(value => value.trim()).filter(Boolean);
  return {
    keywords: keywords.slice(0, TECHNICAL_SEO_MAX_KEYWORDS),
    locationName: String(answers.locationName ?? '').trim(),
    languageCode: String(answers.languageCode ?? 'en').trim() || 'en',
  };
}

export function companyWebsite(state: Pick<AppSnapshot, 'onboarding' | 'onboardingCapture'> & { company?: { pages?: { url: string }[] } }) {
  return state.onboarding?.answers.company.website || state.onboardingCapture?.pages[0]?.url || state.company?.pages?.[0]?.url || '';
}

export function technicalSeoReadyReasons(state: AppSnapshot) {
  const reasons: string[] = [];
  const installation = state.installations.find(item => item.agentId === 'technical-seo-monitor');
  if (!installation || !state.activation.selectedTeam.includes('technical-seo-monitor')) reasons.push('Select Technical SEO in the team.');
  if (state.workspace.paused) reasons.push('Resume the workspace before starting a crawl.');
  if (!state.activation.confirmedFacts && !(state as { company?: { confirmed?: boolean } }).company?.confirmed) reasons.push('Confirm company facts before DataForSEO can crawl.');
  const website = companyWebsite(state);
  if (!website) reasons.push('Capture the company website in Connections.');
  else if (state.workspace.mode !== 'fixture') {
    try { companyOriginHost(website); } catch (error) { reasons.push(error instanceof Error ? error.message : 'Company website is not a valid crawl target.'); }
  }
  const setup = technicalSeoAnswers(state);
  if (!setup.keywords.length) reasons.push('Add 1–20 keywords this specialist should rank-check.');
  if (setup.keywords.length > TECHNICAL_SEO_MAX_KEYWORDS) reasons.push('Technical SEO tracks at most 20 keywords.');
  try { if (setup.locationName) requireSerpLocation(setup.locationName); else reasons.push('Choose a SERP location.'); }
  catch (error) { reasons.push(error instanceof Error ? error.message : 'Choose a supported SERP location.'); }
  const seo = state.technicalSeo;
  if (seo?.status === 'crawling' || seo?.status === 'queued') reasons.push('A crawl is already in progress.');
  return reasons;
}

export function saveTechnicalSeoSetup(state: EngineState, expectedRevision: number, input: { keywords: string[]; locationName: string; languageCode: string }) {
  if (!state.installations.some(item => item.agentId === 'technical-seo-monitor') && !state.activation.selectedTeam.includes('technical-seo-monitor')) {
    throw new DomainError('ENTITLEMENT', 'Select Technical SEO in the team.');
  }
  let location;
  try { location = requireSerpLocation(input.locationName); }
  catch (error) { throw new DomainError('LOCATION_UNSUPPORTED', error instanceof Error ? error.message : 'Choose a supported SERP location.'); }
  const setup = TechnicalSeoSetup.parse({
    keywords: input.keywords.map(value => value.trim()).filter(Boolean),
    locationName: location.name,
    languageCode: input.languageCode.trim() || location.languageCode,
  });
  const current = state.agentOnboarding?.find(record => record.agentId === 'technical-seo-monitor');
  saveAgentOnboarding(state, 'technical-seo-monitor', expectedRevision, setup);
  const seo = ensureTechnicalSeo(state);
  seo.keywords = setup.keywords;
  seo.locationName = setup.locationName;
  seo.languageCode = setup.languageCode;
  seo.status = seo.status === 'ready' || seo.status === 'crawling' ? seo.status : 'needs_setup';
  seo.lastError = null;
  seo.updatedAt = state.asOf;
  audit(state, 'technical_seo.setup', `${setup.keywords.length} keywords · ${setup.locationName}`);
  return { revision: (current?.revision ?? 0) + 1, message: 'Technical SEO keywords and SERP location saved. Company website capture was not copied into this agent.' };
}

export function startTechnicalSeo(state: EngineState) {
  const reasons = technicalSeoReadyReasons(state);
  if (reasons.length) throw new DomainError('TECHNICAL_SEO_NOT_READY', reasons.join(' '));
  if (state.workspace.mode !== 'fixture') throw new DomainError('HOSTED_ACTION_SERVICE', 'Live DataForSEO crawl must use the hosted Technical SEO launcher.');
  const seo = ensureTechnicalSeo(state);
  const setup = technicalSeoAnswers(state);
  const website = companyWebsite(state);
  const target = website.includes('://') ? new URL(website).hostname.replace(/^www\./, '') : 'example.invalid';
  const installation = state.installations.find(item => item.agentId === 'technical-seo-monitor')!;
  const pages = (state.onboardingCapture?.pages ?? state.company.pages).slice(0, TECHNICAL_SEO_MAX_PAGES).map(page => ({
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
  }));
  seo.target = target;
  seo.crawlTaskId = `FIXTURE_ONLY_dataforseo_${installation.id}`;
  seo.keywords = setup.keywords;
  seo.locationName = setup.locationName;
  seo.languageCode = setup.languageCode;
  seo.pages = pages;
  seo.rankings = [
    ...setup.keywords.map((keyword, index) => ({
      keyword,
      source: 'tracked' as const,
      rank: index === 0 ? 7 : null,
      resultUrl: index === 0 ? (pages[0]?.url ?? '') : '',
      locationName: setup.locationName,
      languageCode: setup.languageCode,
    })),
    {
      keyword: `${state.company.offers[0] ?? 'company'}`.slice(0, 200),
      source: 'inventory' as const,
      rank: 12,
      resultUrl: pages[0]?.url ?? '',
      locationName: setup.locationName,
      languageCode: setup.languageCode,
    },
  ];
  seo.fixture = true;
  seo.status = 'ready';
  seo.lastError = null;
  seo.updatedAt = state.asOf;
  installation.lastPreparationAt = state.asOf;
  installation.status = 'monitoring';
  const proof = evidence(state, 'DataForSEO fixture crawl', 'fixture dataforseo', seo.crawlTaskId);
  const artifactId = nextId(state, 'artifact');
  state.artifacts.push({
    id: artifactId,
    workspaceId: state.workspace.id,
    agentId: 'technical-seo-monitor',
    type: 'TechnicalSeoReport',
    sourceSnapshot: [proof, ...state.company.evidence],
    factualInputs: [
      `ILLUSTRATIVE FIXTURE — no live DataForSEO fetch.`,
      `Target: ${target}`,
      `Keywords: ${setup.keywords.join(', ')}`,
      `Location: ${setup.locationName} (${setup.languageCode})`,
    ],
    title: 'Technical SEO crawl and rank snapshot',
    content: technicalSeoReport(seo),
    reviewState: 'draft',
    capabilityVersion: '1.0.0',
    runId: nextId(state, 'run'),
    createdAt: state.asOf,
    limitation: 'ILLUSTRATIVE FIXTURE — DataForSEO did not crawl or read Google. Copy-out is complete delivery; DAVID does not write the CMS. Not Search Console.',
  });
  audit(state, 'technical_seo.started', seo.crawlTaskId);
  return 'Fixture crawl and ranks recorded. No live DataForSEO fetch.';
}

export function pauseTechnicalSeo(state: EngineState) {
  const seo = ensureTechnicalSeo(state);
  seo.status = 'paused';
  seo.updatedAt = state.asOf;
  const installation = state.installations.find(item => item.agentId === 'technical-seo-monitor');
  if (installation) installation.status = 'paused';
  audit(state, 'technical_seo.paused', seo.crawlTaskId ?? 'no-crawl');
  return 'Technical SEO paused. DataForSEO will not start a new crawl.';
}

export function applyTechnicalSeoCrawl(state: EngineState, input: {
  crawlTaskId: string;
  target: string;
  pages: TechnicalSeoState['pages'];
  rankings?: TechnicalSeoState['rankings'];
  fixture?: boolean;
}) {
  const seo = ensureTechnicalSeo(state);
  if (seo.crawlTaskId && seo.crawlTaskId !== input.crawlTaskId) throw new DomainError('CRAWL_MISMATCH', 'This pingback does not match the crawl started for this workspace.');
  seo.crawlTaskId = input.crawlTaskId;
  seo.target = input.target;
  seo.pages = input.pages.slice(0, TECHNICAL_SEO_MAX_PAGES);
  if (input.rankings) seo.rankings = input.rankings;
  seo.fixture = input.fixture === true;
  seo.status = 'ready';
  seo.lastError = null;
  seo.updatedAt = state.asOf;
  const installation = state.installations.find(item => item.agentId === 'technical-seo-monitor');
  if (installation) {
    installation.lastPreparationAt = state.asOf;
    installation.status = 'monitoring';
  }
  audit(state, 'technical_seo.crawled', seo.crawlTaskId);
  return seo.fixture ? 'Fixture crawl applied.' : 'DataForSEO crawl recorded for this workspace.';
}

export function technicalSeoReport(seo: TechnicalSeoState) {
  const prefix = seo.fixture ? 'ILLUSTRATIVE FIXTURE — ' : '';
  const issues = seo.pages.flatMap(page => page.failedChecks.length ? [`${page.url} — ${page.failedChecks.join(', ')}`] : []);
  const ranks = seo.rankings.map(row => `${row.keyword} (${row.source}): ${row.rank ? `#${row.rank}` : 'not in top 10'}${row.resultUrl ? ` · ${row.resultUrl}` : ''}`);
  return `${prefix}Target: ${seo.target ?? 'unset'}
Pages crawled: ${seo.pages.length} / ${seo.maxPages}
Task: ${seo.crawlTaskId ?? 'none'}

Issues
${issues.length ? issues.map(item => `- ${item}`).join('\n') : '- No failed checks in this snapshot.'}

Rankings
${ranks.length ? ranks.map(item => `- ${item}`).join('\n') : '- No ranking rows yet.'}

Copy titles, descriptions and fixes into the CMS. DAVID does not write the live site.`;
}
