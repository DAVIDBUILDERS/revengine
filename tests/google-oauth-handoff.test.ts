import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
  rpc: vi.fn(),
  authorize: vi.fn(),
  authClient: vi.fn(),
  exchange: vi.fn(),
  finish: vi.fn(),
}));
vi.mock('../packages/orchestration/src/environment', () => ({ environment: () => mocks.env }));
vi.mock('../apps/web/lib/auth', () => ({ authorize: mocks.authorize, authClient: mocks.authClient }));
vi.mock('../packages/orchestration/src/database', () => ({ runtimeDatabase: () => ({ finishOAuth: mocks.finish }) }));
vi.mock('../packages/connectors/src/index', async (importOriginal) => ({
  ...await importOriginal<typeof import('../packages/connectors/src/index')>(),
  exchangeGoogleCode: mocks.exchange,
}));

import { GET } from '../apps/web/app/api/google/callback/route';
import { POST } from '../apps/web/app/api/google/connect/route';
import { hashOAuthState } from '../packages/connectors/src/google';

const origin = 'https://oauth-app.example.invalid';
const callback = `${origin}/api/google/callback`;
const workspace = 'a1000000-0000-4000-8000-000000000010';
const otherWorkspace = 'b1000000-0000-4000-8000-000000000010';
const connection = 'a1000000-0000-4000-8000-000000000030';
const state = 'synthetic-single-use-state-'.repeat(2);
const verifier = 'synthetic-pkce-verifier-'.repeat(3);
const tokens = { subject: 'synthetic-google-subject', email: 'owner@example.invalid', scopes: ['openid', 'email'], tokens: { accessToken: 'SYNTHETIC_ACCESS_TOKEN' }, expiresAt: '2099-01-01T00:00:00Z' };

function callbackRequest(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) query.set(key, value);
  return new Request(`${callback}?${query}`);
}
function connectRequest(requestOrigin = origin) {
  return new Request(`${origin}/api/google/connect`, {
    method: 'POST', headers: { origin: requestOrigin, 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceId: workspace, capabilities: ['sheets'] }),
  });
}
function destination(response: Response) {
  expect(response.status).toBe(307);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  return new URL(response.headers.get('location')!);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.env = { APP_ORIGIN: origin, GOOGLE_CLIENT_ID: 'synthetic-client', GOOGLE_CLIENT_SECRET: 'SYNTHETIC_SECRET', GOOGLE_REDIRECT_URI: callback };
  mocks.authClient.mockResolvedValue({ rpc: mocks.rpc });
  mocks.authorize.mockResolvedValue({ client: { rpc: mocks.rpc } });
  mocks.rpc.mockResolvedValue({ data: [{ workspace_id: workspace, verifier }], error: null });
  mocks.exchange.mockResolvedValue(tokens);
  mocks.finish.mockResolvedValue(connection);
});

