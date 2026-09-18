import { describe, expect, it } from 'vitest';
import { createFixtureState, executeCommand, catalog } from '../packages/domain/src/index';
import { launchManagedDataForSeoCrawl } from '../packages/orchestration/src/action-service';
import { environment } from '../packages/orchestration/src/environment';

async function seoReady() {
  const state = createFixtureState();
  await executeCommand(state, { type: 'select_team', agentIds: ['technical-seo-monitor', 'account-intelligence', 'search-growth', 'creative-performance', 'landing-page-optimizer'] });
  await executeCommand(state, { type: 'save_technical_seo_setup', expectedRevision: 0, keywords: ['managed seo', 'shopify seo'], locationName: 'United States', languageCode: 'en' });
  return state;
}

describe('Technical SEO — DataForSEO crawl and SERP, copy-out only', () => {
  it('stays in the 33-agent catalog as preparation with DataForSEO tools', () => {
    expect(catalog).toHaveLength(33);
    const seo = catalog.find(agent => agent.id === 'technical-seo-monitor');
    expect(seo?.modes).toEqual(['preparation']);
    expect(seo?.releaseStatus).toBe('pilot');
    expect(seo?.requiredCapabilities).toEqual(expect.arrayContaining(['dataforseo.onpage', 'dataforseo.serp']));
    expect(seo?.toolNames.join(' ')).not.toMatch(/gsc|search.?console|lighthouse/i);
  });

  it('records a labeled fixture crawl and ranks without fetching DataForSEO', async () => {
    const state = await seoReady();
    const result = await executeCommand(state, { type: 'start_technical_seo' });
    expect(result.message).toMatch(/No live DataForSEO fetch/);
    expect(state.technicalSeo?.crawlTaskId).toMatch(/^FIXTURE_ONLY_dataforseo_/);
    expect(state.technicalSeo?.fixture).toBe(true);
    expect(state.technicalSeo?.status).toBe('ready');
    expect(state.technicalSeo?.pages.length).toBeGreaterThan(0);
    expect(state.technicalSeo?.rankings.some(row => row.keyword === 'managed seo' && row.source === 'tracked')).toBe(true);
    const artifact = state.artifacts.filter(item => item.agentId === 'technical-seo-monitor' && item.type === 'TechnicalSeoReport').at(-1);
    expect(artifact?.limitation).toMatch(/ILLUSTRATIVE FIXTURE/);
    expect(artifact?.limitation).toMatch(/does not write the CMS/i);
    expect(artifact?.content).not.toMatch(/Search Console/);
  });

  it('blocks start without keywords and refuses live crawl from the fixture domain', async () => {
    const state = createFixtureState();
    await executeCommand(state, { type: 'select_team', agentIds: ['technical-seo-monitor', 'account-intelligence', 'search-growth', 'creative-performance', 'landing-page-optimizer'] });
    await expect(executeCommand(state, { type: 'start_technical_seo' })).rejects.toThrow(/keywords/i);
    const ready = await seoReady();
    ready.workspace.mode = 'live';
    ready.context.environment = 'live';
    await expect(executeCommand(ready, { type: 'start_technical_seo' })).rejects.toThrow(/hosted Technical SEO launcher/);
  });

  it('denies DataForSEO credentials in fixture mode', () => {
    expect(environment({}).DAVID_MODE).toBe('fixture');
    expect(() => environment({ DATAFORSEO_LOGIN: 'secret' })).toThrow(/FIXTURE_CREDENTIALS_DENIED/);
    expect(() => environment({ DATAFORSEO_PASSWORD: 'secret' })).toThrow(/FIXTURE_CREDENTIALS_DENIED/);
  });

  it('does not launch a live crawl from unit tests', async () => {
    await expect(launchManagedDataForSeoCrawl({
      workspaceId: '019fdec8-4890-7870-a6bd-416bf4db2784',
      target: 'example.com',
      startUrl: 'https://example.com/',
      maxPages: 50,
      keywords: ['seo'],
      locationName: 'United States',
      languageCode: 'en',
      priorityUrls: [],
    })).rejects.toThrow(/denied in fixture mode|Live DataForSEO crawl is disabled/);
  });
});
