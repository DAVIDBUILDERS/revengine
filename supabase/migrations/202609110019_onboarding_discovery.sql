begin;
-- Objectives and working hours do not change captured company facts.
create or replace function public.save_onboarding(p_workspace uuid,p_expected_revision integer,p_answers jsonb) returns void language plpgsql security definer set search_path='' as $$
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
  if d.workspace_id is null or (d.answers->'company'-array['priorities','successDefinition','businessModel','timeZone']) is distinct from (p_answers->'company'-array['priorities','successDefinition','businessModel','timeZone']) then
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

-- Metadata discovery is permitted while paused, bound to selected workspace intent.
create function public.begin_onboarding_discovery(p_workspace uuid,p_connection uuid,p_request jsonb default '{}'::jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare installation uuid; result uuid; model text; mode text; begin
 perform private.require_setup_owner(p_workspace);
 if p_request is null or jsonb_typeof(p_request)<>'object' or octet_length(p_request::text)>4096 or exists(select 1 from jsonb_object_keys(p_request) k where k not in ('operation','fileId','tab')) then raise exception 'Invalid discovery request';end if;
 perform public.consume_request_quota(p_workspace,'commands');
 perform 1 from public.workspaces where id=p_workspace for update;
 update public.runs set status='blocked' where workspace_id=p_workspace and definition_version='onboarding-discovery-v1' and status='processing' and created_at<now()-interval '2 minutes';
 if not exists(select 1 from public.connections where workspace_id=p_workspace and id=p_connection and provider='google' and health not in ('revoked','expired') and 'sheets.read'=any(operations)) then raise exception 'Authorized spreadsheet access required' using errcode='42501';end if;
 select business_model,environment into model,mode from public.workspaces where id=p_workspace;
 select i.id into installation from public.installations i where i.workspace_id=p_workspace order by i.id limit 1;
 if installation is null then
  insert into public.installations(workspace_id,agent_id,definition_version,mode,status,daily_capacity)
  select p_workspace,c.id,'1.0.0',c.mode,'selected',0 from public.onboarding_documents d
   cross join lateral jsonb_array_elements_text(d.answers->'team') a join private.agent_catalog c on c.id=a.value
   where d.workspace_id=p_workspace and c.implemented and model=any(c.archetypes) order by c.id limit 1 returning id into installation;
 end if;
 if installation is null then raise exception 'Choose an applicable implemented team before discovering sources';end if;
 if (select count(*) from public.runs where workspace_id=p_workspace and definition_version='onboarding-discovery-v1' and created_at>now()-interval '1 day')>=100 then raise exception 'Daily discovery limit reached';end if;
 result:=gen_random_uuid();
 insert into public.runs(id,workspace_id,installation_id,connection_id,definition_version,sdk_version,deployment_id,environment,status)
 values(result,p_workspace,installation,p_connection,'onboarding-discovery-v1','4.8.8','request-bound',mode,'processing');
 insert into private.run_inputs(workspace_id,run_id,kind,payload) values(p_workspace,result,'onboarding_discovery',p_request||'{"read_only":true}'::jsonb);
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id,detail) values(p_workspace,auth.uid(),'onboarding_discovery_started',result,p_request||'{"read_only":true}'::jsonb);
 return result;
end $$;
create function private.finish_onboarding_discovery(p_success boolean) returns void
language plpgsql security definer set search_path='' as $$ begin
 update public.runs set status=case when p_success then 'completed' else 'blocked' end where id=private.current_run() and workspace_id=private.current_workspace() and definition_version='onboarding-discovery-v1';
 if not found then raise exception 'Discovery run required';end if;
 insert into public.audit_events(workspace_id,event_type,entity_id,detail) values(private.current_workspace(),'onboarding_discovery_finished',private.current_run(),jsonb_build_object('metadata_read_succeeded',p_success,'capability_verified',false,'external_writes',false));
end $$;
revoke all on function public.begin_onboarding_discovery(uuid,uuid,jsonb) from public,anon;
grant execute on function public.begin_onboarding_discovery(uuid,uuid,jsonb) to authenticated;
revoke all on function private.finish_onboarding_discovery(boolean) from public,anon,authenticated;
grant execute on function private.finish_onboarding_discovery(boolean) to david_worker;
commit;
