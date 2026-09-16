/**
 * SQL-derived companion interfaces, manually reviewed against migrations 001–003.
 * This is NOT Supabase CLI output. Replace/extend using `pnpm db:types` after applying
 * migrations to the authorized hosted test project; keep the generation evidence.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type AgentOnboardingRow = {workspace_id:string;agent_id:string;status:'not_started'|'in_progress'|'blocked'|'ready';answers:Json;required_tools:Json;missing:string[];revision:number;updated_at:string;updated_by:string};
export type MembershipRow = {id:string;workspace_id:string;actor_id:string;role:'workspace_owner'|'workspace_member'|'workspace_viewer'|'david_operator';active:boolean};
export type ConnectionRow = {id:string;workspace_id:string;provider:'google'|'csv'|'website'|'fixture';identity:string;subject_id:string|null;scopes:string[];operations:string[];owner_id:string|null;health:'unconfigured'|'healthy'|'expired'|'revoked'|'failed'|'fixture';last_sync_at:string|null;verified_at:string|null;freshness_seconds:number};
export type RunRow = {id:string;workspace_id:string;installation_id:string|null;connection_id:string|null;definition_version:string;sdk_version:string;deployment_id:string;environment:'fixture'|'shadow'|'live';status:string;workflow_id:string|null;workflow_claim:string|null;claim_until:string|null;fence:number;next_due_at:string|null;created_at:string};
export type ActionRow = {id:string;workspace_id:string;installation_id:string;run_id:string;contact_id:string;proposal_id:string;type:'send_follow_up'|'book_appointment';payload:Json;source_snapshot:Json;payload_hash:string;proposal_version:number;policy_id:string;mandate_id:string|null;status:'not_attempted'|'submitting'|'provider_accepted'|'confirmed'|'failed'|'uncertain';expires_at:string;reserved_cost_minor:number;reserved_at:string|null;reservation_day:string|null;claim_token:string|null;fence:number;submitting_at:string|null;created_at:string};
export type ApprovalRow = {id:string;workspace_id:string;action_id:string;status:'pending'|'approved'|'rejected'|'expired'|'invalidated';payload_hash:string;approver_id:string|null;decided_at:string|null;expires_at:string};
export type ReceiptRow = {id:string;workspace_id:string;action_id:string;status:ActionRow['status'];provider:'google'|'fixture';provider_id:string|null;message:string;reconciliation:'not_required'|'pending'|'resolved'|'operator_review';observed_at:string};
export type CheckedFunctions = {
 decide_action:{Args:{p_action_id:string;p_decision:'approved'|'rejected';p_payload_hash:string};Returns:string};
 set_workspace_pause:{Args:{p_workspace_id:string;p_paused:true};Returns:undefined};
 set_contact_takeover:{Args:{p_contact_id:string;p_enabled:boolean};Returns:undefined};
 begin_google_oauth:{Args:{p_workspace_id:string;p_state_hash:string;p_verifier:string;p_redirect_uri:string};Returns:undefined};
 consume_google_oauth:{Args:{p_state_hash:string;p_redirect_uri:string};Returns:{workspace_id:string;verifier:string}[]};
 disconnect_google:{Args:{p_connection_id:string};Returns:undefined};
};
