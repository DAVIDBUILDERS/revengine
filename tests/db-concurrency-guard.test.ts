import {describe,it,expect} from 'vitest';
import {concurrencyTarget} from '../scripts/db-concurrency-target';
const base={TEST_SUPABASE_PROJECT_ID:'testref',PRODUCTION_SUPABASE_PROJECT_ID:'prodref',TEST_DATABASE_URL:'postgres://postgres:synthetic@db.testref.supabase.co/postgres',TEST_WORKER_DATABASE_URL:'postgres://david_worker.testref:synthetic@aws-0-us-east-1.pooler.supabase.com/postgres',TEST_DISPATCHER_DATABASE_URL:'postgres://david_dispatcher.testref:synthetic@aws-0-us-east-1.pooler.supabase.com/postgres'};
describe('hosted concurrency target guard (offline; no database connections)',()=>{
 it('requires all isolated project and restricted role credentials before connecting',()=>{for(const key of Object.keys(base))expect(()=>concurrencyTarget({...base,[key]:undefined})).toThrow('SETUP_MISSING');});
 it('refuses production, another project and username suffix spoofing',()=>{
  expect(()=>concurrencyTarget({...base,PRODUCTION_SUPABASE_PROJECT_ID:'testref'})).toThrow('PRODUCTION_DENIED');
  expect(()=>concurrencyTarget({...base,TEST_DATABASE_URL:'postgres://postgres:synthetic@db.prodref.supabase.co/postgres'})).toThrow('MISMATCH');
  expect(()=>concurrencyTarget({...base,TEST_WORKER_DATABASE_URL:'postgres://david_worker.testref:synthetic@attacker.invalid/postgres'})).toThrow('MISMATCH');
  expect(()=>concurrencyTarget({...base,TEST_WORKER_DATABASE_URL:'postgres://postgres.testref:synthetic@aws-0-us-east-1.pooler.supabase.com/postgres'})).toThrow('MISMATCH');
 });
 it('accepts only explicitly bound PostgreSQL roles and removes URL TLS overrides',()=>{
  expect(concurrencyTarget(base).ref).toBe('testref');
  expect(concurrencyTarget({...base,TEST_DATABASE_URL:base.TEST_DATABASE_URL+'?sslmode=disable'}).adminUrl).not.toContain('sslmode');
  expect(()=>concurrencyTarget({...base,TEST_DATABASE_URL:'https://postgres:synthetic@db.testref.supabase.co/postgres'})).toThrow('MISMATCH');
 });
});