describe('Google OAuth callback handoff using synthetic provider and database responses', () => {
  it('returns the broker connection and actor-bound workspace, never provider fields or a claimed verification', async () => {
    const response = await GET(callbackRequest({ state, code: 'SYNTHETIC_CODE', workspace: otherWorkspace, connection: 'attacker-selected', next: 'https://attacker.example.invalid', scope: 'forged' }));
    const url = destination(response);
    expect(url.origin).toBe(origin);
    expect(Object.fromEntries(url.searchParams)).toEqual({ view: 'connections', workspace, google: 'review', connection });
    expect(mocks.rpc).toHaveBeenCalledWith('consume_google_oauth', { p_state_hash: hashOAuthState(state), p_redirect_uri: callback });
    expect(mocks.exchange).toHaveBeenCalledWith(expect.objectContaining({ verifier, redirectUri: callback, code: 'SYNTHETIC_CODE' }));
    expect(mocks.finish).toHaveBeenCalledWith({ stateHash: hashOAuthState(state), ...tokens });
    expect(response.headers.get('location')).not.toMatch(/SYNTHETIC|verified|token|scope|next=/);
  });

  it('consumes cancellation state and routes back without exchanging credentials; replay loses workspace context', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ workspace_id: workspace, verifier }], error: null }).mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'state replayed' } });
    const cancelled = destination(await GET(callbackRequest({ state, error: 'access_denied', error_description: 'PRIVATE_PROVIDER_DETAIL' })));
    expect(Object.fromEntries(cancelled.searchParams)).toEqual({ view: 'connections', workspace, google: 'cancelled' });
    const replay = destination(await GET(callbackRequest({ state, code: 'SYNTHETIC_CODE' })));
    expect(Object.fromEntries(replay.searchParams)).toEqual({ view: 'connections', google: 'expired' });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(mocks.finish).not.toHaveBeenCalled();
  });

  it.each(['wrong actor', 'expired state'])('does not preserve a supplied workspace or exchange a code when SQL rejects %s', async (reason) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: reason } });
    const url = destination(await GET(callbackRequest({ state, code: 'SYNTHETIC_CODE', workspace: otherWorkspace })));
    expect(Object.fromEntries(url.searchParams)).toEqual({ view: 'connections', google: 'expired' });
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it.each([{}, { state: 'short' }, { state: 'x'.repeat(257) }])('rejects malformed state before database or provider access: %j', async (params) => {
    const url = destination(await GET(callbackRequest({ code: 'SYNTHETIC_CODE', ...params })));
    expect(Object.fromEntries(url.searchParams)).toEqual({ view: 'connections', google: 'expired' });
    expect(mocks.authClient).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it('sanitizes token-exchange failure while retaining only the resolved workspace', async () => {
    mocks.exchange.mockRejectedValue(new Error('provider details with SYNTHETIC_SECRET and private account info'));
    const response = await GET(callbackRequest({ state, code: 'SYNTHETIC_CODE' }));
    expect(Object.fromEntries(destination(response).searchParams)).toEqual({ view: 'connections', workspace, google: 'failed' });
    expect(await response.text()).not.toMatch(/SYNTHETIC|private account/);
    expect(mocks.finish).not.toHaveBeenCalled();
  });

  it('returns failure when persistence fails, without presenting an unrecorded connection', async () => {
    mocks.finish.mockRejectedValue(new Error('SYNTHETIC_DATABASE_SECRET'));
    const url = destination(await GET(callbackRequest({ state, code: 'SYNTHETIC_CODE' })));
    expect(Object.fromEntries(url.searchParams)).toEqual({ view: 'connections', workspace, google: 'failed' });
    expect(url.searchParams.has('connection')).toBe(false);
  });

  it('consumes valid state but declines missing codes and unknown provider errors', async () => {
    for (const params of [{ state }, { state, error: 'SYNTHETIC_PROVIDER_ERROR' }]) {
      const url = destination(await GET(callbackRequest(params)));
      expect(Object.fromEntries(url.searchParams)).toEqual({ view: 'connections', workspace, google: 'failed' });
    }
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it('retains canonical callback rejection before resolving state or redirecting', async () => {
    const response = await GET(new Request(`https://wrong-origin.example.invalid/api/google/callback?${new URLSearchParams({ state, code: 'SYNTHETIC_CODE' })}`));
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('CALLBACK_URI_DENIED');
    expect(response.headers.get('location')).toBeNull();
    expect(mocks.authClient).not.toHaveBeenCalled();
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
});

describe('Google OAuth initiation', () => {
  it.each(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'])('requires %s before creating an OAuth state', async (key) => {
    delete mocks.env[key];
    const response = await POST(connectRequest());
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe('GOOGLE_UNCONFIGURED');
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('consume_request_quota', { p_workspace: workspace, p_scope: 'commands' });
  });

  it('still checks request origin before authorization or database calls', async () => {
    const response = await POST(connectRequest('https://attacker.example.invalid'));
    expect(response.status).toBe(403);
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('preserves sensitive authorization, quota and PKCE-backed state before providing the Google URL', async () => {
    const response = await POST(connectRequest());
    expect(response.status).toBe(200);
    const url = new URL((await response.json()).url);
    expect(mocks.authorize).toHaveBeenCalledWith(workspace, true);
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(['consume_request_quota', 'begin_google_oauth']);
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('redirect_uri')).toBe(callback);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('openid email https://www.googleapis.com/auth/drive.file');
    expect(url.searchParams.has('client_secret')).toBe(false);
    expect(mocks.rpc.mock.calls[1][1]).toMatchObject({ p_workspace_id: workspace, p_redirect_uri: callback, p_state_hash: hashOAuthState(url.searchParams.get('state')!) });
  });

  it('does not create a state after a rejected quota', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: 'quota_denied' } });
    const response = await POST(connectRequest());
    expect(response.status).toBe(429);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});
