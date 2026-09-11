import {blocked} from './runtime';
const origin=process.env.APP_ORIGIN;const secret=process.env.CRON_SECRET;
if(!origin||!secret)blocked('APP_ORIGIN and CRON_SECRET for the explicitly bound test deployment are required.');
if(!process.env.EXPECTED_VERCEL_PROJECT_ID||!process.env.EXPECTED_SUPABASE_PROJECT_ID)blocked('Explicit Vercel and Supabase project bindings are required.');
const response=await fetch(new URL('/api/cron',origin),{headers:{authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(55000)});
console.log(`Dispatcher ${response.status}: ${await response.text()}`);if(!response.ok)process.exitCode=1;
