import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { environment } from '../../packages/orchestration/src/environment';

export async function proxy(request: NextRequest) {
  const env = environment();
  if (env.DAVID_MODE === 'fixture') return NextResponse.next();
  let response = NextResponse.next({request});
  const client = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: {secure: new URL(env.APP_ORIGIN).protocol === 'https:', sameSite:'lax', path:'/'},
    cookies: {getAll: () => request.cookies.getAll(), setAll(values) { for(const {name,value} of values) request.cookies.set(name,value); response=NextResponse.next({request}); for(const {name,value,options} of values) response.cookies.set(name,value,options); }},
  });
  await client.auth.getClaims();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
// Workflow-managed requests must not go through application session middleware.
export const config = {matcher: ['/((?!_next/static|_next/image|favicon.ico|\.well-known/workflow|api/cron).*)']};
