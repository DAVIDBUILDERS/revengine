import { apiError, json } from '../../../lib/http';
import { fixtureSnapshot } from '../../../lib/fixture';
import { environment } from '../../../../../packages/orchestration/src/environment';
import { operationalSnapshot } from '../../../lib/operational';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {try {const params=new URL(request.url).searchParams;return json(environment().DAVID_MODE==='fixture'?await fixtureSnapshot(params.get('workspace')??'david'):await operationalSnapshot(params.get('workspace')));}catch(error){return apiError(error);}}
