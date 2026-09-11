import {describe,it,expect} from 'vitest';
import {readFile,readdir} from 'node:fs/promises';
import {parse} from 'pgsql-parser';

describe('PostgreSQL migration syntax (not hosted execution or RLS proof)',()=>{
 it('parses every versioned migration with the PostgreSQL parser',async()=>{const files=(await readdir('supabase/migrations')).filter(name=>name.endsWith('.sql'));expect(files.length).toBeGreaterThan(0);for(const file of files){const sql=await readFile(`supabase/migrations/${file}`,'utf8');try{await parse(sql);}catch(error){throw new Error(`${file}: ${error instanceof Error?error.message:'SQL parse error'}`);}}});
});
