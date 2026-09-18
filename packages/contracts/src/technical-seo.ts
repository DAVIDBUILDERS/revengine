import { z } from 'zod';

const Id = z.uuid();
const Utc = z.iso.datetime();

export const TECHNICAL_SEO_MAX_PAGES = 50;
export const TECHNICAL_SEO_MAX_KEYWORDS = 20;
export const TECHNICAL_SEO_INVENTORY_LIMIT = 25;

export const SERP_LOCATIONS = [
  { name: 'United States', languageCode: 'en' },
  { name: 'United Kingdom', languageCode: 'en' },
  { name: 'Canada', languageCode: 'en' },
  { name: 'Australia', languageCode: 'en' },
  { name: 'Germany', languageCode: 'de' },
] as const;

export function requireSerpLocation(name: string) {
  const match = SERP_LOCATIONS.find(item => item.name === name.trim());
  if (!match) throw new Error('Choose a supported SERP location.');
  return match;
}

export function companyOriginHost(website: string) {
  let host = '';
  try { host = new URL(website).hostname.toLowerCase(); } catch { throw new Error('Company website must be a valid http(s) URL.'); }
  if (!host || host === 'localhost' || host.endsWith('.invalid') || host.endsWith('.local')) {
    throw new Error('Crawl target must be the confirmed public company domain.');
  }
  return host.replace(/^www\./, '');
}

export function assertUrlOnTarget(url: string, target: string) {
  let host = '';
  try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { throw new Error('Crawl URLs must be absolute http(s) addresses.'); }
  if (host !== target) throw new Error('DataForSEO may only fetch the confirmed company origin.');
}

export const TechnicalSeoStatus = z.enum(['needs_setup', 'queued', 'crawling', 'ready', 'blocked', 'paused']);
export const TechnicalSeoRankingSource = z.enum(['tracked', 'inventory']);

export const TechnicalSeoPage = z.object({
  url: z.url(),
  statusCode: z.number().int().min(0).max(599),
  title: z.string().max(500),
  description: z.string().max(2000),
  score: z.number().min(0).max(100).nullable(),
  failedChecks: z.array(z.string().max(80)).max(80),
}).strict();

export const TechnicalSeoRanking = z.object({
  keyword: z.string().min(1).max(200),
  source: TechnicalSeoRankingSource,
  rank: z.number().int().min(1).max(100).nullable(),
  resultUrl: z.union([z.literal(''), z.url()]),
  locationName: z.string().min(1).max(120),
  languageCode: z.string().min(2).max(8),
}).strict();

export const TechnicalSeoState = z.object({
  workspaceId: Id,
  status: TechnicalSeoStatus,
  target: z.string().max(253).nullable(),
  crawlTaskId: z.string().max(128).nullable(),
  maxPages: z.number().int().min(1).max(TECHNICAL_SEO_MAX_PAGES),
  keywords: z.array(z.string().min(1).max(200)).max(TECHNICAL_SEO_MAX_KEYWORDS),
  locationName: z.string().max(120),
  languageCode: z.string().max(8),
  pages: z.array(TechnicalSeoPage).max(TECHNICAL_SEO_MAX_PAGES),
  rankings: z.array(TechnicalSeoRanking).max(TECHNICAL_SEO_MAX_KEYWORDS + TECHNICAL_SEO_INVENTORY_LIMIT),
  fixture: z.boolean(),
  lastError: z.string().max(1000).nullable(),
  updatedAt: Utc,
}).strict();

export const TechnicalSeoSetup = z.object({
  keywords: z.array(z.string().min(1).max(200)).min(1).max(TECHNICAL_SEO_MAX_KEYWORDS),
  locationName: z.string().min(2).max(120),
  languageCode: z.string().min(2).max(8),
}).strict();

export type TechnicalSeoPage = z.infer<typeof TechnicalSeoPage>;
export type TechnicalSeoRanking = z.infer<typeof TechnicalSeoRanking>;
export type TechnicalSeoState = z.infer<typeof TechnicalSeoState>;
export type TechnicalSeoSetup = z.infer<typeof TechnicalSeoSetup>;
