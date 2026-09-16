-- Per-client, per-agent onboarding envelope. Company connections stay shared.
begin;
create table private.agent_required_tools (
 agent_id text primary key references private.agent_catalog(id),
 required_tools jsonb not null
);
insert into private.agent_required_tools(agent_id,required_tools) values
('account-intelligence','{"tools":["read_approved_snapshot","save_artifact"],"capabilities":["website.captured","company.confirmed"],"systems":["website","drive"],"prerequisites":["confirmed_company_facts","approved_website_snapshot"]}'),
('buying-signal-scout','{"tools":[],"capabilities":["engineering.implementation"],"systems":["analytics","proposals"],"prerequisites":["missing_engineering_integration"]}'),
('outbound-email-sdr','{"tools":["instantly.campaign","instantly.leads","instantly.webhooks"],"capabilities":["company.confirmed","instantly.send","instantly.warmup","instantly.replies","calendar.booking_link"],"systems":["mail"],"prerequisites":["confirmed_company_facts","customer_lead_list","booking_url","warmed_sending_account"]}'),
('linkedin-outreach-assistant','{"tools":["heyreach.copy_out"],"capabilities":["engineering.implementation"],"systems":["social","proposals"],"prerequisites":["missing_engineering_integration"]}'),
('partner-development','{"tools":[],"capabilities":["engineering.implementation"],"systems":["proposals","mail"],"prerequisites":["missing_engineering_integration"]}'),
('rfp-opportunity-scout','{"tools":[],"capabilities":["engineering.implementation"],"systems":["rfp","drive"],"prerequisites":["missing_engineering_integration"]}'),
('competitor-intelligence','{"tools":[],"capabilities":["engineering.implementation"],"systems":["website"],"prerequisites":["missing_engineering_integration"]}'),
('search-growth','{"tools":["read_approved_snapshot","save_artifact"],"capabilities":["website.captured","company.confirmed"],"systems":["website","analytics"],"prerequisites":["confirmed_company_facts","approved_website_snapshot"]}'),
('technical-seo-monitor','{"tools":["read_approved_snapshot","save_artifact"],"capabilities":["website.captured","company.confirmed"],"systems":["website"],"prerequisites":["confirmed_company_facts","approved_website_snapshot"]}'),
('local-search-manager','{"tools":["read_approved_snapshot","save_artifact"],"capabilities":["website.captured","company.confirmed"],"systems":["local","website"],"prerequisites":["confirmed_company_facts","approved_website_snapshot"]}'),
('creative-performance','{"tools":["read_approved_snapshot","save_artifact"],"capabilities":["website.captured","company.confirmed"],"systems":["advertising","drive"],"prerequisites":["confirmed_company_facts","approved_website_snapshot"]}'),
('paid-campaign-operator','{"tools":[],"capabilities":["engineering.implementation"],"systems":["advertising","analytics"],"prerequisites":["missing_engineering_integration"]}'),
('landing-page-optimizer','{"tools":["read_approved_snapshot","save_artifact"],"capabilities":["website.captured","company.confirmed"],"systems":["website","analytics"],"prerequisites":["confirmed_company_facts","approved_website_snapshot"]}'),
('social-content-publisher','{"tools":["read_approved_snapshot","save_artifact"],"capabilities":["website.captured","company.confirmed"],"systems":["social","drive"],"prerequisites":["confirmed_company_facts","approved_website_snapshot"]}'),
('video-script-producer','{"tools":["read_approved_snapshot","save_artifact"],"capabilities":["website.captured","company.confirmed"],"systems":["drive"],"prerequisites":["confirmed_company_facts","approved_website_snapshot"]}'),
('product-merchandiser','{"tools":[],"capabilities":["engineering.implementation"],"systems":["commerce"],"prerequisites":["missing_engineering_integration"]}'),
('speed-to-lead-responder','{"tools":[],"capabilities":["engineering.implementation"],"systems":["proposals","mail"],"prerequisites":["missing_engineering_integration"]}'),
('ai-receptionist','{"tools":[],"capabilities":["engineering.implementation"],"systems":["calls","calendar"],"prerequisites":["missing_engineering_integration"]}'),
('website-sales-concierge','{"tools":["read_approved_snapshot","save_artifact"],"capabilities":["website.captured","company.confirmed"],"systems":["website","drive"],"prerequisites":["confirmed_company_facts","approved_website_snapshot"]}'),
('appointment-coordinator','{"tools":["read_bound_source","propose_checked_action"],"capabilities":["calendar.availability","calendar.book","conversation.assignment"],"systems":["calendar","mail"],"prerequisites":["current_policy","assigned_operator","selected_installation","approved_action","fresh_bound_sources"]}'),
('lead-qualification','{"tools":[],"capabilities":["engineering.implementation"],"systems":["proposals"],"prerequisites":["missing_engineering_integration"]}'),
('proposal-operations','{"tools":[],"capabilities":["engineering.implementation"],"systems":["proposals","drive"],"prerequisites":["missing_engineering_integration"]}'),
('deal-follow-up','{"tools":["read_bound_source","propose_checked_action"],"capabilities":["proposals.current","gmail.send","gmail.reply_read","cohort.enrolled"],"systems":["proposals","mail"],"prerequisites":["current_policy","assigned_operator","selected_installation","approved_action","fresh_bound_sources"]}'),
('sales-call-coach','{"tools":[],"capabilities":["engineering.implementation"],"systems":["calls","drive"],"prerequisites":["missing_engineering_integration"]}'),
('estimate-recovery','{"tools":[],"capabilities":["engineering.implementation"],"systems":["proposals","mail"],"prerequisites":["missing_engineering_integration"]}'),
('revenue-experiment-manager','{"tools":[],"capabilities":["engineering.implementation"],"systems":["analytics","payments"],"prerequisites":["missing_engineering_integration"]}'),
('abandoned-cart-recovery','{"tools":[],"capabilities":["engineering.implementation"],"systems":["commerce","mail"],"prerequisites":["missing_engineering_integration"]}'),
('lifecycle-email-manager','{"tools":[],"capabilities":["engineering.implementation"],"systems":["mail","proposals"],"prerequisites":["missing_engineering_integration"]}'),
('customer-win-back','{"tools":[],"capabilities":["engineering.implementation"],"systems":["proposals","mail"],"prerequisites":["missing_engineering_integration"]}'),
('expansion-opportunity-scout','{"tools":[],"capabilities":["engineering.implementation"],"systems":["proposals","payments"],"prerequisites":["missing_engineering_integration"]}'),
('renewal-and-retention','{"tools":[],"capabilities":["engineering.implementation"],"systems":["proposals","payments"],"prerequisites":["missing_engineering_integration"]}'),
('review-and-referral-manager','{"tools":[],"capabilities":["engineering.implementation"],"systems":["local","mail"],"prerequisites":["missing_engineering_integration"]}');
revoke all on private.agent_required_tools from public,anon,authenticated,david_worker,david_dispatcher,david_oauth;

