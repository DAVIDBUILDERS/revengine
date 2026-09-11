import { z } from 'zod';
import { authClient } from '../../../../lib/auth';
import { apiError, boundedJson, checkOrigin, HttpError, json } from '../../../../lib/http';
export async function POST(request:Request){try{checkOrigin(request);const input=z.object({email:z.email(),password:z.string().min(8).max(256)}).strict().parse(await boundedJson(request,4096));const client=await authClient();const {error}=await client.auth.signInWithPassword(input);if(error)throw new HttpError(401,'SIGN_IN_FAILED','Unable to sign in. Use your invited account or contact your workspace owner.');return json({message:'Signed in.'});}catch(error){return apiError(error);}}
