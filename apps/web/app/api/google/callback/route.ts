import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authClient } from '../../../../lib/auth';
import { apiError, HttpError } from '../../../../lib/http';
import { environment } from '../../../../../../packages/orchestration/src/environment';
import { runtimeDatabase } from '../../../../../../packages/orchestration/src/database';
import { exchangeGoogleCode, hashOAuthState } from '../../../../../../packages/connectors/src/index';

export const runtime = 'nodejs';

type Outcome = 'review' | 'cancelled' | 'expired' | 'failed';

function handoff(origin: string, outcome: Outcome, workspaceId?: string, connectionId?: string) {
  const destination = new URL('/?view=connections', origin);
  if (workspaceId) destination.searchParams.set('workspace', workspaceId);
  destination.searchParams.set('google', outcome);
  if (connectionId) destination.searchParams.set('connection', connectionId);
  // These query values select UI only. Access, identity and readiness must be
  // read from the current authorized workspace snapshot, never from this URL.
  const response = NextResponse.redirect(destination);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

export async function GET(request: Request) {
  let returnOrigin: string | undefined;
  let workspaceId: string | undefined;
  try {
    const env = environment();
    if (!env.GOOGLE_REDIRECT_URI) {
      throw new HttpError(503, 'GOOGLE_UNCONFIGURED', 'The Google OAuth application is not configured.');
    }
    const url = new URL(request.url);
    if (url.origin + url.pathname !== env.GOOGLE_REDIRECT_URI) {
      throw new HttpError(403, 'CALLBACK_URI_DENIED', 'OAuth redirect does not match the configured callback.');
    }
    // Do not turn a callback arriving at an unapproved origin into a UI return.
    returnOrigin = env.APP_ORIGIN;
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return handoff(returnOrigin, 'failed');

    const state = z.string().min(32).max(256).safeParse(url.searchParams.get('state'));
    if (!state.success || url.searchParams.getAll('state').length !== 1) return handoff(returnOrigin, 'expired');
    const stateHash = hashOAuthState(state.data);
    const client = await authClient();
    const { data, error } = await client.rpc('consume_google_oauth', {
      p_state_hash: stateHash,
      p_redirect_uri: env.GOOGLE_REDIRECT_URI,
    });
    if (error || !data?.[0]) {
      return handoff(returnOrigin, !error || error.code === '42501' ? 'expired' : 'failed');
    }
    const resolved = z.object({ workspace_id: z.uuid(), verifier: z.string().min(43).max(128) }).parse(data[0]);
    workspaceId = resolved.workspace_id;

    // Cancellation consumes the same actor-bound, single-use state as success.
    // Ignore error descriptions and all other provider-controlled URL fields.
    const providerError = url.searchParams.get('error');
    if (providerError) return handoff(returnOrigin, providerError === 'access_denied' ? 'cancelled' : 'failed', workspaceId);
    const code = z.string().min(1).max(4096).safeParse(url.searchParams.get('code'));
    if (!code.success || url.searchParams.getAll('code').length !== 1) return handoff(returnOrigin, 'failed', workspaceId);

    const tokens = await exchangeGoogleCode({
      code: code.data,
      verifier: resolved.verifier,
      redirectUri: env.GOOGLE_REDIRECT_URI,
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    });
    const connectionId = z.uuid().parse(await runtimeDatabase().finishOAuth({ stateHash, ...tokens }));
    return handoff(returnOrigin, 'review', workspaceId, connectionId);
  } catch (error) {
    // Provider errors, codes and credentials must never enter a browser URL or
    // response body. Preserve workspace context only after actor-bound consume.
    return returnOrigin ? handoff(returnOrigin, 'failed', workspaceId) : apiError(error);
  }
}
