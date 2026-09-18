import { onboardingCommands, type OnboardingRecord, type AgentOnboardingRecord } from './onboarding';
export * from './onboarding';
import {setupCommands,type SetupDocument,type PreparedSetup} from './setup';
export * from './setup';
export * from './outbound';
export * from './technical-seo';
import { type OutboundSdrState } from './outbound';
import { type TechnicalSeoState } from './technical-seo';
import { z } from 'zod';

export const Id = z.uuid();
export const Utc = z.iso.datetime();
export const Money = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable();
export const Currency = z.string().regex(/^[A-Z]{3}$/);
export const TimeZone = z.string().refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }, 'An IANA time zone is required');
export const Mode = z.enum(['fixture', 'shadow', 'live']);
export const BusinessModel = z.enum(['b2b_services', 'home_services', 'commerce']);
export const Role = z.enum(['workspace_owner', 'workspace_member', 'workspace_viewer', 'david_operator']);
export const ProposalStatus = z.enum(['open', 'accepted', 'declined', 'on_hold', 'expired', 'unknown']);
export const OpportunityStage = z.enum(['inquiry', 'qualified', 'proposal', 'won', 'lost', 'unknown']);
export const RunStatus = z.enum(['scheduled', 'processing', 'awaiting_approval', 'waiting_for_reply', 'waiting_for_input', 'completed', 'blocked', 'failed', 'paused', 'cancelled']);
export const ActionStatus = z.enum(['not_attempted', 'submitting', 'provider_accepted', 'confirmed', 'failed', 'uncertain']);
export const ApprovalStatus = z.enum(['pending', 'approved', 'rejected', 'expired', 'invalidated']);
export const InstallationStatus = z.enum(['selected', 'installed', 'monitoring', 'scheduled', 'processing', 'awaiting_approval', 'waiting_for_input', 'waiting_for_reply', 'connection_expired', 'blocked', 'failed', 'paused']);
export const EvidenceQuality = z.enum(['fixture', 'provider_verified', 'manually_reported', 'unknown']);
export const EvidenceRef = z.object({ id: Id, label: z.string(), source: z.string(), capturedAt: Utc, quality: EvidenceQuality, url: z.url().optional() }).strict();
export const WorkspaceContext = z.object({ schemaVersion: z.literal(1), actorId: Id, workspaceId: Id, membershipId: Id, role: Role, environment: Mode, permittedOperations: z.array(z.string()), assurance: z.enum(['aal1', 'aal2']) }).strict();
export const ConnectionResource = z.object({id:Id,type:z.enum(['sheet','mailbox','calendar','csv','website','campaign']),resource:z.string(),owner:z.string(),verifiedAt:Utc.nullable(),range:z.string().nullable().optional()}).strict();
export type ConnectionResource = z.infer<typeof ConnectionResource>;
export const ConnectionCapability = z.object({ id: Id, workspaceId: Id, provider: z.enum(['google', 'csv', 'website', 'fixture', 'instantly', 'hubspot', 'dataforseo']), identity: z.string(), resource: z.string(), scopes: z.array(z.string()), operations: z.array(z.string()), health: z.enum(['unconfigured', 'healthy', 'expired', 'revoked', 'failed', 'fixture']), lastSyncAt: Utc.nullable(), verifiedAt: Utc.nullable(), owner: z.string(), freshnessSeconds: z.number().int().positive(), boundResources:z.array(ConnectionResource).optional() }).strict();
export const ContactRecord = z.object({ id: Id, workspaceId: Id, name: z.string(), email: z.email(), account: z.string(), suppressed: z.boolean(), enrolled: z.boolean(), humanTakeover: z.boolean(), owner: z.string(), lastContactAt: Utc.nullable() }).strict();
export const OpportunityRecord = z.object({ schemaVersion: z.literal(1), id: Id, workspaceId: Id, contactId: Id, accountId: Id, businessModel: BusinessModel, owner: z.string(), stage: OpportunityStage, rawStage: z.string(), evidence: z.array(EvidenceRef) }).strict();
export const ProposalRecord = z.object({ schemaVersion: z.literal(1), id: Id, workspaceId: Id, opportunityId: Id, contactId: Id, version: z.number().int().positive(), reference: z.string(), issuedAt: Utc, validUntil: Utc.nullable(), amountMinor: Money, currency: Currency, valueKind: z.enum(['one_time', 'monthly_recurring', 'total_contract', 'unknown']), scopeSummary: z.string().min(1).max(4000), sourceUrl: z.url().nullable(), status: ProposalStatus, rawStatus: z.string(), owner: z.string().min(1), sourceVerifiedAt: Utc, syncedAt: Utc, evidence: z.array(EvidenceRef), fixture: z.boolean() }).strict();
export const AgentDefinition = z.object({ id: z.string(), name: z.string(), version: z.string(), category: z.string(), responsibility: z.string(), supportedArchetypes: z.array(BusinessModel), modes: z.array(z.enum(['preparation', 'monitored_execution', 'bounded_autonomous_execution'])), releaseStatus: z.enum(['implemented', 'pilot', 'planned']), requiredCapabilities: z.array(z.string()), triggers: z.array(z.string()), allowedTasks: z.array(z.string()), toolNames: z.array(z.string()), outputSchema: z.string(), prerequisites: z.array(z.string()), stopConditions: z.array(z.string()), capacityUnit: z.string(), dependencies: z.array(z.string()), failureModes: z.array(z.string()), fallback: z.string(), metrics: z.array(z.string()), evaluationCases: z.array(z.string()), aliases: z.array(z.string()) }).strict();
export const AgentInstallation = z.object({ id: Id, workspaceId: Id, agentId: z.string(), definitionVersion: z.string(), mode: z.enum(['preparation', 'monitored_execution', 'bounded_autonomous_execution']), status: InstallationStatus, sourceMappings: z.array(z.string()), policyVersion: z.number().int().positive(), dailyCapacity: z.number().int().nonnegative(), lastPreparationAt: Utc.nullable(), lastBusinessActionAt: Utc.nullable(), blockers: z.array(z.string()) }).strict();
export const SourceEvent = z.object({ schemaVersion: z.literal(1), id: Id, workspaceId: Id, connectionId: Id, sourceId: z.string(), providerEventId: z.string(), entityId: z.string(), occurredAt: Utc, receivedAt: Utc, sourceVersion: z.string(), correlationId: Id, evidenceId: Id }).strict();
export const Blocker = z.object({ code: z.string(), message: z.string(), owner: z.string(), nextStep: z.string(), dimension: z.enum(['integration', 'action', 'measurement']) }).strict();
export const ReadinessResult = z.object({ integration: z.boolean(), action: z.boolean(), measurement: z.boolean(), blockers: z.array(Blocker), evaluatedAt: Utc, freshUntil: Utc.nullable(), fallback: z.string() }).strict();
export const ActionPayload = z.object({ recipient: z.email(), subject: z.string().max(200), body: z.string().max(8000), proposalVersion: z.number().int().positive(), calendarId: z.string().optional(), startAt: Utc.optional(), endAt: Utc.optional(), timeZone: TimeZone.optional() }).strict();
export const ActionProposal = z.object({ schemaVersion: z.literal(1), id: Id, workspaceId: Id, installationId: Id, runId: Id, contactId: Id, proposalId: Id, type: z.enum(['send_follow_up', 'book_appointment']), payload: ActionPayload, payloadHash: z.string(), evidence: z.array(EvidenceRef), approvalId: Id.nullable(), reservedCostMinor: z.number().int().nonnegative(), status: ActionStatus, createdAt: Utc, expiresAt: Utc }).strict();
export const ActionReceipt = z.object({ id: Id, workspaceId: Id, actionId: Id, status: ActionStatus, provider: z.enum(['google', 'fixture', 'instantly']), providerId: z.string().nullable(), message: z.string(), reconciliation: z.enum(['not_required', 'pending', 'resolved', 'operator_review']), observedAt: Utc, evidence: z.array(EvidenceRef) }).strict();
export const Approval = z.object({ id: Id, workspaceId: Id, actionId: Id, status: ApprovalStatus, payloadHash: z.string(), approverId: Id.nullable(), decidedAt: Utc.nullable(), expiresAt: Utc }).strict();
export const OutcomeObservation = z.object({ id: Id, workspaceId: Id, opportunityId: Id, metric: z.string(), metricVersion: z.literal(1), stage: z.enum(['reply', 'booked', 'attended', 'signed', 'completed', 'invoiced', 'paid']), source: z.string(), periodStart: Utc, periodEnd: Utc, value: z.number().nullable(), valueType: z.enum(['count', 'money_minor', 'duration_minutes']), currency: Currency.nullable(), quality: EvidenceQuality, evidence: z.array(EvidenceRef) }).strict();
export const Metric = z.object({ key: z.string(), label: z.string(), value: z.number().nullable(), unit: z.string(), stage: z.string(), evidenceIds: z.array(Id), limitation: z.string().nullable() }).strict();
export const BriefSnapshot = z.object({ id: Id, workspaceId: Id, asOf: Utc, metrics: z.array(Metric), evidence: z.array(EvidenceRef), limitations: z.array(z.string()), decisions: z.array(z.string()).max(3), commitments: z.array(z.string()), narrativeVersion: z.string(), narrative: z.string() }).strict();
export const TeamRecommendation = z.object({ id: Id, workspaceId: Id, goal: z.string(), businessModel: BusinessModel, specialistIds: z.array(z.string()).max(5), rationale: z.record(z.string(), z.string()), dependencies: z.array(z.string()), limitations: z.array(z.string()) }).strict();
export const Prerequisite = z.object({ key: z.string(), label: z.string(), provider: z.string(), owner: z.string(), unlocks: z.array(z.string()), state: z.enum(['missing', 'in_progress', 'verified', 'engineering_required']), evidence: z.string().nullable(), nextStep: z.string() }).strict();
export const ActivationPlan = z.object({ id: Id, workspaceId: Id, selectedTeam: z.array(z.string()).max(32), teamSelectedAt: Utc.optional(), step: z.number().int().min(1).max(6), prerequisites: z.array(Prerequisite), milestone: z.enum(['not_started', 'preparation_artifact', 'authorized_test_action', 'live_business_outcome']), confirmedFacts: z.boolean(), owner: z.string() }).strict();
export const WorkOpportunity = z.object({ id: Id, workspaceId: Id, title: z.string(), affectedIds: z.array(Id), observedCondition: z.string(), evidence: z.array(EvidenceRef), hypothesis: z.string(), agentId: z.string(), effortMinutes: z.number().nonnegative(), costMinor: Money, owner: z.string(), evaluationRule: z.string(), status: z.enum(['proposed', 'approved', 'dismissed', 'reviewed']), alternatives: z.array(z.string()), baseline: z.string(), target: z.string(), reviewAt: Utc }).strict();
export const PreparedArtifact = z.object({ id: Id, workspaceId: Id, agentId: z.string(), type: z.string(), sourceSnapshot: z.array(EvidenceRef), factualInputs: z.array(z.string()), title: z.string(), content: z.string(), reviewState: z.enum(['draft', 'reviewed', 'rejected']), capabilityVersion: z.string(), runId: Id, createdAt: Utc, limitation: z.string() }).strict();
export const ForecastScenario = z.object({ id: Id, workspaceId: Id, version: z.number().int().positive(), name: z.string(), businessModel: BusinessModel, currency: Currency, horizonDays: z.number().int().min(1).max(730), volume: z.number().int().nonnegative().max(1000000), cohort: z.enum(['new_demand', 'recovery']), overlapResolved: z.boolean(), conversions: z.array(z.object({ label: z.string(), low: z.number().min(0).max(1), base: z.number().min(0).max(1), high: z.number().min(0).max(1) }).strict().refine(v => v.low <= v.base && v.base <= v.high)).min(1).max(8), capacity: z.number().int().nonnegative(), valueMinor: Money, spendMinor: Money, baselineWins: z.number().nonnegative().nullable(), counterfactual: z.string().nullable(), assumptions: z.array(z.string()), createdAt: Utc }).strict();
export const RuntimeHealth = z.object({ component: z.string(), health: z.enum(['healthy', 'unverified', 'blocked', 'failed', 'fixture', 'stale']), observedAt: Utc, lastSuccessAt: Utc.nullable(), lastPreparationAt: Utc.nullable(), lastBusinessActionAt: Utc.nullable(), coverage: z.string(), owner: z.string(), nextStep: z.string() }).strict();

