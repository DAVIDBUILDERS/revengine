-- DAVID Engine: apply only to an explicitly bound hosted Supabase project.
-- Runtime logins/passwords are provisioned separately; migrations never contain secrets.
begin;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault with schema vault;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

do $$ begin
  if not exists(select 1 from pg_roles where rolname='david_worker') then
    create role david_worker nologin noinherit nobypassrls;
  end if;
  if not exists(select 1 from pg_roles where rolname='david_dispatcher') then
    create role david_dispatcher nologin noinherit nobypassrls;
  end if;
end $$;
alter role david_worker nobypassrls nocreatedb nocreaterole;
alter role david_dispatcher nobypassrls nocreatedb nocreaterole;
-- Managed Supabase postgres cannot ALTER NOSUPERUSER. New roles default to it;
-- fail closed on an existing privileged role instead of requiring superuser.
do $$ begin
  if exists(select 1 from pg_roles where rolname in ('david_worker','david_dispatcher') and (rolsuper or rolbypassrls or rolcreatedb or rolcreaterole)) then
    raise exception 'RUNTIME_ROLE_PRIVILEGED';
  end if;
end $$;
grant usage on schema public, private to david_worker, david_dispatcher;

create table public.workspaces (
 id uuid primary key default gen_random_uuid(), name text not null, environment text not null check(environment in ('fixture','shadow','live')),
 business_model text not null check(business_model in ('b2b_services','home_services','commerce')), time_zone text not null,
 paused boolean not null default true, entitlement integer not null default 5 check(entitlement between 0 and 32),
 currency text not null check(currency ~ '^[A-Z]{3}$'), subscription_minor bigint check(subscription_minor between 0 and 9007199254740991),
 daily_limit integer not null default 10 check(daily_limit between 0 and 1000), daily_budget_minor bigint not null default 0 check(daily_budget_minor >= 0),
 created_at timestamptz not null default now()
);
create table public.memberships (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), actor_id uuid not null references auth.users(id),
 role text not null check(role in ('workspace_owner','workspace_member','workspace_viewer','david_operator')), active boolean not null default true,
 unique(workspace_id,actor_id), unique(workspace_id,id)
);
create table public.connections (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), provider text not null check(provider in ('google','csv','website','fixture')),
 identity text not null, subject_id text, scopes text[] not null default '{}', operations text[] not null default '{}', owner_id uuid,
 health text not null default 'unconfigured' check(health in ('unconfigured','healthy','expired','revoked','failed','fixture')),
 last_sync_at timestamptz, verified_at timestamptz, freshness_seconds integer not null default 3600 check(freshness_seconds > 0),
 unique(workspace_id,id), foreign key(workspace_id,owner_id) references public.memberships(workspace_id,id)
);
create table public.source_bindings (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), connection_id uuid not null,
 resource_id text not null, resource_type text not null check(resource_type in ('sheet','mailbox','calendar','website','csv')),
 range_name text, mapping_version integer not null default 1, mapping jsonb not null default '{}', source_owner text not null,
 verified_at timestamptz, unique(workspace_id,id), unique(workspace_id,connection_id,resource_id),
 foreign key(workspace_id,connection_id) references public.connections(workspace_id,id)
);
create table public.accounts (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), name text not null,
 source_key text not null, unique(workspace_id,id), unique(workspace_id,source_key)
);
create table public.contacts (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), account_id uuid not null,
 name text not null, email text not null, source_key text not null, suppressed boolean not null default false,
 enrolled boolean not null default false, cohort_id text, human_takeover boolean not null default false, owner text not null,
 last_contact_at timestamptz, unique(workspace_id,id), unique(workspace_id,source_key),
 foreign key(workspace_id,account_id) references public.accounts(workspace_id,id)
);
create table public.opportunities (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), contact_id uuid not null, account_id uuid not null,
 owner text not null, stage text not null check(stage in ('inquiry','qualified','proposal','won','lost','unknown')), raw_stage text not null,
 business_model text not null check(business_model in ('b2b_services','home_services','commerce')), source_key text not null,
 unique(workspace_id,id), unique(workspace_id,source_key), foreign key(workspace_id,contact_id) references public.contacts(workspace_id,id),
 foreign key(workspace_id,account_id) references public.accounts(workspace_id,id)
);
create table public.proposals (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), opportunity_id uuid not null, contact_id uuid not null,
 source_binding_id uuid not null, source_key text not null, version integer not null check(version > 0), reference text not null, issued_at timestamptz not null,
 valid_until timestamptz, amount_minor bigint check(amount_minor between 0 and 9007199254740991), currency text not null check(currency ~ '^[A-Z]{3}$'),
 value_kind text not null check(value_kind in ('one_time','monthly_recurring','total_contract','unknown')), scope_summary text not null,
 source_url text, status text not null check(status in ('open','accepted','declined','on_hold','expired','unknown')), raw_status text not null,
 owner text not null, source_verified_at timestamptz not null, synced_at timestamptz not null, fixture boolean not null default false,
 unique(workspace_id,id), unique(workspace_id,source_binding_id,source_key,version),
 foreign key(workspace_id,opportunity_id) references public.opportunities(workspace_id,id), foreign key(workspace_id,contact_id) references public.contacts(workspace_id,id),
 foreign key(workspace_id,source_binding_id) references public.source_bindings(workspace_id,id)
);
create table public.evidence (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), source_binding_id uuid,
 label text not null, source text not null, quality text not null check(quality in ('fixture','provider_verified','manually_reported','unknown')),
 captured_at timestamptz not null, object_path text, url text, content_hash text, expires_at timestamptz, unique(workspace_id,id),
 foreign key(workspace_id,source_binding_id) references public.source_bindings(workspace_id,id),
 check(object_path is null or split_part(object_path,'/',1)=workspace_id::text)
);
create table public.policies (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), version integer not null,
 approved_by uuid not null, bounds jsonb not null, created_at timestamptz not null default now(), unique(workspace_id,id), unique(workspace_id,version),
 foreign key(workspace_id,approved_by) references public.memberships(workspace_id,id)
);
create table public.installations (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), agent_id text not null, definition_version text not null,
 mode text not null check(mode in ('preparation','monitored_execution','bounded_autonomous_execution')),
 status text not null default 'selected', policy_id uuid, daily_capacity integer not null check(daily_capacity >= 0),
 last_preparation_at timestamptz, last_business_action_at timestamptz, unique(workspace_id,id), unique(workspace_id,agent_id),
 foreign key(workspace_id,policy_id) references public.policies(workspace_id,id)
);
create table public.live_activations (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), sender_connection_id uuid not null, sender text not null,
 cohort_id text not null, operator_membership_id uuid not null, policy_id uuid not null, approved_by uuid not null,
 expires_at timestamptz not null, revoked_at timestamptz, staffed_hours jsonb not null, unique(workspace_id,id),
 foreign key(workspace_id,sender_connection_id) references public.connections(workspace_id,id),
 foreign key(workspace_id,operator_membership_id) references public.memberships(workspace_id,id),
 foreign key(workspace_id,approved_by) references public.memberships(workspace_id,id), foreign key(workspace_id,policy_id) references public.policies(workspace_id,id)
);
create table public.mandates (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), version integer not null, grantor_id uuid not null,
 action_type text not null check(action_type in ('send_follow_up','book_appointment')), bounds jsonb not null, starts_at timestamptz not null,
 expires_at timestamptz not null, revoked_at timestamptz, unique(workspace_id,id), check(expires_at > starts_at),
 foreign key(workspace_id,grantor_id) references public.memberships(workspace_id,id)
);
create table public.runs (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), installation_id uuid not null, connection_id uuid,
 definition_version text not null, sdk_version text not null, deployment_id text not null, environment text not null check(environment in ('fixture','shadow','live')),
 status text not null check(status in ('scheduled','processing','awaiting_approval','waiting_for_reply','waiting_for_input','completed','blocked','failed','paused','cancelled')),
 workflow_id text, workflow_claim text, claim_until timestamptz, fence bigint not null default 0, next_due_at timestamptz,
 created_at timestamptz not null default now(), unique(workspace_id,id),
 foreign key(workspace_id,installation_id) references public.installations(workspace_id,id), foreign key(workspace_id,connection_id) references public.connections(workspace_id,id)
);
create table public.actions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), installation_id uuid not null, run_id uuid not null,
 contact_id uuid not null, proposal_id uuid not null, type text not null check(type in ('send_follow_up','book_appointment')),
 payload jsonb not null, source_snapshot jsonb not null default '{}', payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'), proposal_version integer not null, policy_id uuid not null, mandate_id uuid,
 status text not null default 'not_attempted' check(status in ('not_attempted','submitting','provider_accepted','confirmed','failed','uncertain')),
 expires_at timestamptz not null, reserved_cost_minor bigint not null default 0 check(reserved_cost_minor >= 0), reserved_at timestamptz,
 reservation_day date, claim_token uuid, fence bigint not null default 0, submitting_at timestamptz,
 created_at timestamptz not null default now(), unique(workspace_id,id), unique(workspace_id,run_id,type,payload_hash),
 foreign key(workspace_id,installation_id) references public.installations(workspace_id,id), foreign key(workspace_id,run_id) references public.runs(workspace_id,id),
 foreign key(workspace_id,contact_id) references public.contacts(workspace_id,id), foreign key(workspace_id,proposal_id) references public.proposals(workspace_id,id),
 foreign key(workspace_id,policy_id) references public.policies(workspace_id,id), foreign key(workspace_id,mandate_id) references public.mandates(workspace_id,id)
);
create table public.approvals (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), action_id uuid not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected','expired','invalidated')), payload_hash text not null,
 approver_id uuid, decided_at timestamptz, expires_at timestamptz not null, unique(workspace_id,id), unique(workspace_id,action_id),
 foreign key(workspace_id,action_id) references public.actions(workspace_id,id), foreign key(workspace_id,approver_id) references public.memberships(workspace_id,id)
);
create table public.receipts (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), action_id uuid not null,
 status text not null check(status in ('not_attempted','submitting','provider_accepted','confirmed','failed','uncertain')), provider text not null check(provider in ('google','fixture')),
 provider_id text, message text not null, reconciliation text not null check(reconciliation in ('not_required','pending','resolved','operator_review')),
 observed_at timestamptz not null default now(), unique(workspace_id,id), foreign key(workspace_id,action_id) references public.actions(workspace_id,id)
);
create table public.conversations (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), contact_id uuid not null, run_id uuid not null,
 connection_id uuid not null, purpose text not null, provider_thread_id text, owner_agent_id text not null, fence bigint not null default 1,
 replied_at timestamptz, last_reply_at timestamptz, reply_class text, booked_at timestamptz, takeover boolean not null default false, active boolean not null default true,
 unique(workspace_id,id), foreign key(workspace_id,contact_id) references public.contacts(workspace_id,id), foreign key(workspace_id,run_id) references public.runs(workspace_id,id),
 foreign key(workspace_id,connection_id) references public.connections(workspace_id,id)
);
create unique index one_contact_owner on public.conversations(workspace_id,contact_id) where active;
create table public.appointments (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), conversation_id uuid not null, action_id uuid not null,
 evidence_id uuid not null, calendar_id text not null, provider_event_id text not null, starts_at timestamptz not null, ends_at timestamptz not null, time_zone text not null,
 unique(workspace_id,id), unique(workspace_id,calendar_id,provider_event_id), check(ends_at > starts_at),
 foreign key(workspace_id,conversation_id) references public.conversations(workspace_id,id), foreign key(workspace_id,action_id) references public.actions(workspace_id,id),
 foreign key(workspace_id,evidence_id) references public.evidence(workspace_id,id)
);
create table public.outcomes (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), opportunity_id uuid not null, evidence_id uuid not null,
 metric text not null, metric_version integer not null default 1, stage text not null check(stage in ('reply','booked','attended','signed','completed','invoiced','paid')),
 source text not null, period_start timestamptz not null, period_end timestamptz not null, value numeric check(value between -9007199254740991 and 9007199254740991), value_type text not null, currency text,
 quality text not null check(quality in ('fixture','provider_verified','manually_reported','unknown')), unique(workspace_id,id),
 foreign key(workspace_id,opportunity_id) references public.opportunities(workspace_id,id), foreign key(workspace_id,evidence_id) references public.evidence(workspace_id,id)
);
create table public.prepared_artifacts (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), run_id uuid not null,
 agent_id text not null, type text not null, title text not null, content text not null, factual_inputs jsonb not null, source_snapshot jsonb not null,
 capability_version text not null, review_state text not null check(review_state in ('draft','reviewed','rejected')), limitation text not null,
 created_at timestamptz not null default now(), unique(workspace_id,id), foreign key(workspace_id,run_id) references public.runs(workspace_id,id)
);
create table public.artifact_evidence (
 workspace_id uuid not null references public.workspaces(id), artifact_id uuid not null, evidence_id uuid not null,
 primary key(workspace_id,artifact_id,evidence_id), foreign key(workspace_id,artifact_id) references public.prepared_artifacts(workspace_id,id),
 foreign key(workspace_id,evidence_id) references public.evidence(workspace_id,id)
);
create table public.action_evidence (
 workspace_id uuid not null references public.workspaces(id), action_id uuid not null, evidence_id uuid not null,
 primary key(workspace_id,action_id,evidence_id), foreign key(workspace_id,action_id) references public.actions(workspace_id,id),
 foreign key(workspace_id,evidence_id) references public.evidence(workspace_id,id)
);
-- Product documents retain shared schema-validated payloads; normalized references use tenant FKs.
create table public.product_records (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
 kind text not null check(kind in ('team_recommendation','activation_plan','work_opportunity','initiative','assignment','forecast_scenario','brief_snapshot','intervention','company_context')),
 parent_id uuid, payload jsonb not null, version integer not null default 1, created_at timestamptz not null default now(), unique(workspace_id,id),
 foreign key(workspace_id,parent_id) references public.product_records(workspace_id,id)
);
create table public.usage_records (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), run_id uuid, category text not null,
 minutes integer not null default 0 check(minutes >= 0), cost_minor bigint check(cost_minor >= 0), currency text not null,
 note text not null, created_at timestamptz not null default now(), unique(workspace_id,id), foreign key(workspace_id,run_id) references public.runs(workspace_id,id)
);
create table public.audit_events (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), actor_id uuid,
 event_type text not null, entity_id uuid, detail jsonb not null default '{}', created_at timestamptz not null default now(), unique(workspace_id,id)
);
create table private.outbox (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), run_id uuid not null,
 event_type text not null, dedupe_key text not null, payload jsonb not null default '{}', due_at timestamptz not null default now(),
 lease_token uuid, lease_until timestamptz, attempts integer not null default 0, dispatched_at timestamptz, last_error text,
 unique(workspace_id,dedupe_key), foreign key(workspace_id,run_id) references public.runs(workspace_id,id)
);
create index due_outbox on private.outbox(due_at) where dispatched_at is null;
create table private.inbox (
 workspace_id uuid not null references public.workspaces(id), connection_id uuid not null, provider_event_id text not null,
 run_id uuid not null, received_at timestamptz not null default now(), primary key(workspace_id,connection_id,provider_event_id),
 foreign key(workspace_id,connection_id) references public.connections(workspace_id,id), foreign key(workspace_id,run_id) references public.runs(workspace_id,id)
);
create table private.wait_registrations (
 workspace_id uuid not null references public.workspaces(id), run_id uuid not null, action_id uuid not null, hook_token text not null,
 expires_at timestamptz not null, delivered_at timestamptz, primary key(workspace_id,action_id),
 foreign key(workspace_id,run_id) references public.runs(workspace_id,id), foreign key(workspace_id,action_id) references public.actions(workspace_id,id)
);
create table private.run_routes (
 run_id uuid primary key references public.runs(id), workspace_id uuid not null references public.workspaces(id), route_token uuid not null default gen_random_uuid(),
 foreign key(workspace_id,run_id) references public.runs(workspace_id,id)
);
-- Unlike a custom GUC, this context cannot be manufactured with SET by david_worker.
create table private.transaction_context (
 transaction_id bigint primary key, backend_pid integer not null, workspace_id uuid not null, run_id uuid not null, created_at timestamptz not null default now(),
 foreign key(workspace_id,run_id) references public.runs(workspace_id,id)
);
create table private.source_cursors (
 workspace_id uuid not null references public.workspaces(id), source_binding_id uuid not null, cursor jsonb not null, checkpointed_at timestamptz not null default now(),
 primary key(workspace_id,source_binding_id), foreign key(workspace_id,source_binding_id) references public.source_bindings(workspace_id,id)
);
create table private.budget_counters (
 workspace_id uuid not null references public.workspaces(id), day date not null, actions integer not null default 0, reserved_minor bigint not null default 0,
 spent_minor bigint not null default 0, primary key(workspace_id,day)
);
create table private.connection_secrets (
 workspace_id uuid not null references public.workspaces(id), connection_id uuid not null, vault_id uuid not null references vault.secrets(id),
 expires_at timestamptz not null, refresh_lease uuid, refresh_until timestamptz, primary key(workspace_id,connection_id),
 foreign key(workspace_id,connection_id) references public.connections(workspace_id,id)
);
create table private.oauth_states (
 state_hash text primary key, workspace_id uuid not null references public.workspaces(id), actor_id uuid not null references auth.users(id),
 redirect_uri text not null, verifier_vault_id uuid not null references vault.secrets(id), expires_at timestamptz not null, consumed_at timestamptz
);

