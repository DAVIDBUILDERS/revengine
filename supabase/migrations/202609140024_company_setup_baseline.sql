-- Persist an unapproved, revision-zero company configuration before account setup.
-- A first lineup save must not erase source proof captured before agents were chosen.
begin;
create function private.initialize_onboarding_baseline(p_workspace uuid) returns void
language plpgsql security definer set search_path='' as $$
declare w public.workspaces; actor uuid; defaults jsonb; begin
 if exists(select 1 from public.onboarding_documents where workspace_id=p_workspace) then return;end if;
 select * into w from public.workspaces where id=p_workspace for update;
 if w.id is null then raise exception 'Workspace not found' using errcode='42501';end if;
 select actor_id into actor from public.memberships where workspace_id=p_workspace and active
 order by (role='workspace_owner') desc,(role='david_operator') desc,id limit 1;
 if actor is null then raise exception 'Workspace membership required' using errcode='42501';end if;
 defaults:=jsonb_build_object('company',jsonb_build_object('name',w.name,'website','','businessModel',w.business_model,'timeZone',w.time_zone,
  'offers','[]'::jsonb,'customers','[]'::jsonb,'priorities','[]'::jsonb,'successDefinition','','brandGuidance','','forbiddenClaims',''))
  || '{"team":[],"systems":[],"operations":{"approvalMode":"each_action","automationAcknowledged":false,"contactRestrictions":"","workingDays":[1,2,3,4,5],"startHour":9,"endHour":17,"meetingMinutes":30,"bufferMinutes":15,"dailyCapacity":0,"modelDailyBudgetMinor":null,"actionDailyBudgetMinor":0,"sender":"","calendarId":"","escalationOwner":"","approvedContactIds":[],"policyAcknowledged":false},"people":[],"measurement":{"owner":"","outcomeSources":"","baseline":[],"sharing":"private"}}'::jsonb;
 insert into public.onboarding_documents(workspace_id,revision,answers,updated_at,updated_by)
 values(w.id,0,defaults,w.created_at,actor) on conflict(workspace_id) do nothing;
 if found then
  insert into private.onboarding_revisions(workspace_id,revision,answers,actor,at,summary)
  values(w.id,0,defaults,actor,w.created_at,'Initial company setup. No sources verified or work authorized.');
 end if;
end $$;
revoke all on function private.initialize_onboarding_baseline(uuid) from public,anon,authenticated,david_worker,david_dispatcher,david_oauth;

create or replace function public.create_onboarding_workspace(p_name text,p_business_model text,p_time_zone text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; begin
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Confirmed account required' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,781));
 if (select count(*) from public.memberships where actor_id=auth.uid() and role='workspace_owner')>=3 then raise exception 'Contact DAVID to provision additional workspaces';end if;
 if coalesce(length(trim(p_name)),0) not between 1 and 200 or p_business_model is null or p_business_model not in ('b2b_services','home_services','commerce') or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_time_zone) then raise exception 'Invalid company details';end if;
 insert into public.workspaces(name,environment,business_model,time_zone,paused,currency,subscription_minor) values(trim(p_name),'shadow',p_business_model,p_time_zone,true,'USD',0) returning id into result;
 insert into public.memberships(workspace_id,actor_id,role) values(result,auth.uid(),'workspace_owner');
 perform private.initialize_onboarding_baseline(result);
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(result,auth.uid(),'workspace_created','{"source":"onboarding","outbound_enabled":false}');return result;
end $$;

-- Direct saves from older clients also receive the same stable baseline.
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

-- Authorized reads repair legacy workspaces with no saved document. No permissions are granted.
create or replace function public.read_onboarding_v2(p_workspace uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; d public.onboarding_documents; reviews jsonb; begin
 if private.member_role(p_workspace) is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 perform private.initialize_onboarding_baseline(p_workspace);
 result:=public.read_onboarding(p_workspace);
 if result is null then return null;end if;
 select * into d from public.onboarding_documents where workspace_id=p_workspace;
 select coalesce(jsonb_agg(review.value || case when history.configuration_revision is null then '{}'::jsonb
  else jsonb_build_object('configurationRevision',history.configuration_revision) end order by review.ordinality),'[]'::jsonb) into reviews
 from jsonb_array_elements(result->'reviews') with ordinality as review(value,ordinality)
 left join private.onboarding_revisions history on history.workspace_id=p_workspace and history.revision=(review.value->>'revision')::integer;
 return result || jsonb_build_object('configurationRevision',d.configuration_revision,'configurationUpdatedAt',d.configuration_updated_at,'reviews',reviews);
end $$;
commit;
