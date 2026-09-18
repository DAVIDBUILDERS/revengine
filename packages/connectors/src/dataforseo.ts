import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { TECHNICAL_SEO_INVENTORY_LIMIT, TECHNICAL_SEO_MAX_PAGES, assertUrlOnTarget } from '../../contracts/src/technical-seo';
export { assertUrlOnTarget, companyOriginHost, requireSerpLocation, SERP_LOCATIONS } from '../../contracts/src/technical-seo';

export class DataForSeoError extends Error {
  constructor(public code: string, message: string, public status: number | null = null) {
    super(message);
    this.name = 'DataForSeoError';
  }
}

const ALLOWED_PREFIXES = [
  '/v3/on_page/task_post',
  '/v3/on_page/summary/',
  '/v3/on_page/pages',
  '/v3/serp/google/organic/live/regular',
  '/v3/dataforseo_labs/google/ranked_keywords/live',
] as const;

export function denyDataForSeoPath(path: string) {
  const value = path.split('?')[0] ?? path;
  if (/backlink|bing|youtube|lighthouse|instant_pages|keyword_suggestions|keyword_ideas|content_analysis/i.test(value)) {
    throw new DataForSeoError('path_denied', 'Technical SEO uses On-Page crawl, Google organic SERP, and Labs ranked keywords only.');
  }
  if (!ALLOWED_PREFIXES.some(prefix => value === prefix || value.startsWith(prefix))) {
    throw new DataForSeoError('path_denied', 'Technical SEO does not call this DataForSEO endpoint.');
  }
}

type DataForSeoConfig = { login: string; password: string; fetch?: typeof fetch };

export function createDataForSeoClient(config: DataForSeoConfig) {
  if (!config.login.trim() || !config.password.trim()) throw new DataForSeoError('unconfigured', 'DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD are required for live Technical SEO.');
  const authorization = `Basic ${Buffer.from(`${config.login}:${config.password}`).toString('base64')}`;
  const request = async (path: string, init: RequestInit = {}) => {
    denyDataForSeoPath(path);
    const headers = new Headers(init.headers);
    headers.set('Authorization', authorization);
    headers.set('Content-Type', 'application/json');
    const response = await (config.fetch ?? fetch)(`https://api.dataforseo.com${path}`, { ...init, headers });
    const body = await response.text();
    let parsed: unknown = {};
    try { parsed = body ? JSON.parse(body) : {}; } catch { throw new DataForSeoError('invalid_json', 'DataForSEO returned a non-JSON body.', response.status); }
    if (!response.ok) throw new DataForSeoError('request_failed', `DataForSEO ${path} failed.`, response.status);
    const envelope = parsed as { status_code?: number; status_message?: string; tasks?: { status_code?: number; status_message?: string }[] };
    if (typeof envelope.status_code === 'number' && envelope.status_code >= 40000) {
      throw new DataForSeoError('request_failed', envelope.status_message || `DataForSEO ${path} failed.`, envelope.status_code);
    }
    const taskError = envelope.tasks?.find(task => typeof task.status_code === 'number' && task.status_code >= 40000);
    if (taskError) throw new DataForSeoError('request_failed', taskError.status_message || `DataForSEO ${path} failed.`, taskError.status_code ?? null);
    return parsed;
  };
  return {
    postCrawl(input: { target: string; startUrl: string; maxPages: number; priorityUrls: string[]; pingbackUrl: string; tag: string; acceptLanguage: string }) {
      assertUrlOnTarget(input.startUrl, input.target);
      input.priorityUrls.forEach(url => assertUrlOnTarget(url, input.target));
      return request('/v3/on_page/task_post', { method: 'POST', body: JSON.stringify([{
        target: input.target,
        start_url: input.startUrl,
        max_crawl_pages: Math.min(input.maxPages, TECHNICAL_SEO_MAX_PAGES),
        respect_sitemap: true,
        enable_javascript: true,
        allow_subdomains: false,
        priority_urls: input.priorityUrls.slice(0, 20),
        accept_language: input.acceptLanguage,
        tag: input.tag,
        pingback_url: input.pingbackUrl,
      }]) });
    },
    crawlSummary(taskId: string) {
      return request(`/v3/on_page/summary/${encodeURIComponent(taskId)}`);
    },
    crawlPages(taskId: string) {
      return request('/v3/on_page/pages', { method: 'POST', body: JSON.stringify([{ id: taskId, limit: TECHNICAL_SEO_MAX_PAGES }]) });
    },
    organicSerp(input: { keyword: string; locationName: string; languageCode: string; target: string }) {
      return request('/v3/serp/google/organic/live/regular', { method: 'POST', body: JSON.stringify([{
        keyword: input.keyword,
        location_name: input.locationName,
        language_code: input.languageCode,
        device: 'desktop',
        depth: 10,
        target: `${input.target}*`,
      }]) });
    },
    rankedKeywords(input: { target: string; locationName: string; languageCode: string }) {
      return request('/v3/dataforseo_labs/google/ranked_keywords/live', { method: 'POST', body: JSON.stringify([{
        target: input.target,
        location_name: input.locationName,
        language_code: input.languageCode,
        item_types: ['organic'],
        limit: TECHNICAL_SEO_INVENTORY_LIMIT,
      }]) });
    },
  };
}

