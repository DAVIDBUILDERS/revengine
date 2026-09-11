import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {CSV_FIELDS,parseCsvImport} from '../packages/domain/src/csv';
import {normalizeSheetRows} from '../packages/orchestration/src/sheet-import';
const row=parseCsvImport(readFileSync('fixtures/proposals.csv','utf8')).rows[0];
it('maps explicit Sheet headers without inventing stable keys or enrollment',()=>{
 const fields=[...CSV_FIELDS,'gmail_thread_id'];
 const headers=fields.map(f=>`Source ${f}`);
 const result=normalizeSheetRows([headers,fields.map(f=>f==='gmail_thread_id'?'thread-real':row[f])],Object.fromEntries(fields.map((f,i)=>[f,headers[i]])));
 expect(result[0].gmail_thread_id).toBe('thread-real');expect(result[0].proposal_id).toBe(row.proposal_id);expect(result[0]).not.toHaveProperty('enrolled');
});
it('rejects ambiguous headers and oversized ranges instead of truncating source truth',()=>{
 expect(()=>normalizeSheetRows([['same','same']],{})).toThrow('DUPLICATE');
 expect(()=>normalizeSheetRows([CSV_FIELDS,...Array.from({length:501},()=>CSV_FIELDS.map(f=>row[f]))],{})).toThrow('ROW_LIMIT');
 expect(()=>normalizeSheetRows([CSV_FIELDS,CSV_FIELDS.map(f=>f==='status'?'maybe':row[f])],{})).toThrow('Status');
});