create function private.member_role(p_workspace uuid) returns text language sql stable security definer set search_path='' as $$
 select m.role from public.memberships m where m.workspace_id=p_workspace and m.actor_id=auth.uid() and m.active
   and (m.role <> 'david_operator' or auth.jwt()->>'aal'='aal2')
$$;
create function private.current_workspace() returns uuid language sql stable security definer set search_path='' as $$
 select c.workspace_id from private.transaction_context c where c.transaction_id=txid_current() and c.backend_pid=pg_backend_pid()
$$;
create function private.current_run() returns uuid language sql stable security definer set search_path='' as $$
 select c.run_id from private.transaction_context c where c.transaction_id=txid_current() and c.backend_pid=pg_backend_pid()
$$;
create function private.bind_run(p_run uuid,p_token uuid) returns void language plpgsql security definer set search_path='' as $$
 declare w uuid; begin
 select workspace_id into w from private.run_routes where run_id=p_run and route_token=p_token;
 if w is null then raise exception 'Invalid run routing capability' using errcode='42501'; end if;
 insert into private.transaction_context(transaction_id,backend_pid,workspace_id,run_id) values(txid_current(),pg_backend_pid(),w,p_run);
 end $$;
create function private.route_run(p_run uuid) returns table(run_id uuid, route_token uuid) language sql security definer set search_path='' as $$
 select r.run_id,r.route_token from private.run_routes r where r.run_id=p_run
