begin;
create table public.onboarding_documents (
 workspace_id uuid primary key references public.workspaces(id), revision integer not null default 0,
 answers jsonb not null, updated_at timestamptz not null default now(), updated_by uuid not null references auth.users(id)
);
create table private.onboarding_revisions (
 workspace_id uuid not null references public.workspaces(id),revision integer not null,answers jsonb not null,
 actor uuid not null,at timestamptz not null default now(),summary text not null,primary key(workspace_id,revision)
);
create table public.onboarding_tasks (
 workspace_id uuid not null references public.workspaces(id),id text not null,title text not null,owner text not null,
 status text not null check(status in ('open','in_progress','resolved')),note text not null default '',revision integer not null,
 updated_by uuid not null,updated_at timestamptz not null default now(),primary key(workspace_id,id)
);
create table private.workspace_invitations (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),email text not null,
 role text not null check(role in ('workspace_owner','workspace_member','workspace_viewer')),token_hash text not null unique,
 status text not null default 'pending' check(status in ('pending','accepted','revoked')),
 expires_at timestamptz not null default now()+interval '7 days',created_by uuid not null,accepted_by uuid,created_at timestamptz not null default now()
);
alter table public.onboarding_documents enable row level security;
alter table public.onboarding_tasks enable row level security;
create policy onboarding_read on public.onboarding_documents for select to authenticated using(private.member_role(workspace_id) is not null);
create policy onboarding_tasks_read on public.onboarding_tasks for select to authenticated using(private.member_role(workspace_id) is not null);
revoke all on public.onboarding_documents,public.onboarding_tasks from anon,authenticated;
grant select on public.onboarding_documents,public.onboarding_tasks to authenticated;
revoke all on private.onboarding_revisions,private.workspace_invitations from public,anon,authenticated,david_worker,david_dispatcher,david_oauth;

create function private.require_setup_owner(p_workspace uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if coalesce(private.member_role(p_workspace),'') not in ('workspace_owner','david_operator') then raise exception 'Workspace owner or assigned MFA operator required' using errcode='42501';end if;
end $$;

create function public.read_onboarding(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.onboarding_documents; begin
 if private.member_role(p_workspace) is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 select * into d from public.onboarding_documents where workspace_id=p_workspace;
 if d.workspace_id is null then return null;end if;
 return jsonb_build_object('version',1,'revision',d.revision,'appliedRevision',(select (detail->>'revision')::int from public.audit_events where workspace_id=p_workspace and event_type='onboarding_settings_applied' order by created_at desc limit 1),'answers',d.answers,'updatedAt',d.updated_at,'updatedBy',d.updated_by,
 'reviews',coalesce((select jsonb_agg(jsonb_build_object('artifactId',v.entity_id,'revision',(v.detail->>'revision')::int,'at',v.created_at)) from (select distinct on(entity_id) entity_id,detail,created_at from public.audit_events where workspace_id=p_workspace and event_type='artifact_reviewed' and detail ? 'revision' order by entity_id,created_at desc limit 100) v where v.detail->>'decision'='reviewed'),'[]'::jsonb),
 'history',coalesce((select jsonb_agg(jsonb_build_object('revision',r.revision,'at',r.at,'actor',r.actor,'summary',r.summary) order by r.revision desc) from (select * from private.onboarding_revisions where workspace_id=p_workspace order by revision desc limit 100) r),'[]'::jsonb),
 'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'owner',t.owner,'status',t.status,'note',t.note,'revision',t.revision) order by t.updated_at) from public.onboarding_tasks t where workspace_id=p_workspace),'[]'::jsonb),
 'invitations',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'role',i.role,'status',case when i.status='pending' and i.expires_at<=now() then 'expired' else i.status end,'expiresAt',i.expires_at)) from (select * from private.workspace_invitations where workspace_id=p_workspace order by created_at desc limit 100) i),'[]'::jsonb));
end $$;

