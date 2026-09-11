import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import type postgres from 'postgres';
import {database,blocked} from './runtime';
import {concurrencyTarget} from './db-concurrency-target';

type Tx=postgres.TransactionSql;
type Pool=ReturnType<typeof database>;
type Claim={claim_token:string;fence:number};
let target:ReturnType<typeof concurrencyTarget>;
try{target=concurrencyTarget(process.env);}catch(error){blocked(error instanceof Error?error.message:'CONCURRENCY_SETUP_MISSING');}
const admin=database(target.adminUrl),actors=[database(target.adminUrl),database(target.adminUrl)] as const;
const workers=[database(target.workerUrl),database(target.workerUrl)] as const,dispatchers=[database(target.dispatcherUrl),database(target.dispatcherUrl)] as const;
const pools=[admin,...actors,...workers,...dispatchers];
const ids=new Map<string,string>();const id=(suffix:string)=>{const original=`a2000000-0000-4000-8000-${suffix.padStart(12,'0')}`;if(!ids.has(original))ids.set(original,randomUUID());return ids.get(original)!;};
const workspace=id('10'),owner=id('1'),operator=id('2'),run=id('110'),action=id('120');
const marker=`DAVID_SQL_CONCURRENCY_ONLY_${randomUUID()}`;
const testEmail=(name:string)=>`${name}-${workspace}@example.invalid`;
let seeded=false;
function ensure(condition:unknown,message:string):asserts condition {if(!condition)throw new Error(message);}

/** Two open transactions rendezvous before executing competing operations. Pooler backends
 * must differ while both transactions are held; Promise concurrency alone is not evidence. */
