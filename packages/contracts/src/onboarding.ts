import { z } from 'zod';
const text = z.string().trim().max(4000);
const list = z.preprocess(value => Array.isArray(value) ? value.map(v=>typeof v==='string'?v.trim():v).filter(v=>v!=='') : value, z.array(z.string().min(1).max(500)).max(100));
export const Briefing = z.object({
 version:z.literal(1),
 step:z.enum(['welcome','website','description','name','goal','other-goal','research','company-name','offer','customers','summary','proposal-source','conversion-action','recommendation','access','budget','review','finish']),
 name:text.default(''), goal:z.enum(['','demand','conversion','recover','other']).default(''),
 goals:z.array(z.enum(['demand','conversion','recover','other'])).max(4).refine(v=>new Set(v).size===v.length,'Select distinct directions').default([]),
 otherGoal:text.default(''),
 description:text.default(''), websiteInput:text.default(''), proposalSource:text.default(''), conversionAction:text.default(''),
 researchId:z.union([z.literal(''),z.uuid()]).default(''), noWebsite:z.boolean().default(false),
 reviewedFacts:z.string().max(16000).default(''), task:z.string().max(100).default(''), finished:z.boolean().default(false),
}).strict();
export type Briefing = z.infer<typeof Briefing>;
export const OnboardingAnswers = z.object({
  briefing:Briefing.optional(),
  company: z.object({name:text,website:z.union([z.literal(''),z.url()]),businessModel:z.enum(['b2b_services','home_services','commerce']),timeZone:z.string().refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}},'Use an IANA time zone'),offers:list,customers:list,priorities:list,successDefinition:text,brandGuidance:text,forbiddenClaims:text}).strict(),
  team:z.array(z.string().min(1).max(100)).max(33).refine(v=>new Set(v).size===v.length,'Select distinct agents'),
  systems:z.array(z.object({id:z.string().min(1).max(100),kind:z.enum(['website','proposals','mail','calendar','drive','advertising','social','analytics','calls','payments','commerce','local','rfp','other']),tool:text,availability:z.enum(['available','not_available','admin_needed']),resource:text,owner:text,mapping:text,connectionId:z.union([z.literal(''),z.uuid()])}).strict()).max(40).refine(v=>new Set(v.map(s=>s.id)).size===v.length,'System IDs must be distinct'),
  operations:z.object({approvalMode:z.enum(['each_action','bounded_follow_up']),automationAcknowledged:z.boolean(),contactRestrictions:text,workingDays:z.array(z.number().int().min(1).max(7)).min(1).max(7),startHour:z.number().int().min(0).max(23),endHour:z.number().int().min(1).max(24),meetingMinutes:z.number().int().min(5).max(240),bufferMinutes:z.number().int().min(0).max(120),dailyCapacity:z.number().int().min(0).max(1000),modelDailyBudgetMinor:z.number().int().min(0).max(1000000).nullable(),actionDailyBudgetMinor:z.number().int().min(0).max(1000000),sender:z.union([z.literal(''),z.email()]),calendarId:text,escalationOwner:text,approvedContactIds:z.array(z.uuid()).max(500),policyAcknowledged:z.boolean()}).strict().refine(v=>v.endHour>v.startHour,'Working hours must end after they start').refine(v=>v.approvalMode!=='bounded_follow_up'||v.automationAcknowledged,'Explicit authorization is required to request automatic follow-up'),
  people:z.array(z.object({email:z.email(),name:text,responsibility:z.enum(['owner','approver','administrator','operator','measurement']),role:z.enum(['workspace_owner','workspace_member','workspace_viewer'])}).strict()).max(30),
  measurement:z.object({owner:text,outcomeSources:text.default(''),baseline:z.array(z.object({metric:text,value:z.number().finite().nonnegative().nullable(),unit:text,source:text,asOf:z.union([z.literal(''),z.iso.date()])}).strict()).max(20),sharing:z.enum(['private','aggregate_only','review_each_release'])}).strict(),
}).strict();
export type OnboardingAnswers = z.infer<typeof OnboardingAnswers>;
export const OnboardingRecord = z.object({version:z.literal(1),revision:z.number().int().nonnegative(),configurationRevision:z.number().int().nonnegative().optional(),configurationUpdatedAt:z.iso.datetime({offset:true}).optional(),appliedRevision:z.number().int().nonnegative().nullable().default(null),answers:OnboardingAnswers,updatedAt:z.iso.datetime({offset:true}),updatedBy:z.string(),reviews:z.array(z.object({artifactId:z.uuid(),revision:z.number().int(),configurationRevision:z.number().int().nonnegative().optional(),at:z.iso.datetime({offset:true})}).strict()).max(100).default([]),history:z.array(z.object({revision:z.number().int(),at:z.iso.datetime({offset:true}),actor:z.string(),summary:z.string()}).strict()).max(100),tasks:z.array(z.object({id:z.string(),title:z.string(),owner:z.string(),status:z.enum(['open','in_progress','resolved']),note:z.string(),revision:z.number().int()}).strict()).max(100),invitations:z.array(z.object({id:z.string(),email:z.email(),role:z.enum(['workspace_owner','workspace_member','workspace_viewer']),status:z.enum(['pending','accepted','revoked','expired']),expiresAt:z.iso.datetime({offset:true})}).strict()).max(100)}).strict();
export type OnboardingRecord = z.infer<typeof OnboardingRecord>;
export const AgentRequiredTools = z.object({
  tools:z.array(z.string().min(1).max(100)).max(20),
  capabilities:z.array(z.string().min(1).max(100)).max(20),
  systems:z.array(z.string().min(1).max(40)).max(20),
  prerequisites:z.array(z.string().min(1).max(100)).max(20),
}).strict();
export type AgentRequiredTools = z.infer<typeof AgentRequiredTools>;
export const AgentOnboardingStatus = z.enum(['not_started','in_progress','blocked','ready']);
export const AgentOnboardingRecord = z.object({
  workspaceId:z.uuid(),
  agentId:z.string().min(1).max(100),
  status:AgentOnboardingStatus,
  answers:z.record(z.string(),z.unknown()),
  requiredTools:AgentRequiredTools,
  missing:z.array(z.string().max(2000)).max(50),
  revision:z.number().int().nonnegative(),
  updatedAt:z.iso.datetime({offset:true}),
  updatedBy:z.string(),
}).strict();
export type AgentOnboardingRecord = z.infer<typeof AgentOnboardingRecord>;
export function emptyOnboarding(input:{name:string;businessModel:'b2b_services'|'home_services'|'commerce';timeZone:string},at:string):OnboardingRecord {
 return {version:1,revision:0,appliedRevision:null,updatedAt:at,updatedBy:'Not saved',reviews:[],history:[],tasks:[],invitations:[],answers:{company:{name:input.name,businessModel:input.businessModel,timeZone:input.timeZone,website:'',offers:[],customers:[],priorities:[],successDefinition:'',brandGuidance:'',forbiddenClaims:''},team:[],systems:[],operations:{approvalMode:'each_action',automationAcknowledged:false,contactRestrictions:'',workingDays:[1,2,3,4,5],startHour:9,endHour:17,meetingMinutes:30,bufferMinutes:15,dailyCapacity:0,modelDailyBudgetMinor:null,actionDailyBudgetMinor:0,sender:'',calendarId:'',escalationOwner:'',approvedContactIds:[],policyAcknowledged:false},people:[],measurement:{owner:'',outcomeSources:'',baseline:[],sharing:'private'}}};
}
export const onboardingCommands = [
 z.object({type:z.literal('sample_onboarding_capture')}).strict(),
 z.object({type:z.literal('confirm_sample_company'),expectedRevision:z.number().int().nonnegative()}).strict(),
 z.object({type:z.literal('assign_operator'),email:z.email()}).strict(),
 z.object({type:z.literal('save_onboarding'),expectedRevision:z.number().int().nonnegative(),answers:OnboardingAnswers}).strict(),
 z.object({type:z.literal('onboarding_task'),expectedRevision:z.number().int().nonnegative(),taskId:z.string().min(1).max(100),title:z.string().min(1).max(500),owner:z.string().min(1).max(300),status:z.enum(['open','in_progress','resolved']),note:z.string().max(2000)}).strict(),
 z.object({type:z.literal('review_artifact'),artifactId:z.uuid(),decision:z.enum(['reviewed','rejected'])}).strict(),
 z.object({type:z.literal('set_allowance'),allowance:z.number().int().min(0).max(32)}).strict(),
 z.object({type:z.literal('create_invitation'),email:z.email(),role:z.enum(['workspace_owner','workspace_member','workspace_viewer'])}).strict(),
 z.object({type:z.literal('revoke_invitation'),invitationId:z.uuid()}).strict(),
 z.object({type:z.literal('apply_onboarding'),expectedRevision:z.number().int().positive()}).strict(),
 z.object({type:z.literal('save_agent_onboarding'),agentId:z.string().min(1).max(100),expectedRevision:z.number().int().nonnegative(),answers:z.record(z.string(),z.unknown())}).strict(),
] as const;
