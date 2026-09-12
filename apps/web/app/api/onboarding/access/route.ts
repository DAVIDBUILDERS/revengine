import { createHash } from 'node:crypto';
import { z } from 'zod';
import { authClient } from '../../../../lib/auth';
import { apiError, boundedJson, checkOrigin, HttpError, json } from '../../../../lib/http';
import { BusinessModel, TimeZone } from '@david/contracts';
import { environment } from '../../../../../../packages/orchestration/src/environment';

const Input=z.discriminatedUnion('type',[
 z.object({type:z.literal('create_workspace'),requestId:z.uuid().optional(),name:z.string().trim().min(1).max(200),businessModel:BusinessModel,timeZone:TimeZone}).strict(),
 z.object({type:z.literal('accept_invitation'),token:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
 z.object({type:z.literal('register'),email:z.email(),password:z.string().min(12).max(256)}).strict(),
 z.object({type:z.literal('recover'),email:z.email()}).strict(),
 z.object({type:z.literal('update_password'),password:z.string().min(12).max(256)}).strict(),
]);
export async function POST(request:Request){try{
 checkOrigin(request);const input=Input.parse(await boundedJson(request,8192));const client=await authClient();
 if(input.type==='register'){
  const {error}=await client.auth.signUp({email:input.email,password:input.password,options:{emailRedirectTo:`${environment().APP_ORIGIN}/auth/callback`}});
  if(error)throw new HttpError(409,'REGISTRATION_FAILED','Account registration could not complete. Check authentication configuration or try signing in.');
  return json({message:'Check your email to confirm your account, then sign in. Email delivery must be configured by the deployment administrator.'});
 }
 if(input.type==='recover'){
  const {error}=await client.auth.resetPasswordForEmail(input.email,{redirectTo:`${environment().APP_ORIGIN}/auth/callback?next=/account`});
  if(error)throw new HttpError(503,'RECOVERY_UNAVAILABLE','Password recovery is unavailable. Contact your account administrator.');
  return json({message:'If the account is eligible, a recovery email will arrive shortly.'});
 }
 const {data:user,error:authError}=await client.auth.getUser();
 if(authError||!user.user)throw new HttpError(401,'AUTH_REQUIRED','Sign in before continuing setup.');
 if(input.type==='update_password'){
  const {error}=await client.auth.updateUser({password:input.password});if(error)throw new HttpError(409,'PASSWORD_UPDATE_FAILED','Password could not be updated. Use a fresh recovery link or complete MFA.');return json({message:'Password updated. You can return to your workspace.'});
 }
 const {data,error}=input.type==='create_workspace'
 ?await client.rpc(input.requestId?'create_onboarding_workspace_once':'create_onboarding_workspace',{...(input.requestId?{p_request:input.requestId}:{}),p_name:input.name,p_business_model:input.businessModel,p_time_zone:input.timeZone})
 :await client.rpc('accept_workspace_invitation',{p_token_hash:createHash('sha256').update(input.token).digest('hex')});
 if(error)throw new HttpError(409,'SETUP_BLOCKED',error.message.slice(0,500));
 return json({workspaceId:data});
}catch(error){return apiError(error);}}
