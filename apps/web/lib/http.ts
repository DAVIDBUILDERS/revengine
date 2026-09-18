import { randomUUID, timingSafeEqual } from 'node:crypto';
import { ZodError } from 'zod';
import { environment } from '../../../packages/orchestration/src/environment';
import { DomainError } from '../../../packages/domain/src/action-service';
import { InstantlyError } from '../../../packages/connectors/src/instantly';
import { DataForSeoError } from '../../../packages/connectors/src/dataforseo';

export class HttpError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
export function checkOrigin(request: Request) {
  const expected = new URL(environment().APP_ORIGIN).origin;
  if (request.headers.get('origin') !== expected) throw new HttpError(403, 'ORIGIN_DENIED', 'This request must come from the configured application origin.');
  if (request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, 'CSRF_DENIED', 'Cross-site changes are not allowed.');
}
export async function boundedJson(request: Request, max = 1100000): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new HttpError(415, 'JSON_REQUIRED', 'Submit JSON.');
  if (Number(request.headers.get('content-length') ?? 0) > max) throw new HttpError(413, 'BODY_TOO_LARGE', 'This request exceeds the import limit.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'BODY_REQUIRED', 'A request body is required.');
  let length = 0; const chunks: Uint8Array[] = [];
  try { while (true) { const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > max) throw new HttpError(413, 'BODY_TOO_LARGE', 'This request exceeds the import limit.'); chunks.push(value); } }
  finally { await reader.cancel(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'INVALID_JSON', 'The request is not valid JSON.'); }
}
export function verifyInstantlyWebhook(request: Request) {
  const secret = environment().INSTANTLY_WEBHOOK_SECRET;
  if (!secret || secret.length < 32) throw new HttpError(503, 'INSTANTLY_WEBHOOK_UNCONFIGURED', 'Configure an Instantly webhook secret of at least 32 characters.');
  const header = request.headers.get('x-instantly-secret') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const expected = Buffer.from(secret);
  const actual = Buffer.from(header);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new HttpError(401, 'INSTANTLY_WEBHOOK_UNAUTHORIZED', 'Instantly webhook authentication failed.');
}
export function verifyCron(request: Request) {
  const secret = environment().CRON_SECRET;
  if (!secret || secret.length < 32) throw new HttpError(503, 'CRON_UNCONFIGURED', 'Configure a cron secret of at least 32 characters.');
  const expected = Buffer.from(`Bearer ${secret}`); const actual = Buffer.from(request.headers.get('authorization') ?? '');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new HttpError(401, 'CRON_UNAUTHORIZED', 'Dispatcher authentication failed.');
}
export function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } }); }
export function apiError(error: unknown) {
  const correlationId = randomUUID();
  if (error instanceof HttpError) return json({ error: error.code, message: error.message, correlationId }, error.status);
  if (error instanceof DomainError) return json({ error:error.code, message:error.message, correlationId },409);
  if (error instanceof ZodError) return json({ error: 'VALIDATION_FAILED', message: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '), correlationId }, 400);
  // Domain errors are intentionally concise. Unknown provider errors never expose response bodies or credentials.
  if (error instanceof InstantlyError) return json({ error: error.code.toUpperCase(), message: error.message, correlationId }, 409);
  if (error instanceof DataForSeoError) return json({ error: error.code.toUpperCase(), message: error.message, correlationId }, error.code === 'webhook_unauthorized' ? 401 : error.code === 'unmatched' ? 404 : error.code === 'webhook_unconfigured' ? 503 : 409);
  if (error instanceof Error && /^(BLOCKED|FORBIDDEN|INVALID|STALE|PAUSED|DENIED|NOT_FOUND|CONFLICT|APPROVAL|BUDGET|CAPACITY|UNKNOWN|FIXTURE|LIVE|SUPABASE|VERCEL|GOOGLE|MIGRATION|AUTH|MODEL|ENTITLEMENT|INSTANTLY)/.test(error.message)) return json({ error: 'ACTION_BLOCKED', message: error.message.slice(0, 600), correlationId }, 409);
  return json({ error: 'REQUEST_FAILED', message: 'The operation could not be completed. Review the current blockers or contact the assigned operator.', correlationId }, 500);
}
