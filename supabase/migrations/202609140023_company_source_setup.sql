-- Shared source setup can run before a customer selects specialist seats.
-- Read-only setup runs retain workspace/connection scope and cannot create actions.
begin;

alter table public.runs alter column installation_id drop not null;
alter table public.runs add constraint source_setup_run_boundary check (
 installation_id is not null or (
  definition_version in ('connection-check-v1','onboarding-discovery-v1')
  and connection_id is not null
  and status in ('scheduled','processing','completed','blocked','failed','paused','cancelled')
 )
);

create function private.guard_source_setup_run() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if (old.installation_id is null or new.installation_id is null) and (new.installation_id is distinct from old.installation_id or new.definition_version is distinct from old.definition_version
  or new.connection_id is distinct from old.connection_id or new.workspace_id is distinct from old.workspace_id) then
  raise exception 'A source setup run cannot become a business run or change scope' using errcode='42501';
 end if;
 return new;
end $$;
create trigger source_setup_run_scope before update on public.runs for each row execute function private.guard_source_setup_run();
revoke all on function private.guard_source_setup_run() from public,anon,authenticated,david_worker,david_dispatcher,david_oauth;

create function private.guard_source_setup_input() returns trigger
language plpgsql security definer set search_path='' as $$
declare r public.runs; begin
 select * into r from public.runs where id=new.run_id and workspace_id=new.workspace_id;
 if r.installation_id is null then
  if r.id is null or new.payload->>'read_only' is distinct from 'true'
   or not coalesce(((r.definition_version='connection-check-v1' and new.kind='verify_connection' and new.payload->>'connectionId'=r.connection_id::text)
        or (r.definition_version='onboarding-discovery-v1' and new.kind='onboarding_discovery')),false)
  then raise exception 'Read-only source setup input required' using errcode='42501';end if;
 end if;
 return new;
end $$;
create trigger source_setup_input_boundary before insert or update on private.run_inputs
for each row execute function private.guard_source_setup_input();
revoke all on function private.guard_source_setup_input() from public,anon,authenticated,david_worker,david_dispatcher,david_oauth;

create or replace function public.queue_connection_check(p_workspace uuid,p_connection uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare r uuid; mode text; begin
 perform private.require_setup_owner(p_workspace);
 perform 1 from public.workspaces where id=p_workspace for update;
 if not exists(select 1 from public.connections where id=p_connection and workspace_id=p_workspace and provider='google' and health in ('healthy','unconfigured')) then
  raise exception 'Authorized Google connection required' using errcode='42501';
 end if;
 if (select count(*) from public.source_bindings where workspace_id=p_workspace and connection_id=p_connection) not between 1 and 10 then raise exception 'Bind one to ten approved resources before verification';end if;
 perform public.consume_request_quota(p_workspace,'commands');
 select id into r from public.runs where workspace_id=p_workspace and connection_id=p_connection
  and definition_version='connection-check-v1' and status in ('scheduled','processing') order by created_at desc limit 1;
 if r is not null then return r;end if;
 if (select count(*) from public.runs where workspace_id=p_workspace and definition_version='connection-check-v1' and created_at>now()-interval '1 day')>=100 then raise exception 'Daily source verification limit reached';end if;
 select environment into mode from public.workspaces where id=p_workspace;r:=gen_random_uuid();
 insert into public.runs(id,workspace_id,installation_id,connection_id,definition_version,sdk_version,deployment_id,environment,status,next_due_at)
 values(r,p_workspace,null,p_connection,'connection-check-v1','4.8.8','pending-dispatch',mode,'scheduled',now());
 insert into private.run_inputs values(p_workspace,r,'verify_connection',jsonb_build_object('connectionId',p_connection,'read_only',true));
 insert into private.outbox(workspace_id,run_id,event_type,dedupe_key) values(p_workspace,r,'connection_check','connection-check:'||r);
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id,detail) values(p_workspace,auth.uid(),'company_source_check_requested',r,jsonb_build_object('connectionId',p_connection,'read_only',true,'agent_selection_required',false));
 return r;
end $$;

