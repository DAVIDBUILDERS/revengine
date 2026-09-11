begin;
create function private.block_run(p_reason text) returns void language plpgsql security definer set search_path='' as $$ begin
 update public.runs set status='blocked' where id=private.current_run() and workspace_id=private.current_workspace() and status not in ('completed','cancelled');
 insert into public.audit_events(workspace_id,event_type,entity_id,detail) values(private.current_workspace(),'run_blocked',private.current_run(),jsonb_build_object('reason',left(p_reason,500)));
end $$;
create function private.release_action_reservation(p_action uuid,p_token uuid,p_fence bigint) returns void language plpgsql security definer set search_path='' as $$
declare a public.actions; begin
 select * into a from public.actions where id=p_action and workspace_id=private.current_workspace() and run_id=private.current_run() for update;
 if a.id is null or a.status<>'not_attempted' or a.claim_token is distinct from p_token or a.fence<>p_fence or a.reserved_at is null then return; end if;
 update private.budget_counters set reserved_minor=greatest(0,reserved_minor-a.reserved_cost_minor),actions=greatest(0,actions-1) where workspace_id=a.workspace_id and day=a.reservation_day;
 update public.actions set reserved_at=null,claim_token=null,reservation_day=null where id=a.id;
end $$;
create function private.mark_connection_synced(p_connection uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from public.runs where id=private.current_run() and connection_id=p_connection and workspace_id=private.current_workspace()) then raise exception 'Connection binding denied'; end if;
 update public.connections set last_sync_at=now() where id=p_connection and workspace_id=private.current_workspace() and health='healthy';
end $$;
create function private.record_reply(p_connection uuid,p_contact uuid,p_event text,p_at timestamptz,p_class text,p_excerpt text) returns boolean language plpgsql security definer set search_path='' as $$
declare conv public.conversations; evidence_id uuid; opportunity_id uuid; begin
 if p_class not in ('positive','decline','opt_out','bounce','automatic','ambiguous') then raise exception 'Unknown reply class'; end if;
 select * into conv from public.conversations where workspace_id=private.current_workspace() and contact_id=p_contact and connection_id=p_connection and active for update;
 if conv.id is null or not private.receive_event(p_connection,p_event) then return false; end if;
 update public.conversations set replied_at=coalesce(replied_at,p_at),reply_class=case when last_reply_at is null or p_at>=last_reply_at then p_class else reply_class end,last_reply_at=greatest(coalesce(last_reply_at,p_at),p_at) where id=conv.id;
 if p_class in ('opt_out','bounce') then update public.contacts set suppressed=true where id=p_contact and workspace_id=conv.workspace_id; end if;
 update public.approvals set status='invalidated' where workspace_id=conv.workspace_id and action_id in(select id from public.actions where workspace_id=conv.workspace_id and contact_id=p_contact and type='send_follow_up' and status='not_attempted');
 update public.runs set status='waiting_for_input',next_due_at=null where workspace_id=conv.workspace_id and id=conv.run_id and status not in ('completed','cancelled');
 insert into public.evidence(workspace_id,label,source,quality,captured_at,content_hash) values(conv.workspace_id,'Enrolled Google reply: '||p_class,'gmail:'||p_event,'provider_verified',p_at,encode(extensions.digest(p_excerpt,'sha256'),'hex')) returning id into evidence_id;
 select p.opportunity_id into opportunity_id from public.actions a join public.proposals p on p.id=a.proposal_id and p.workspace_id=a.workspace_id where a.run_id=conv.run_id order by a.created_at desc limit 1;
 if p_class in ('positive','decline','opt_out','ambiguous') and opportunity_id is not null then
 insert into public.outcomes(workspace_id,opportunity_id,evidence_id,metric,stage,source,period_start,period_end,value,value_type,quality) values(conv.workspace_id,opportunity_id,evidence_id,'human_replies','reply','gmail:'||p_event,p_at,p_at,1,'count','provider_verified'); end if;
 insert into public.audit_events(workspace_id,event_type,entity_id,detail) values(conv.workspace_id,'reply_received',p_contact,jsonb_build_object('class',p_class,'evidence_id',evidence_id,'next_step','Assigned operator review'));
 return true;