export function parseCrawlTaskId(raw: unknown) {
  const id = z.string().min(8).max(128).optional().parse((raw as { tasks?: { id?: string }[] })?.tasks?.[0]?.id);
  if (!id) throw new DataForSeoError('task_missing', 'DataForSEO did not return a crawl task id.');
  return id;
}

export function parseCrawlProgress(raw: unknown) {
  const progress = String((raw as { tasks?: { result?: { crawl_progress?: string }[] }[] })?.tasks?.[0]?.result?.[0]?.crawl_progress ?? '');
  return progress === 'finished' ? 'finished' as const : 'in_progress' as const;
}

function checksFrom(record: Record<string, unknown>) {
  const checks = record.checks && typeof record.checks === 'object' ? record.checks as Record<string, unknown> : {};
  return Object.entries(checks).flatMap(([key, value]) => value === true && /^(no_|is_4|is_5|is_broken|is_http|title_too|duplicate_|low_|high_|irrelevant_|has_render)/.test(key) ? [key] : []);
}

export function parseCrawlPages(raw: unknown, target: string) {
  const items = (raw as { tasks?: { result?: { items?: unknown[] }[] }[] })?.tasks?.[0]?.result?.[0]?.items;
  const rows = Array.isArray(items) ? items : [];
  return rows.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const url = String(record.url ?? '').trim();
    if (!url.startsWith('http')) return [];
    try { assertUrlOnTarget(url, target); } catch { return []; }
    const meta = record.meta && typeof record.meta === 'object' ? record.meta as Record<string, unknown> : {};
    const score = typeof record.onpage_score === 'number' ? record.onpage_score : null;
    return [{
      url,
      statusCode: Number(record.status_code ?? 0) || 0,
      title: String(meta.title ?? '').slice(0, 500),
      description: String(meta.description ?? '').slice(0, 2000),
      score: score === null ? null : Math.max(0, Math.min(100, score)),
      failedChecks: checksFrom(record).slice(0, 80),
    }];
  }).slice(0, TECHNICAL_SEO_MAX_PAGES);
}

export function parseOrganicRank(raw: unknown, target: string) {
  const items = (raw as { tasks?: { result?: { items?: { type?: string; rank_group?: number; url?: string }[] }[] }[] })?.tasks?.[0]?.result?.[0]?.items;
  const rows = Array.isArray(items) ? items : [];
  const organic = rows.find(item => item?.type === 'organic' && typeof item.url === 'string' && item.url.includes(target));
  if (!organic) return { rank: null as number | null, resultUrl: '' };
  return { rank: Number(organic.rank_group) || null, resultUrl: String(organic.url ?? '') };
}

export function parseRankedKeywords(raw: unknown, target: string, locationName: string, languageCode: string) {
  const items = (raw as { tasks?: { result?: { items?: unknown[] }[] }[] })?.tasks?.[0]?.result?.[0]?.items;
  const rows = Array.isArray(items) ? items : [];
  return rows.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const keywordData = record.keyword_data && typeof record.keyword_data === 'object' ? record.keyword_data as Record<string, unknown> : {};
    const keyword = String(keywordData.keyword ?? '').trim();
    const serp = record.ranked_serp_element && typeof record.ranked_serp_element === 'object' ? record.ranked_serp_element as Record<string, unknown> : {};
    const serpItem = serp.serp_item && typeof serp.serp_item === 'object' ? serp.serp_item as Record<string, unknown> : {};
    const url = String(serpItem.url ?? '').trim();
    if (!keyword) return [];
    if (url) try { assertUrlOnTarget(url, target); } catch { /* Labs may return the domain home without a path. */ }
    const rank = Number(serpItem.rank_group ?? serpItem.rank_absolute);
    return [{
      keyword: keyword.slice(0, 200),
      source: 'inventory' as const,
      rank: Number.isFinite(rank) && rank > 0 ? rank : null,
      resultUrl: url.startsWith('http') ? url : '',
      locationName,
      languageCode,
    }];
  }).slice(0, TECHNICAL_SEO_INVENTORY_LIMIT);
}

export function dataForSeoPingbackToken(secret: string, workspaceId: string) {
  return createHmac('sha256', secret).update(workspaceId).digest('hex');
}

export function verifyDataForSeoPingback(secret: string, workspaceId: string, token: string) {
  if (!secret || secret.length < 32) throw new DataForSeoError('webhook_unconfigured', 'Configure DATAFORSEO_WEBHOOK_SECRET of at least 32 characters.');
  const expected = Buffer.from(dataForSeoPingbackToken(secret, workspaceId));
  const actual = Buffer.from(token);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new DataForSeoError('webhook_unauthorized', 'DataForSEO pingback authentication failed.');
  }
}
