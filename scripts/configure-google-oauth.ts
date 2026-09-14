// Platform administration only: this does not grant Google account access.
import { assertMigrationTarget } from '../packages/orchestration/src/environment';
import { blocked, database } from './runtime';

const mode = process.argv[2];
if (!['preview', 'apply'].includes(mode)) blocked('Use configure-google-oauth.ts preview|apply <https-origin>.');
const origin = new URL(process.argv[3] ?? '');
if (origin.protocol !== 'https:' || origin.origin !== process.argv[3]) {
  blocked('Provide the exact HTTPS application origin without path, credentials, query or fragment.');
}
const target = assertMigrationTarget(process.env);
const redirectUri = `${origin.origin}/api/google/callback`;
const sql = database(target.connection);
try {
  const [role] = await sql`select rolcanlogin, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
    from pg_roles where rolname = 'david_oauth'`;
  if (!role?.rolcanlogin || role.rolsuper || role.rolbypassrls || role.rolcreatedb || role.rolcreaterole) {
    blocked('The restricted david_oauth login must be provisioned before configuring Google.');
  }
  const existing = await sql`select redirect_uri from private.allowed_oauth_redirects where redirect_uri = ${redirectUri}`;
  if (mode === 'apply') {
    await sql`insert into private.allowed_oauth_redirects (redirect_uri) values (${redirectUri}) on conflict do nothing`;
  }
  console.log(JSON.stringify({
    project: target.expected,
    redirectUri,
    mode,
    status: mode === 'apply' ? 'allowlisted' : existing.length ? 'already allowlisted' : 'will add exact callback',
    restrictedOAuthRole: 'verified',
    accountAccess: 'Requires owner consent and separate source verification',
  }));
} finally {
  await sql.end();
}
