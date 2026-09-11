import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Database } from '../../db/src/index';
import { createModelAdapter, type UsageBudget, type FactualInput } from '../../ai/src/index';
import { prepareFromContext, WebsiteContext, preparationIds, type PreparationOutput } from '../../agents/src/index';
import type { EvidenceRef } from '../../contracts/src/index';

export const ModelPreparationConfig = z.object({ apiKey: z.string().min(1), modelId: z.string().min(1), provider: z.string().min(1), maxCostMinor: z.number().int().min(1).max(100000), maxOutputTokens: z.number().int().min(100).max(1500).default(600) }).strict();
export function preparationModelConfig(env: Record<string,string|undefined>) {
  return ModelPreparationConfig.parse({apiKey:env.AI_GATEWAY_API_KEY,modelId:env.AI_MODEL_ID,provider:env.AI_ALLOWED_PROVIDER,maxCostMinor:env.AI_MAX_JOB_COST_MINOR===undefined?undefined:Number(env.AI_MAX_JOB_COST_MINOR),maxOutputTokens:env.AI_MAX_OUTPUT_TOKENS===undefined?600:Number(env.AI_MAX_OUTPUT_TOKENS)});
}
export function createDatabaseModelBudget(database:Database,runId:string):UsageBudget {
  z.uuid().parse(runId);
  return {
    async reserve(input){if(input.runId!==runId)throw new Error('MODEL_RUN_BINDING');z.uuid().parse(input.workspaceId);return database.withRun(runId,async tx=>{const [row]=await tx<{id:string}[]>`select private.reserve_model_budget(${input.workspaceId}::uuid,${input.maxCostMinor},${input.maxTokens}) as id`;if(!row?.id)throw new Error('MODEL_BUDGET_NOT_RESERVED');return row.id;});},
    async settle(id,input){await database.withRun(runId,async tx=>{await tx`select private.settle_model_budget(${z.uuid().parse(id)}::uuid,${input.inputTokens},${input.outputTokens},${input.model},${input.costMinor})`;});},
    async fail(id,reason){await database.withRun(runId,async tx=>{await tx`select private.fail_model_budget(${z.uuid().parse(id)}::uuid,${reason.slice(0,200)})`;});},
  };
}
export type PreparedRunInput={workspaceId:string;runId:string;agentId:string;company:WebsiteContext};
export type PreparationModelPort={prepare(input:{workspaceId:string;runId:string;agentId:string;facts:FactualInput[]}):Promise<{wording:string;sourceIds:string[]}>};
export type PreparationStorePort={
  claim(input:PreparedRunInput&{sourceSignature:string}):Promise<{status:'claimed'|'completed'|'unchanged';artifactId:string|null}>;
  save(input:PreparedRunInput&{sourceSignature:string;artifactId:string;artifact:PreparationOutput;modelSourceIds:string[]}):Promise<string>;
  fail(runId:string,reason:string):Promise<void>;
};
export function preparationSourceSignature(company:WebsiteContext,agentId:string) {
  // Capture timestamp alone cannot justify paying for the same repeated document.
  const source={version:'preparation.v1',agentId,companyName:company.companyName,offers:company.offers,customerTypes:company.customerTypes,locations:company.locations,confirmed:company.confirmed,pages:company.pages.map(({url,title,description,text})=>({url,title,description,text})).sort((a,b)=>a.url.localeCompare(b.url))};
  return createHash('sha256').update(JSON.stringify(source)).digest('hex');
}
export async function runPreparation(input:PreparedRunInput,store:PreparationStorePort,model?:PreparationModelPort){
  z.uuid().parse(input.workspaceId);z.uuid().parse(input.runId);const company=WebsiteContext.parse(input.company);
  if(company.fixture||company.evidence.some(item=>item.quality==='fixture'))throw new Error('FIXTURE_DATA_IN_OPERATIONAL_RUN');if(!company.confirmed)throw new Error('COMPANY_CONFIRMATION_REQUIRED');
  if(!preparationIds.includes(input.agentId as typeof preparationIds[number]))throw new Error('PREPARATION_UNAVAILABLE');
  const sourceSignature=preparationSourceSignature(company,input.agentId);const claim=await store.claim({...input,company,sourceSignature});
  if(claim.status!=='claimed')return {artifactId:claim.artifactId,status:'preparation_unchanged'};
  try{
    const artifact=prepareFromContext(input.agentId,company);let modelSourceIds:string[]=[];
    if(input.agentId!=='technical-seo-monitor'){
      if(!model)throw new Error('MODEL_ACCESS_MISSING');
      const sourceId=company.evidence[0].id;const facts:FactualInput[]=[{id:'company',text:`Confirmed company: ${company.companyName}`,sourceId,confirmed:true},...company.offers.map((text,index)=>({id:`offer-${index}`,text:`Approved offer: ${text}`,sourceId,confirmed:true})),...company.customerTypes.map((text,index)=>({id:`audience-${index}`,text:`Confirmed audience: ${text}`,sourceId,confirmed:true}))];
      const selected=await model.prepare({workspaceId:input.workspaceId,runId:input.runId,agentId:input.agentId,facts});
      if(!selected.sourceIds.length||selected.sourceIds.some(id=>!company.evidence.some(e=>e.id===id)))throw new Error('MODEL_SOURCE_UNSUPPORTED');
      // The AI adapter emits only enumerated framing plus supplied confirmed fact text, never arbitrary claims.
      const approvedLines=new Set(facts.map(f=>f.text));const lines=selected.wording.split('\n');if(!['Clarify the approved offer','Explain fit for the confirmed audience','Use the approved facts to frame review questions'].includes(lines[0])||lines.length<2||lines.slice(1).some(line=>!approvedLines.has(line)))throw new Error('MODEL_WORDING_UNSUPPORTED');
      artifact.content+=`\n\nModel-selected approved wording for review:\n${selected.wording}\nEvidence references: ${selected.sourceIds.join(', ')}`;
      modelSourceIds=selected.sourceIds;
    }
    const artifactId=await store.save({...input,company,sourceSignature,artifactId:randomUUID(),artifact,modelSourceIds});return {artifactId,status:'preparation_saved'};
  }catch(error){await store.fail(input.runId,error instanceof Error?error.message.slice(0,200):'PREPARATION_FAILED');throw error;}
}
export function createDatabasePreparationStore(database:Database,runId:string):PreparationStorePort {
  return {
    async claim(input){if(input.runId!==runId)throw new Error('PREPARATION_RUN_BINDING');return database.withRun(runId,async tx=>{const [result]=await tx<{status:'claimed'|'completed'|'unchanged';artifact_id:string|null}[]>`select * from private.claim_preparation(${input.agentId},${input.sourceSignature})`;if(!result)throw new Error('PREPARATION_CLAIM_FAILED');return {status:result.status,artifactId:result.artifact_id};});},
    async save(input){const record={id:input.artifactId,agentId:input.agentId,...input.artifact,sourceSnapshot:input.company.evidence as EvidenceRef[],modelSourceIds:input.modelSourceIds};return database.withRun(runId,async tx=>{const [result]=await tx<{id:string}[]>`select private.complete_preparation(${input.sourceSignature},${JSON.stringify(record)}::jsonb) as id`;if(!result?.id)throw new Error('PREPARATION_SAVE_FAILED');return result.id;});},
    async fail(_runId,reason){await database.withRun(runId,async tx=>{await tx`select private.fail_preparation(${reason})`;});},
  };
}
export function configuredPreparationModel(database:Database,runId:string,env:Record<string,string|undefined>){return createModelAdapter(preparationModelConfig(env),createDatabaseModelBudget(database,runId));}