$$;
create function private.register_run_route() returns trigger language plpgsql security definer set search_path='' as $$
 begin insert into private.run_routes(run_id,workspace_id) values(new.id,new.workspace_id); return new; end $$;
create trigger register_run_route after insert on public.runs for each row execute function private.register_run_route();

do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename in ('workspaces','memberships','connections','source_bindings','accounts','contacts','opportunities','proposals','evidence','policies','installations','live_activations','mandates','runs','actions','approvals','receipts','conversations','appointments','outcomes','prepared_artifacts','artifact_evidence','action_evidence','product_records','usage_records','audit_events') loop
  execute format('alter table public.%I enable row level security',t.tablename);
  execute format('revoke all on public.%I from public, anon, authenticated, david_worker, david_dispatcher',t.tablename);
  execute format('grant select on public.%I to authenticated, david_worker',t.tablename);
  execute format('create policy member_read on public.%I for select to authenticated using (private.member_role(%I) is not null)',t.tablename,case when t.tablename='workspaces' then 'id' else 'workspace_id' end);
  execute format('create policy scoped_worker_read on public.%I for select to david_worker using (%I=private.current_workspace())',t.tablename,case when t.tablename='workspaces' then 'id' else 'workspace_id' end);
 end loop;
end $$;
-- Read models are browser readable. Browser roles have NO direct write grants.
-- Mutable import/content writes are scoped by the restricted worker transaction.
do $$ declare t text; begin foreach t in array array['accounts','contacts','opportunities','proposals','evidence','runs','conversations','appointments','outcomes','prepared_artifacts','artifact_evidence','action_evidence','product_records','usage_records'] loop
 execute format('grant insert, update on public.%I to david_worker',t);
 execute format('create policy scoped_worker_insert on public.%I for insert to david_worker with check (workspace_id=private.current_workspace())',t);
 execute format('create policy scoped_worker_update on public.%I for update to david_worker using (workspace_id=private.current_workspace()) with check (workspace_id=private.current_workspace())',t);