create or replace function public.begin_onboarding_discovery(p_workspace uuid,p_connection uuid,p_request jsonb default '{}'::jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; mode text; begin
 perform private.require_setup_owner(p_workspace);
 if p_request is null or jsonb_typeof(p_request)<>'object' or octet_length(p_request::text)>4096 or exists(select 1 from jsonb_object_keys(p_request) k where k not in ('operation','fileId','tab')) then raise exception 'Invalid discovery request';end if;
 perform public.consume_request_quota(p_workspace,'commands');
 perform 1 from public.workspaces where id=p_workspace for update;
 update public.runs set status='blocked' where workspace_id=p_workspace and definition_version='onboarding-discovery-v1' and status='processing' and created_at<now()-interval '2 minutes';
 if not exists(select 1 from public.connections where workspace_id=p_workspace and id=p_connection and provider='google' and health in ('healthy','unconfigured') and 'sheets.read'=any(operations)) then raise exception 'Authorized spreadsheet access required' using errcode='42501';end if;
 select environment into mode from public.workspaces where id=p_workspace;
 if (select count(*) from public.runs where workspace_id=p_workspace and definition_version='onboarding-discovery-v1' and created_at>now()-interval '1 day')>=100 then raise exception 'Daily discovery limit reached';end if;
 result:=gen_random_uuid();
 insert into public.runs(id,workspace_id,installation_id,connection_id,definition_version,sdk_version,deployment_id,environment,status)
 values(result,p_workspace,null,p_connection,'onboarding-discovery-v1','4.8.8','request-bound',mode,'processing');
 insert into private.run_inputs(workspace_id,run_id,kind,payload) values(p_workspace,result,'onboarding_discovery',p_request||'{"read_only":true}'::jsonb);
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id,detail) values(p_workspace,auth.uid(),'onboarding_discovery_started',result,p_request||'{"read_only":true}'::jsonb);
 return result;
end $$;

create or replace function public.set_workspace_pause(p_workspace_id uuid,p_paused boolean) returns void language plpgsql security definer set search_path='' as $$
declare w public.workspaces; readiness jsonb; begin
 if coalesce(private.member_role(p_workspace_id),'') not in ('workspace_owner','david_operator') or p_paused is null then raise exception 'Owner role required' using errcode='42501'; end if;
 select * into w from public.workspaces where id=p_workspace_id for update;
 if p_paused then
  update public.workspaces set paused=true where id=w.id;
  update public.approvals set status='invalidated' where workspace_id=w.id and status in ('pending','approved') and action_id in(select id from public.actions where workspace_id=w.id and status='not_attempted');
  update public.runs set status='paused' where workspace_id=w.id and installation_id is not null and (status in ('scheduled','awaiting_approval','waiting_for_reply') or status='processing' and not exists(select 1 from public.actions a where a.workspace_id=w.id and a.run_id=public.runs.id and a.status in ('submitting','uncertain')));
 else
  if w.environment='fixture' then raise exception 'Fixture workspaces are local-only'; end if;
  readiness:=private.workspace_readiness(w.id,true);
  if w.environment='live' and not coalesce((readiness->>'action')::boolean,false) then raise exception 'LIVE_RESUME_BLOCKED: Resolve the current authoritative readiness blockers'; end if;
  if w.environment='shadow' and exists(select 1 from jsonb_array_elements(readiness->'blockers') b where b->>'code' in ('team_capacity','company_context')) then raise exception 'SHADOW_RESUME_BLOCKED: Confirm company sources and provision selected implemented capacity'; end if;
  -- Resume is a new authorization boundary: never restart an old approved message.
  update public.approvals set status='invalidated' where workspace_id=w.id and status in ('pending','approved') and action_id in(select a.id from public.actions a join public.runs r on r.workspace_id=a.workspace_id and r.id=a.run_id where a.workspace_id=w.id and a.status='not_attempted' and r.status='paused');
  update public.runs set status='cancelled',next_due_at=null where workspace_id=w.id and installation_id is not null and status='paused';
  update public.workspaces set paused=false where id=w.id;
  update public.installations i set status='monitoring',preparation_next_due_at=case when i.mode='preparation' then now() else i.preparation_next_due_at end where i.workspace_id=w.id and i.status='selected' and i.daily_capacity>0 and exists(select 1 from private.agent_catalog c where c.id=i.agent_id and c.implemented);
 end if;
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(w.id,auth.uid(),case when p_paused then 'workspace_paused' else 'workspace_resumed_after_readiness' end,jsonb_build_object('prior_paused_runs_restarted',false,'environment',w.environment));
end $$;

