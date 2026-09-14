import {beforeEach,expect,it,vi} from 'vitest';

// Synthetic orchestration checks: no credentials or provider requests.
const harness=vi.hoisted(()=>({resourceCount:0,fence:1 as number|null,queries:[] as string[]}));
vi.mock('workflow',()=>({getWorkflowMetadata:()=>({workflowRunId:'synthetic-source-workflow'})}));
vi.mock('../packages/orchestration/src/database',()=>({runtimeDatabase:()=>({
 withRun:async(_runId:string,fn:(tx:unknown)=>Promise<unknown>)=>fn(async(strings:TemplateStringsArray)=>{
  const query=strings.join('?');harness.queries.push(query);
  if(query.includes('private.claim_run'))return [{fence:harness.fence}];
  if(query.includes('select s.id'))return Array.from({length:harness.resourceCount},(_,i)=>({id:`synthetic-binding-${i}`}));
  if(query.includes('private.block_run'))return [];
  throw new Error(`Unexpected database query: ${query}`);
 }),
})}));
import {connectionCheckV1} from '../apps/web/workflows/source-check-v1';

beforeEach(()=>{harness.resourceCount=0;harness.fence=1;harness.queries=[];});
it.each([0,11])('records a blocked source check when %i resources remain at dispatch',async count=>{
 harness.resourceCount=count;
 expect(await connectionCheckV1('synthetic-run')).toEqual({status:'blocked',externalWritesVerified:false});
 expect(harness.queries.some(query=>query.includes('private.block_run'))).toBe(true);
 expect(harness.queries.some(query=>query.includes('private.record_connection_check'))).toBe(false);
});
it('leaves an already claimed source check alone',async()=>{
 harness.fence=null;
 expect(await connectionCheckV1('synthetic-run')).toEqual({status:'duplicate'});
 expect(harness.queries).toHaveLength(1);
});
