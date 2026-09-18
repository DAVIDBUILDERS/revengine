import { z } from 'zod';
import { verifyDataForSeoPingback, DataForSeoError } from '../../../../../../packages/connectors/src/dataforseo';
import { collectTechnicalSeoResults } from '../../../../../../packages/orchestration/src/action-service';
import { runtimeDatabase } from '../../../../../../packages/orchestration/src/database';
import { environment } from '../../../../../../packages/orchestration/src/environment';
import { apiError, json } from '../../../../lib/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** DataForSEO GET pingback. Origin/CSRF checks do not apply; the HMAC token does. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const crawlTaskId = z.string().min(8).max(128).parse(url.searchParams.get('id'));
    const workspaceId = z.uuid().parse(url.searchParams.get('tag'));
    const token = z.string().min(32).max(128).parse(url.searchParams.get('token'));
    verifyDataForSeoPingback(environment().DATAFORSEO_WEBHOOK_SECRET ?? '', workspaceId, token);
    const db = runtimeDatabase();
    const prepared = z.object({
      target: z.string().min(1),
      keywords: z.array(z.string()),
      locationName: z.string(),
      languageCode: z.string(),
    }).nullable().catch(null).parse(await db.technicalSeoPingbackContext(workspaceId, crawlTaskId));
    if (!prepared) throw new DataForSeoError('unmatched', 'This pingback does not match a Technical SEO crawl for that workspace.');
    const collected = await collectTechnicalSeoResults({ crawlTaskId, ...prepared });
    if (collected.progress !== 'finished') return json({ status: 'pending' });
    return json({ status: await db.applyTechnicalSeoCrawl({
      workspaceId,
      crawlTaskId,
      target: prepared.target,
      pages: collected.pages,
      rankings: collected.rankings,
    }) });
  } catch (error) {
    return apiError(error);
  }
}