async function race<T>(label:string,role:string,participants:readonly[(meet:(tx:Tx)=>Promise<void>)=>Promise<T>,(meet:(tx:Tx)=>Promise<void>)=>Promise<T>]):Promise<T[]> {
 let release!:()=>void;let fail!:(error:Error)=>void;const gate=new Promise<void>((resolve,reject)=>{release=resolve;fail=reject;});
 const sessions:{pid:number;role:string}[]=[];const timeout=setTimeout(()=>fail(new Error(`${label}: session rendezvous timed out`)),12000);
 const meet=async(tx:Tx)=>{const [session]=await tx<{pid:number;role:string}[]>`select pg_backend_pid() pid,current_user::text role`;sessions.push(session);if(sessions.length===2)release();await gate;};
 const results=await Promise.allSettled(participants.map(participant=>participant(meet)));clearTimeout(timeout);
 ensure(sessions.length===2&&sessions[0].pid!==sessions[1].pid&&sessions.every(session=>session.role===role),`${label}: two independent ${role} sessions were not established`);
 const rejected=results.find(result=>result.status==='rejected');if(rejected)throw new Error(`${label}: transaction failed (${String((rejected.reason as {code?:string})?.code??'assertion or connection error')})`);
 return results.map(result=>(result as PromiseFulfilledResult<T>).value);
}
async function scoped<T>(worker:Pool,dispatcher:Pool,operation:(tx:Tx)=>Promise<T>):Promise<T>{
 const [route]=await dispatcher<{route_token:string}[]>`select * from private.route_run(${run}::uuid)`;ensure(route,'Fixture run is not routable');
 return await worker.begin(async tx=>{await tx`select private.bind_run(${run}::uuid,${route.route_token}::uuid)`;return await operation(tx);}) as T;
}
async function cleanup(){
 await admin.begin(async tx=>{
  const [owned]=await tx`select id from public.workspaces where id=${workspace}::uuid and name=${marker} for update`;ensure(owned,'Cleanup ownership marker missing; refusing deletion');
  // Explicit dependency order, equality-bound to this invocation's UUID. No global tables,
  // provider state, other workspace rows or shared billing limits are changed.
  for(const table of ['private.transaction_context','private.wait_registrations','private.outbox','private.run_routes','private.budget_counters','public.approvals','public.receipts','public.actions','public.audit_events','public.live_activations','public.runs','public.installations','public.policies','public.proposals','public.opportunities','public.contacts','public.accounts','public.source_bindings','public.connections','public.memberships'])await tx.unsafe(`delete from ${table} where workspace_id=$1`,[workspace]);
  await tx`delete from public.workspaces where id=${workspace}::uuid and name=${marker}`;
  await tx`delete from auth.users where (id=${owner}::uuid and email=${testEmail('action-owner')}) or (id=${operator}::uuid and email=${testEmail('action-operator')})`;
 });
}
try{
 // Reuse the actual SQL003 setup, replace every UUID/email, and commit only this fixture.
 // No next_due_at is exposed; approval outbox rows are deferred inside their creating TX.
 const source=await readFile('supabase/tests/003_actions.sql','utf8');const start=source.indexOf('insert into auth.users');const end=source.indexOf("select set_config('test.route_token'");ensure(start>=0&&end>start,'SQL003 fixture boundary changed; review seed before running');
 let seed=source.slice(start,end).replace(/a2000000-0000-4000-8000-[0-9]{12}/g,value=>{if(!ids.has(value))ids.set(value,randomUUID());return ids.get(value)!;});
 seed=seed.replace(/([a-z-]+)@example\.invalid/g,(_,name:string)=>testEmail(name)).replace("'Action fixture'",`'${marker}'`).replace("'scheduled',now()-interval '1 hour'","'scheduled',null");
 ensure(!seed.includes("now()-interval '1 hour'"),'Unexpected due fixture run');
 await admin.begin(async tx=>{await tx.unsafe(seed);});seeded=true;
 console.log(`Hosted concurrency fixture committed: project=${target.ref}, workspace=${workspace}. No provider calls are made.`);
 await scoped(workers[0],dispatchers[0],async tx=>{await tx`select private.create_action(${action}::uuid,${id('60')}::uuid,${id('80')}::uuid,'send_follow_up',${tx.json({recipient:testEmail('customer'),proposalVersion:1,subject:'Approved subject',body:'Approved text'})},${'a'.repeat(64)},${id('90')}::uuid,10,now()+interval '1 hour')`;});
 const approvals=await race('duplicate approval','authenticated',actors.map(actor=>async(meet:(tx:Tx)=>Promise<void>)=>await actor.begin(async tx=>{
  await tx`set local role authenticated`;await tx`select set_config('request.jwt.claims',${JSON.stringify({sub:owner,role:'authenticated',aal:'aal1'})},true)`;await meet(tx);
  const [decision]=await tx<{id:string}[]>`select public.decide_action(${action}::uuid,'approved',${'a'.repeat(64)}) id`;
  // Authenticated operation above is the tested path. Only isolated test admin can defer
  // its own outbox before commit, preventing background dispatch of synthetic records.
  await tx`reset role`;await tx`update private.outbox set due_at=now()+interval '1 day' where workspace_id=${workspace}::uuid`;
  return decision.id;
 }) as string) as [(meet:(tx:Tx)=>Promise<void>)=>Promise<string>,(meet:(tx:Tx)=>Promise<void>)=>Promise<string>]);
 ensure(approvals[0]===approvals[1],'Duplicate decisions returned different approval IDs');
 const [decisionCounts]=await admin<{approvals:number;outbox:number}[]>`select (select count(*)::integer from public.approvals where workspace_id=${workspace}::uuid and action_id=${action}::uuid and status='approved') approvals,(select count(*)::integer from private.outbox where workspace_id=${workspace}::uuid and event_type='approval_decided') outbox`;
 ensure(decisionCounts.approvals===1&&decisionCounts.outbox===1,'Duplicate approval/outbox was committed');console.log('PASS hosted: concurrent exact approval commits one decision and one outbox event.');
 const reservations=await race<Claim[]>('action reservation','david_worker',[
  meet=>scoped(workers[0],dispatchers[0],async tx=>{await meet(tx);return await tx<Claim[]>`select * from private.reserve_action(${action}::uuid)`;}),
  meet=>scoped(workers[1],dispatchers[1],async tx=>{await meet(tx);return await tx<Claim[]>`select * from private.reserve_action(${action}::uuid)`;})
 ]);
 const claims=reservations.flat();ensure(claims.length===1,'Concurrent reservation did not produce exactly one claim');
 const [budget]=await admin<{actions:number;reserved_minor:string}[]>`select actions,reserved_minor from private.budget_counters where workspace_id=${workspace}::uuid`;ensure(budget.actions===1&&Number(budget.reserved_minor)===10,'Concurrent reservation duplicated budget consumption');
 const claim=claims[0];const submissions=await race<boolean>('final submission fence','david_worker',[
  meet=>scoped(workers[0],dispatchers[0],async tx=>{await meet(tx);const [row]=await tx<{accepted:boolean}[]>`select private.mark_submitting(${action}::uuid,${claim.claim_token}::uuid,${claim.fence}) accepted`;return row.accepted;}),
  meet=>scoped(workers[1],dispatchers[1],async tx=>{await meet(tx);const [row]=await tx<{accepted:boolean}[]>`select private.mark_submitting(${action}::uuid,${claim.claim_token}::uuid,${claim.fence}) accepted`;return row.accepted;})
 ]);ensure(submissions.filter(Boolean).length===1,'Concurrent final fence authorized more or fewer than one dispatch');
 const [record]=await admin<{status:string;receipts:number}[]>`select status,(select count(*)::integer from public.receipts where workspace_id=${workspace}::uuid) receipts from public.actions where id=${action}::uuid and workspace_id=${workspace}::uuid`;ensure(record.status==='submitting'&&record.receipts===0,'SQL gate manufactured provider evidence');
 console.log('PASS hosted: independent workers reserve once, consume budget once and permit one final submission fence. No provider submission occurred.');
 console.log('NOT TESTED: global claim_due/model budget races, deployed Workflow concurrency and provider idempotency. Shared global state is not changed by this harness.');
}catch(error){console.error(`FAIL hosted concurrency: ${error instanceof Error&&!(error as {code?:string}).code?error.message:'database operation failed; inspect the isolated project with the assigned operator'}`);process.exitCode=1;}
finally{
 if(seeded){try{await cleanup();console.log(`Removed only concurrency fixture workspace ${workspace} and its two synthetic Auth users.`);}catch{
  try{await admin`update public.workspaces set paused=true where id=${workspace}::uuid and name=${marker}`;}catch{/* exact recovery IDs below remain available */}
  console.error(`CLEANUP REQUIRED: workspace=${workspace}; owner=${owner}; operator=${operator}; marker=${marker}. Only these committed synthetic records belong to this run. Workspace pause was attempted. Retain the record and review FK blockers before removing it.`);process.exitCode=1;
 }}
 await Promise.allSettled(pools.map(pool=>pool.end({timeout:5})));
}