end $$;
create function private.complete_action_evidence(p_action uuid,p_provider_id text,p_thread text) returns void language plpgsql security definer set search_path='' as $$
declare a public.actions; r public.runs; p public.proposals; e uuid; conv public.conversations; begin
 select * into a from public.actions where id=p_action and workspace_id=private.current_workspace() and run_id=private.current_run();
 if a.id is null or a.status not in ('provider_accepted','confirmed') then raise exception 'Accepted action required'; end if;
 if exists(select 1 from public.action_evidence where workspace_id=a.workspace_id and action_id=a.id) then return; end if;
 select * into r from public.runs where id=a.run_id;select * into p from public.proposals where id=a.proposal_id;
 insert into public.evidence(workspace_id,label,source,quality,captured_at) values(a.workspace_id,case when a.type='book_appointment' then 'Google Calendar confirmed booking' else 'Gmail API acceptance (delivery unknown)' end,case when a.type='book_appointment' then 'calendar:' else 'gmail:' end||p_provider_id,'provider_verified',now()) returning id into e;
 insert into public.action_evidence(workspace_id,action_id,evidence_id) values(a.workspace_id,a.id,e);
 select * into conv from public.conversations where workspace_id=a.workspace_id and contact_id=a.contact_id and active;
 if conv.id is null then
  insert into public.conversations(workspace_id,contact_id,run_id,connection_id,purpose,provider_thread_id,owner_agent_id) values(a.workspace_id,a.contact_id,r.id,r.connection_id,'proposal_follow_up',p_thread,(select agent_id from public.installations where id=a.installation_id)) returning * into conv;
 elsif p_thread is not null then update public.conversations set provider_thread_id=p_thread where id=conv.id; end if;
 if a.type='book_appointment' then
  update public.conversations set booked_at=now() where id=conv.id;
  insert into public.appointments(workspace_id,conversation_id,action_id,evidence_id,calendar_id,provider_event_id,starts_at,ends_at,time_zone) values(a.workspace_id,conv.id,a.id,e,a.payload->>'calendarId',p_provider_id,(a.payload->>'startAt')::timestamptz,(a.payload->>'endAt')::timestamptz,a.payload->>'timeZone') on conflict(workspace_id,calendar_id,provider_event_id) do nothing;
  insert into public.outcomes(workspace_id,opportunity_id,evidence_id,metric,stage,source,period_start,period_end,value,value_type,quality) values(a.workspace_id,p.opportunity_id,e,'verified_bookings','booked','calendar:'||p_provider_id,now(),now(),1,'count','provider_verified');
  update public.runs set status='completed',next_due_at=null where id=r.id;
 else update public.runs set status='waiting_for_reply',next_due_at=now()+interval '5 minutes' where id=r.id; end if;
end $$;
create function public.request_action_dispatch(p_action uuid,p_reconcile boolean) returns void language plpgsql security definer set search_path='' as $$
declare a public.actions; begin
 select * into a from public.actions where id=p_action;
 if a.id is null or coalesce(private.member_role(a.workspace_id),'') not in ('workspace_owner','david_operator') then raise exception 'Action permission denied' using errcode='42501'; end if;
 if p_reconcile and a.status not in ('submitting','uncertain') then return; end if;
 insert into private.outbox(workspace_id,run_id,event_type,dedupe_key,payload) values(a.workspace_id,a.run_id,case when p_reconcile then 'action_reconcile' else 'action_dispatch' end,case when p_reconcile then 'reconcile:' else 'dispatch:' end||a.id||':'||date_trunc('minute',now())::text,jsonb_build_object('action_id',a.id)) on conflict do nothing;
