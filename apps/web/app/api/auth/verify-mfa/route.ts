import { z } from 'zod';
import { authClient } from '../../../../lib/auth';
import { apiError, boundedJson, checkOrigin, HttpError, json } from '../../../../lib/http';
export async function POST(request:Request){try{checkOrigin(request);const input=z.object({factorId:z.uuid(),code:z.string().regex(/^\d{6}$/)}).strict().parse(await boundedJson(request,4096));const client=await authClient();const {error}=await client.auth.mfa.challengeAndVerify(input);if(error)throw new HttpError(401,'MFA_FAILED','Verification failed. Enter a current code from your enrolled authenticator.');return json({message:'Multi-factor verification complete.'});}catch(error){return apiError(error);}}
