import { normalizeInstantlyWebhook } from '../../../../../../packages/connectors/src/instantly';
import { runtimeDatabase } from '../../../../../../packages/orchestration/src/database';
import { apiError, boundedJson, json, verifyInstantlyWebhook } from '../../../../lib/http';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Instantly posts here. Origin/CSRF checks do not apply; the webhook secret does. */
export async function POST(request: Request) {
  try {
    verifyInstantlyWebhook(request);
    const payload = await boundedJson(request);
    const event = normalizeInstantlyWebhook(payload);
    if (!event) return json({ status: 'ignored' });
    return json({ status: await runtimeDatabase().ingestInstantlyWebhook(event) });
  } catch (error) {
    return apiError(error);
  }
}
