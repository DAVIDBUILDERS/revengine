import { z } from 'zod';

const optional = z.string().min(1).optional();
export const Environment = z.object({
  DAVID_MODE: z.enum(['fixture', 'shadow', 'live']).default('fixture'),
  DAVID_DEPLOYMENT: z.enum(['local', 'test', 'production', 'demo']).default('local'),
  DAVID_LIVE_EXECUTION: z.enum(['false', 'true']).default('false'),
  VERCEL: optional, VERCEL_ENV: optional, VERCEL_PROJECT_ID: optional, EXPECTED_VERCEL_PROJECT_ID: optional,
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(), NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optional,
  EXPECTED_SUPABASE_PROJECT_ID: optional, PRODUCTION_SUPABASE_PROJECT_ID: optional,
  WORKER_DATABASE_URL: optional, DISPATCHER_DATABASE_URL: optional, DATABASE_CA_CERT: optional,
  DAVID_OAUTH_DATABASE_URL: optional,
  GOOGLE_CLIENT_ID: optional, GOOGLE_CLIENT_SECRET: optional, GOOGLE_REDIRECT_URI: z.url().optional(),
  AI_GATEWAY_API_KEY: optional, AI_MODEL_ID: optional, AI_ALLOWED_PROVIDER: optional,
  APP_ORIGIN: z.url().default('http://localhost:3000'), CRON_SECRET: optional,
  FIXTURE_DATA_DIR: optional,
});
export type Environment = z.infer<typeof Environment>;
export function environment(input: Record<string, string | undefined> = process.env): Environment {
  const env = Environment.parse(input);
  const cloud = Boolean(env.VERCEL || env.VERCEL_ENV);
  if (env.DAVID_MODE === 'fixture') {
    if (cloud || env.DAVID_DEPLOYMENT !== 'local') throw new Error('FIXTURE_CLOUD_DENIED: Operational fixture authentication is local only. Use the separate demo app for public synthetic sessions.');
    const disallowed = ['GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'WORKER_DATABASE_URL', 'DISPATCHER_DATABASE_URL', 'DAVID_OAUTH_DATABASE_URL', 'AI_GATEWAY_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'MIGRATION_DATABASE_URL', 'TEST_DATABASE_URL', 'PRIVACY_DATABASE_URL', 'PRIVACY_STORAGE_SERVICE_KEY'];
    if (disallowed.some(key => Boolean(input[key]))) throw new Error('FIXTURE_CREDENTIALS_DENIED: Remove real sender, database, admin and model credentials from fixture mode.');
  }
  if (env.DAVID_MODE !== 'fixture') {
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !env.EXPECTED_SUPABASE_PROJECT_ID) throw new Error('SUPABASE_UNCONFIGURED: URL, publishable key and expected project ID are required.');
    const host = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname;
    if (host !== `${env.EXPECTED_SUPABASE_PROJECT_ID}.supabase.co`) throw new Error('SUPABASE_PROJECT_MISMATCH: The URL does not match the explicit expected project.');
    if (env.DAVID_DEPLOYMENT !== 'production' && env.EXPECTED_SUPABASE_PROJECT_ID === env.PRODUCTION_SUPABASE_PROJECT_ID) throw new Error('PRODUCTION_DATA_DENIED: Nonproduction must use a separate project.');
    if (env.VERCEL_ENV === 'preview' && (env.DAVID_DEPLOYMENT === 'production' || !env.PRODUCTION_SUPABASE_PROJECT_ID || env.EXPECTED_SUPABASE_PROJECT_ID === env.PRODUCTION_SUPABASE_PROJECT_ID)) throw new Error('PREVIEW_PRODUCTION_DENIED');
    if (env.DAVID_DEPLOYMENT === 'production' && env.EXPECTED_SUPABASE_PROJECT_ID !== env.PRODUCTION_SUPABASE_PROJECT_ID) throw new Error('PRODUCTION_PROJECT_MISMATCH');
    for (const key of ['WORKER_DATABASE_URL','DISPATCHER_DATABASE_URL','DAVID_OAUTH_DATABASE_URL'] as const) {
      if (!env[key]) continue;
      const connection = new URL(env[key]);
      const direct = connection.hostname === `db.${env.EXPECTED_SUPABASE_PROJECT_ID}.supabase.co`;
      const pooler = connection.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(connection.username).endsWith(`.${env.EXPECTED_SUPABASE_PROJECT_ID}`);
      if (!['postgres:','postgresql:'].includes(connection.protocol) || (!direct && !pooler)) throw new Error('DATABASE_PROJECT_MISMATCH: Every restricted runtime connection must match the expected hosted project.');
      if (connection.searchParams.get('sslmode') === 'disable') throw new Error('DATABASE_TLS_REQUIRED');
    }
  }
  if (cloud) {
    if (env.DAVID_DEPLOYMENT !== 'production' && !env.PRODUCTION_SUPABASE_PROJECT_ID) throw new Error('PRODUCTION_BOUNDARY_REQUIRED: Declare the production project ID so previews cannot accidentally use it.');
    if (!env.EXPECTED_VERCEL_PROJECT_ID || env.VERCEL_PROJECT_ID !== env.EXPECTED_VERCEL_PROJECT_ID) throw new Error('VERCEL_PROJECT_MISMATCH: Verify the intended Vercel project binding.');
    if (new URL(env.APP_ORIGIN).protocol !== 'https:') throw new Error('HTTPS_REQUIRED');
  }
  if (env.DAVID_LIVE_EXECUTION === 'true' && (env.DAVID_MODE !== 'live' || env.DAVID_DEPLOYMENT !== 'production' || env.VERCEL_ENV === 'preview')) throw new Error('LIVE_EXECUTION_DENIED: Explicit live mode and operational production deployment are required.');
  if (env.DAVID_MODE !== 'fixture' && (input.SUPABASE_SERVICE_ROLE_KEY || input.SUPABASE_SECRET_KEY || input.MIGRATION_DATABASE_URL || input.TEST_DATABASE_URL || input.PRIVACY_DATABASE_URL || input.PRIVACY_STORAGE_SERVICE_KEY)) throw new Error('ADMIN_CREDENTIAL_IN_RUNTIME: Keep migration/admin credentials out of the web runtime.');
  return env;
}

export function assertMigrationTarget(input: Record<string, string | undefined>) {
  const expected = input.EXPECTED_SUPABASE_PROJECT_ID;
  if (!expected || !input.MIGRATION_DATABASE_URL || !input.CONFIRMED_DATABASE_PROJECT_ID) throw new Error('MIGRATION_SETUP_MISSING: EXPECTED_SUPABASE_PROJECT_ID, CONFIRMED_DATABASE_PROJECT_ID and MIGRATION_DATABASE_URL are required.');
  if (expected !== input.CONFIRMED_DATABASE_PROJECT_ID) throw new Error('MIGRATION_TARGET_MISMATCH');
  const connection = new URL(input.MIGRATION_DATABASE_URL);
  const username = decodeURIComponent(connection.username);
  if (!['postgres:', 'postgresql:'].includes(connection.protocol)) throw new Error('MIGRATION_POSTGRES_REQUIRED');
  const bound = connection.hostname === `db.${expected}.supabase.co` || (connection.hostname.endsWith('.pooler.supabase.com') && username.endsWith(`.${expected}`));
  if (!bound) throw new Error('MIGRATION_CONNECTION_MISMATCH: Copy the actual direct or session-pooler connection for the expected project.');
  if (connection.searchParams.get('sslmode') === 'disable') throw new Error('DATABASE_TLS_REQUIRED');
  return { expected, connection: input.MIGRATION_DATABASE_URL };
}