alter function private.create_action(uuid,uuid,uuid,text,jsonb,text,uuid,bigint,timestamptz) rename to create_action_before_source_setup;
revoke all on function private.create_action_before_source_setup(uuid,uuid,uuid,text,jsonb,text,uuid,bigint,timestamptz) from public,anon,authenticated,david_worker,david_dispatcher,david_oauth;
create function private.create_action(p_id uuid,p_contact uuid,p_proposal uuid,p_type text,p_payload jsonb,p_hash text,p_policy uuid,p_cost bigint,p_expires timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from public.runs where id=private.current_run() and workspace_id=private.current_workspace()
  and installation_id is not null and definition_version not in ('connection-check-v1','onboarding-discovery-v1')) then
  raise exception 'Source setup cannot authorize or create business actions' using errcode='42501';
 end if;
 return private.create_action_before_source_setup(p_id,p_contact,p_proposal,p_type,p_payload,p_hash,p_policy,p_cost,p_expires);
end $$;
revoke all on function private.create_action(uuid,uuid,uuid,text,jsonb,text,uuid,bigint,timestamptz) from public,anon,authenticated,david_worker,david_dispatcher,david_oauth;
grant execute on function private.create_action(uuid,uuid,uuid,text,jsonb,text,uuid,bigint,timestamptz) to david_worker;

