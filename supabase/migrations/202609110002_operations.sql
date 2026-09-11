begin;
create function public.decide_action(p_action_id uuid,p_decision text,p_payload_hash text) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.actions; d public.approvals; m public.memberships; begin
 if auth.uid() is null or p_decision is null or p_decision not in ('approved','rejected') or p_payload_hash is null then raise exception 'Unauthorized decision' using errcode='42501'; end if;
 select * into a from public.actions where id=p_action_id for update;
 select * into m from public.memberships where workspace_id=a.workspace_id and actor_id=auth.uid() and active;
 if m.id is null or coalesce(private.member_role(a.workspace_id),'') not in ('workspace_owner','david_operator') then raise exception 'Approval role required' using errcode='42501'; end if;
 select * into d from public.approvals where workspace_id=a.workspace_id and action_id=a.id for update;
 if d.id is null or d.payload_hash is distinct from p_payload_hash or a.payload_hash is distinct from p_payload_hash then raise exception 'Approval payload changed'; end if;
 if d.status=p_decision then return d.id; end if;
 if d.status <> 'pending' or d.expires_at <= now() or a.expires_at <= now() or a.status <> 'not_attempted' then raise exception 'Approval is no longer actionable'; end if;
 update public.approvals set status=p_decision, approver_id=m.id, decided_at=now() where id=d.id;
 insert into private.outbox(workspace_id,run_id,event_type,dedupe_key,payload) values(a.workspace_id,a.run_id,'approval_decided','approval:'||d.id,jsonb_build_object('action_id',a.id,'approval_id',d.id)) on conflict(workspace_id,dedupe_key) do nothing;
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id,detail) values(a.workspace_id,auth.uid(),'approval_'||p_decision,a.id,jsonb_build_object('payload_hash',a.payload_hash));
 return d.id;
