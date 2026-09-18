import { describe,it,expect } from 'vitest';
import { environment, assertMigrationTarget } from '../packages/orchestration/src/environment';
import { Command, ProposalRecord, ForecastScenario } from '../packages/contracts/src';
import { redact } from '../packages/observability/src';
describe('deployment and schema safety boundaries',()=>{
  it('allows offline fixtures without credentials, blocks cloud impersonation and real secrets',()=>{
    expect(environment({}).DAVID_MODE).toBe('fixture');
    for(const values of [{VERCEL:'1'},{DAVID_DEPLOYMENT:'test'},{GOOGLE_CLIENT_SECRET:'secret'},{WORKER_DATABASE_URL:'secret'},{AI_GATEWAY_API_KEY:'secret'},{PRIVACY_DATABASE_URL:'secret'},{PRIVACY_STORAGE_SERVICE_KEY:'secret'},{INSTANTLY_API_KEY:'secret'},{DATAFORSEO_LOGIN:'secret'},{DATAFORSEO_PASSWORD:'secret'},{DATAFORSEO_WEBHOOK_SECRET:'secret'},{ELEVENLABS_API_KEY:'secret'}])expect(()=>environment(values)).toThrow();
  });
  it('rejects preview live activation, production data in test and wrong project',()=>{
    const base={DAVID_MODE:'shadow',DAVID_DEPLOYMENT:'test',NEXT_PUBLIC_SUPABASE_URL:'https://testref.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public',EXPECTED_SUPABASE_PROJECT_ID:'testref'};
    expect(environment(base).DAVID_MODE).toBe('shadow');
    expect(()=>environment({...base,PRODUCTION_SUPABASE_PROJECT_ID:'testref'})).toThrow('PRODUCTION_DATA_DENIED');
    expect(()=>environment({...base,EXPECTED_SUPABASE_PROJECT_ID:'wrong'})).toThrow('PROJECT_MISMATCH');
    expect(()=>environment({...base,DAVID_LIVE_EXECUTION:'true'})).toThrow('LIVE_EXECUTION_DENIED');
  });
  it('refuses migrations before target verification',()=>{
    expect(()=>assertMigrationTarget({})).toThrow('MIGRATION_SETUP_MISSING');
    expect(()=>assertMigrationTarget({EXPECTED_SUPABASE_PROJECT_ID:'a',CONFIRMED_DATABASE_PROJECT_ID:'a',MIGRATION_DATABASE_URL:'postgres://postgres:secret@db.b.supabase.co/postgres'})).toThrow('CONNECTION_MISMATCH');
  });
  it('binds every runtime role to the same hosted project, including pooled usernames',()=>{
    const base={DAVID_MODE:'shadow',NEXT_PUBLIC_SUPABASE_URL:'https://testref.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public',EXPECTED_SUPABASE_PROJECT_ID:'testref'};
    expect(()=>environment({...base,WORKER_DATABASE_URL:'postgres://david_worker:fake@db.wrong.supabase.co/postgres'})).toThrow('DATABASE_PROJECT_MISMATCH');
    expect(()=>environment({...base,DISPATCHER_DATABASE_URL:'postgres://david_dispatcher.testref:fake@malicious.example/postgres'})).toThrow('DATABASE_PROJECT_MISMATCH');
    expect(environment({...base,WORKER_DATABASE_URL:'postgres://david_worker.testref:fake@aws-0-us-east-1.pooler.supabase.com/postgres'}).DAVID_MODE).toBe('shadow');
    expect(()=>environment({...base,DAVID_DEPLOYMENT:'production',PRODUCTION_SUPABASE_PROJECT_ID:'testref',VERCEL_ENV:'preview'})).toThrow('PREVIEW_PRODUCTION_DENIED');
    expect(()=>environment({...base,DAVID_DEPLOYMENT:'production',PRODUCTION_SUPABASE_PROJECT_ID:'different'})).toThrow('PRODUCTION_PROJECT_MISMATCH');
  });
  it('rejects unsupported tool calls, extra authority fields and unsafe currency values',()=>{
    expect(Command.safeParse({type:'send_anything',recipient:'intruder@example.com'}).success).toBe(false);
    expect(Command.safeParse({type:'pause',paused:false,role:'david_operator'}).success).toBe(false);
    expect(ProposalRecord.shape.amountMinor.safeParse(Number.MAX_SAFE_INTEGER+1).success).toBe(false);
    expect(ForecastScenario.shape.conversions.safeParse([{label:'wins',low:.8,base:.4,high:.9}]).success).toBe(false);
  });
  it('redacts nested secrets, database URLs and body data from retained logs',()=>{
    const safe=JSON.stringify(redact({token:'bad',nested:{authorization:'Bearer bad',message:'postgres://person:password@host/db'},body:'private email'}));
    expect(safe).not.toContain('password');expect(safe).not.toContain('bad');expect(safe).not.toContain('private email');
  });
});
