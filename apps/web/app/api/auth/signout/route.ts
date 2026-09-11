import { authClient } from '../../../../lib/auth';
import { apiError, checkOrigin, json } from '../../../../lib/http';
export async function POST(request:Request){try{checkOrigin(request);const client=await authClient();await client.auth.signOut();return json({message:'Signed out.'});}catch(error){return apiError(error);}}
