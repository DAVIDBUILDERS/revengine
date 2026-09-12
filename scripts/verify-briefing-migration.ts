/** Exercise the pending migration with every SQL suite, rolling back DDL and test data each time. */
import {readFile,readdir} from 'node:fs/promises';
import {database,nonproductionTarget} from './runtime';
const target=nonproductionTarget(),sql=database(target.url);
const migration=(await readFile('supabase/migrations/202609110022_conversational_briefing.sql','utf8')).replace(/^begin;$/m,'').replace(/^commit;$/m,'');
try{
 for(const file of (await readdir('supabase/tests')).filter(f=>f.endsWith('.sql')).sort()){
  const suite=await readFile(`supabase/tests/${file}`,'utf8');
  if(!/^begin;$/mi.test(suite)||!/^rollback;/mi.test(suite))throw new Error('Suite must own explicit rollback transactions');
  // Preserve deliberate rollback/rebind boundaries in pooled-context security tests.
  await sql.unsafe(suite.replace(/^begin;$/mi,()=>`begin;\n${migration}`));
  console.log(`PASS pending migration 022 + ${file} (rolled back)`);
 }
}catch(error){await sql.unsafe('rollback').catch(()=>{});console.error(error instanceof Error?error.message:'SQL verification failed');process.exitCode=1;}finally{await sql.end();}
