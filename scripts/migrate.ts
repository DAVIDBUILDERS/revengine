import {readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {assertMigrationTarget} from '../packages/orchestration/src/environment';
import {database,blocked} from './runtime';
const mode=process.argv[2];if(!['preview','apply'].includes(mode))blocked('Use db:preview or db:apply.');
let target;try{target=assertMigrationTarget(process.env);}catch(error){blocked(error instanceof Error?error.message:'Migration target configuration invalid');}
if(new URL(target.connection).port==='6543')blocked('Use the verified direct/session connection for migrations, not the transaction pooler.');
const files=(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
const sql=database(target.connection);
try{
  const [exists]=await sql`select to_regclass('david_migrations.versions') as table_name`;
  const applied=exists.table_name?await sql<{name:string;checksum:string}[]>`select name,checksum from david_migrations.versions`:[];
  const scripts=await Promise.all(files.map(async name=>{const content=await readFile(`supabase/migrations/${name}`,'utf8');const checksum=createHash('sha256').update(content).digest('hex');const previous=applied.find(a=>a.name===name);if(previous&&previous.checksum!==checksum)throw new Error(`Applied migration ${name} has changed; restore the original and add a new migration.`);return {name,content,checksum,pending:!previous};}));
  console.table(scripts.map(({name,pending})=>({name,status:pending?'pending':'applied'})));
  if(mode==='preview')console.log('PREVIEW ONLY: target binding checked; no schema writes or shadow database.');
  else{
    await sql`select pg_advisory_lock(18052026,1)`;
    try{
      await sql`create schema if not exists david_migrations`;await sql`revoke all on schema david_migrations from public`;
      await sql`create table if not exists david_migrations.versions(name text primary key,checksum text not null,applied_at timestamptz not null default now())`;
      for(const script of scripts.filter(s=>s.pending)){await sql.begin(async tx=>{
        const already=await tx`select name,checksum from david_migrations.versions where name=${script.name}`;if(already.length){if(already[0].checksum!==script.checksum)throw new Error('Concurrent migration checksum mismatch');return;}
        // Strip only standalone outer transaction commands; ledger and DDL commit atomically.
        const body=script.content.replace(/^\s*(begin|commit);\s*$/gmi,'');await tx.unsafe(body);
        await tx`insert into david_migrations.versions(name,checksum) values(${script.name},${script.checksum})`;
      });console.log(`APPLIED ${script.name}`);}
    }finally{await sql`select pg_advisory_unlock(18052026,1)`;}
  }
}catch(error){console.error(error instanceof Error?error.message:'Migration failed');process.exitCode=1;}finally{await sql.end();}
