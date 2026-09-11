import {apiError,json} from '../../../lib/http';
import {operationalSnapshot} from '../../../lib/operational';
import {fixtureSnapshot} from '../../../lib/fixture';
import {environment} from '../../../../../packages/orchestration/src/environment';
export async function GET(request:Request){try{const workspace=new URL(request.url).searchParams.get('workspace');const data=environment().DAVID_MODE==='fixture'?await fixtureSnapshot(workspace??'david'):await operationalSnapshot(workspace);const response=json({schemaVersion:1,exportedAt:new Date().toISOString(),coverage:'Current customer-visible snapshot; source tables above the display cap require an operator full export. Provider tokens and private operational payloads are excluded.',data});response.headers.set('Content-Disposition','attachment; filename="david-workspace-snapshot.json"');return response;}catch(error){return apiError(error);}}
