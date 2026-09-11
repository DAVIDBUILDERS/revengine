import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Id, WorkspaceContext } from '../../../packages/contracts/src';
import { environment } from '../../../packages/orchestration/src/environment';
import { HttpError } from './http';

export async function authClient() {
  const env = environment();
  if (env.DAVID_MODE === 'fixture') throw new HttpError(409, 'FIXTURE_AUTH_DISABLED', 'Local fixture mode does not use customer authentication.');
  const jar = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: { secure: new URL(env.APP_ORIGIN).protocol === 'https:', sameSite: 'lax', path: '/' },
    cookies: { getAll: () => jar.getAll(), setAll: values => { for (const {name,value,options} of values) jar.set(name, value, options); } },
  });
}
export async function authorize(workspaceId: string, sensitive = false) {
  Id.parse(workspaceId);
  const client = await authClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) throw new HttpError(401, 'AUTH_REQUIRED', 'Sign in with your invited DAVID account.');
  if (sensitive) {
    const result = await client.auth.getUser();
    if (result.error || result.data.user?.id !== data.claims.sub) throw new HttpError(401, 'AUTH_EXPIRED', 'Sign in again before making this change.');
  }
  const {data: member, error: membershipError} = await client.from('memberships').select('id,role').eq('workspace_id', workspaceId).eq('actor_id',data.claims.sub).eq('active',true).maybeSingle();
  if (membershipError || !member) throw new HttpError(403, 'WORKSPACE_DENIED', 'You are not assigned to this workspace.');
  if (member.role === 'david_operator' && data.claims.aal !== 'aal2') throw new HttpError(403, 'OPERATOR_MFA_REQUIRED', 'Use multi-factor authentication for operator access.');
  const role = member.role;
  const context = WorkspaceContext.parse({ schemaVersion:1, actorId:data.claims.sub, membershipId:member.id,workspaceId,role,environment:environment().DAVID_MODE,assurance:data.claims.aal === 'aal2' ? 'aal2':'aal1',permittedOperations:role === 'workspace_viewer' ? ['read'] : role === 'workspace_member' ? ['read','prepare'] : ['read','prepare','approve','configure','pause'] });
  return { client, context };
}