create table public.agent_onboarding (
 workspace_id uuid not null references public.workspaces(id),
 agent_id text not null references private.agent_catalog(id),
 status text not null default 'not_started' check(status in ('not_started','in_progress','blocked','ready')),
 answers jsonb not null default '{}'::jsonb,
 required_tools jsonb not null,
 missing text[] not null default '{}',
 revision integer not null default 0 check(revision>=0),
 updated_at timestamptz not null default now(),
 updated_by uuid not null references auth.users(id),
 primary key(workspace_id,agent_id)
);
alter table public.agent_onboarding enable row level security;
revoke all on public.agent_onboarding from public,anon,authenticated,david_worker,david_dispatcher,david_oauth;
grant select on public.agent_onboarding to authenticated;
create policy agent_onboarding_read on public.agent_onboarding for select to authenticated using(private.member_role(workspace_id) is not null);

create function private.ensure_agent_onboarding(p_workspace uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 if not exists(select 1 from public.workspaces where id=p_workspace) then raise exception 'Workspace not found' using errcode='42501';end if;
 select actor_id into actor from public.memberships where workspace_id=p_workspace and active
  order by (role='workspace_owner') desc,(role='david_operator') desc,id limit 1;
 actor:=coalesce(auth.uid(),actor);
 if actor is null then raise exception 'Workspace membership required' using errcode='42501';end if;
 insert into public.agent_onboarding(workspace_id,agent_id,status,answers,required_tools,missing,revision,updated_at,updated_by)
 select p_workspace,t.agent_id,'not_started','{}'::jsonb,t.required_tools,'{}'::text[],0,now(),actor
 from private.agent_required_tools t
 on conflict(workspace_id,agent_id) do nothing;
end $$;
revoke all on function private.ensure_agent_onboarding(uuid) from public,anon,authenticated,david_worker,david_dispatcher,david_oauth;

create or replace function private.initialize_onboarding_baseline(p_workspace uuid) returns void
language plpgsql security definer set search_path='' as $$
declare w public.workspaces; actor uuid; defaults jsonb; begin
 select * into w from public.workspaces where id=p_workspace for update;
 if w.id is null then raise exception 'Workspace not found' using errcode='42501';end if;
 select actor_id into actor from public.memberships where workspace_id=p_workspace and active
 order by (role='workspace_owner') desc,(role='david_operator') desc,id limit 1;
 if actor is null then raise exception 'Workspace membership required' using errcode='42501';end if;
 if not exists(select 1 from public.onboarding_documents where workspace_id=p_workspace) then
  defaults:=jsonb_build_object('company',jsonb_build_object('name',w.name,'website','','businessModel',w.business_model,'timeZone',w.time_zone,
   'offers','[]'::jsonb,'customers','[]'::jsonb,'priorities','[]'::jsonb,'successDefinition','','brandGuidance','','forbiddenClaims',''))
   || '{"team":[],"systems":[],"operations":{"approvalMode":"each_action","automationAcknowledged":false,"contactRestrictions":"","workingDays":[1,2,3,4,5],"startHour":9,"endHour":17,"meetingMinutes":30,"bufferMinutes":15,"dailyCapacity":0,"modelDailyBudgetMinor":null,"actionDailyBudgetMinor":0,"sender":"","calendarId":"","escalationOwner":"","approvedContactIds":[],"policyAcknowledged":false},"people":[],"measurement":{"owner":"","outcomeSources":"","baseline":[],"sharing":"private"}}'::jsonb;
  insert into public.onboarding_documents(workspace_id,revision,answers,updated_at,updated_by)
  values(w.id,0,defaults,w.created_at,actor) on conflict(workspace_id) do nothing;
  if found then
   insert into private.onboarding_revisions(workspace_id,revision,answers,actor,at,summary)
   values(w.id,0,defaults,actor,w.created_at,'Initial company setup. No sources verified or work authorized.');
  end if;
 end if;
 perform private.ensure_agent_onboarding(p_workspace);
end $$;

create or replace function public.select_team(p_workspace uuid,p_agents text[]) returns void language plpgsql security definer set search_path='' as $$
declare w public.workspaces; slot text[]; previous text[]; begin
 perform private.require_setup_owner(p_workspace);select * into w from public.workspaces where id=p_workspace for update;
 slot:=coalesce(array(select distinct a from unnest(coalesce(p_agents,'{}'::text[])) a where a is distinct from 'website-sales-concierge' order by 1),'{}');
 if p_agents is null or cardinality(slot)>w.entitlement or cardinality(p_agents)<>(select count(distinct a) from unnest(p_agents) a) then raise exception 'Distinct agents within workspace allowance required';end if;
 if exists(select 1 from unnest(slot) a left join private.agent_catalog c on c.id=a where c.id is null or not w.business_model=any(c.archetypes)) then raise exception 'Unknown or inapplicable specialist';end if;
 select coalesce(array_agg(i.agent_id order by i.agent_id),'{}') into previous from public.installations i where i.workspace_id=w.id and i.status is distinct from 'paused' and i.agent_id is distinct from 'website-sales-concierge';
 if exists(select 1 from unnest(previous) a where not a=any(slot))
    and w.team_selected_at is not null and w.team_selected_at>now()-interval '12 hours'
    and private.member_role(p_workspace) is distinct from 'david_operator'
 then raise exception 'Removing a specialist settles for 12 hours after the last live team change';end if;
 if exists(select 1 from public.runs r join public.installations i on i.id=r.installation_id where r.workspace_id=w.id and not i.agent_id=any(slot) and i.agent_id is distinct from 'website-sales-concierge' and r.status not in ('completed','cancelled','failed')) then raise exception 'Complete a controlled handoff before removing a specialist with unfinished work';end if;
 update public.installations set status='paused' where workspace_id=w.id and not agent_id=any(slot) and agent_id is distinct from 'website-sales-concierge';
 insert into public.installations(workspace_id,agent_id,definition_version,mode,status,daily_capacity)
 select w.id,c.id,'1.0.0',c.mode,'selected',0 from private.agent_catalog c where c.id=any(slot) or c.id='website-sales-concierge'
 on conflict(workspace_id,agent_id) do update set status='selected';
 if previous is distinct from slot then update public.workspaces set team_selected_at=now() where id=w.id;end if;
 perform private.ensure_agent_onboarding(p_workspace);
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(w.id,auth.uid(),'team_selected',jsonb_build_object('agent_ids',slot,'included',jsonb_build_array('website-sales-concierge')));
end $$;

create function public.read_agent_onboarding(p_workspace uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if private.member_role(p_workspace) is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 perform private.ensure_agent_onboarding(p_workspace);
 return coalesce((select jsonb_agg(jsonb_build_object(
  'workspaceId',a.workspace_id,'agentId',a.agent_id,'status',a.status,'answers',a.answers,
  'requiredTools',a.required_tools,'missing',to_jsonb(a.missing),'revision',a.revision,
  'updatedAt',a.updated_at,'updatedBy',a.updated_by) order by a.agent_id)
  from public.agent_onboarding a where a.workspace_id=p_workspace),'[]'::jsonb);
end $$;

create function public.save_agent_onboarding(p_workspace uuid,p_agent text,p_expected_revision integer,p_answers jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare current_row public.agent_onboarding; started boolean;
begin
 perform private.require_setup_owner(p_workspace);
 perform private.ensure_agent_onboarding(p_workspace);
 select * into current_row from public.agent_onboarding where workspace_id=p_workspace and agent_id=p_agent for update;
 if current_row.agent_id is null then raise exception 'Unknown specialist';end if;
 if p_expected_revision is distinct from current_row.revision then raise exception 'Setup revision conflict; reload before saving' using errcode='40001';end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>40000 then raise exception 'Invalid agent onboarding answers';end if;
 started:=p_answers<>'{}'::jsonb;
 update public.agent_onboarding set answers=p_answers,revision=current_row.revision+1,
  status=case when current_row.status='ready' then 'ready' when started then 'in_progress' else 'not_started' end,
  updated_at=now(),updated_by=auth.uid()
 where workspace_id=p_workspace and agent_id=p_agent;
 insert into public.audit_events(workspace_id,actor_id,event_type,detail)
  values(p_workspace,auth.uid(),'agent_onboarding_saved',jsonb_build_object('agent_id',p_agent,'revision',current_row.revision+1));
end $$;

revoke all on function public.read_agent_onboarding(uuid),public.save_agent_onboarding(uuid,text,integer,jsonb) from public,anon;
grant execute on function public.read_agent_onboarding(uuid),public.save_agent_onboarding(uuid,text,integer,jsonb) to authenticated;

create or replace function private.privacy_tables() returns table(table_name text,exportable boolean,delete_order integer) language sql immutable set search_path='' as $$
 values
 ('public.outbound_events',true,-8),('public.outbound_leads',true,-7),('public.outbound_campaigns',true,-6),
 ('public.agent_onboarding',true,-5),
 ('public.onboarding_documents',true,-4),('public.onboarding_tasks',true,-3),('private.onboarding_revisions',true,-2),('private.workspace_invitations',false,-1),
 ('private.transaction_context',false,1),('private.wait_registrations',false,2),('private.outbox',true,3),('private.inbox',true,4),
 ('private.run_routes',false,5),('private.run_inputs',true,6),('private.preparation_claims',true,7),('private.model_reservations',true,8),
 ('private.proposal_threads',true,9),('private.gmail_cursors',true,10),('private.import_rows',true,11),('private.source_cursors',true,12),
 ('private.request_quotas',true,13),('private.connection_secrets',false,14),('private.oauth_states',false,15),('private.model_workspace_counters',true,16),
 ('private.workspace_model_limits',true,17),('private.budget_counters',true,18),('public.artifact_evidence',true,19),('public.action_evidence',true,20),
 ('public.appointments',true,21),('public.outcomes',true,22),('public.approvals',true,23),('public.receipts',true,24),('public.conversations',true,25),
 ('public.actions',true,26),('public.prepared_artifacts',true,27),('public.usage_records',true,28),('public.runs',true,29),('public.installations',true,30),
 ('public.live_activations',true,31),('public.mandates',true,32),('public.policies',true,33),('public.proposals',true,34),('public.evidence',true,35),
 ('public.product_records',true,36),('public.opportunities',true,37),('public.contacts',true,38),('public.accounts',true,39),('public.source_bindings',true,40),
 ('public.connections',true,41),('public.audit_events',true,42),('public.memberships',true,43),('private.privacy_jobs',false,44),('public.workspaces',true,45)
$$;
commit;