create or replace function private.connection_token(p_connection uuid,p_operation text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare token jsonb; r public.runs; begin
 select * into r from public.runs where id=private.current_run() and workspace_id=private.current_workspace();
 if r.id is null or r.connection_id is distinct from p_connection then raise exception 'Connection/operation denied' using errcode='42501';end if;
 if r.definition_version in ('connection-check-v1','onboarding-discovery-v1') then
  if r.status<>'processing' or not exists(select 1 from private.run_inputs input where input.workspace_id=r.workspace_id and input.run_id=r.id
    and ((r.definition_version='connection-check-v1' and input.kind='verify_connection' and p_operation in ('sheets.read','gmail.read','calendar.freebusy'))
      or (r.definition_version='onboarding-discovery-v1' and input.kind='onboarding_discovery' and p_operation='sheets.read')))
  then raise exception 'Source setup permits checked reads only' using errcode='42501';end if;
 end if;
 if not exists(select 1 from public.connections c where c.workspace_id=r.workspace_id and c.id=p_connection and c.health not in ('revoked','expired')
  and (r.definition_version not in ('connection-check-v1','onboarding-discovery-v1') or c.health in ('healthy','unconfigured')) and p_operation=any(c.operations)) then
  raise exception 'Connection/operation denied' using errcode='42501';
 end if;
 select v.decrypted_secret::jsonb || jsonb_build_object('expiresAt',s.expires_at) into token
 from private.connection_secrets s join vault.decrypted_secrets v on v.id=s.vault_id
 where s.workspace_id=r.workspace_id and s.connection_id=p_connection;
 if token is null then raise exception 'Connection requires reauthorization';end if;
 return token;
end $$;

-- Material configuration versions preserve reusable source/output proof when the lineup changes.
-- Ordinary revision remains the CAS/history and action-authorization revision.
create function private.onboarding_configuration_hash(p_answers jsonb) returns text
language sql immutable set search_path='' as $$
 select encode(extensions.digest((jsonb_build_object(
  'company',p_answers->'company','systems',p_answers->'systems','operations',p_answers->'operations','people',p_answers->'people',
  'briefing',jsonb_build_object('goal',coalesce(p_answers#>>'{briefing,goal}',''),'otherGoal',coalesce(p_answers#>>'{briefing,otherGoal}',''),
   'proposalSource',coalesce(p_answers#>>'{briefing,proposalSource}',''),'conversionAction',coalesce(p_answers#>>'{briefing,conversionAction}',''),
   'researchId',coalesce(p_answers#>>'{briefing,researchId}',''),'noWebsite',coalesce(p_answers#>'{briefing,noWebsite}','false'::jsonb))
 ))::text,'sha256'),'hex')
$$;
alter table public.onboarding_documents add column configuration_revision integer,
 add column configuration_updated_at timestamptz, add column configuration_hash text;
alter table private.onboarding_revisions add column configuration_revision integer;
with changes as (
 select workspace_id,revision,case when lag(private.onboarding_configuration_hash(answers)) over(partition by workspace_id order by revision)
  is distinct from private.onboarding_configuration_hash(answers) then revision else null end as changed_at
 from private.onboarding_revisions
), stamps as (
 select workspace_id,revision,max(changed_at) over(partition by workspace_id order by revision rows unbounded preceding) as configuration_revision from changes
)
update private.onboarding_revisions history set configuration_revision=stamps.configuration_revision from stamps
where history.workspace_id=stamps.workspace_id and history.revision=stamps.revision;
update public.onboarding_documents d set configuration_hash=private.onboarding_configuration_hash(d.answers),
 configuration_revision=coalesce((select h.configuration_revision from private.onboarding_revisions h where h.workspace_id=d.workspace_id and h.revision=d.revision),d.revision),
 configuration_updated_at=coalesce((select stamp.at from private.onboarding_revisions h join private.onboarding_revisions stamp on stamp.workspace_id=h.workspace_id and stamp.revision=h.configuration_revision where h.workspace_id=d.workspace_id and h.revision=d.revision),d.updated_at);
alter table public.onboarding_documents alter column configuration_revision set not null,
 alter column configuration_updated_at set not null, alter column configuration_hash set not null,
 add constraint configuration_revision_boundary check(configuration_revision>=0 and configuration_revision<=revision),
 add constraint configuration_hash_shape check(configuration_hash ~ '^[a-f0-9]{64}$');
alter table private.onboarding_revisions alter column configuration_revision set not null;

create function private.stamp_onboarding_configuration() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 new.configuration_hash:=private.onboarding_configuration_hash(new.answers);
 if tg_op='INSERT' then
  new.configuration_revision:=new.revision;new.configuration_updated_at:=new.updated_at;
 elsif new.configuration_hash is distinct from old.configuration_hash then
  new.configuration_revision:=new.revision;new.configuration_updated_at:=new.updated_at;
 else
  new.configuration_revision:=old.configuration_revision;new.configuration_updated_at:=old.configuration_updated_at;
 end if;
 return new;
end $$;
create trigger onboarding_configuration_stamp before insert or update on public.onboarding_documents
for each row execute function private.stamp_onboarding_configuration();
create function private.stamp_onboarding_history() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 select configuration_revision into new.configuration_revision from public.onboarding_documents
 where workspace_id=new.workspace_id and revision=new.revision and configuration_hash=private.onboarding_configuration_hash(new.answers);
 if new.configuration_revision is null then raise exception 'Onboarding history does not match the saved configuration';end if;
 return new;
end $$;
create trigger onboarding_history_configuration_stamp before insert on private.onboarding_revisions
for each row execute function private.stamp_onboarding_history();
revoke all on function private.onboarding_configuration_hash(jsonb),private.stamp_onboarding_configuration(),private.stamp_onboarding_history()
from public,anon,authenticated,david_worker,david_dispatcher,david_oauth;

-- Normalize navigation-only briefing defaults before authority and company-proof invalidation.
create or replace function public.save_onboarding(p_workspace uuid,p_expected_revision integer,p_answers jsonb) returns void language plpgsql security definer set search_path='' as $$
declare d public.onboarding_documents; w public.workspaces; o jsonb; changed boolean; rev integer; begin
 perform private.require_setup_owner(p_workspace);
 select * into w from public.workspaces where id=p_workspace for update;
 select * into d from public.onboarding_documents where workspace_id=p_workspace for update;
 if p_expected_revision is distinct from coalesce(d.revision,0) then raise exception 'Setup revision conflict; reload before saving' using errcode='40001';end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>150000
 or not(p_answers ?& array['company','team','systems','operations','people','measurement'])
 or exists(select 1 from jsonb_object_keys(p_answers) k where k not in ('company','team','systems','operations','people','measurement','briefing')) then raise exception 'Invalid onboarding document';end if;
 if p_answers ? 'briefing' then
  if jsonb_typeof(p_answers->'briefing') is distinct from 'object' or octet_length((p_answers->'briefing')::text)>40000
   or p_answers#>>'{briefing,version}' is distinct from '1'
   or coalesce(p_answers#>>'{briefing,step}','') not in ('welcome','website','description','name','goal','other-goal','research','company-name','offer','customers','summary','proposal-source','conversion-action','recommendation','access','budget','review','finish')
   or coalesce(p_answers#>>'{briefing,goal}','') not in ('','demand','conversion','recover','other')
   or jsonb_typeof(p_answers#>'{briefing,noWebsite}') is distinct from 'boolean'
   or jsonb_typeof(p_answers#>'{briefing,finished}') is distinct from 'boolean'
   or exists(select 1 from jsonb_object_keys(p_answers->'briefing') k where k not in ('version','step','name','goal','otherGoal','description','websiteInput','proposalSource','conversionAction','researchId','noWebsite','reviewedFacts','task','finished'))
   or exists(select 1 from unnest(array['name','otherGoal','description','websiteInput','proposalSource','conversionAction','researchId','reviewedFacts','task']) k where jsonb_typeof(p_answers->'briefing'->k) is distinct from 'string')
   then raise exception 'Invalid briefing'; end if;
 end if;
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
 changed:=d.workspace_id is null or private.onboarding_configuration_hash(d.answers) is distinct from private.onboarding_configuration_hash(p_answers) or d.answers->'team' is distinct from p_answers->'team';rev:=coalesce(d.revision,0)+1;
 if changed then
  perform public.set_workspace_pause(p_workspace,true);
  if d.workspace_id is null or ((d.answers->'company')-array['priorities','successDefinition','businessModel','timeZone']) is distinct from ((p_answers->'company')-array['priorities','successDefinition','businessModel','timeZone']) or (p_answers ? 'briefing' and d.answers#>'{company,priorities}' is distinct from p_answers#>'{company,priorities}') or coalesce(d.answers#>>'{briefing,goal}','') is distinct from coalesce(p_answers#>>'{briefing,goal}','') or coalesce(d.answers#>>'{briefing,conversionAction}','') is distinct from coalesce(p_answers#>>'{briefing,conversionAction}','') or coalesce(d.answers#>>'{briefing,researchId}','') is distinct from coalesce(p_answers#>>'{briefing,researchId}','') then
   update public.product_records set payload=jsonb_set(payload,'{context,confirmed}','false'::jsonb),version=version+1 where workspace_id=p_workspace and kind='company_context';
  end if;
  update public.approvals set status='invalidated' where workspace_id=p_workspace and status in ('pending','approved') and action_id in(select id from public.actions where workspace_id=p_workspace and status='not_attempted');
  update public.mandates set revoked_at=now() where workspace_id=p_workspace and revoked_at is null;
  update public.live_activations set revoked_at=now() where workspace_id=p_workspace and revoked_at is null;
 end if;
 insert into public.onboarding_documents(workspace_id,revision,answers,updated_by) values(p_workspace,rev,p_answers,auth.uid())
 on conflict(workspace_id) do update set revision=excluded.revision,answers=excluded.answers,updated_at=now(),updated_by=auth.uid();
 insert into private.onboarding_revisions(workspace_id,revision,answers,actor,summary) values(p_workspace,rev,p_answers,auth.uid(),case when changed then 'Configuration changed; execution paused and authority invalidated.' else 'Onboarding answers saved.' end);
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(p_workspace,auth.uid(),'onboarding_saved',jsonb_build_object('revision',rev,'authority_invalidated',changed));
end $$;

-- Versioned reader: deploy this migration before clients use the optional fields.
-- The old strict-schema read_onboarding response remains byte-for-byte compatible in shape.
create function public.read_onboarding_v2(p_workspace uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; d public.onboarding_documents; reviews jsonb; begin
 result:=public.read_onboarding(p_workspace);
 if result is null then return null;end if;
 select * into d from public.onboarding_documents where workspace_id=p_workspace;
 select coalesce(jsonb_agg(review.value || case when history.configuration_revision is null then '{}'::jsonb
  else jsonb_build_object('configurationRevision',history.configuration_revision) end order by review.ordinality),'[]'::jsonb) into reviews
 from jsonb_array_elements(result->'reviews') with ordinality as review(value,ordinality)
 left join private.onboarding_revisions history on history.workspace_id=p_workspace and history.revision=(review.value->>'revision')::integer;
 return result || jsonb_build_object('configurationRevision',d.configuration_revision,'configurationUpdatedAt',d.configuration_updated_at,'reviews',reviews);
end $$;
revoke all on function public.read_onboarding_v2(uuid) from public,anon;
grant execute on function public.read_onboarding_v2(uuid) to authenticated;
commit;
