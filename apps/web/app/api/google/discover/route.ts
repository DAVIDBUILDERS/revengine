import {z} from 'zod';
import {authorize} from '../../../../lib/auth';
import {apiError,boundedJson,checkOrigin,HttpError,json} from '../../../../lib/http';
import {environment} from '../../../../../../packages/orchestration/src/environment';
import {runtimeDatabase} from '../../../../../../packages/orchestration/src/database';
import {createVaultSecretStore} from '../../../../../../packages/db/src/index';
import {createGoogleConnector,GoogleError} from '../../../../../../packages/connectors/src/index';
import {suggestColumnMapping} from '@david/domain/onboarding-assist';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request){try{
 checkOrigin(request);
 const input=z.object({workspaceId:z.uuid(),connectionId:z.uuid(),fileId:z.string().min(1).max(512).optional(),tab:z.string().min(1).max(100).optional(),pageToken:z.string().max(1000).optional()}).strict().refine(v=>!v.tab||!!v.fileId,'Select a file before its tab').parse(await boundedJson(request,4096));
 const {client,context}=await authorize(input.workspaceId,true);
 if(!['workspace_owner','david_operator'].includes(context.role))throw new HttpError(403,'OWNER_REQUIRED','An owner must select sources.');
 const {data:connection}=await client.from('connections').select('identity,scopes').eq('workspace_id',input.workspaceId).eq('id',input.connectionId).eq('provider','google').maybeSingle();
 if(!connection)throw new HttpError(403,'CONNECTION_DENIED','Connection is unavailable in this workspace.');
 if(!input.fileId&&!connection.scopes.some((scope:string)=>['https://www.googleapis.com/auth/drive.file','https://www.googleapis.com/auth/drive.metadata.readonly'].includes(scope)))throw new HttpError(409,'FILE_SELECTION_REQUIRED','This account grant permits a selected Sheet read, but not file discovery. Enter its file ID or explicitly authorize read-only spreadsheet discovery.');
 const env=environment();if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET)throw new HttpError(503,'GOOGLE_UNCONFIGURED','Google app configuration is missing.');
 const {data:runId,error}=await client.rpc('begin_onboarding_discovery',{p_workspace:input.workspaceId,p_connection:input.connectionId,p_request:{operation:input.fileId?'inspect_sheet':'list_sheets',fileId:input.fileId??null,tab:input.tab??null}});
 if(error)throw new HttpError(409,'DISCOVERY_BLOCKED',error.message.slice(0,500));
 const db=runtimeDatabase();
 const connector=createGoogleConnector({binding:{connectionId:input.connectionId,identity:connection.identity,enrolledThreadIds:[]},secrets:createVaultSecretStore(db,runId),clientId:env.GOOGLE_CLIENT_ID,clientSecret:env.GOOGLE_CLIENT_SECRET});
 try{
  const result=input.fileId?await connector.inspectSheet(input.fileId,input.tab):await connector.discoverSheets(input.pageToken);
  await db.withRun(runId,tx=>tx`select private.finish_onboarding_discovery(true)`);
  return json({...result,...('headers' in result?{mapping:suggestColumnMapping(result.headers)}:{}),observedAt:new Date().toISOString(),verified:false,message:'Metadata read only. Select and review the resource before binding; access checks remain separate.'});
 }catch(error){await db.withRun(runId,tx=>tx`select private.finish_onboarding_discovery(false)`).catch(()=>{});throw error;}
}catch(error){if(error instanceof GoogleError){const messages:Record<string,string>={permission_denied:'Google denied access. Ask the account administrator to authorize this file or scope.',reauthorization_required:'Google authorization expired. Reconnect this account before continuing.',sheet_tab_not_found:'That tab is no longer available. Reload the spreadsheet tabs.',provider_not_found:'The selected Google resource is unavailable to this account.'};return apiError(new HttpError(409,error.code.toUpperCase(),messages[error.code]??'The metadata read failed. No resource has been marked verified; retry or ask the source owner.'));}return apiError(error);}}
