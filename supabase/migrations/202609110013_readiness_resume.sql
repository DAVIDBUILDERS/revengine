begin;
create function private.workspace_readiness(p_workspace uuid,p_ignore_pause boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.workspaces; blockers jsonb:='[]'; selected integer; configured integer; context_ready boolean; activation public.live_activations; clock_local timestamp; live_ok boolean:=false; has_execution boolean; begin
 select * into w from public.workspaces where id=p_workspace;
 if w.id is null then raise exception 'Workspace missing'; end if;
 select count(*),count(*) filter(where i.daily_capacity>0 and c.implemented) into selected,configured from public.installations i join private.agent_catalog c on c.id=i.agent_id where i.workspace_id=w.id and i.status<>'paused';
 if selected=0 or selected>w.entitlement or selected>5 or configured=0 then
  blockers:=blockers||jsonb_build_array(jsonb_build_object('code','team_capacity','message','Select an implemented specialist and provision reviewed capacity within the five-slot entitlement.','owner','DAVID operator','nextStep','Review selected responsibilities and assign bounded per-day capacity using the provisioning runbook.','dimension','action'));
 end if;
 if exists(select 1 from public.installations i join private.agent_catalog c on c.id=i.agent_id where i.workspace_id=w.id and i.status<>'paused' and not c.implemented) then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','capability_unimplemented','message','A selected responsibility still requires engineering implementation.','owner','DAVID engineering','nextStep','Keep the specialist selected with its honest unavailable mode or choose an implemented responsibility.','dimension','action')); end if;
 select exists(select 1 from public.product_records where workspace_id=w.id and kind='company_context' and coalesce(payload->'context',payload)->>'confirmed'='true' and coalesce(payload->'context',payload)->>'fixture'='false' and jsonb_typeof(coalesce(payload->'context',payload)->'evidence')='array' and jsonb_array_length(coalesce(payload->'context',payload)->'evidence')>0) into context_ready;
 if not context_ready then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','company_context','message','Confirmed company facts and authorized source evidence are missing.','owner','Workspace owner','nextStep','Capture approved pages and save confirmed company facts with their evidence.','dimension','integration')); end if;
 if w.paused and not p_ignore_pause then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','paused','message','Workspace is paused.','owner','Workspace owner','nextStep','Review readiness, then explicitly resume; old paused runs will not be restarted.','dimension','action')); end if;
 select exists(select 1 from public.installations where workspace_id=w.id and status<>'paused' and mode<>'preparation') into has_execution;
 if w.environment<>'live' then
  blockers:=blockers||jsonb_build_array(jsonb_build_object('code','shadow_execution_disabled','message','This workspace prepares internal work; real outbound is disabled.','owner','Release owner','nextStep','Retain shadow mode until the reviewed live cohort, provider verification and deployment gates are complete.','dimension','action'));
 else
  if w.daily_limit<=0 or w.daily_budget_minor<=0 then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','live_budget','message','Live action capacity and spending ceilings are not provisioned.','owner','DAVID operator','nextStep','Approve explicit daily action and minor-unit spending limits.','dimension','action')); end if;
  select la.* into activation from public.live_activations la join public.memberships m on m.workspace_id=la.workspace_id and m.id=la.operator_membership_id join public.connections c on c.workspace_id=la.workspace_id and c.id=la.sender_connection_id
   where la.workspace_id=w.id and la.revoked_at is null and la.expires_at>now() and m.active and m.role='david_operator' and la.sender=c.identity and c.health='healthy' order by la.expires_at desc limit 1;
  if activation.id is null then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','live_activation','message','Current approved sender, policy, assigned operator and cohort activation are missing.','owner','Release owner','nextStep','Record a reviewed live activation with expiration and assigned operator.','dimension','action'));
  else
   begin clock_local:=now() at time zone w.time_zone; exception when invalid_parameter_value then clock_local:=null; end;
   if clock_local is null or not coalesce(activation.staffed_hours->'days' @> to_jsonb(array[extract(isodow from clock_local)::integer]),false)
     or not coalesce(extract(hour from clock_local)>=(activation.staffed_hours->>'startHour')::integer and extract(hour from clock_local)<(activation.staffed_hours->>'endHour')::integer,false) then
    blockers:=blockers||jsonb_build_array(jsonb_build_object('code','staffed_hours','message','Current time is outside confirmed operator coverage, or coverage/time zone is invalid.','owner','Assigned DAVID operator','nextStep','Confirm staffing days/hours in the workspace time zone; outbound remains paused outside that coverage.','dimension','action'));
   end if;
   if not exists(select 1 from public.contacts ct join public.proposals p on p.workspace_id=ct.workspace_id and p.contact_id=ct.id join public.source_bindings s on s.workspace_id=p.workspace_id and s.id=p.source_binding_id join public.connections c on c.workspace_id=s.workspace_id and c.id=s.connection_id
      where ct.workspace_id=w.id and ct.enrolled and ct.cohort_id=activation.cohort_id and not ct.suppressed and not ct.human_takeover and p.status='open' and not p.fixture and (p.valid_until is null or p.valid_until>now())
      and s.resource_type='sheet' and s.verified_at is not null and c.id=activation.sender_connection_id and c.health='healthy' and p.source_verified_at>now()-make_interval(secs=>c.freshness_seconds)
      and exists(select 1 from private.proposal_threads t where t.workspace_id=p.workspace_id and t.proposal_id=p.id and t.connection_id=c.id)) then
    blockers:=blockers||jsonb_build_array(jsonb_build_object('code','enrolled_source','message','No currently eligible enrolled proposal has verified Sheet and reply-thread coverage for this activation.','owner','Source owner','nextStep','Reconcile the exact selected Sheet, verify proposal/thread identity and explicitly enroll the approved cohort.','dimension','integration'));
   end if;
   if not exists(select 1 from public.connections c where c.id=activation.sender_connection_id and c.workspace_id=w.id and c.health='healthy' and 'sheets.read'=any(c.operations) and 'gmail.read'=any(c.operations) and 'gmail.send'=any(c.operations) and c.last_sync_at>now()-interval '2 minutes') then
    blockers:=blockers||jsonb_build_array(jsonb_build_object('code','google_capabilities','message','Current proposal, Gmail send and enrolled reply-read capability coverage is incomplete or stale.','owner','Google account owner','nextStep','Verify granted operations and reconcile enrolled history before enabling outbound.','dimension','integration'));
   end if;
   if exists(select 1 from public.installations i where i.workspace_id=w.id and i.status<>'paused' and i.mode<>'preparation' and (i.policy_id is null or i.policy_id<>activation.policy_id or i.daily_capacity<=0)) then
    blockers:=blockers||jsonb_build_array(jsonb_build_object('code','installation_policy','message','Each selected execution responsibility needs the current activation policy and reviewed capacity.','owner','DAVID operator','nextStep','Bind the reviewed policy to each execution installation and confirm limits.','dimension','action'));
   end if;
   if exists(select 1 from public.installations where workspace_id=w.id and status<>'paused' and agent_id='appointment-coordinator') and not exists(select 1 from public.connections c join public.source_bindings s on s.workspace_id=c.workspace_id and s.connection_id=c.id join public.policies p on p.id=activation.policy_id and p.workspace_id=c.workspace_id
     where c.workspace_id=w.id and c.id=activation.sender_connection_id and 'calendar.book'=any(c.operations) and 'calendar.freebusy'=any(c.operations) and s.resource_type='calendar' and s.verified_at is not null and s.resource_id=p.bounds->>'calendarId' and coalesce((p.bounds->>'meetingMinutes')::integer,0) between 15 and 120) then
    blockers:=blockers||jsonb_build_array(jsonb_build_object('code','calendar_capability','message','Approved Calendar availability, booking resource or meeting duration is unverified.','owner','Calendar owner','nextStep','Verify the exact owned calendar, scoped permissions and policy-bound meeting rules.','dimension','integration'));
   end if;
  end if;
 end if;
 if not has_execution and w.environment='live' then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','execution_not_selected','message','No execution responsibility is selected.','owner','Workspace owner','nextStep','Continue internal preparation or select an implemented execution specialist and validate its requirements.','dimension','action')); end if;
 live_ok:=w.environment='live' and not exists(select 1 from jsonb_array_elements(blockers) b where b->>'dimension' in ('integration','action'));
 -- Payment observations alone do not prove cost coverage or incremental contribution.
 blockers:=blockers||jsonb_build_array(jsonb_build_object('code','financial_measurement','message','Financial return and customer fulfillment-cost coverage are not verified.','owner','Finance owner','nextStep','Bind and reconcile payment and fulfillment-cost sources before financial-return claims.','dimension','measurement'));
 return jsonb_build_object('integration',not exists(select 1 from jsonb_array_elements(blockers) b where b->>'dimension'='integration'),'action',live_ok,'measurement',false,'blockers',blockers,'evaluatedAt',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'freshUntil',case when live_ok then to_char(least(activation.expires_at,now()+interval '60 seconds') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') else null end,'fallback','Run approved internal preparation where its source/model/capacity gates pass; resolve blocked execution with the assigned owner.');
end $$;
create function public.read_workspace_readiness(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if private.member_role(p_workspace) is null then raise exception 'Workspace access denied' using errcode='42501'; end if;
 return private.workspace_readiness(p_workspace,false);
end $$;
create or replace function public.set_workspace_pause(p_workspace_id uuid,p_paused boolean) returns void language plpgsql security definer set search_path='' as $$
declare w public.workspaces; readiness jsonb; begin
 if coalesce(private.member_role(p_workspace_id),'') not in ('workspace_owner','david_operator') or p_paused is null then raise exception 'Owner role required' using errcode='42501'; end if;
 select * into w from public.workspaces where id=p_workspace_id for update;
 if p_paused then
  update public.workspaces set paused=true where id=w.id;
  update public.approvals set status='invalidated' where workspace_id=w.id and status in ('pending','approved') and action_id in(select id from public.actions where workspace_id=w.id and status='not_attempted');
  update public.runs set status='paused' where workspace_id=w.id and (status in ('scheduled','awaiting_approval','waiting_for_reply') or status='processing' and not exists(select 1 from public.actions a where a.workspace_id=w.id and a.run_id=public.runs.id and a.status in ('submitting','uncertain')));
 else
  if w.environment='fixture' then raise exception 'Fixture workspaces are local-only'; end if;
  readiness:=private.workspace_readiness(w.id,true);
  if w.environment='live' and not coalesce((readiness->>'action')::boolean,false) then raise exception 'LIVE_RESUME_BLOCKED: Resolve the current authoritative readiness blockers'; end if;
  if w.environment='shadow' and exists(select 1 from jsonb_array_elements(readiness->'blockers') b where b->>'code' in ('team_capacity','company_context')) then raise exception 'SHADOW_RESUME_BLOCKED: Confirm company sources and provision selected implemented capacity'; end if;
  -- Resume is a new authorization boundary: never restart an old approved message.
  update public.approvals set status='invalidated' where workspace_id=w.id and status in ('pending','approved') and action_id in(select a.id from public.actions a join public.runs r on r.workspace_id=a.workspace_id and r.id=a.run_id where a.workspace_id=w.id and a.status='not_attempted' and r.status='paused');
  update public.runs set status='cancelled',next_due_at=null where workspace_id=w.id and status='paused';
  update public.workspaces set paused=false where id=w.id;
  update public.installations i set status='monitoring',preparation_next_due_at=case when i.mode='preparation' then now() else i.preparation_next_due_at end where i.workspace_id=w.id and i.status='selected' and i.daily_capacity>0 and exists(select 1 from private.agent_catalog c where c.id=i.agent_id and c.implemented);
 end if;
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(w.id,auth.uid(),case when p_paused then 'workspace_paused' else 'workspace_resumed_after_readiness' end,jsonb_build_object('prior_paused_runs_restarted',false,'environment',w.environment));
end $$;
-- Calendar bounds are deterministic policy checks, independent of provider availability.
alter function private.action_ready(uuid) rename to action_ready_core;
create function private.action_ready(p_action uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare a public.actions; bounds jsonb; workspace_zone text; starts timestamptz; ends timestamptz; local_start timestamp; local_end timestamp; duration integer; buffer_minutes integer; capacity integer; start_hour integer; end_hour integer; begin
 if not coalesce(private.action_ready_core(p_action),false) then return false; end if;
 select * into a from public.actions where id=p_action and workspace_id=private.current_workspace() and run_id=private.current_run();
 if a.type<>'book_appointment' then return true; end if;
 select p.bounds into bounds from public.policies p where p.id=a.policy_id and p.workspace_id=a.workspace_id;
 select time_zone into workspace_zone from public.workspaces where id=a.workspace_id;
 if bounds is null or not (bounds ?& array['calendarId','timeZone','meetingMinutes','workingDays','workingStartHour','workingEndHour','calendarCapacity','bufferMinutes']) then return false; end if;
 begin
  duration:=(bounds->>'meetingMinutes')::integer;buffer_minutes:=(bounds->>'bufferMinutes')::integer;capacity:=(bounds->>'calendarCapacity')::integer;start_hour:=(bounds->>'workingStartHour')::integer;end_hour:=(bounds->>'workingEndHour')::integer;
  starts:=(a.payload->>'startAt')::timestamptz;ends:=(a.payload->>'endAt')::timestamptz;local_start:=starts at time zone workspace_zone;local_end:=ends at time zone workspace_zone;
 exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or invalid_parameter_value then return false; end;
 if a.payload->>'calendarId' is distinct from bounds->>'calendarId' or a.payload->>'timeZone' is distinct from bounds->>'timeZone' or bounds->>'timeZone' is distinct from workspace_zone
  or duration is null or duration not between 15 and 120 or buffer_minutes is null or buffer_minutes not between 0 and 120 or capacity is null or capacity not between 1 and 100
  or start_hour is null or end_hour is null or start_hour<0 or end_hour>24 or start_hour>=end_hour or starts is null or ends is null or starts<=now() or ends-starts<>make_interval(mins=>duration)
  or local_start::date<>local_end::date or not coalesce(bounds->'workingDays' @> to_jsonb(array[extract(isodow from local_start)::integer]),false)
  or extract(epoch from local_start::time)<start_hour*3600 or extract(epoch from local_end::time)>end_hour*3600 then return false; end if;
 if ((select count(*) from public.appointments ap where ap.workspace_id=a.workspace_id and ap.calendar_id=a.payload->>'calendarId' and (ap.starts_at at time zone workspace_zone)::date=local_start::date)
  +(select count(*) from public.actions pending where pending.workspace_id=a.workspace_id and pending.id<>a.id and pending.type='book_appointment' and pending.payload->>'calendarId'=a.payload->>'calendarId' and ((pending.payload->>'startAt')::timestamptz at time zone workspace_zone)::date=local_start::date and (pending.status in ('submitting','uncertain') or pending.status='not_attempted' and pending.reserved_at is not null)))>=capacity then return false; end if;
 if exists(select 1 from public.actions pending where pending.workspace_id=a.workspace_id and pending.id<>a.id and pending.type='book_appointment' and pending.payload->>'calendarId'=a.payload->>'calendarId' and (pending.status in ('submitting','uncertain') or pending.status='not_attempted' and pending.reserved_at is not null) and (pending.payload->>'startAt')::timestamptz<ends+make_interval(mins=>buffer_minutes) and (pending.payload->>'endAt')::timestamptz>starts-make_interval(mins=>buffer_minutes)) then return false; end if;
 if exists(select 1 from public.appointments ap where ap.workspace_id=a.workspace_id and ap.calendar_id=a.payload->>'calendarId' and ap.starts_at<ends+make_interval(mins=>buffer_minutes) and ap.ends_at>starts-make_interval(mins=>buffer_minutes)) then return false; end if;
 return true;
end $$;
revoke all on function private.action_ready(uuid),private.action_ready_core(uuid) from public,anon,authenticated,david_worker,david_dispatcher,david_oauth;
revoke all on function private.workspace_readiness(uuid,boolean) from public,anon,authenticated,david_worker,david_dispatcher,david_oauth;
revoke all on function public.read_workspace_readiness(uuid),public.set_workspace_pause(uuid,boolean) from public,anon;
grant execute on function public.read_workspace_readiness(uuid),public.set_workspace_pause(uuid,boolean) to authenticated;
commit;