export type WorkspaceContext = z.infer<typeof WorkspaceContext>;
export type ConnectionCapability = z.infer<typeof ConnectionCapability>;
export type ContactRecord = z.infer<typeof ContactRecord>;
export type OpportunityRecord = z.infer<typeof OpportunityRecord>;
export type ProposalRecord = z.infer<typeof ProposalRecord>;
export type AgentDefinition = z.infer<typeof AgentDefinition>;
export type AgentInstallation = z.infer<typeof AgentInstallation>;
export type SourceEvent = z.infer<typeof SourceEvent>;
export type ReadinessResult = z.infer<typeof ReadinessResult>;
export type ActionProposal = z.infer<typeof ActionProposal>;
export type ActionReceipt = z.infer<typeof ActionReceipt>;
export type Approval = z.infer<typeof Approval>;
export type OutcomeObservation = z.infer<typeof OutcomeObservation>;
export type BriefSnapshot = z.infer<typeof BriefSnapshot>;
export type TeamRecommendation = z.infer<typeof TeamRecommendation>;
export type ActivationPlan = z.infer<typeof ActivationPlan>;
export type WorkOpportunity = z.infer<typeof WorkOpportunity>;
export type PreparedArtifact = z.infer<typeof PreparedArtifact>;
export type ForecastScenario = z.infer<typeof ForecastScenario>;
export type RuntimeHealth = z.infer<typeof RuntimeHealth>;
export type EvidenceRef = z.infer<typeof EvidenceRef>;
export type Metric = z.infer<typeof Metric>;

