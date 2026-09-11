-- Deterministic operational analysis. These observations never authorize a send,
-- booking, policy change or outcome attribution. No client-authored findings enter
-- this interface. The workspace lock serializes refreshes with initiative approval.
begin;
create index strategy_findings_by_workspace on public.product_records(workspace_id,created_at)
 where kind='work_opportunity';

create function private.refresh_work_findings(p_workspace uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 w public.workspaces; policy_bounds jsonb; calendar_bounds jsonb; policy_id uuid;
 reply_hours integer:=4; interval_minutes integer:=1440; capacity integer; remaining_slots bigint;
 calendar_resource text; calendar_owner text; local_day date; observed_at timestamptz:=now(); stamp text;
 rule record; prior public.product_records; finding_id uuid; observation_id uuid; source_evidence jsonb;
 condition_text text; owner_text text; created_count integer:=0; resolved_count integer:=0; active_count integer;
begin
 select * into w from public.workspaces where id=p_workspace for update;
 if w.id is null then raise exception 'Workspace missing' using errcode='42501'; end if;
 -- Anonymous/local fixture strategy stays in the isolated fixture engine.
 if w.environment='fixture' then raise exception 'Operational strategy requires nonfixture workspace'; end if;
 stamp:=to_char(observed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 select p.bounds,p.id into policy_bounds,policy_id from public.installations i
 join public.policies p on p.workspace_id=i.workspace_id and p.id=i.policy_id
 where i.workspace_id=w.id and i.agent_id='deal-follow-up';
 -- These fallback values are labeled analysis thresholds, never execution grants.
 -- Do not cast arbitrary policy JSON, accept JSON numbers within explicit bounds.
 if jsonb_typeof(policy_bounds->'replyReviewHours')='number' and policy_bounds->>'replyReviewHours' ~ '^[0-9]{1,3}$' then
  if (policy_bounds->>'replyReviewHours')::integer between 1 and 168 then reply_hours:=(policy_bounds->>'replyReviewHours')::integer; end if;
 end if;
 if jsonb_typeof(policy_bounds->'minContactIntervalMinutes')='number' and policy_bounds->>'minContactIntervalMinutes' ~ '^[0-9]{1,5}$' then
  if (policy_bounds->>'minContactIntervalMinutes')::integer between 1 and 43200 then interval_minutes:=(policy_bounds->>'minContactIntervalMinutes')::integer; end if;
 end if;
 select p.bounds into calendar_bounds from public.installations i join public.policies p on p.workspace_id=i.workspace_id and p.id=i.policy_id
 where i.workspace_id=w.id and i.agent_id='appointment-coordinator';
 -- Unknown/malformed calendar policy means unknown capacity, not zero capacity.
 if jsonb_typeof(calendar_bounds->'calendarCapacity')='number' and calendar_bounds->>'calendarCapacity' ~ '^[0-9]{1,3}$'
  and nullif(calendar_bounds->>'calendarId','') is not null and calendar_bounds->>'timeZone'=w.time_zone
  and exists(select 1 from pg_catalog.pg_timezone_names where name=w.time_zone) then
  if (calendar_bounds->>'calendarCapacity')::integer between 1 and 100 then
   calendar_resource:=calendar_bounds->>'calendarId';
   select s.source_owner into calendar_owner from public.source_bindings s
   join public.connections c on c.workspace_id=s.workspace_id and c.id=s.connection_id
   where s.workspace_id=w.id and s.resource_type='calendar' and s.resource_id=calendar_resource
    and s.verified_at is not null and s.verified_at<=observed_at and c.provider='google'
   order by s.verified_at desc,s.id limit 1;
   if calendar_owner is not null then
    capacity:=(calendar_bounds->>'calendarCapacity')::integer;
    local_day:=(observed_at at time zone w.time_zone)::date;
    select greatest(0,capacity-count(*)) into remaining_slots from public.appointments a
    join public.evidence e on e.workspace_id=a.workspace_id and e.id=a.evidence_id
    join public.actions accepted on accepted.workspace_id=a.workspace_id and accepted.id=a.action_id
    join public.runs r on r.workspace_id=accepted.workspace_id and r.id=accepted.run_id and r.environment<>'fixture'
    where a.workspace_id=w.id and a.calendar_id=calendar_resource and e.quality<>'fixture'
     and (a.starts_at at time zone w.time_zone)::date=local_day;
   end if;
  end if;
 end if;

 for rule in
  with ranked as materialized (
   select p.*,dense_rank() over(partition by p.opportunity_id,p.reference order by p.version desc) as version_rank
   from public.proposals p where p.workspace_id=w.id and not p.fixture
  ), latest as materialized (
   -- Duplicate authoritative rows at the latest version are a review condition,
   -- not permission to select whichever row happens to be favorable.
   select r.*,count(*) over(partition by r.opportunity_id,r.reference) as authority_count,
    row_number() over(partition by r.opportunity_id,r.reference order by r.synced_at desc,r.id) as pick
   from ranked r where r.version_rank=1
  ), facts as materialized (
   select p.id,p.source_binding_id,p.owner,p.status,p.authority_count,p.source_verified_at,
    p.issued_at,p.valid_until,p.scope_summary,c.enrolled,c.suppressed,c.human_takeover,c.last_contact_at,c.email,
    cn.freshness_seconds,cv.last_reply_at,cv.reply_class,coalesce(cv.takeover,false) as conversation_takeover,
    coalesce(cv.replied_at is not null or cv.last_reply_at is not null,false) as has_reply,
    (select case when count(*)=0 then coalesce(cv.booked_at<=observed_at,false)
     else bool_and(coalesce(o.value=1 and o.quality in ('provider_verified','manually_reported') and e.quality in ('provider_verified','manually_reported'),false)) end
     from public.outcomes o join public.evidence e on e.workspace_id=o.workspace_id and e.id=o.evidence_id
     where o.workspace_id=w.id and o.opportunity_id=p.opportunity_id and o.stage='booked' and o.value_type='count'
      and o.quality<>'fixture' and e.quality<>'fixture' and o.period_end<=observed_at
      and o.period_end=(select max(current.period_end) from public.outcomes current
       join public.evidence proof on proof.workspace_id=current.workspace_id and proof.id=current.evidence_id
       where current.workspace_id=w.id and current.opportunity_id=p.opportunity_id and current.stage='booked' and current.value_type='count'
        and current.quality<>'fixture' and proof.quality<>'fixture' and current.period_end<=observed_at)
    ) as has_booking,
    exists(select 1 from public.actions a join public.runs r on r.workspace_id=a.workspace_id and r.id=a.run_id
     where a.workspace_id=w.id and a.contact_id=p.contact_id and r.environment<>'fixture'
      and a.type='book_appointment' and a.status in ('not_attempted','submitting','uncertain','provider_accepted','confirmed')) as pending_booking,
    exists(select 1 from public.actions a join public.runs r on r.workspace_id=a.workspace_id and r.id=a.run_id
     where a.workspace_id=w.id and a.contact_id=p.contact_id and r.environment<>'fixture'
      and a.type='send_follow_up' and a.status in ('not_attempted','submitting','uncertain','provider_accepted','confirmed')) as has_followup,
    exists(select 1 from public.evidence e where e.workspace_id=w.id and e.source_binding_id=p.source_binding_id
     and e.quality in ('provider_verified','manually_reported') and e.captured_at<=observed_at) as has_source_evidence
   from latest p join public.contacts c on c.workspace_id=p.workspace_id and c.id=p.contact_id
   join public.source_bindings s on s.workspace_id=p.workspace_id and s.id=p.source_binding_id
   join public.connections cn on cn.workspace_id=s.workspace_id and cn.id=s.connection_id and cn.provider<>'fixture'
   left join lateral (
    select cv.* from public.conversations cv
    join public.runs r on r.workspace_id=cv.workspace_id and r.id=cv.run_id
    join public.connections cc on cc.workspace_id=cv.workspace_id and cc.id=cv.connection_id
    where cv.workspace_id=w.id and cv.contact_id=p.contact_id and cv.active and r.environment<>'fixture' and cc.provider<>'fixture'
    limit 1
   ) cv on true
   where p.pick=1
  ), classified as materialized (
   select f.*,
    (f.status='open' and f.authority_count=1 and f.enrolled and not f.suppressed and not f.human_takeover
     and not f.conversation_takeover and not f.has_reply and not coalesce(f.has_booking,false) and not f.has_followup
     and f.has_source_evidence and f.source_verified_at<=observed_at and f.source_verified_at>=observed_at-make_interval(secs=>least(f.freshness_seconds,2592000))
     and f.issued_at<=observed_at and (f.valid_until is null or f.valid_until>observed_at)
     and nullif(btrim(f.owner),'') is not null and nullif(btrim(f.scope_summary),'') is not null
     and f.email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     and (f.last_contact_at is null or f.last_contact_at<=observed_at-make_interval(mins=>interval_minutes))) as neglected,
    (f.last_reply_at<=observed_at-make_interval(hours=>reply_hours) and f.reply_class in ('positive','decline','opt_out','ambiguous')
     and not f.human_takeover and not f.conversation_takeover and not coalesce(f.has_booking,false)) as delayed,
    (f.reply_class='positive' and f.last_reply_at<=observed_at and f.status='open' and f.authority_count=1
     and not f.suppressed and not f.human_takeover and not f.conversation_takeover and not coalesce(f.has_booking,false) and not f.pending_booking) as handoff,
    (f.status='unknown' or f.authority_count<>1 or f.source_verified_at>observed_at
     or f.source_verified_at<observed_at-make_interval(secs=>least(f.freshness_seconds,2592000))) as unresolved
   from facts f
  ), candidates as materialized (
   select keys.key,f.id,f.source_binding_id,f.owner from classified f cross join
    (values ('neglected'),('delayed_response'),('missing_next_action'),('meeting_capacity'),('unknown_status')) keys(key)
   where case keys.key
    when 'neglected' then f.neglected when 'delayed_response' then f.delayed when 'missing_next_action' then f.handoff
    when 'meeting_capacity' then remaining_slots is not null and f.handoff and (select count(*) from classified where handoff)>remaining_slots
    when 'unknown_status' then f.unresolved else false end
  )
  select definitions.*, (select count(*) from candidates c where c.key=definitions.key) as affected_count,
   array(select c.id from candidates c where c.key=definitions.key order by c.id limit 200) as affected_ids,
   array(select distinct c.source_binding_id from candidates c where c.key=definitions.key order by c.source_binding_id limit 20) as binding_ids,
   (select case when count(distinct c.owner)=1 then min(c.owner) else 'Responsible proposal owners (see source records)' end from candidates c where c.key=definitions.key) as proposal_owner
  from (values
   ('neglected','Review open proposals without a next action','A factual, reviewed follow-up may produce a useful response.','Record an observed reply or an explicit no-response result.','deal-follow-up',15),
   ('delayed_response','Assign delayed replies to the responsible person','Explicit ownership may reduce unresolved conversations.','Record human ownership and the next reviewed action.','deal-follow-up',10),
   ('missing_next_action','Review a positive-reply appointment handoff','A checked appointment handoff may establish a useful next conversation.','Retain a confirmed booking or a documented human decision.','appointment-coordinator',15),
   ('meeting_capacity','Resolve the meeting-capacity constraint','A person can choose timing or coverage without overbooking.','Agree a schedule within verified availability or explicitly approve a policy change.','appointment-coordinator',20),
   ('unknown_status','Confirm unresolved proposal status','Owner confirmation may prevent an inappropriate follow-up.','Resolve status with a dated authoritative source.','deal-follow-up',10)
  ) definitions(key,title,hypothesis,target,agent,effort)
 loop
  -- An unavailable capacity calculation cannot establish that a prior issue ended.
  if rule.key='meeting_capacity' and remaining_slots is null then continue; end if;
  if rule.affected_count=0 then
   for prior in select * from public.product_records where workspace_id=w.id and kind='work_opportunity'
    and starts_with(payload->>'evaluationRule','strategy.v1/'||rule.key||':') and payload->>'status'='proposed' for update
   loop
    update public.product_records set payload=jsonb_set(jsonb_set(payload,'{status}','"reviewed"'::jsonb),'{evaluationRule}',
     to_jsonb((payload->>'evaluationRule')||' Condition no longer observed at '||stamp||'; original observation retained. This does not establish experiment success.')),version=version+1 where id=prior.id;
    insert into public.audit_events(workspace_id,actor_id,event_type,entity_id,detail)
     values(w.id,auth.uid(),'finding.condition_resolved',prior.id,jsonb_build_object('rule',rule.key,'observedAt',stamp,'outcomeAttributed',false));
    resolved_count:=resolved_count+1;
   end loop;
   continue;
  end if;
  -- Keep the original baseline and evidence of both open proposals and approved
  -- experiments. A reviewed/dismissed finding may have a later recurrent episode.
  if exists(select 1 from public.product_records where workspace_id=w.id and kind='work_opportunity'
   and starts_with(payload->>'evaluationRule','strategy.v1/'||rule.key||':') and payload->>'status' in ('proposed','approved')) then continue; end if;
  condition_text:=case rule.key
   when 'neglected' then format('%s current, source-backed, enrolled open proposal(s) have no recorded follow-up or reply after an analysis contact interval of %s minutes.',rule.affected_count,interval_minutes)
   when 'delayed_response' then format('%s human conversation(s) have waited at least %s hours without recorded human ownership or booking.',rule.affected_count,reply_hours)
   when 'missing_next_action' then format('%s positive conversation(s) have no pending appointment action or recorded booking.',rule.affected_count)
   when 'meeting_capacity' then format('%s unscheduled handoff(s) exceed %s remaining locally recorded meeting slot(s) for %s under capacity %s. Provider availability and pending reservations can further reduce availability.',rule.affected_count,remaining_slots,local_day,capacity)
   else format('%s current proposal(s) have unknown, duplicated-authority, future-dated or stale status under their source freshness window (capped at 30 days).',rule.affected_count) end;
  condition_text:='Observed at '||stamp||': '||condition_text||' This is a review candidate; action readiness and execution authorization are evaluated separately.';
  if rule.affected_count>200 then condition_text:=condition_text||' The retained affected-record list is capped at 200; the count includes all matches.'; end if;
  owner_text:=coalesce(nullif(case when rule.key='meeting_capacity' then calendar_owner else rule.proposal_owner end,''),'Unassigned source owner');
  finding_id:=gen_random_uuid(); observation_id:=gen_random_uuid();
  insert into public.evidence(id,workspace_id,label,source,quality,captured_at,content_hash)
   values(observation_id,w.id,'DAVID condition observation · '||rule.key,'strategy.v1/'||rule.key,'unknown',observed_at,
    encode(extensions.digest(jsonb_build_object('condition',condition_text,'ids',rule.affected_ids,'policyId',policy_id)::text,'sha256'),'hex'));
  -- Source evidence remains labeled by its retained quality. The detector's own
  -- observation is explicitly derived/unknown, never a provider-verified outcome.
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'label',e.label,'source',e.source,
   'capturedAt',to_char(e.captured_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'quality',e.quality) order by e.captured_at desc,e.id),'[]'::jsonb)
   into source_evidence from (
    select e.* from public.evidence e where e.workspace_id=w.id and e.source_binding_id=any(rule.binding_ids)
     and e.quality<>'fixture' and e.captured_at<=observed_at order by e.captured_at desc,e.id limit 19
   ) e;
  source_evidence:=jsonb_build_array(jsonb_build_object('id',observation_id,'label','DAVID condition observation · '||rule.key,
   'source','strategy.v1/'||rule.key,'capturedAt',stamp,'quality','unknown'))||source_evidence;
  insert into public.product_records(id,workspace_id,kind,payload) values(finding_id,w.id,'work_opportunity',jsonb_build_object(
   'id',finding_id,'workspaceId',w.id,'title',rule.title,'affectedIds',to_jsonb(rule.affected_ids),'observedCondition',condition_text,
   'evidence',source_evidence,'hypothesis',rule.hypothesis,'agentId',rule.agent,'effortMinutes',rule.effort,'costMinor',null,
   'owner',owner_text,'evaluationRule','strategy.v1/'||rule.key||': compare retained response/status evidence with this dated baseline at review. Missing or insufficient evidence remains inconclusive; review does not authorize external actions.',
   'status','proposed','alternatives',jsonb_build_array('Wait for an authoritative source update','Ask the responsible source owner for the next step'),
   'baseline',condition_text,'target',rule.target,'reviewAt',to_char((observed_at+interval '7 days') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
  insert into public.audit_events(workspace_id,actor_id,event_type,entity_id,detail)
   values(w.id,auth.uid(),'finding.proposed',finding_id,jsonb_build_object('rule',rule.key,'affectedCount',rule.affected_count,
    'retainedCount',cardinality(rule.affected_ids),'observationEvidenceId',observation_id,'evaluatedAt',stamp,'policyId',policy_id,'outcomeAttributed',false));
  created_count:=created_count+1;
 end loop;
 select count(*) into active_count from public.product_records where workspace_id=w.id and kind='work_opportunity' and payload->>'status' in ('proposed','approved');
 return jsonb_build_object('created',created_count,'resolved',resolved_count,'active',active_count,'evaluatedAt',stamp);
end $$;

create function public.refresh_work_findings(p_workspace uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
 if coalesce(private.member_role(p_workspace),'') not in ('workspace_owner','david_operator') then
  raise exception 'Owner or assigned operator role required' using errcode='42501';
 end if;
 return private.refresh_work_findings(p_workspace);
end $$;

create function private.refresh_current_findings() returns jsonb
language plpgsql security definer set search_path='' as $$
declare workspace uuid; begin
 workspace:=private.current_workspace();
 if workspace is null or not exists(select 1 from public.runs r where r.id=private.current_run() and r.workspace_id=workspace and r.environment<>'fixture') then
  raise exception 'Bound nonfixture run required' using errcode='42501';
 end if;
 return private.refresh_work_findings(workspace);
end $$;

-- Retired findings cannot be approved through a stale browser. Repeated approval
-- of the same initiative is idempotent; no run/action/approval/mandate is created.
create or replace function public.approve_work_finding(p_workspace uuid,p_finding uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare f public.product_records; result uuid; data jsonb; begin
 if coalesce(private.member_role(p_workspace),'') not in ('workspace_owner','david_operator') then raise exception 'Owner role required' using errcode='42501'; end if;
 perform 1 from public.workspaces where id=p_workspace for update;
 -- Re-evaluate immediately so an unrefreshed browser cannot approve a condition
 -- that has already ended since the last brief/source refresh.
 if exists(select 1 from public.workspaces where id=p_workspace and environment<>'fixture') then
  perform private.refresh_work_findings(p_workspace);
 end if;
 select * into f from public.product_records where id=p_finding and workspace_id=p_workspace and kind='work_opportunity' for update;
 if f.id is null then raise exception 'Finding missing'; end if;
 select id into result from public.product_records where workspace_id=p_workspace and parent_id=f.id and kind='initiative';
 if result is not null then return result; end if;
 if f.payload->>'status' is distinct from 'proposed' then raise exception 'Only a current proposed finding may start an initiative'; end if;
 result:=gen_random_uuid();data:=jsonb_build_object('id',result,'workspaceId',p_workspace,'findingId',f.id,'title',f.payload->>'title','owner',f.payload->>'owner','baseline',f.payload->>'baseline','target',f.payload->>'target','reviewAt',f.payload->>'reviewAt','status','active','assignments',jsonb_build_array(f.payload->>'agentId'));
 insert into public.product_records(id,workspace_id,kind,parent_id,payload) values(result,p_workspace,'initiative',f.id,data);
 insert into public.product_records(workspace_id,kind,parent_id,payload) values(p_workspace,'assignment',result,jsonb_build_object('agentId',f.payload->>'agentId','bounds',f.payload->>'evaluationRule','status','awaiting_readiness'));
 update public.product_records set payload=jsonb_set(payload,'{status}','"approved"'::jsonb),version=version+1 where id=f.id;
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id) values(p_workspace,auth.uid(),'initiative_approved',result);
 return result;
end $$;

revoke all on function private.refresh_work_findings(uuid),private.refresh_current_findings() from public,anon,authenticated,david_worker,david_dispatcher,david_oauth;
revoke all on function public.refresh_work_findings(uuid),public.approve_work_finding(uuid,uuid) from public,anon,david_worker,david_dispatcher,david_oauth;
grant execute on function public.refresh_work_findings(uuid),public.approve_work_finding(uuid,uuid) to authenticated;
grant execute on function private.refresh_current_findings() to david_worker;
commit;