end loop; end $$;
revoke all on all tables in schema private from public, anon, authenticated, david_worker, david_dispatcher;
revoke all on all tables in schema vault from public, anon, authenticated, david_worker, david_dispatcher;
revoke all on all functions in schema private from public, anon, authenticated, david_worker, david_dispatcher;
grant usage on schema private to authenticated;
grant execute on function private.member_role(uuid) to authenticated;
grant execute on function private.current_workspace(),private.current_run(),private.bind_run(uuid,uuid) to david_worker;
grant execute on function private.route_run(uuid) to david_dispatcher;

-- Private bucket policies check membership in addition to the path prefix.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('david-evidence','david-evidence',false,5242880,array['text/csv','text/plain','application/pdf','image/png','image/jpeg'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy david_evidence_read on storage.objects for select to authenticated using(
 bucket_id='david-evidence' and (storage.foldername(name))[1] in (select m.workspace_id::text from public.memberships m where m.actor_id=auth.uid() and m.active and private.member_role(m.workspace_id) is not null)
);
create policy david_evidence_upload on storage.objects for insert to authenticated with check(
 bucket_id='david-evidence' and (storage.foldername(name))[2]='quarantine' and (storage.foldername(name))[1] in (select m.workspace_id::text from public.memberships m where m.actor_id=auth.uid() and m.active and private.member_role(m.workspace_id) in ('workspace_owner','workspace_member','david_operator'))
);
-- No browser UPDATE/DELETE object policy; authorized retention jobs are separately operated.
commit;