create function public.save_onboarding(p_workspace uuid,p_expected_revision integer,p_answers jsonb) returns void language plpgsql security definer set search_path='' as $$
declare d public.onboarding_documents; w public.workspaces; o jsonb; changed boolean; rev integer; begin
 perform private.require_setup_owner(p_workspace);
 select * into w from public.workspaces where id=p_workspace for update;
 select * into d from public.onboarding_documents where workspace_id=p_workspace for update;
 if p_expected_revision is distinct from coalesce(d.revision,0) then raise exception 'Setup revision conflict; reload before saving' using errcode='40001';end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>150000
 or not(p_answers ?& array['company','team','systems','operations','people','measurement'])
 or exists(select 1 from jsonb_object_keys(p_answers) k where k not in ('company','team','systems','operations','people','measurement')) then raise exception 'Invalid onboarding document';end if;
 if jsonb_typeof(p_answers->'company') is distinct from 'object' or jsonb_typeof(p_answers->'operations') is distinct from 'object'
 or jsonb_typeof(p_answers->'measurement') is distinct from 'object' or jsonb_typeof(p_answers->'team') is distinct from 'array'
 or jsonb_typeof(p_answers->'systems') is distinct from 'array' or jsonb_typeof(p_answers->'people') is distinct from 'array'
 then raise exception 'Invalid onboarding sections';end if;
 if jsonb_array_length(p_answers->'team')>w.entitlement or jsonb_array_length(p_answers->'systems')>40 or jsonb_array_length(p_answers->'people')>30
 or (select count(distinct value) from jsonb_array_elements_text(p_answers->'team'))<>jsonb_array_length(p_answers->'team')
 or exists(select 1 from jsonb_array_elements_text(p_answers->'team') a where not exists(select 1 from private.agent_catalog c where c.id=a.value)) then raise exception 'Invalid team or workspace allowance';end if;
 if coalesce(p_answers#>>'{company,businessModel}','') not in ('b2b_services','home_services','commerce')
 or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_answers#>>'{company,timeZone}')
 or coalesce(length(p_answers#>>'{company,name}'),0)>4000 then raise exception 'Invalid company settings';end if;
 o:=p_answers->'operations';
 if not(o ?& array['approvalMode','automationAcknowledged','policyAcknowledged','workingDays','startHour','endHour','meetingMinutes','bufferMinutes','dailyCapacity','modelDailyBudgetMinor','actionDailyBudgetMinor','approvedContactIds'])
 or coalesce(o->>'approvalMode','') not in ('each_action','bounded_follow_up') or jsonb_typeof(o->'policyAcknowledged') is distinct from 'boolean'
 or jsonb_typeof(o->'automationAcknowledged') is distinct from 'boolean'
 or (o->>'approvalMode'='bounded_follow_up' and o->>'automationAcknowledged' is distinct from 'true')
 or exists(select 1 from unnest(array['startHour','endHour','meetingMinutes','bufferMinutes','dailyCapacity','actionDailyBudgetMinor']) k where jsonb_typeof(o->k) is distinct from 'number' or (o->>k) !~ '^[0-9]+$')
 or jsonb_typeof(o->'modelDailyBudgetMinor') not in ('number','null')
 or (jsonb_typeof(o->'modelDailyBudgetMinor')='number' and (o->>'modelDailyBudgetMinor') !~ '^[0-9]+$')
 or (o->>'startHour')::int not between 0 and 23 or (o->>'endHour')::int not between 1 and 24 or (o->>'endHour')::int<=(o->>'startHour')::int
 or (o->>'meetingMinutes')::int not between 5 and 240 or (o->>'bufferMinutes')::int not between 0 and 120
 or (o->>'dailyCapacity')::int not between 0 and 1000 or (o->>'actionDailyBudgetMinor')::bigint not between 0 and 1000000
 or (o->>'modelDailyBudgetMinor')::bigint not between 0 and 1000000
 or jsonb_typeof(o->'approvedContactIds') is distinct from 'array' or jsonb_array_length(o->'approvedContactIds')>500
 or jsonb_typeof(o->'workingDays') is distinct from 'array' or jsonb_array_length(o->'workingDays') not between 1 and 7
 or exists(select 1 from jsonb_array_elements_text(o->'workingDays') day where day.value::int not between 1 and 7)
 then raise exception 'Invalid operating settings or automation authorization';end if;
 if exists(select 1 from jsonb_array_elements_text(o->'approvedContactIds') c where not exists(select 1 from public.contacts actual where actual.workspace_id=p_workspace and actual.id=c.value::uuid)) then raise exception 'Contact belongs to another workspace';end if;
 if exists(select 1 from jsonb_array_elements(p_answers->'systems') s where coalesce(s->>'connectionId','')<>'' and not exists(select 1 from public.connections c where c.workspace_id=p_workspace and c.id=(s->>'connectionId')::uuid)) then raise exception 'Connection belongs to another workspace';end if;
 changed:=d.workspace_id is null or (d.answers-'measurement') is distinct from (p_answers-'measurement');rev:=coalesce(d.revision,0)+1;
 if changed then
  perform public.set_workspace_pause(p_workspace,true);
  if d.workspace_id is null or d.answers->'company' is distinct from p_answers->'company' then
   update public.product_records set payload=jsonb_set(payload,'{context,confirmed}','false'::jsonb),version=version+1 where workspace_id=p_workspace and kind='company_context';
  end if;
  update public.approvals set status='invalidated' where workspace_id=p_workspace and status in ('pending','approved') and action_id in(select id from public.actions where workspace_id=p_workspace and status='not_attempted');
  update public.mandates set revoked_at=now() where workspace_id=p_workspace and revoked_at is null;
  update public.live_activations set revoked_at=now() where workspace_id=p_workspace and revoked_at is null;
 end if;
 insert into public.onboarding_documents(workspace_id,revision,answers,updated_by) values(p_workspace,rev,p_answers,auth.uid())
 on conflict(workspace_id) do update set revision=excluded.revision,answers=excluded.answers,updated_at=now(),updated_by=auth.uid();
 insert into private.onboarding_revisions(workspace_id,revision,answers,actor,summary) values(p_workspace,rev,p_answers,auth.uid(),case when changed then 'Configuration changed; execution paused and authority invalidated.' else 'Measurement settings saved.' end);
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(p_workspace,auth.uid(),'onboarding_saved',jsonb_build_object('revision',rev,'authority_invalidated',changed));
end $$;

create function public.update_onboarding_task(p_workspace uuid,p_revision integer,p_id text,p_title text,p_owner text,p_status text,p_note text) returns void language plpgsql security definer set search_path='' as $$ begin
 perform private.require_setup_owner(p_workspace);
 perform 1 from public.workspaces where id=p_workspace for update;
 if not exists(select 1 from public.onboarding_documents where workspace_id=p_workspace and revision=p_revision) then raise exception 'Reload the current onboarding revision';end if;
 if p_status is null or p_status not in ('open','in_progress','resolved') or coalesce(length(p_id),0) not between 1 and 100 or coalesce(length(p_title),0) not between 1 and 500 or coalesce(length(p_owner),0) not between 1 and 300 or coalesce(length(p_note),0)>2000 then raise exception 'Invalid setup request';end if;
 if p_status='resolved' and private.member_role(p_workspace)<>'david_operator' then raise exception 'Assigned operator required to resolve requests' using errcode='42501';end if;
 if not exists(select 1 from public.onboarding_tasks where workspace_id=p_workspace and id=p_id) and (select count(*) from public.onboarding_tasks where workspace_id=p_workspace)>=100 then raise exception 'Setup task limit reached';end if;
 insert into public.onboarding_tasks(workspace_id,id,title,owner,status,note,revision,updated_by) values(p_workspace,p_id,p_title,p_owner,p_status,coalesce(p_note,''),p_revision,auth.uid())
 on conflict(workspace_id,id) do update set title=excluded.title,owner=excluded.owner,status=excluded.status,note=excluded.note,revision=excluded.revision,updated_by=auth.uid(),updated_at=now();
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(p_workspace,auth.uid(),'setup_request_updated',jsonb_build_object('request',p_id,'status',p_status,'revision',p_revision));
end $$;

create function public.configure_workspace_allowance(p_workspace uuid,p_allowance integer) returns void language plpgsql security definer set search_path='' as $$ begin
 if private.member_role(p_workspace) is distinct from 'david_operator' then raise exception 'Assigned MFA operator required' using errcode='42501';end if;
 perform 1 from public.workspaces where id=p_workspace for update;
 if p_allowance is null or p_allowance not between 0 and 32 or p_allowance<coalesce((select jsonb_array_length(answers->'team') from public.onboarding_documents where workspace_id=p_workspace),0) or p_allowance<(select count(*) from public.installations where workspace_id=p_workspace and status<>'paused') then raise exception 'Allowance cannot be lower than the selected team';end if;
 update public.workspaces set entitlement=p_allowance where id=p_workspace;
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(p_workspace,auth.uid(),'workspace_allowance_changed',jsonb_build_object('allowance',p_allowance));
end $$;

create function public.review_prepared_artifact(p_workspace uuid,p_artifact uuid,p_decision text) returns void language plpgsql security definer set search_path='' as $$ begin
 perform private.require_setup_owner(p_workspace);
 perform 1 from public.workspaces where id=p_workspace for update;
 if p_decision is null or p_decision not in ('reviewed','rejected') then raise exception 'Invalid review';end if;
 if p_decision='reviewed' and exists(select 1 from public.onboarding_documents where workspace_id=p_workspace) and not exists(
  select 1 from public.prepared_artifacts a where a.workspace_id=p_workspace and a.id=p_artifact and jsonb_array_length(a.source_snapshot)>0
   and a.factual_inputs ?& (select array_agg(value) from (
    select 'Company: '||(answers#>>'{company,name}') as value from public.onboarding_documents where workspace_id=p_workspace
    union all select 'Owner-approved brand guidance: '||(answers#>>'{company,brandGuidance}') from public.onboarding_documents where workspace_id=p_workspace
    union all select 'Owner-prohibited claims: '||(answers#>>'{company,forbiddenClaims}') from public.onboarding_documents where workspace_id=p_workspace
    union all select 'Approved offer: '||v.value from public.onboarding_documents d cross join lateral jsonb_array_elements_text(d.answers#>'{company,offers}') v where d.workspace_id=p_workspace
    union all select 'Confirmed customer type: '||v.value from public.onboarding_documents d cross join lateral jsonb_array_elements_text(d.answers#>'{company,customers}') v where d.workspace_id=p_workspace
   ) required_facts)
   and not exists(
   select 1 from jsonb_array_elements(a.source_snapshot) proof left join public.evidence e on e.id=(proof->>'id')::uuid and e.workspace_id=p_workspace
   where e.id is null or e.quality in ('fixture','unknown') or e.content_hash is distinct from
    (select payload->>'sourceHash' from public.product_records where workspace_id=p_workspace and kind='company_context' and payload#>>'{context,confirmed}'='true' order by created_at desc limit 1)
  )
 ) then raise exception 'Review requires evidence matching the current confirmed company capture';end if;
 update public.prepared_artifacts set review_state=p_decision where workspace_id=p_workspace and id=p_artifact;
 if not found then raise exception 'Artifact not found in workspace';end if;
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id,detail) values(p_workspace,auth.uid(),'artifact_reviewed',p_artifact,jsonb_build_object('decision',p_decision,'revision',coalesce((select revision from public.onboarding_documents where workspace_id=p_workspace),0)));
end $$;

create function public.create_workspace_invitation(p_workspace uuid,p_email text,p_role text,p_token_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; begin
 perform private.require_setup_owner(p_workspace);perform 1 from public.workspaces where id=p_workspace for update;
 if p_email is null or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_role is null or p_role not in ('workspace_owner','workspace_member','workspace_viewer') or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid invitation';end if;
 if (select count(*) from private.workspace_invitations where workspace_id=p_workspace and created_at>now()-interval '1 day')>=50 then raise exception 'Daily invitation limit reached';end if;
 insert into private.workspace_invitations(workspace_id,email,role,token_hash,created_by) values(p_workspace,lower(trim(p_email)),p_role,p_token_hash,auth.uid()) returning id into result;
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id,detail) values(p_workspace,auth.uid(),'workspace_invitation_created',result,jsonb_build_object('role',p_role));return result;
end $$;
create function public.revoke_workspace_invitation(p_workspace uuid,p_invitation uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 perform private.require_setup_owner(p_workspace);
 update private.workspace_invitations set status='revoked' where id=p_invitation and workspace_id=p_workspace and status='pending';
 if not found then raise exception 'Pending invitation not found';end if;
end $$;
create function public.accept_workspace_invitation(p_token_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare inv private.workspace_invitations; actor_email text; begin
 select lower(email) into actor_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if actor_email is null then raise exception 'Sign in with the confirmed invited email' using errcode='42501';end if;
 select * into inv from private.workspace_invitations where token_hash=p_token_hash for update;
 if inv.id is null or inv.status<>'pending' or inv.expires_at<=now() or inv.email<>actor_email then raise exception 'Invitation is expired, unavailable or for another account' using errcode='42501';end if;
 if not exists(select 1 from public.memberships where workspace_id=inv.workspace_id and actor_id=inv.created_by and active and role in ('workspace_owner','david_operator')) then raise exception 'Invitation grantor no longer has authority';end if;
 -- Invitations never silently escalate or reactivate an existing membership.
 if exists(select 1 from public.memberships where workspace_id=inv.workspace_id and actor_id=auth.uid()) then raise exception 'Membership already exists; ask the owner to review it';end if;
 insert into public.memberships(workspace_id,actor_id,role) values(inv.workspace_id,auth.uid(),inv.role);
 update private.workspace_invitations set status='accepted',accepted_by=auth.uid() where id=inv.id;
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id,detail) values(inv.workspace_id,auth.uid(),'workspace_invitation_accepted',inv.id,'{}');return inv.workspace_id;
end $$;

create function public.create_onboarding_workspace(p_name text,p_business_model text,p_time_zone text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; begin
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Confirmed account required' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,781));
 if (select count(*) from public.memberships where actor_id=auth.uid() and role='workspace_owner')>=3 then raise exception 'Contact DAVID to provision additional workspaces';end if;
 if coalesce(length(trim(p_name)),0) not between 1 and 200 or p_business_model is null or p_business_model not in ('b2b_services','home_services','commerce') or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_time_zone) then raise exception 'Invalid company details';end if;
 insert into public.workspaces(name,environment,business_model,time_zone,paused,currency,subscription_minor) values(trim(p_name),'shadow',p_business_model,p_time_zone,true,'USD',0) returning id into result;
 insert into public.memberships(workspace_id,actor_id,role) values(result,auth.uid(),'workspace_owner');
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(result,auth.uid(),'workspace_created','{"source":"onboarding","outbound_enabled":false}');return result;
end $$;

-- Workspace owners can assign an already authorized DAVID operator without per-client SQL.
-- The first trusted operator is provisioned once by deployment administration.
create function public.assign_onboarding_operator(p_workspace uuid,p_email text) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid; begin
 perform private.require_setup_owner(p_workspace);
 perform 1 from public.workspaces where id=p_workspace for update;
 select u.id into actor from auth.users u where lower(u.email)=lower(trim(p_email)) and u.email_confirmed_at is not null
 and exists(select 1 from public.memberships m where m.actor_id=u.id and m.role='david_operator' and m.active);
 if actor is null then raise exception 'A registered DAVID operator is required; contact deployment administration' using errcode='42501';end if;
 if exists(select 1 from public.memberships where workspace_id=p_workspace and actor_id=actor and (role<>'david_operator' or not active)) then
  raise exception 'Existing membership needs an administrative access review';
 end if;
 insert into public.memberships(workspace_id,actor_id,role) values(p_workspace,actor,'david_operator') on conflict(workspace_id,actor_id) do nothing;
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id,detail) values(p_workspace,auth.uid(),'onboarding_operator_assigned',actor,'{}');
end $$;
revoke all on function public.assign_onboarding_operator(uuid,text) from public,anon;
grant execute on function public.assign_onboarding_operator(uuid,text) to authenticated;

-- A confirmed capture is bound to the current shared answers under the same workspace lock.
alter function public.save_company_context(uuid,uuid,jsonb) rename to save_company_context_v1;
revoke all on function public.save_company_context_v1(uuid,uuid,jsonb) from public,anon,authenticated;
create function public.save_company_context(p_workspace uuid,p_id uuid,p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare d public.onboarding_documents; begin
 perform private.require_setup_owner(p_workspace);
 perform 1 from public.workspaces where id=p_workspace for update;
 select * into d from public.onboarding_documents where workspace_id=p_workspace;
 if p_payload#>>'{context,confirmed}'='true' and d.workspace_id is not null then
  if p_payload->>'onboardingRevision' is distinct from d.revision::text
   or p_payload#>>'{context,companyName}' is distinct from d.answers#>>'{company,name}'
   or p_payload#>>'{context,pages,0,url}' is distinct from d.answers#>>'{company,website}'
   or p_payload#>'{context,offers}' is distinct from d.answers#>'{company,offers}'
   or p_payload#>'{context,customerTypes}' is distinct from d.answers#>'{company,customers}'
   or p_payload#>>'{context,operatingGuidance,brand}' is distinct from d.answers#>>'{company,brandGuidance}'
   or p_payload#>>'{context,operatingGuidance,forbiddenClaims}' is distinct from d.answers#>>'{company,forbiddenClaims}'
  then raise exception 'Onboarding changed; reload and confirm the current facts' using errcode='40001';end if;
 end if;
 return public.save_company_context_v1(p_workspace,p_id,p_payload);
end $$;
revoke all on function public.save_company_context(uuid,uuid,jsonb) from public,anon;
grant execute on function public.save_company_context(uuid,uuid,jsonb) to authenticated;

-- Allowance is a server-controlled workspace entitlement, not a customer-editable form value.
create or replace function public.select_team(p_workspace uuid,p_agents text[]) returns void language plpgsql security definer set search_path='' as $$
declare w public.workspaces;begin
 perform private.require_setup_owner(p_workspace);select * into w from public.workspaces where id=p_workspace for update;
 if p_agents is null or cardinality(p_agents)>w.entitlement or cardinality(p_agents)<>(select count(distinct a) from unnest(p_agents) a) then raise exception 'Distinct agents within workspace allowance required';end if;
 if exists(select 1 from unnest(p_agents) a left join private.agent_catalog c on c.id=a where c.id is null or not w.business_model=any(c.archetypes)) then raise exception 'Unknown or inapplicable specialist';end if;
 if exists(select 1 from public.runs r join public.installations i on i.id=r.installation_id where r.workspace_id=w.id and not i.agent_id=any(p_agents) and r.status not in ('completed','cancelled','failed')) then raise exception 'Complete a controlled handoff before removing a specialist with unfinished work';end if;
 update public.installations set status='paused' where workspace_id=w.id and not agent_id=any(p_agents);
 insert into public.installations(workspace_id,agent_id,definition_version,mode,status,daily_capacity)
 select w.id,c.id,'1.0.0',c.mode,'selected',0 from private.agent_catalog c where c.id=any(p_agents)
 on conflict(workspace_id,agent_id) do update set status='selected';
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(w.id,auth.uid(),'team_selected',jsonb_build_object('agent_ids',p_agents));
end $$;

create function public.apply_onboarding_settings(p_workspace uuid,p_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare d public.onboarding_documents;w public.workspaces;o jsonb;pol uuid;policy_version integer;actor_membership uuid;sender_connection uuid;operator_membership uuid;cohort text;agents text[];g private.model_global_limit;proposal public.proposals; contact public.contacts; begin
 perform private.require_setup_owner(p_workspace);select * into w from public.workspaces where id=p_workspace for update;
 select * into d from public.onboarding_documents where workspace_id=p_workspace for update;
 if d.workspace_id is null or d.revision is distinct from p_revision then raise exception 'Reload current onboarding revision';end if;
 o:=d.answers->'operations';
 if o->>'policyAcknowledged' is distinct from 'true' or coalesce(o->>'escalationOwner','')='' then raise exception 'Review operating settings and assign an escalation owner';end if;
 if exists(select 1 from public.actions where workspace_id=p_workspace and status in ('submitting','uncertain')) then raise exception 'Reconcile in-flight actions before applying changed settings';end if;
 select id into actor_membership from public.memberships where workspace_id=p_workspace and actor_id=auth.uid() and active;
 update public.workspaces set paused=true,name=coalesce(nullif(d.answers#>>'{company,name}',''),name),business_model=d.answers#>>'{company,businessModel}',time_zone=d.answers#>>'{company,timeZone}',daily_limit=(o->>'dailyCapacity')::int,daily_budget_minor=(o->>'actionDailyBudgetMinor')::bigint where id=p_workspace;
 select coalesce(array_agg(a.value),'{}') into agents from jsonb_array_elements_text(d.answers->'team') a join private.agent_catalog c on c.id=a.value where d.answers#>>'{company,businessModel}'=any(c.archetypes) and c.implemented;
 perform public.select_team(p_workspace,agents);
 select coalesce(max(version),0)+1 into policy_version from public.policies where workspace_id=p_workspace;
 insert into public.policies(workspace_id,version,approved_by,bounds) values(p_workspace,policy_version,actor_membership,jsonb_build_object('minContactIntervalMinutes',1440,'replyFreshnessSeconds',120,'calendarId',o->>'calendarId','timeZone',d.answers#>>'{company,timeZone}','meetingMinutes',(o->>'meetingMinutes')::int,'workingDays',o->'workingDays','workingStartHour',(o->>'startHour')::int,'workingEndHour',(o->>'endHour')::int,'calendarCapacity',(o->>'dailyCapacity')::int,'bufferMinutes',(o->>'bufferMinutes')::int,'reservedCostMinor',1,'onboardingRevision',d.revision,'contactRestrictions',o->>'contactRestrictions')) returning id into pol;
 update public.installations i set policy_id=pol,daily_capacity=case when c.implemented then (o->>'dailyCapacity')::int else 0 end,mode=c.mode
 from private.agent_catalog c where i.workspace_id=p_workspace and i.agent_id=c.id and i.agent_id=any(agents);
 select * into g from private.model_global_limit where singleton;
 perform public.set_workspace_model_limits(p_workspace,coalesce((o->>'modelDailyBudgetMinor')::bigint,0),least(coalesce(g.daily_output_token_ceiling,0),100000),coalesce(g.pricing_basis,'Unconfigured provider pricing')||'; onboarding revision '||d.revision);
 update public.approvals set status='invalidated' where workspace_id=p_workspace and status in ('pending','approved') and action_id in(select id from public.actions where workspace_id=p_workspace and status='not_attempted');
 update public.live_activations set revoked_at=now() where workspace_id=p_workspace and revoked_at is null;
 update public.mandates set revoked_at=now() where workspace_id=p_workspace and revoked_at is null;
 cohort:='onboarding-'||p_workspace::text||'-'||d.revision;
 update public.contacts set enrolled=false where workspace_id=p_workspace;
 update public.contacts set enrolled=true,cohort_id=cohort where workspace_id=p_workspace and not suppressed and not human_takeover and (o->'approvedContactIds') ? id::text;
 select c.id into sender_connection from public.connections c where c.workspace_id=p_workspace and c.identity=o->>'sender' and c.health='healthy' and 'gmail.send'=any(c.operations) order by c.verified_at desc limit 1;
 select m.id into operator_membership from public.memberships m join auth.users u on u.id=m.actor_id where m.workspace_id=p_workspace and m.active and m.role='david_operator' and lower(u.email)=lower(o->>'escalationOwner');
 -- Applying reviewed settings configures authority, but never changes the deployment live flag or resumes work.
 if sender_connection is not null and operator_membership is not null and exists(select 1 from public.contacts where workspace_id=p_workspace and enrolled and cohort_id=cohort) then
  insert into public.live_activations(workspace_id,sender_connection_id,sender,cohort_id,operator_membership_id,policy_id,approved_by,expires_at,staffed_hours)
  values(p_workspace,sender_connection,o->>'sender',cohort,operator_membership,pol,actor_membership,now()+interval '7 days',jsonb_build_object('days',o->'workingDays','startHour',(o->>'startHour')::int,'endHour',(o->>'endHour')::int));
 end if;
 if o->>'approvalMode'='bounded_follow_up' then
  if private.member_role(p_workspace)<>'workspace_owner' or o->>'automationAcknowledged' is distinct from 'true' or sender_connection is null or operator_membership is null or (o->>'dailyCapacity')::int<=0 then raise exception 'Automatic follow-up requires owner authorization, verified sender, assigned operator and positive capacity';end if;
  update public.installations set mode='bounded_autonomous_execution' where workspace_id=p_workspace and agent_id='deal-follow-up' and agent_id=any(agents);
  for proposal in select p.* from public.proposals p join public.contacts c on c.id=p.contact_id and c.workspace_id=p.workspace_id where p.workspace_id=p_workspace and c.enrolled and c.cohort_id=cohort and p.status='open' and not p.fixture loop
   select * into contact from public.contacts where id=proposal.contact_id and workspace_id=p_workspace;
   insert into public.mandates(workspace_id,version,grantor_id,action_type,bounds,starts_at,expires_at) values(p_workspace,policy_version,actor_membership,'send_follow_up',jsonb_build_object('templateVersion','factual-followup.v1','subjectTemplate','Following up on {reference}','bodyTemplate',E'I’m following up on proposal {reference}.\n\n{scopeSummary}\n\nWhat questions can we help answer?','channel','gmail','policyId',pol,'policyVersion',policy_version,'senderConnectionId',sender_connection,'cohortId',cohort,'contactIds',jsonb_build_array(contact.id),'recipientDomains',jsonb_build_array(lower(split_part(contact.email,'@',2))),'approvedScope',proposal.scope_summary,'maxActions',(o->>'dailyCapacity')::int,'maxCostMinor',(o->>'actionDailyBudgetMinor')::bigint),now(),now()+interval '7 days');
  end loop;
 end if;
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id,detail) values(p_workspace,auth.uid(),'onboarding_settings_applied',pol,jsonb_build_object('revision',d.revision,'paused',true,'approval_mode',o->>'approvalMode'));
end $$;

revoke all on function private.require_setup_owner(uuid) from public,anon,authenticated;
revoke all on function public.read_onboarding(uuid),public.save_onboarding(uuid,integer,jsonb),public.update_onboarding_task(uuid,integer,text,text,text,text,text),public.configure_workspace_allowance(uuid,integer),public.review_prepared_artifact(uuid,uuid,text),public.create_workspace_invitation(uuid,text,text,text),public.revoke_workspace_invitation(uuid,uuid),public.accept_workspace_invitation(text),public.create_onboarding_workspace(text,text,text),public.apply_onboarding_settings(uuid,integer) from public,anon;
grant execute on function public.read_onboarding(uuid),public.save_onboarding(uuid,integer,jsonb),public.update_onboarding_task(uuid,integer,text,text,text,text,text),public.configure_workspace_allowance(uuid,integer),public.review_prepared_artifact(uuid,uuid,text),public.create_workspace_invitation(uuid,text,text,text),public.revoke_workspace_invitation(uuid,uuid),public.accept_workspace_invitation(text),public.create_onboarding_workspace(text,text,text),public.apply_onboarding_settings(uuid,integer) to authenticated;
create or replace function private.privacy_tables() returns table(table_name text,exportable boolean,delete_order integer) language sql immutable set search_path='' as $$
 values
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
