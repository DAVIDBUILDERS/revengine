import {readFile,readdir} from 'node:fs/promises';
import {database,nonproductionTarget} from './runtime';
const target=nonproductionTarget();const sql=database(target.url);
try{
  const tests=(await readdir('supabase/tests')).filter(f=>f.endsWith('.sql')).sort();if(!tests.length)throw new Error('No hosted SQL tests found.');
  // Each SQL suite owns a rollback transaction and exercises normal Auth/worker roles.
  for(const test of tests){await sql.unsafe(await readFile(`supabase/tests/${test}`,'utf8'));console.log(`PASS hosted PostgreSQL: ${test}`);}
  console.log('Hosted SQL suites passed. Realtime, Storage HTTP, Auth cookie, restore and deployed workflow traces require their separate evidence.');
}catch(error){console.error(`FAIL hosted PostgreSQL: ${error instanceof Error?error.message:'unknown error'}`);process.exitCode=1;}finally{await sql.end();}
