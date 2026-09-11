import {createHook,sleep,getWorkflowMetadata} from 'workflow';
import {claimRunStep,prepareActionStep,registerWaitStep,decisionStep,executeActionStep,finishWaitStep,prepareArtifactStep,pollReplyStep,blockStep} from './steps';

/** Keep this entrypoint and input contract intact for in-flight v1 deployments. */
export async function proposalV1(runId:string){
 'use workflow';
 const workflowId=getWorkflowMetadata().workflowRunId;
 const job=await claimRunStep(runId,workflowId);
 if(!job)return {status:'duplicate_or_stopped'};
 try{
  if(job.kind==='prepare')return await prepareArtifactStep(runId);
  const action=await prepareActionStep(runId);
  let decision=await decisionStep(runId,action.actionId);
  if(decision==='pending'){
   using approval=createHook<{decisionSaved:true}>();
   await approval.getConflict();
   await registerWaitStep(runId,action.actionId,approval.token,action.expiresAt);
   decision=await decisionStep(runId,action.actionId);
   if(decision==='pending')await Promise.race([approval,sleep(new Date(action.expiresAt))]);
   decision=await decisionStep(runId,action.actionId);
   await finishWaitStep(runId,action.actionId);
  }
  if(decision!=='approved'&&decision!=='mandated'){await blockStep(runId,decision==='pending'?'Approval expired; operator review required.':`Authority ${decision}.`);return {status:'blocked'};}
  const result=await executeActionStep(runId,action.actionId);
  if(result.status==='provider_accepted'){
   // Durable sleep is a bounded policy wait; source reconciliation also runs through due work.
   await sleep('5 minutes');await pollReplyStep(runId);
  }
  return result;
 }catch{await blockStep(runId,'Workflow stopped at a capability or validation gate. Inspect source, policy and provider readiness; no blind write retry.');return {status:'blocked'};}
}
export async function actionV1(runId:string,actionId:string,reconcile:boolean){
 'use workflow';
 return await executeActionStep(runId,actionId,reconcile);
}
export async function reconcileSourceV1(runId:string){'use workflow';return await pollReplyStep(runId);}
