import postgres from 'postgres';
import { z } from 'zod';

const Uuid = z.uuid();
export type Transaction = postgres.TransactionSql;
export type DispatchClaim = { outbox_id: string; run_id: string; event_type: string; payload: Record<string, unknown>; lease_token: string };
export type DatabaseOptions = { workerUrl: string; dispatcherUrl: string; ca?: string; oauthUrl?: string };

/** Module-scoped bounded pools. Transaction pooler supports no named prepared statements. */
function pool(url: string, role: string, ca?: string) {
  const parsed = new URL(url);
  if (!['postgres:','postgresql:'].includes(parsed.protocol) || !(decodeURIComponent(parsed.username)===role||decodeURIComponent(parsed.username).startsWith(`${role}.`))) throw new Error(`Expected the restricted ${role} login`);
  if (parsed.searchParams.has('sslmode')) parsed.searchParams.delete('sslmode'); // driver options below verify the peer, never downgrade
  return postgres(parsed.toString(), { max: 1, prepare: false, connect_timeout: 8, idle_timeout: 20, max_lifetime: 300,
    ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) }, connection: { statement_timeout: 15000, application_name: 'david-engine' } });
}
export function createDatabase(options: DatabaseOptions) {
  const worker = pool(options.workerUrl, 'david_worker', options.ca);
  const dispatcher = pool(options.dispatcherUrl, 'david_dispatcher', options.ca);
  const oauth = options.oauthUrl ? pool(options.oauthUrl, 'david_oauth', options.ca) : null;
  return {
    async withRun<T>(runId: string, operation: (tx: Transaction) => Promise<T>): Promise<T> {
      Uuid.parse(runId);
      const [route] = await dispatcher<{run_id:string;route_token:string}[]>`select * from private.route_run(${runId}::uuid)`;
      if (!route) throw new Error('Unknown or unroutable run');
      // The capability binds a routing record. No caller-supplied workspace reaches SET or RLS.
      const result = await worker.begin(async tx => {
        await tx`select private.bind_run(${runId}::uuid,${route.route_token}::uuid)`;
        return await operation(tx);
      });
      return result as T;
    },
    async claimDue(limit = 25): Promise<DispatchClaim[]> {
      z.number().int().min(1).max(100).parse(limit);
      return await dispatcher<DispatchClaim[]>`select * from private.claim_due(${limit})`;
    },
    async ingestInstantlyWebhook(payload: unknown): Promise<string> {
      const jsonPayload = JSON.parse(JSON.stringify(payload)) as postgres.JSONValue;
      const [row] = await dispatcher<{ingest_instantly_webhook:string}[]>`select private.ingest_instantly_webhook(${dispatcher.json(jsonPayload)}::jsonb) as ingest_instantly_webhook`;
      return row?.ingest_instantly_webhook ?? 'ignored';
    },
    async finishDispatch(outboxId: string, leaseToken: string, workflowId: string | null): Promise<boolean> {
      Uuid.parse(outboxId); Uuid.parse(leaseToken);
      const [row] = await dispatcher<{done:boolean}[]>`select private.finish_dispatch(${outboxId}::uuid,${leaseToken}::uuid,${workflowId}) as done`;
      return row?.done ?? false;
    },
    async retryDispatch(outboxId: string, leaseToken: string, reason: string): Promise<void> {
      Uuid.parse(outboxId); Uuid.parse(leaseToken);
      await dispatcher`select private.retry_dispatch(${outboxId}::uuid,${leaseToken}::uuid,${reason.slice(0,200)})`;
    },
    async finishOAuth(input: { stateHash: string; subject: string; email: string; scopes: string[]; tokens: {accessToken:string;refreshToken?:string}; expiresAt: string }): Promise<string> {
      if (!oauth) throw new Error('DAVID_OAUTH_DATABASE_URL is required for the restricted OAuth broker');
      const [row] = await oauth<{id:string}[]>`select private.finish_google_oauth(${input.stateHash},${input.subject},${input.email},${input.scopes}::text[],${oauth.json(input.tokens)},${input.expiresAt}::timestamptz) as id`;
      if (!row) throw new Error('OAuth completion failed');
      return row.id;
    },
    async close() { await Promise.all([worker.end({timeout:5}),dispatcher.end({timeout:5}),...(oauth ? [oauth.end({timeout:5})] : [])]); }
  };
}
export type Database = ReturnType<typeof createDatabase>;

/** Only call within a connector operation; never return these records from a Workflow step. */
export function createVaultSecretStore(database: Database, runId: string) {
  return {
    async read(connectionId: string, operation: string) {
      return await database.withRun(runId, async tx => {
        const [row] = await tx<{token: {accessToken:string;refreshToken?:string;expiresAt:string}}[]>`select private.connection_token(${Uuid.parse(connectionId)}::uuid,${operation}) as token`;
        if (!row?.token) throw new Error('Connection requires reauthorization');
        return row.token;
      });
    },
    async acquireRefresh(connectionId: string): Promise<string|null> {
      return await database.withRun(runId, async tx => {
        const [row] = await tx<{lease:string|null}[]>`select private.lease_token_refresh(${Uuid.parse(connectionId)}::uuid) as lease`;
        return row?.lease ?? null;
      });
    },
    async storeRefresh(connectionId: string, lease: string, tokens: {accessToken:string;refreshToken?:string;expiresAt:string}) {
      await database.withRun(runId, async tx => {
        await tx`select private.store_refreshed_token(${Uuid.parse(connectionId)}::uuid,${Uuid.parse(lease)}::uuid,${tx.json({accessToken:tokens.accessToken,...(tokens.refreshToken ? {refreshToken:tokens.refreshToken} : {})})},${tokens.expiresAt}::timestamptz)`;
      });
    },
    async expire(connectionId: string) {
      await database.withRun(runId, async tx => { await tx`select private.expire_connection(${Uuid.parse(connectionId)}::uuid)`; });
    }
  };
}
