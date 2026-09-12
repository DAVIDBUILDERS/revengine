-- Additive briefing metadata; existing documents and execution guards are preserved.
begin;
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
 changed:=d.workspace_id is null or (d.answers-array['measurement','briefing']) is distinct from (p_answers-array['measurement','briefing']) or ((d.answers->'briefing')-array['version','step','name','description','websiteInput','reviewedFacts','finished']) is distinct from ((p_answers->'briefing')-array['version','step','name','description','websiteInput','reviewedFacts','finished']);rev:=coalesce(d.revision,0)+1;
 if changed then
  perform public.set_workspace_pause(p_workspace,true);
  if d.workspace_id is null or ((d.answers->'company')-array['priorities','successDefinition','businessModel','timeZone']) is distinct from ((p_answers->'company')-array['priorities','successDefinition','businessModel','timeZone']) or (p_answers ? 'briefing' and d.answers#>'{company,priorities}' is distinct from p_answers#>'{company,priorities}') or d.answers#>>'{briefing,goal}' is distinct from p_answers#>>'{briefing,goal}' or d.answers#>>'{briefing,conversionAction}' is distinct from p_answers#>>'{briefing,conversionAction}' or d.answers#>>'{briefing,researchId}' is distinct from p_answers#>>'{briefing,researchId}' then
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

-- A background capture may commit only for the currently saved request.
create function public.save_briefing_capture(p_workspace uuid,p_request uuid,p_url text,p_id uuid,p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare a jsonb; begin
 perform private.require_setup_owner(p_workspace);
 perform 1 from public.workspaces where id=p_workspace for update;
 select answers into a from public.onboarding_documents where workspace_id=p_workspace;
 if a#>>'{briefing,researchId}' is distinct from p_request::text or a#>>'{company,website}' is distinct from p_url or a#>>'{briefing,noWebsite}' is distinct from 'false'
 then raise exception 'This research request was replaced' using errcode='40001'; end if;
 if p_payload#>>'{context,confirmed}' is distinct from 'false' then raise exception 'Capture cannot confirm facts'; end if;
 return public.save_company_context(p_workspace,p_id,p_payload);
end $$;
revoke all on function public.save_briefing_capture(uuid,uuid,text,uuid,jsonb) from public,anon;
grant execute on function public.save_briefing_capture(uuid,uuid,text,uuid,jsonb) to authenticated;
-- Retry-safe company creation, including a lost HTTP response. Key is scoped to the verified actor.
create function public.create_onboarding_workspace_once(p_request uuid,p_name text,p_business_model text,p_time_zone text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; begin
 if auth.uid() is null or p_request is null then raise exception 'Authenticated request required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||p_request::text,0));
 select workspace_id into result from public.audit_events where actor_id=auth.uid() and event_type='workspace_creation_request' and detail->>'requestId'=p_request::text limit 1;
 if result is not null then
  perform private.require_setup_owner(result);
  return result;
 end if;
 result:=public.create_onboarding_workspace(p_name,p_business_model,p_time_zone);
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(result,auth.uid(),'workspace_creation_request',jsonb_build_object('requestId',p_request));
 return result;
end $$;
revoke all on function public.create_onboarding_workspace_once(uuid,text,text,text) from public,anon;
grant execute on function public.create_onboarding_workspace_once(uuid,text,text,text) to authenticated;
-- Expose only setup readiness, never another workspace's budget or provider credentials.
create function public.read_preparation_setup(p_workspace uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g private.model_global_limit; begin
 if private.member_role(p_workspace) is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 select * into g from private.model_global_limit where singleton;
 return jsonb_build_object('globalConfigured',coalesce(g.daily_cost_ceiling_minor>0 and g.daily_output_token_ceiling>0,false));
end $$;
revoke all on function public.read_preparation_setup(uuid) from public,anon;
grant execute on function public.read_preparation_setup(uuid) to authenticated;
create or replace function public.save_company_context(p_workspace uuid,p_id uuid,p_payload jsonb) returns uuid
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
   or (d.answers ? 'briefing' and (p_payload#>>'{context,operatingGuidance,objective}' is distinct from coalesce((select string_agg(value,' · ' order by ord) from jsonb_array_elements_text(d.answers#>'{company,priorities}') with ordinality as v(value,ord)),'') or coalesce(p_payload#>>'{context,operatingGuidance,desiredAction}','') is distinct from case when d.answers#>>'{briefing,goal}'='conversion' then d.answers#>>'{briefing,conversionAction}' else '' end))
   or p_payload#>>'{context,operatingGuidance,forbiddenClaims}' is distinct from d.answers#>>'{company,forbiddenClaims}'
  then raise exception 'Onboarding changed; reload and confirm the current facts' using errcode='40001';end if;
 end if;
 return public.save_company_context_v1(p_workspace,p_id,p_payload);
end $$;

create or replace function public.review_prepared_artifact(p_workspace uuid,p_artifact uuid,p_decision text) returns void language plpgsql security definer set search_path='' as $$ begin
 perform private.require_setup_owner(p_workspace);
 perform 1 from public.workspaces where id=p_workspace for update;
 if p_decision is null or p_decision not in ('reviewed','rejected') then raise exception 'Invalid review';end if;
 if p_decision='reviewed' and exists(select 1 from public.onboarding_documents where workspace_id=p_workspace) and not exists(
  select 1 from public.prepared_artifacts a where a.workspace_id=p_workspace and a.id=p_artifact and jsonb_array_length(a.source_snapshot)>0
   and a.factual_inputs ?& (select array_agg(value) from (
    select 'Company: '||(answers#>>'{company,name}') as value from public.onboarding_documents where workspace_id=p_workspace
    union all select 'Owner-selected objective: '||(select string_agg(v.value,' · ' order by v.ord) from jsonb_array_elements_text(d.answers#>'{company,priorities}') with ordinality v(value,ord)) from public.onboarding_documents d where d.workspace_id=p_workspace and d.answers ? 'briefing' and jsonb_array_length(d.answers#>'{company,priorities}')>0
    union all select 'Owner-selected visitor action: '||(answers#>>'{briefing,conversionAction}') from public.onboarding_documents where workspace_id=p_workspace and answers#>>'{briefing,goal}'='conversion' and coalesce(answers#>>'{briefing,conversionAction}','')<>''
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


commit;
