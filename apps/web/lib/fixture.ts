import { mkdir, readFile, rename, rm, writeFile, stat } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve, join } from 'node:path';
import { cookies } from 'next/headers';
import { createFixtureState, executeCommand, snapshot, isFixtureWorkspace, type EngineState } from '../../../packages/domain/src/index';
import { type Command } from '../../../packages/contracts/src/index';
import { environment } from '../../../packages/orchestration/src/environment';
import { HttpError } from './http';

type SessionFile = { version:1; state: EngineState; requests: number[] };
async function sessionPath(workspace: string) {
  const env = environment();
  if (env.DAVID_MODE !== 'fixture') throw new HttpError(403,'FIXTURE_DISABLED','Synthetic sessions are available only in local fixture mode.');
  if (!isFixtureWorkspace(workspace)) throw new HttpError(404,'FIXTURE_WORKSPACE_UNKNOWN','Choose a known synthetic workspace.');
  const jar = await cookies();
  let sessionId = jar.get('david-fixture-session')?.value;
  if (!sessionId || !/^[a-f0-9]{64}$/.test(sessionId)) {
    sessionId = randomBytes(32).toString('hex');
    jar.set('david-fixture-session', sessionId, {httpOnly:true,sameSite:'strict',secure:false,path:'/',maxAge:86400});
  }
  const dir = env.FIXTURE_DATA_DIR ?? resolve(process.cwd(), '.fixture');
  await mkdir(dir,{recursive:true,mode:0o700});
  return join(dir,`${sessionId}-${workspace}.json`);
}
async function locked<T>(file: string, operation: () => Promise<T>): Promise<T> {
  const lock = `${file}.lock`;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await mkdir(lock); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const info = await stat(lock).catch(()=>null);
      if (info && Date.now()-info.mtimeMs>30000) await rm(lock,{recursive:true,force:true});
      if (attempt === 99) throw new HttpError(409,'FIXTURE_BUSY','Another fixture command is running. Try again.');
      await new Promise(resolve=>setTimeout(resolve,20));
    }
  }
  try { return await operation(); } finally { await rm(lock,{recursive:true,force:true}); }
}
async function load(file: string, workspace: string): Promise<SessionFile> {
  try { const data = JSON.parse(await readFile(file,'utf8')) as SessionFile; if (data.version!==1) throw new Error('FIXTURE_VERSION_UNSUPPORTED'); return data; }
  catch(error) { if((error as NodeJS.ErrnoException).code!=='ENOENT') throw error; return {version:1,state:createFixtureState(workspace),requests:[]}; }
}
async function save(file: string, data: SessionFile) { const temp=`${file}.${randomBytes(8).toString('hex')}.tmp`; await writeFile(temp,JSON.stringify(data),{mode:0o600}); await rename(temp,file); }
export async function fixtureSnapshot(workspace = 'david') {
  const file=await sessionPath(workspace);
  return locked(file,async()=>{const data=await load(file,workspace);await save(file,data);return snapshot(data.state);});
}
export async function fixtureCommand(command: Command, workspace = 'david') {
  const file=await sessionPath(workspace);
  return locked(file,async()=>{
    const data=await load(file,workspace); data.requests=data.requests.filter(at=>at>Date.now()-60000);
    if(data.requests.length>=120) throw new HttpError(429,'RATE_LIMIT','This synthetic session has reached 120 changes per minute. Retry shortly.');
    data.requests.push(Date.now());
    // Mutations are serialized through a filesystem lock ONLY for no-cloud fixtures.
    // Production uses SQL transactions, never this store.
    if(command.type==='reset') { data.state=createFixtureState(workspace); await save(file,data); return {snapshot:snapshot(data.state),message:'Your synthetic session was reset. Other sessions are unchanged.'}; }
    const result=await executeCommand(data.state,command);
    await save(file,data);
    return result;
  });
}
