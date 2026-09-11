import {authClient} from '../../../../lib/auth';
import {apiError,HttpError,json} from '../../../../lib/http';
export async function GET(){try{const client=await authClient();const {data:user,error}=await client.auth.getUser();if(error||!user.user)throw new HttpError(401,'AUTH_REQUIRED','Sign in first.');const {data}=await client.auth.mfa.listFactors();return json({factorId:data?.totp.find(f=>f.status==='verified')?.id??null});}catch(error){return apiError(error);}}