end $$;
create function public.approve_work_finding(p_workspace uuid,p_finding uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare f public.product_records; result uuid; data jsonb; begin
 if coalesce(private.member_role(p_workspace),'') not in ('workspace_owner','david_operator') then raise exception 'Owner role required' using errcode='42501'; end if;
 select * into f from public.product_records where id=p_finding and workspace_id=p_workspace and kind='work_opportunity' for update;
 if f.id is null then raise exception 'Finding missing'; end if;
 select id into result from public.product_records where workspace_id=p_workspace and parent_id=f.id and kind='initiative';if result is not null then return result; end if;
 result:=gen_random_uuid();data:=jsonb_build_object('id',result,'workspaceId',p_workspace,'findingId',f.id,'title',f.payload->>'title','owner',f.payload->>'owner','baseline',f.payload->>'baseline','target',f.payload->>'target','reviewAt',f.payload->>'reviewAt','status','active','assignments',jsonb_build_array(f.payload->>'agentId'));
 insert into public.product_records(id,workspace_id,kind,parent_id,payload) values(result,p_workspace,'initiative',f.id,data);
 insert into public.product_records(workspace_id,kind,parent_id,payload) values(p_workspace,'assignment',result,jsonb_build_object('agentId',f.payload->>'agentId','bounds',f.payload->>'evaluationRule','status','awaiting_readiness'));
 update public.product_records set payload=jsonb_set(payload,'{status}','"approved"'::jsonb) where id=f.id;
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id) values(p_workspace,auth.uid(),'initiative_approved',result);return result;
end $$;
create function public.review_initiative(p_workspace uuid,p_initiative uuid,p_result text) returns void language plpgsql security definer set search_path='' as $$ begin
 if coalesce(private.member_role(p_workspace),'') not in ('workspace_owner','david_operator') then raise exception 'Owner role required' using errcode='42501'; end if;
 if p_result not in ('supported','unsupported','inconclusive') then raise exception 'Invalid evaluation'; end if;
 update public.product_records set payload=jsonb_set(payload,'{status}',to_jsonb(p_result)) where id=p_initiative and workspace_id=p_workspace and kind='initiative';if not found then raise exception 'Initiative missing'; end if;
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id,detail) values(p_workspace,auth.uid(),'initiative_reviewed',p_initiative,jsonb_build_object('reported_result',p_result));
end $$;
create function private.workspace_metrics(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb:='[]'; metric record; total numeric; ids jsonb; unit text; missing boolean; n integer; currencies integer; currency_code text; value_kinds integer; has_unknown_kind boolean; has_manual boolean; begin
 for metric in select * from (values ('reply','human_replies','Human replies','count'),('booked','verified_bookings','Verified bookings','count'),('attended','attended_meetings','Held meetings','count'),('signed','signed_value','Won business','money_minor'),('paid','collected_revenue','Collected revenue','money_minor')) as m(stage,key,label,kind) loop
  with ranked as (select o.*,dense_rank() over(partition by opportunity_id,stage,value_type order by period_end desc) as rank from public.outcomes o where o.workspace_id=p_workspace and o.quality<>'fixture' and o.stage=metric.stage and o.value_type=metric.kind and o.period_end<=now()),
  current as (select opportunity_id,case when count(value)=count(*) and min(value)=max(value) and bool_and(quality<>'unknown') and (metric.kind<>'count' or min(value) in (0,1)) and (metric.kind<>'money_minor' or (min(value)=trunc(min(value)) and min(value)>=0 and min(value)<=9007199254740991)) then min(value) else null end as value,
   case when count(currency)=count(*) and min(currency)=max(currency) then min(currency) else null end as currency from ranked where rank=1 group by opportunity_id)
  select count(*),sum(value),(count(value)<>count(*) or (metric.kind='money_minor' and count(currency)<>count(*))),count(distinct currency),min(currency) into n,total,missing,currencies,currency_code from current;
  if missing or (metric.kind='money_minor' and (n=0 or currencies<>1 or currency_code is null)) or (metric.stage='attended' and n=0) then total:=null;
  elsif n=0 then total:=0; end if;
  if total>9007199254740991 then total:=null;missing:=true;end if;
  select coalesce(jsonb_agg(distinct o.evidence_id),'[]') into ids from public.outcomes o where o.workspace_id=p_workspace and o.quality<>'fixture' and o.stage=metric.stage and o.value_type=metric.kind and o.period_end=(select max(x.period_end) from public.outcomes x where x.workspace_id=o.workspace_id and x.opportunity_id=o.opportunity_id and x.stage=o.stage and x.value_type=o.value_type and x.quality<>'fixture' and x.period_end<=now());
  select exists(select 1 from public.outcomes o where o.workspace_id=p_workspace and o.stage=metric.stage and o.quality='manually_reported') into has_manual;
  if metric.stage='signed' and total is not null then
   with signed_opportunities as (select distinct opportunity_id from public.outcomes where workspace_id=p_workspace and stage='signed' and value_type='money_minor' and quality<>'fixture' and period_end<=now()),
   ranked_proposals as (select pp.*,dense_rank() over(partition by pp.opportunity_id,pp.reference order by pp.version desc) as version_rank from public.proposals pp where pp.workspace_id=p_workspace and not pp.fixture),
   current_kinds as (select opportunity_id,reference,case when min(value_kind)=max(value_kind) and min(status)=max(status) then min(value_kind) else 'unknown' end as value_kind from ranked_proposals where version_rank=1 group by opportunity_id,reference)
   select count(distinct p.value_kind),coalesce(bool_or(p.value_kind is null or p.value_kind='unknown'),true) into value_kinds,has_unknown_kind from signed_opportunities o left join current_kinds p on p.opportunity_id=o.opportunity_id;
   if value_kinds<>1 or has_unknown_kind then total:=null;missing:=true; end if;
  end if;
  unit:=case when metric.kind='count' then 'count' when currencies=1 and currency_code is not null then currency_code||' minor' else 'money unavailable' end;
  result:=result||jsonb_build_array(jsonb_build_object('key',metric.key,'label',metric.label,'value',total,'unit',unit,'stage',metric.stage,'evidenceIds',ids,'limitation',case when metric.stage='attended' then 'Attendance requires separate evidence or a labeled responsible-person confirmation.' when metric.kind='money_minor' and total is null then 'Financial source is missing, conflicting, mixes currencies or contract value kinds; unavailable, not zero.' when metric.kind='money_minor' and has_manual then 'Includes manually reported evidence; no independent verification or causal incrementality claim.' when metric.kind='money_minor' then 'Latest observed stage snapshots per opportunity; no causal incrementality claim.' when missing then 'Conflicting or unknown current evidence; resolve the stage observation.' when has_manual then 'Includes manually reported evidence; not independently verified.' else null end));
 end loop;
 result:=result||jsonb_build_array(jsonb_build_object('key','gross_profit','label','Customer gross profit','value',null,'unit','money unavailable','stage','profit','evidenceIds','[]'::jsonb,'limitation','Fulfillment costs and collection evidence are not connected.'));
 for metric in with ranked as (select p.*,dense_rank() over(partition by opportunity_id,reference order by version desc) as rank from public.proposals p where p.workspace_id=p_workspace and not p.fixture),
 current as (select opportunity_id,reference,min(currency) currency,min(value_kind) value_kind,case when count(amount_minor)=count(*) and min(amount_minor)=max(amount_minor) and min(currency)=max(currency) and min(value_kind)=max(value_kind) then min(amount_minor) else null end amount_minor,case when min(status)=max(status) then min(status) else 'unknown' end status from ranked where rank=1 group by opportunity_id,reference)
 select currency,value_kind,sum(amount_minor) total,count(amount_minor)<>count(*) missing from current where status='open' group by currency,value_kind loop
  result:=result||jsonb_build_array(jsonb_build_object('key','pipeline_'||metric.currency||'_'||metric.value_kind,'label','Open proposal value · '||replace(metric.currency||'_'||metric.value_kind,'_',' '),'value',case when metric.missing or metric.value_kind='unknown' or metric.total>9007199254740991 then null else metric.total end,'unit',metric.currency||' minor','stage','pipeline','evidenceIds','[]'::jsonb,'limitation','Latest proposal versions only. Pipeline is potential value, not won or collected revenue. Unknown amounts remain unavailable; stale records are flagged.'));
 end loop;
 select count(distinct a.id) into n from public.actions a join public.receipts r on r.workspace_id=a.workspace_id and r.action_id=a.id where a.workspace_id=p_workspace and a.status in ('provider_accepted','confirmed') and r.provider='google' and r.status in ('provider_accepted','confirmed');
 select coalesce(jsonb_agg(distinct ae.evidence_id),'[]') into ids from public.action_evidence ae join public.actions a on a.workspace_id=ae.workspace_id and a.id=ae.action_id where a.workspace_id=p_workspace and a.status in ('provider_accepted','confirmed');
 result:=result||jsonb_build_array(jsonb_build_object('key','accepted_actions','label','Provider-accepted actions','value',n,'unit','count','stage','provider_acceptance','evidenceIds',ids,'limitation','Email acceptance does not establish delivery.'));
 select count(*) into n from public.prepared_artifacts a where a.workspace_id=p_workspace and not exists(select 1 from jsonb_array_elements(a.source_snapshot) e where e->>'quality'='fixture');
 select coalesce(jsonb_agg(distinct ae.evidence_id),'[]') into ids from public.artifact_evidence ae join public.evidence e on e.workspace_id=ae.workspace_id and e.id=ae.evidence_id where ae.workspace_id=p_workspace and e.quality<>'fixture';
 return result||jsonb_build_array(jsonb_build_object('key','prepared_artifacts','label','Saved preparation artifacts','value',n,'unit','count','stage','preparation','evidenceIds',ids,'limitation','Drafts are internal work, not external actions or business outcomes.'));
end $$;
create function public.read_workspace_metrics(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if private.member_role(p_workspace) is null then raise exception 'Workspace access denied' using errcode='42501'; end if;
 return private.workspace_metrics(p_workspace);
end $$;
create function public.save_weekly_brief(p_workspace uuid,p_snapshot jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid; metrics jsonb; evidence jsonb; decisions jsonb; snapshot jsonb; begin
 if coalesce(private.member_role(p_workspace),'') not in ('workspace_owner','david_operator') then raise exception 'Owner role required' using errcode='42501'; end if;
 if p_snapshot is null or p_snapshot->>'workspaceId' is distinct from p_workspace::text or p_snapshot->>'id' is null then raise exception 'Invalid brief binding'; end if;
 rid:=(p_snapshot->>'id')::uuid;
 -- Client/model totals, evidence, as-of time and narrative are never accepted as verified observations.
 metrics:=private.workspace_metrics(p_workspace);
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'label',e.label,'source',e.source,'capturedAt',to_char(e.captured_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'quality',e.quality)),'[]') into evidence from public.evidence e where e.workspace_id=p_workspace and e.quality<>'fixture' and e.id in(select eid.value::uuid from jsonb_array_elements(metrics) metric_row(value) cross join lateral jsonb_array_elements_text(metric_row.value->'evidenceIds') eid(value));
 select coalesce(jsonb_agg(title),'[]') into decisions from (select payload->>'title' title from public.product_records where workspace_id=p_workspace and kind='work_opportunity' and payload->>'status'='proposed' order by created_at limit 3) d;
 snapshot:=jsonb_build_object('id',rid,'workspaceId',p_workspace,'asOf',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'metrics',metrics,'evidence',evidence,'limitations',jsonb_build_array('Recorded evidence only; source/account coverage and currentness require review.','Email acceptance does not prove delivery; booking does not prove attendance.','Financial return requires separate payment, cost and attribution evidence.'),'decisions',decisions,'commitments',jsonb_build_array('Review waiting replies and uncertain actions with the assigned operator.'),'narrativeVersion','database-metrics.v1','narrative','This immutable brief uses current database observations and their linked evidence. Missing stages remain unavailable. No causal uplift or financial return is inferred.');
 insert into public.product_records(id,workspace_id,kind,payload) values(rid,p_workspace,'brief_snapshot',snapshot);
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id) values(p_workspace,auth.uid(),'brief_frozen',rid);return rid;
end $$;
revoke all on function private.workspace_metrics(uuid) from public,anon,authenticated;
revoke all on function public.read_workspace_metrics(uuid) from public,anon;
grant execute on function public.read_workspace_metrics(uuid) to authenticated;
revoke all on function private.block_run(text),private.release_action_reservation(uuid,uuid,bigint),private.mark_connection_synced(uuid),private.record_reply(uuid,uuid,text,timestamptz,text,text),private.complete_action_evidence(uuid,text,text) from public,anon,authenticated;
grant execute on function private.block_run(text),private.release_action_reservation(uuid,uuid,bigint),private.mark_connection_synced(uuid),private.record_reply(uuid,uuid,text,timestamptz,text,text),private.complete_action_evidence(uuid,text,text) to david_worker;
revoke all on function public.request_action_dispatch(uuid,boolean),public.approve_work_finding(uuid,uuid),public.review_initiative(uuid,uuid,text),public.save_weekly_brief(uuid,jsonb) from public,anon;
grant execute on function public.request_action_dispatch(uuid,boolean),public.approve_work_finding(uuid,uuid),public.review_initiative(uuid,uuid,text),public.save_weekly_brief(uuid,jsonb) to authenticated;
commit;
