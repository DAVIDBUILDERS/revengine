import { Command } from '../../../../../packages/contracts/src/index';
import { environment } from '../../../../../packages/orchestration/src/environment';
import { apiError, boundedJson, checkOrigin, json } from '../../../lib/http';
import { fixtureCommand } from '../../../lib/fixture';
import { operationalCommand } from '../../../lib/operational';
export const runtime='nodejs';
export const maxDuration=30;
export async function POST(request:Request){try{checkOrigin(request);const command=Command.parse(await boundedJson(request));const workspace=new URL(request.url).searchParams.get('workspace');return json(environment().DAVID_MODE==='fixture'?await fixtureCommand(command,workspace??'david'):await operationalCommand(command,workspace));}catch(error){return apiError(error);}}
