-- Owners may select more than one briefing direction. Existing single-goal documents remain valid.
begin;
create or replace function public.save_onboarding(p_workspace uuid,p_expected_revision integer,p_answers jsonb) returns void language plpgsql security definer set search_path='' as $$
declare d public.onboarding_documents; w public.workspaces; o jsonb; changed boolean; rev integer; begin
 perform private.require_setup_owner(p_workspace);
 perform private.initialize_onboarding_baseline(p_workspace);
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
   or exists(select 1 from jsonb_object_keys(p_answers->'briefing') k where k not in ('version','step','name','goal','goals','otherGoal','description','websiteInput','proposalSource','conversionAction','researchId','noWebsite','reviewedFacts','task','finished'))
   or exists(select 1 from unnest(array['name','otherGoal','description','websiteInput','proposalSource','conversionAction','researchId','reviewedFacts','task']) k where jsonb_typeof(p_answers->'briefing'->k) is distinct from 'string')
   or (p_answers->'briefing' ? 'goals' and (
    jsonb_typeof(p_answers#>'{briefing,goals}') is distinct from 'array'
    or jsonb_array_length(p_answers#>'{briefing,goals}')>4
    or exists(select 1 from jsonb_array_elements_text(p_answers#>'{briefing,goals}') g where g.value not in ('demand','conversion','recover','other'))
    or (select count(distinct value) from jsonb_array_elements_text(p_answers#>'{briefing,goals}')) is distinct from jsonb_array_length(p_answers#>'{briefing,goals}')
   ))
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
  if d.workspace_id is null or ((d.answers->'company')-array['priorities','successDefinition','businessModel','timeZone']) is distinct from ((p_answers->'company')-array['priorities','successDefinition','businessModel','timeZone']) or (p_answers ? 'briefing' and d.answers#>'{company,priorities}' is distinct from p_answers#>'{company,priorities}') or coalesce(d.answers#>>'{briefing,goal}','') is distinct from coalesce(p_answers#>>'{briefing,goal}','') or coalesce(d.answers#>'{briefing,goals}','[]'::jsonb) is distinct from coalesce(p_answers#>'{briefing,goals}','[]'::jsonb) or coalesce(d.answers#>>'{briefing,conversionAction}','') is distinct from coalesce(p_answers#>>'{briefing,conversionAction}','') or coalesce(d.answers#>>'{briefing,researchId}','') is distinct from coalesce(p_answers#>>'{briefing,researchId}','') then
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
commit;
