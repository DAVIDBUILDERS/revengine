import { describe, expect, it, vi } from 'vitest';
import { createDataForSeoClient, denyDataForSeoPath, parseCrawlPages, parseCrawlTaskId, parseOrganicRank, parseRankedKeywords, dataForSeoPingbackToken, verifyDataForSeoPingback } from './dataforseo';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

describe('DataForSEO connector — no live crawl in these tests', () => {
  it('posts an origin-bounded crawl and denies Lighthouse, Instant Pages, and backlinks', async () => {
    const paths: string[] = [];
    const http = vi.fn<typeof fetch>(async (input) => {
      paths.push(String(input));
      return json({ tasks: [{ id: 'task-dataforseo-001', status_code: 20000 }] });
    });
    const client = createDataForSeoClient({ login: 'fixture@example.com', password: 'SYNTHETIC', fetch: http });
    const posted = await client.postCrawl({
      target: 'example.com',
      startUrl: 'https://example.com/',
      maxPages: 50,
      priorityUrls: ['https://example.com/about'],
      pingbackUrl: 'https://app.example/api/webhooks/dataforseo',
      tag: 'workspace',
      acceptLanguage: 'en',
    });
    expect(parseCrawlTaskId(posted)).toBe('task-dataforseo-001');
    expect(paths.join(' ')).toMatch(/on_page\/task_post/);
    expect(() => denyDataForSeoPath('/v3/on_page/lighthouse/live')).toThrow(/On-Page crawl/);
    expect(() => denyDataForSeoPath('/v3/on_page/instant_pages')).toThrow(/On-Page crawl/);
    expect(() => denyDataForSeoPath('/v3/backlinks/summary/live')).toThrow(/On-Page crawl/);
    expect(() => denyDataForSeoPath('/v3/serp/google/organic/live/advanced')).toThrow(/does not call/);
  });

  it('drops off-origin crawl URLs and reads organic rank plus Labs inventory', () => {
    expect(parseCrawlPages({
      tasks: [{ result: [{ items: [
        { url: 'https://example.com/about', status_code: 200, onpage_score: 80, meta: { title: 'About', description: 'Firm' }, checks: { title_too_short: false, no_description: false } },
        { url: 'https://other.example/leak', status_code: 200, meta: { title: 'Leak' }, checks: {} },
      ] }] }],
    }, 'example.com')).toEqual([{
      url: 'https://example.com/about', statusCode: 200, title: 'About', description: 'Firm', score: 80, failedChecks: [],
    }]);
    expect(parseOrganicRank({
      tasks: [{ result: [{ items: [{ type: 'organic', rank_group: 4, url: 'https://example.com/' }] }] }],
    }, 'example.com')).toEqual({ rank: 4, resultUrl: 'https://example.com/' });
    expect(parseRankedKeywords({
      tasks: [{ result: [{ items: [{ keyword_data: { keyword: 'managed seo' }, ranked_serp_element: { serp_item: { rank_group: 11, url: 'https://example.com/seo' } } }] }] }],
    }, 'example.com', 'United States', 'en')[0]).toMatchObject({ keyword: 'managed seo', source: 'inventory', rank: 11 });
  });

  it('authenticates pingbacks with an HMAC token', () => {
    const token = dataForSeoPingbackToken('x'.repeat(32), '019fdec8-4890-7870-a6bd-416bf4db2784');
    expect(() => verifyDataForSeoPingback('x'.repeat(32), '019fdec8-4890-7870-a6bd-416bf4db2784', token)).not.toThrow();
    expect(() => verifyDataForSeoPingback('x'.repeat(32), '019fdec8-4890-7870-a6bd-416bf4db2784', '0'.repeat(64))).toThrow(/authentication failed/);
  });
});