end $$;
create function public.set_workspace_pause(p_workspace_id uuid,p_paused boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(private.member_role(p_workspace_id),'') not in ('workspace_owner','david_operator') then raise exception 'Owner role required' using errcode='42501'; end if;
 if not p_paused then raise exception 'Resume requires a readiness-reviewed activation; use the activation service'; end if;
 update public.workspaces set paused=true where id=p_workspace_id;
 update public.runs set status='paused' where workspace_id=p_workspace_id and status in ('scheduled','awaiting_approval','waiting_for_reply');
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(p_workspace_id,auth.uid(),'workspace_paused','{}');
end $$;
create function public.set_contact_takeover(p_contact_id uuid,p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
declare w uuid; begin
 select workspace_id into w from public.contacts where id=p_contact_id;
 if auth.uid() is null or coalesce(private.member_role(w),'') not in ('workspace_owner','david_operator') then raise exception 'Owner role required' using errcode='42501'; end if;
 update public.contacts set human_takeover=p_enabled where id=p_contact_id;
 update public.conversations set takeover=p_enabled,fence=fence+1 where workspace_id=w and contact_id=p_contact_id and active;
 if p_enabled then update public.runs set status='cancelled' where workspace_id=w and id in(select run_id from public.conversations where workspace_id=w and contact_id=p_contact_id) and status in ('scheduled','awaiting_approval','waiting_for_reply'); end if;
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id,detail) values(w,auth.uid(),'contact_takeover',p_contact_id,jsonb_build_object('enabled',p_enabled));
end $$;
create function private.create_action(p_id uuid,p_contact uuid,p_proposal uuid,p_type text,p_payload jsonb,p_hash text,p_policy uuid,p_cost bigint,p_expires timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.runs; p public.proposals; begin
 select * into r from public.runs where id=private.current_run() and workspace_id=private.current_workspace();
 select * into p from public.proposals where id=p_proposal and workspace_id=r.workspace_id;
 if r.id is null or p.id is null or p.contact_id is distinct from p_contact or p_type is null or p_payload is null or p_cost is null or p_expires is null or p_type not in ('send_follow_up','book_appointment') or p_expires <= now() or p_cost < 0 then raise exception 'Invalid action binding'; end if;
 if p_payload->>'recipient' is distinct from (select email from public.contacts where id=p_contact and workspace_id=r.workspace_id) or (p_payload->>'proposalVersion')::integer is distinct from p.version then raise exception 'Invalid recipient/version'; end if;
 insert into public.actions(id,workspace_id,installation_id,run_id,contact_id,proposal_id,type,payload,source_snapshot,payload_hash,proposal_version,policy_id,reserved_cost_minor,expires_at)
 values(p_id,r.workspace_id,r.installation_id,r.id,p_contact,p_proposal,p_type,p_payload,jsonb_build_object('proposal_id',p.source_key,'contact_email',p_payload->>'recipient','owner',p.owner,'scope_summary',p.scope_summary,'version',p.version,'valid_until',p.valid_until,'currency',p.currency,'amount_minor',p.amount_minor,'value_kind',p.value_kind,'issued_at',p.issued_at),p_hash,p.version,p_policy,p_cost,p_expires)
 on conflict(workspace_id,run_id,type,payload_hash) do nothing;
 select id into p_id from public.actions where workspace_id=r.workspace_id and run_id=r.id and type=p_type and payload_hash=p_hash;
 insert into public.approvals(workspace_id,action_id,payload_hash,expires_at) values(r.workspace_id,p_id,p_hash,p_expires) on conflict(workspace_id,action_id) do nothing;
 update public.runs set status='awaiting_approval' where id=r.id;
 return p_id;
end $$;
-- 017 extends this narrow authority decision with current reviewed standing mandates.
create function private.action_authority(p_action uuid) returns text
language plpgsql security definer set search_path='' as $$
declare a public.actions; ap public.approvals; begin
 select * into a from public.actions where id=p_action and workspace_id=private.current_workspace() and run_id=private.current_run();
 if a.id is null then return 'missing'; end if;
 select * into ap from public.approvals where workspace_id=a.workspace_id and action_id=a.id;
 if ap.id is null then return 'missing'; end if;
 if ap.status in ('rejected','invalidated') then return ap.status; end if;
 if a.expires_at<=now() or ap.expires_at<=now() then return 'expired'; end if;
 if ap.payload_hash is distinct from a.payload_hash then return 'invalidated'; end if;
 return ap.status;
end $$;
create function private.action_ready(p_action uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare a public.actions; w public.workspaces; c public.contacts; p public.proposals; r public.runs; i public.installations; conv public.conversations; authority boolean; la public.live_activations; bounds jsonb; local_clock timestamp; begin
 select * into a from public.actions where id=p_action and workspace_id=private.current_workspace() and run_id=private.current_run();
 if a.id is null then return false; end if;
 select * into w from public.workspaces where id=a.workspace_id;
 select * into c from public.contacts where id=a.contact_id and workspace_id=a.workspace_id;
 select * into p from public.proposals where id=a.proposal_id and workspace_id=a.workspace_id;
 select * into r from public.runs where id=a.run_id;
 select * into i from public.installations where id=a.installation_id;
 select * into conv from public.conversations where workspace_id=a.workspace_id and contact_id=a.contact_id and active;
 if w.paused or w.environment<>'live' or r.environment<>'live' or p.fixture or c.suppressed or not c.enrolled or c.human_takeover
   or p.status<>'open' or p.version<>a.proposal_version or (p.valid_until is not null and p.valid_until<=now())
   or a.expires_at<=now() or i.status in ('paused','blocked','failed','selected','connection_expired') or i.policy_id is distinct from a.policy_id
   or r.status in ('paused','cancelled','completed','failed','blocked') or (select count(*) from public.installations where workspace_id=w.id and status<>'paused')>w.entitlement
   or p.source_verified_at < now()-make_interval(secs=>(select freshness_seconds from public.connections where workspace_id=w.id and id=(select connection_id from public.source_bindings where id=p.source_binding_id)))
   or not exists(select 1 from public.connections where id=r.connection_id and workspace_id=w.id and health='healthy')
   or (conv.id is not null and (conv.takeover or conv.run_id<>r.id or conv.booked_at is not null or (conv.replied_at is not null and a.type='send_follow_up')))
 then return false; end if;
 select activation.* into la from public.live_activations activation join public.memberships m on m.id=activation.operator_membership_id and m.workspace_id=activation.workspace_id
  join public.connections cn on cn.workspace_id=activation.workspace_id and cn.id=activation.sender_connection_id
  where activation.workspace_id=w.id and activation.sender_connection_id=r.connection_id and activation.policy_id=a.policy_id and activation.revoked_at is null and activation.expires_at>now()
  and activation.cohort_id=c.cohort_id and activation.sender=cn.identity and m.active and m.role='david_operator' order by activation.expires_at desc limit 1;
 if la.id is null then return false; end if;
 select pol.bounds into bounds from public.policies pol where pol.id=a.policy_id and pol.workspace_id=w.id;
 local_clock:=now() at time zone w.time_zone;
 if not coalesce(la.staffed_hours->'days' @> to_jsonb(array[extract(isodow from local_clock)::integer]),false)
  or not coalesce(extract(hour from local_clock)>=(la.staffed_hours->>'startHour')::integer and extract(hour from local_clock)<(la.staffed_hours->>'endHour')::integer,false)
  or (a.type='send_follow_up' and c.last_contact_at is not null and c.last_contact_at>now()-make_interval(mins=>coalesce((bounds->>'minContactIntervalMinutes')::integer,1440)))
  or not exists(select 1 from public.connections cn where cn.id=r.connection_id and cn.workspace_id=w.id and cn.last_sync_at>now()-make_interval(secs=>coalesce((bounds->>'replyFreshnessSeconds')::integer,120))
    and 'gmail.read'=any(cn.operations) and (case when a.type='send_follow_up' then 'gmail.send'=any(cn.operations) else 'calendar.book'=any(cn.operations) and 'calendar.freebusy'=any(cn.operations) end))
  or (a.type='book_appointment' and (conv.id is null or conv.reply_class is distinct from 'positive'))
  or (a.type='book_appointment' and not exists(select 1 from public.source_bindings sb where sb.workspace_id=w.id and sb.connection_id=r.connection_id and sb.resource_type='calendar' and sb.resource_id=a.payload->>'calendarId' and sb.verified_at is not null))
 then return false; end if;
 authority:=private.action_authority(a.id) in ('approved','mandated');
 return authority;
end $$;
create function private.reserve_action(p_action uuid) returns table(claim_token uuid,fence bigint)
language plpgsql security definer set search_path='' as $$
declare a public.actions; w public.workspaces; b private.budget_counters; token uuid; begin
 select * into a from public.actions where id=p_action and workspace_id=private.current_workspace() and run_id=private.current_run() for update;
 if a.id is null or a.status<>'not_attempted' or a.reserved_at is not null or not private.action_ready(a.id) then return; end if;
 -- Serialize contact claims independently of any network operation.
 perform pg_advisory_xact_lock(hashtextextended(a.workspace_id::text||':'||lower(a.payload->>'recipient'),0));
 perform 1 from public.contacts where workspace_id=a.workspace_id and id=a.contact_id for update;
 if exists(select 1 from public.actions x where x.workspace_id=a.workspace_id and (x.contact_id=a.contact_id or lower(x.payload->>'recipient')=lower(a.payload->>'recipient')) and x.id<>a.id and (x.status in ('submitting','uncertain') or (x.status='not_attempted' and x.reserved_at is not null))) then return; end if;
 select * into w from public.workspaces where id=a.workspace_id for update;
 if not coalesce(private.action_ready(a.id),false) then return; end if;
 insert into private.budget_counters(workspace_id,day) values(a.workspace_id,(now() at time zone 'UTC')::date) on conflict do nothing;
 select * into b from private.budget_counters where workspace_id=a.workspace_id and day=(now() at time zone 'UTC')::date for update;
 if b.actions>=w.daily_limit or b.reserved_minor+b.spent_minor+a.reserved_cost_minor>w.daily_budget_minor then return; end if;
 if (select count(*) from public.actions where workspace_id=a.workspace_id and installation_id=a.installation_id and reserved_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC') >= (select daily_capacity from public.installations where id=a.installation_id) then return; end if;
 token:=gen_random_uuid();
 update private.budget_counters set actions=actions+1,reserved_minor=reserved_minor+a.reserved_cost_minor where workspace_id=b.workspace_id and day=b.day;
 update public.actions set reserved_at=now(),reservation_day=b.day,claim_token=token,fence=actions.fence+1 where id=a.id;
 return query select token,a.fence+1;
end $$;
create function private.mark_submitting(p_action uuid,p_token uuid,p_fence bigint) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 -- Taking the workspace lock gives a pause a well-defined ordering before dispatch.
 perform 1 from public.workspaces where id=private.current_workspace() for update;
 if not private.action_ready(p_action) then return false; end if;
 update public.actions set status='submitting',submitting_at=now() where id=p_action and workspace_id=private.current_workspace() and run_id=private.current_run()
  and status='not_attempted' and claim_token=p_token and fence=p_fence and reserved_at is not null;
 return found;
end $$;
create function private.record_receipt(p_action uuid,p_token uuid,p_fence bigint,p_status text,p_provider text,p_provider_id text,p_message text,p_cost bigint) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.actions; result uuid; begin
 select * into a from public.actions where id=p_action and workspace_id=private.current_workspace() and run_id=private.current_run() for update;
 if a.id is null or a.claim_token is distinct from p_token or a.fence<>p_fence then raise exception 'Stale action fence'; end if;
 if p_status not in ('provider_accepted','confirmed','failed','uncertain') or p_cost<0 or p_cost>a.reserved_cost_minor then raise exception 'Invalid receipt'; end if;
 if a.status=p_status then select id into result from public.receipts where action_id=a.id order by observed_at desc limit 1; return result; end if;
 if a.status not in ('submitting','uncertain') or (a.status='uncertain' and p_status='failed') then raise exception 'Receipt transition requires reconciliation'; end if;
 insert into public.receipts(workspace_id,action_id,status,provider,provider_id,message,reconciliation) values(a.workspace_id,a.id,p_status,p_provider,p_provider_id,left(p_message,500),case when p_status='uncertain' then 'pending' when a.status='uncertain' then 'resolved' else 'not_required' end) returning id into result;
 update public.actions set status=p_status where id=a.id;
 if p_status<>'uncertain' then
  update private.budget_counters set reserved_minor=reserved_minor-a.reserved_cost_minor,spent_minor=spent_minor+p_cost where workspace_id=a.workspace_id and day=a.reservation_day;
  update public.actions set reserved_cost_minor=p_cost where id=a.id;
 end if;
 if p_status in ('provider_accepted','confirmed') then
  update public.contacts set last_contact_at=now() where workspace_id=a.workspace_id and id=a.contact_id;
  update public.installations set last_business_action_at=now() where id=a.installation_id;
 end if;
 insert into public.audit_events(workspace_id,event_type,entity_id,detail) values(a.workspace_id,'action_'||p_status,a.id,jsonb_build_object('receipt_id',result));
 return result;
end $$;
create function private.claim_run(p_workflow_id text) returns bigint language plpgsql security definer set search_path='' as $$
declare result bigint; begin
 update public.runs set workflow_claim=p_workflow_id,workflow_id=coalesce(workflow_id,p_workflow_id),claim_until=now()+interval '2 minutes',fence=fence+1,status='processing'
 where id=private.current_run() and workspace_id=private.current_workspace() and status not in ('cancelled','completed','paused','failed','blocked')
 and (workflow_claim is null or workflow_claim=p_workflow_id) returning fence into result;
 return result;
end $$;
create function private.register_wait(p_action uuid,p_hook text,p_expires timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare a public.actions; d public.approvals; begin
 select * into a from public.actions where id=p_action and workspace_id=private.current_workspace() and run_id=private.current_run();
 if a.id is null or p_expires<=now() then raise exception 'Invalid wait'; end if;
 select * into d from public.approvals where action_id=a.id and workspace_id=a.workspace_id for update;
 insert into private.wait_registrations(workspace_id,run_id,action_id,hook_token,expires_at) values(a.workspace_id,a.run_id,a.id,p_hook,p_expires)
 on conflict(workspace_id,action_id) do update set hook_token=excluded.hook_token,expires_at=excluded.expires_at,delivered_at=null;
 -- A decision may precede hook registration: enqueue another delivery, never lose it.
 if d.status<>'pending' then insert into private.outbox(workspace_id,run_id,event_type,dedupe_key,payload) values(a.workspace_id,a.run_id,'approval_decided','wait:'||a.id||':'||md5(p_hook),jsonb_build_object('action_id',a.id,'approval_id',d.id)) on conflict do nothing; end if;
end $$;
create function private.pending_hook(p_action uuid) returns table(hook_token text,decision text) language sql security definer set search_path='' as $$
 select w.hook_token,a.status from private.wait_registrations w join public.approvals a on a.workspace_id=w.workspace_id and a.action_id=w.action_id
 where w.workspace_id=private.current_workspace() and w.run_id=private.current_run() and w.action_id=p_action and w.expires_at>now() and a.status<>'pending' and w.delivered_at is null
$$;
create function private.complete_hook(p_action uuid) returns void language sql security definer set search_path='' as $$
 update private.wait_registrations set delivered_at=now() where workspace_id=private.current_workspace() and run_id=private.current_run() and action_id=p_action
$$;
create function private.receive_event(p_connection uuid,p_event text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.runs where id=private.current_run() and connection_id=p_connection) then raise exception 'Event connection mismatch'; end if;
 insert into private.inbox(workspace_id,connection_id,provider_event_id,run_id) values(private.current_workspace(),p_connection,p_event,private.current_run()) on conflict do nothing;
 return found;
end $$;
create function private.checkpoint_source(p_binding uuid,p_cursor jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.source_bindings s join public.runs r on r.workspace_id=s.workspace_id and r.connection_id=s.connection_id where s.id=p_binding and r.id=private.current_run() and s.workspace_id=private.current_workspace()) then raise exception 'Source binding mismatch'; end if;
 insert into private.source_cursors(workspace_id,source_binding_id,cursor) values(private.current_workspace(),p_binding,p_cursor) on conflict(workspace_id,source_binding_id) do update set cursor=excluded.cursor,checkpointed_at=now();
end $$;
create function private.claim_due(p_limit integer default 25) returns table(outbox_id uuid,run_id uuid,event_type text,payload jsonb,lease_token uuid)
language plpgsql security definer set search_path='' as $$
begin
 if p_limit<1 or p_limit>100 then raise exception 'Batch limit 1..100'; end if;
 delete from private.transaction_context where created_at<now()-interval '1 day';
 -- next_due_at remains a persisted clock; a missed tick is recovered here.
 insert into private.outbox(workspace_id,run_id,event_type,dedupe_key,payload)
 select r.workspace_id,r.id,'run_due','due:'||r.id||':'||r.next_due_at::text,'{}' from public.runs r join public.workspaces w on w.id=r.workspace_id
 where r.next_due_at<=now() and r.status in ('scheduled','waiting_for_reply') and r.definition_version<>'connection-check-v1' and not w.paused on conflict do nothing;
 -- A crash after submitting must enter reconciliation; it is never reset to ready.
 update public.actions set status='uncertain' where status='submitting' and submitting_at<now()-interval '2 minutes';
 update public.runs set status='blocked' where id in(select r.run_id from private.wait_registrations r where r.expires_at<=now() and r.delivered_at is null) and status='awaiting_approval';
 return query with claims as (
  select o.id from private.outbox o join public.workspaces w on w.id=o.workspace_id where o.dispatched_at is null and o.due_at<=now()
  and (o.lease_until is null or o.lease_until<now()) and o.attempts<8 and (not w.paused or o.event_type in ('approval_decided','connection_check'))
  order by o.due_at limit p_limit for update of o skip locked
 ) update private.outbox o set lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds',attempts=attempts+1 from claims where o.id=claims.id
 returning o.id,o.run_id,o.event_type,o.payload,o.lease_token;
end $$;
create function private.finish_dispatch(p_outbox uuid,p_lease uuid,p_workflow text) returns boolean language plpgsql security definer set search_path='' as $$
declare rid uuid; begin
 update private.outbox set dispatched_at=now(),lease_until=null where id=p_outbox and lease_token=p_lease and dispatched_at is null returning run_id into rid;
 if rid is null then return false; end if;
 if p_workflow is not null then update public.runs set workflow_id=coalesce(workflow_id,p_workflow) where id=rid; end if;
 return true;
end $$;
create function private.retry_dispatch(p_outbox uuid,p_lease uuid,p_reason text) returns void language sql security definer set search_path='' as $$
 update private.outbox set lease_until=null,due_at=now()+least(interval '1 hour',interval '15 seconds'*power(2,attempts)),last_error=left(p_reason,200)
 where id=p_outbox and lease_token=p_lease and dispatched_at is null
$$;
revoke all on all functions in schema private from public,anon,authenticated,david_worker,david_dispatcher;
grant execute on function private.member_role(uuid) to authenticated;
grant execute on function private.current_workspace(),private.current_run(),private.bind_run(uuid,uuid),private.create_action(uuid,uuid,uuid,text,jsonb,text,uuid,bigint,timestamptz),private.reserve_action(uuid),private.mark_submitting(uuid,uuid,bigint),private.record_receipt(uuid,uuid,bigint,text,text,text,text,bigint),private.claim_run(text),private.register_wait(uuid,text,timestamptz),private.pending_hook(uuid),private.complete_hook(uuid),private.receive_event(uuid,text),private.checkpoint_source(uuid,jsonb) to david_worker;
grant execute on function private.route_run(uuid),private.claim_due(integer),private.finish_dispatch(uuid,uuid,text),private.retry_dispatch(uuid,uuid,text) to david_dispatcher;
revoke all on function public.decide_action(uuid,text,text),public.set_workspace_pause(uuid,boolean),public.set_contact_takeover(uuid,boolean) from public,anon;
grant execute on function public.decide_action(uuid,text,text),public.set_workspace_pause(uuid,boolean),public.set_contact_takeover(uuid,boolean) to authenticated;
commit;