export type TimelineEntry = { id: string; workspaceId: string; opportunityId: string; at: string; kind: string; title: string; detail: string; actor: 'david' | 'human' | 'source'; evidence: EvidenceRef[] };
export type Initiative = { id: string; workspaceId: string; findingId: string; title: string; owner: string; baseline: string; target: string; reviewAt: string; status: 'active' | 'supported' | 'unsupported' | 'inconclusive'; assignments: string[] };
export type UsageRecord = { id: string; workspaceId: string; category: 'setup' | 'recurring_support' | 'provider' | 'infrastructure' | 'research'; minutes: number; costMinor: number | null; note: string; at: string };
export interface AppSnapshot {
  currentPreparationArtifactIds?: string[];
  preparationRuntime?: {configured:boolean;message:string};
  preparationRequests?: {id:string;agentId:string;status:string;createdAt:string}[];
  setupDocuments?: SetupDocument[];
  preparedSetup?: PreparedSetup;
  setupIdentity?: {email:string;name:string};
  onboardingCapture?: {evidence?:EvidenceRef[];requestId?:string;id:string;sourceHash:string;fixture:boolean;pages:{url:string;title:string;description:string;text:string;capturedAt:string}[]};
  onboarding?: OnboardingRecord;
  agentOnboarding?: AgentOnboardingRecord[];
  workspace: { entitlement?: number; id: string; name: string; businessModel: z.infer<typeof BusinessModel>; timeZone: string; mode: z.infer<typeof Mode>; paused: boolean; subscriptionMinor: number; currency: string };
  asOf: string; context: WorkspaceContext; contacts: ContactRecord[]; opportunities: OpportunityRecord[]; proposals: ProposalRecord[];
  catalog: AgentDefinition[]; installations: AgentInstallation[]; recommendation: TeamRecommendation; activation: ActivationPlan;
  readiness: ReadinessResult; connections: ConnectionCapability[]; actions: ActionProposal[]; approvals: Approval[]; receipts: ActionReceipt[];
  outcomes: OutcomeObservation[]; metrics: Metric[]; timeline: TimelineEntry[]; artifacts: PreparedArtifact[]; findings: WorkOpportunity[];
  initiatives: Initiative[]; scenarios: ForecastScenario[]; health: RuntimeHealth[]; usage: UsageRecord[]; brief: BriefSnapshot | null;
  outboundSdr?: OutboundSdrState;
  technicalSeo?: TechnicalSeoState;
}
export const Command = z.discriminatedUnion('type', [
  ...onboardingCommands,
  ...setupCommands,
  z.object({type: z.literal('record_outcome'), proposalId: Id, stage: z.enum(['attended','signed','completed','invoiced','paid']), value: Money, currency: Currency.nullable(), reference: z.string().min(3).max(500), observedAt: Utc}).strict(),
  z.object({type: z.literal('draft'), proposalId: Id}).strict(),
  z.object({type: z.literal('approve'), actionId: Id}).strict(),
  z.object({type: z.literal('reject'), actionId: Id}).strict(),
  z.object({type: z.literal('dispatch'), actionId: Id, simulateTimeout: z.boolean().optional()}).strict(),
  z.object({type: z.literal('reconcile'), actionId: Id}).strict(),
  z.object({type: z.literal('reply'), proposalId: Id, text: z.string().min(1).max(8000), eventId: z.string().min(1)}).strict(),
  z.object({type: z.literal('book'), proposalId: Id, startAt: Utc, timeZone: TimeZone}).strict(),
  z.object({type: z.literal('pause'), paused: z.boolean()}).strict(),
  z.object({type: z.literal('takeover'), contactId: Id, enabled: z.boolean()}).strict(),
  z.object({type: z.literal('select_team'), agentIds: z.array(z.string()).max(32)}).strict(),
  z.object({type: z.literal('recommend_team'), goal: z.string().min(3).max(300), businessModel: BusinessModel}).strict(),
  z.object({type: z.literal('activation'), step: z.number().int().min(1).max(6), confirmedFacts: z.boolean()}).strict(),
  z.object({type: z.literal('prepare'), agentId: z.string()}).strict(),
  z.object({type: z.literal('approve_finding'), findingId: Id}).strict(),
  z.object({type: z.literal('review_initiative'), initiativeId: Id, result: z.enum(['supported','unsupported','inconclusive'])}).strict(),
  z.object({type: z.literal('save_scenario'), scenario: ForecastScenario}).strict(),
  z.object({type: z.literal('log_time'), category: z.enum(['setup','recurring_support','provider','infrastructure','research']), minutes: z.number().min(0).max(1440), costMinor: Money, note: z.string().min(1).max(500)}).strict(),
  z.object({type: z.literal('import_csv'), csv: z.string().max(1000000), preview: z.boolean()}).strict(),
  z.object({type: z.literal('import_lead_csv'), csv: z.string().max(1000000), preview: z.boolean(), mapping: z.record(z.string(), z.string()).optional()}).strict(),
  z.object({type: z.literal('set_booking_url'), url: z.string().min(1).max(500)}).strict(),
  z.object({type: z.literal('bind_instantly_workspace'), instantlyWorkspaceId: z.string().min(1).max(128)}).strict(),
  z.object({type: z.literal('generate_outbound_sequence')}).strict(),
  z.object({type: z.literal('start_outbound_sdr')}).strict(),
  z.object({type: z.literal('pause_outbound_sdr')}).strict(),
  z.object({type: z.literal('set_outbound_crm'), provider: z.enum(['none', 'hubspot'])}).strict(),
  z.object({type: z.literal('ingest_outbound_event'), eventType: z.enum(['email_sent','reply_received','auto_reply_received','email_bounced','lead_unsubscribed','lead_meeting_booked']), email: z.email(), text: z.string().max(8000).optional(), providerEventId: z.string().min(1).max(200), campaignId: z.string().max(128).optional(), occurredAt: Utc.optional()}).strict(),
  z.object({type: z.literal('save_technical_seo_setup'), expectedRevision: z.number().int().nonnegative(), keywords: z.array(z.string().min(1).max(200)).min(1).max(20), locationName: z.string().min(2).max(120), languageCode: z.string().min(2).max(8)}).strict(),
  z.object({type: z.literal('start_technical_seo')}).strict(),
  z.object({type: z.literal('pause_technical_seo')}).strict(),
  z.object({type: z.literal('brief')}).strict(),
  z.object({type: z.literal('reset')}).strict()
]);
export type Command = z.infer<typeof Command>;
export type CommandResult = { snapshot: AppSnapshot; message: string; invitationUrl?: string; preview?: { valid: number; errors: {row: number; message: string}[]; rows: Record<string,string>[]; headers?: string[]; mapping?: Record<string, string> } };
