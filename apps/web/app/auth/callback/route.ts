import { NextResponse } from 'next/server';
import { authClient } from '../../../lib/auth';
import { environment } from '../../../../../packages/orchestration/src/environment';
export async function GET(request:Request){
 const url=new URL(request.url);const code=url.searchParams.get('code');const next=url.searchParams.get('next');
 const target=next==='/account'?'/account':'/start';
 if(code){const client=await authClient();const {error}=await client.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(target,environment().APP_ORIGIN));}
 return NextResponse.redirect(new URL('/login?confirmation=failed',environment().APP_ORIGIN));
}
