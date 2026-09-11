-- Hosted Supabase transaction test using synthetic source rows; no provider I/O.
-- Static parsing of this file is not a claim that these assertions were executed.
begin;
insert into auth.users(id,email) values
 ('a6000000-0000-4000-8000-000000000001','strategy-owner@example.invalid'),
 ('b6000000-0000-4000-8000-000000000001','strategy-other-owner@example.invalid'),
 ('a6000000-0000-4000-8000-000000000002','strategy-viewer@example.invalid'),
 ('a6000000-0000-4000-8000-000000000003','strategy-operator@example.invalid');
insert into public.workspaces(id,name,environment,business_model,time_zone,currency) values
 ('a6000000-0000-4000-8000-000000000010','Strategy synthetic test A','live','b2b_services','America/Denver','USD'),
 ('b6000000-0000-4000-8000-000000000010','Strategy synthetic test B','live','home_services','UTC','USD');
insert into public.memberships(id,workspace_id,actor_id,role) values
 ('a6000000-0000-4000-8000-000000000020','a6000000-0000-4000-8000-000000000010','a6000000-0000-4000-8000-000000000001','workspace_owner'),
 ('a6000000-0000-4000-8000-000000000021','a6000000-0000-4000-8000-000000000010','a6000000-0000-4000-8000-000000000002','workspace_viewer'),
 ('a6000000-0000-4000-8000-000000000022','a6000000-0000-4000-8000-000000000010','a6000000-0000-4000-8000-000000000003','david_operator'),
 ('b6000000-0000-4000-8000-000000000020','b6000000-0000-4000-8000-000000000010','b6000000-0000-4000-8000-000000000001','workspace_owner');
insert into public.connections(id,workspace_id,provider,identity,health,last_sync_at,verified_at,freshness_seconds) values
 ('a6000000-0000-4000-8000-000000000030','a6000000-0000-4000-8000-000000000010','google','synthetic-source@example.invalid','healthy',now(),now(),3600);
insert into public.source_bindings(id,workspace_id,connection_id,resource_id,resource_type,source_owner,verified_at) values
 ('a6000000-0000-4000-8000-000000000040','a6000000-0000-4000-8000-000000000010','a6000000-0000-4000-8000-000000000030','synthetic-sheet','sheet','Source owner',now()),
 ('a6000000-0000-4000-8000-000000000041','a6000000-0000-4000-8000-000000000010','a6000000-0000-4000-8000-000000000030','synthetic-calendar','calendar','Calendar operator',now());
insert into public.policies(id,workspace_id,version,approved_by,bounds) values
 ('a6000000-0000-4000-8000-000000000090','a6000000-0000-4000-8000-000000000010',1,'a6000000-0000-4000-8000-000000000020','{"minContactIntervalMinutes":60,"replyReviewHours":4,"calendarCapacity":1,"calendarId":"synthetic-calendar","timeZone":"America/Denver"}');
insert into public.installations(id,workspace_id,agent_id,definition_version,mode,status,policy_id,daily_capacity) values
 ('a6000000-0000-4000-8000-000000000100','a6000000-0000-4000-8000-000000000010','deal-follow-up','1.0.0','monitored_execution','monitoring','a6000000-0000-4000-8000-000000000090',10),
 ('a6000000-0000-4000-8000-000000000101','a6000000-0000-4000-8000-000000000010','appointment-coordinator','1.0.0','monitored_execution','monitoring','a6000000-0000-4000-8000-000000000090',10);
insert into public.runs(id,workspace_id,installation_id,connection_id,definition_version,sdk_version,deployment_id,environment,status) values
 ('a6000000-0000-4000-8000-000000000110','a6000000-0000-4000-8000-000000000010','a6000000-0000-4000-8000-000000000100','a6000000-0000-4000-8000-000000000030','1.0.0','test','test','live','waiting_for_input');
-- Proposal 1 is the only neglected candidate. 2/3 have positive replies; 4/8/9
-- require status review. Latest terminal status, fixtures, suppression, takeover,
-- expiry and existing follow-up must all prevent a neglected recommendation.
do $$ declare n integer; w uuid:='a6000000-0000-4000-8000-000000000010'; a uuid; c uuid; o uuid; p uuid; begin
 for n in 1..218 loop
  a:=private.source_uuid(w,'account',n::text); c:=private.source_uuid(w,'contact',n::text);
  o:=private.source_uuid(w,'opportunity',n::text); p:=private.source_uuid(w,'proposal',n::text);
  insert into public.accounts(id,workspace_id,name,source_key) values(a,w,'Synthetic account '||n,n::text);
  insert into public.contacts(id,workspace_id,account_id,name,email,source_key,owner,enrolled,suppressed,human_takeover)
   values(c,w,a,'Synthetic contact '||n,'synthetic-'||n||'@example.invalid',n::text,'Source owner',n<=12 and n not in (4,9),n=7,n=10);
  insert into public.opportunities(id,workspace_id,account_id,contact_id,owner,stage,raw_stage,business_model,source_key)
   values(o,w,a,c,'Source owner','proposal','open','b2b_services',n::text);
  insert into public.proposals(id,workspace_id,opportunity_id,contact_id,source_binding_id,source_key,version,reference,issued_at,valid_until,amount_minor,currency,value_kind,scope_summary,status,raw_status,owner,source_verified_at,synced_at,fixture)
   values(p,w,o,c,'a6000000-0000-4000-8000-000000000040',n::text,1,'SYN-'||n,now()-interval '1 day',
    case when n=11 then now()-interval '1 hour' else now()+interval '1 day' end,1000,'USD','one_time','Owner-reviewed synthetic scope',
    case when n=4 then 'unknown' else 'open' end,case when n=4 then 'unknown' else 'open' end,'Source owner',
    case when n=4 then now()-interval '2 days' when n=9 then now()+interval '2 hours' else now() end,now(),n=6);
 end loop;
 -- A later authoritative accepted version supersedes the attractive open row.
 insert into public.proposals(id,workspace_id,opportunity_id,contact_id,source_binding_id,source_key,version,reference,issued_at,valid_until,amount_minor,currency,value_kind,scope_summary,status,raw_status,owner,source_verified_at,synced_at,fixture)
  select private.source_uuid(w,'proposal','5-v2'),workspace_id,opportunity_id,contact_id,source_binding_id,source_key,2,reference,issued_at,valid_until,amount_minor,currency,value_kind,scope_summary,'accepted','accepted',owner,source_verified_at,synced_at,false
  from public.proposals where id=private.source_uuid(w,'proposal','5');
 -- Conflicting source authority at the same current version requires review.
 insert into public.proposals(id,workspace_id,opportunity_id,contact_id,source_binding_id,source_key,version,reference,issued_at,valid_until,amount_minor,currency,value_kind,scope_summary,status,raw_status,owner,source_verified_at,synced_at,fixture)
  select private.source_uuid(w,'proposal','8-conflict'),workspace_id,opportunity_id,contact_id,source_binding_id,'8-conflict',1,reference,issued_at,valid_until,amount_minor,currency,value_kind,scope_summary,'declined','declined',owner,source_verified_at,synced_at,false
  from public.proposals where id=private.source_uuid(w,'proposal','8');
 for n in 1..25 loop
  insert into public.evidence(workspace_id,source_binding_id,label,source,quality,captured_at)
   values(w,'a6000000-0000-4000-8000-000000000040','Synthetic retained source '||n,'synthetic-source:'||n,'provider_verified',now()-make_interval(secs=>n));
 end loop;
 insert into public.evidence(workspace_id,source_binding_id,label,source,quality,captured_at)
  values(w,'a6000000-0000-4000-8000-000000000040','Fixture evidence must be excluded','fixture:source','fixture',now());
 for n in 2..3 loop
  insert into public.conversations(workspace_id,contact_id,run_id,connection_id,purpose,owner_agent_id,replied_at,last_reply_at,reply_class)
   values(w,private.source_uuid(w,'contact',n::text),'a6000000-0000-4000-8000-000000000110','a6000000-0000-4000-8000-000000000030','synthetic proposal follow-up','deal-follow-up',
    now()-case when n=2 then interval '5 hours' else interval '1 hour' end,now()-case when n=2 then interval '5 hours' else interval '1 hour' end,'positive');
 end loop;
 -- A later corrected booking snapshot (zero) supersedes the historical one.
 -- An any-history EXISTS(value=1) bug would incorrectly remove handoff/capacity.
 for n in 0..1 loop
  insert into public.outcomes(workspace_id,opportunity_id,evidence_id,metric,stage,source,period_start,period_end,value,value_type,quality)
   values(w,private.source_uuid(w,'opportunity','3'),
    (select id from public.evidence where workspace_id=w and source_binding_id='a6000000-0000-4000-8000-000000000040' and quality='provider_verified' order by id limit 1),
    'verified_bookings','booked','synthetic booking correction',now()-interval '1 day',now()-make_interval(hours=>n+1),n,'count','manually_reported');
 end loop;
 insert into public.actions(id,workspace_id,installation_id,run_id,contact_id,proposal_id,type,payload,payload_hash,proposal_version,policy_id,status,expires_at)
  values('a6000000-0000-4000-8000-000000000120',w,'a6000000-0000-4000-8000-000000000100','a6000000-0000-4000-8000-000000000110',private.source_uuid(w,'contact','12'),private.source_uuid(w,'proposal','12'),'send_follow_up','{}',repeat('a',64),1,'a6000000-0000-4000-8000-000000000090','not_attempted',now()+interval '1 hour');
end $$;

-- No public/worker arbitrary-tenant helper and no manufactured GUC routing.
select set_config('request.jwt.claims','{"sub":"a6000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
do $$ begin
 begin perform public.refresh_work_findings('b6000000-0000-4000-8000-000000000010');raise exception 'FAIL: cross-tenant strategy refresh';exception when insufficient_privilege then null;end;
 begin perform private.refresh_work_findings('a6000000-0000-4000-8000-000000000010');raise exception 'FAIL: browser called internal arbitrary-workspace function';exception when insufficient_privilege then null;end;
 begin insert into public.product_records(workspace_id,kind,payload) values('a6000000-0000-4000-8000-000000000010','work_opportunity','{}');raise exception 'FAIL: browser supplied its own finding';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"a6000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
do $$ begin
 begin perform public.refresh_work_findings('a6000000-0000-4000-8000-000000000010');raise exception 'FAIL: viewer initiated analysis';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"a6000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
do $$ begin
 begin perform public.refresh_work_findings('a6000000-0000-4000-8000-000000000010');raise exception 'FAIL: operator bypassed MFA';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role david_worker;
select set_config('app.workspace_id','a6000000-0000-4000-8000-000000000010',true);
do $$ begin
 begin perform private.refresh_current_findings();raise exception 'FAIL: unbound worker/GUC created strategy findings';exception when insufficient_privilege then null;end;
 begin perform private.refresh_work_findings('b6000000-0000-4000-8000-000000000010');raise exception 'FAIL: worker selected arbitrary workspace';exception when insufficient_privilege then null;end;
end $$;
reset role;

select set_config('request.jwt.claims','{"sub":"a6000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
do $$ declare first_result jsonb; repeat_result jsonb; f record; item jsonb; fields text[]; begin
 first_result:=public.refresh_work_findings('a6000000-0000-4000-8000-000000000010');
 if (first_result->>'created')::integer<>5 then raise exception 'FAIL: expected five deterministic findings, got %',first_result;end if;
 repeat_result:=public.refresh_work_findings('a6000000-0000-4000-8000-000000000010');
 if (repeat_result->>'created')::integer<>0 or (repeat_result->>'active')::integer<>5 then raise exception 'FAIL: repeated refresh duplicated findings';end if;
 for f in select * from public.product_records where workspace_id='a6000000-0000-4000-8000-000000000010' and kind='work_opportunity' loop
  select array_agg(key order by key) into fields from jsonb_object_keys(f.payload) key;
  if fields is distinct from array['affectedIds','agentId','alternatives','baseline','costMinor','effortMinutes','evaluationRule','evidence','hypothesis','id','observedCondition','owner','reviewAt','status','target','title','workspaceId']::text[] then raise exception 'FAIL: payload does not match strict WorkOpportunity shape';end if;
  if f.payload->>'id'<>f.id::text or f.payload->>'workspaceId'<>f.workspace_id::text or f.payload->>'status'<>'proposed'
   or f.payload->'costMinor'<>'null'::jsonb or jsonb_array_length(f.payload->'evidence')>20 or jsonb_array_length(f.payload->'evidence')=0
   or f.payload->>'reviewAt' !~ 'Z$' or f.payload->>'observedCondition' not like '%authorization are evaluated separately.%' then raise exception 'FAIL: incomplete or misleading finding';end if;
  for item in select value from jsonb_array_elements(f.payload->'evidence') loop
   if item->>'quality'='fixture' or item->>'capturedAt' !~ 'Z$' then raise exception 'FAIL: fixture/non-UTC evidence in operational strategy';end if;
  end loop;
 end loop;
 if not exists(select 1 from public.product_records where workspace_id='a6000000-0000-4000-8000-000000000010' and starts_with(payload->>'evaluationRule','strategy.v1/neglected:') and jsonb_array_length(payload->'affectedIds')=1) then raise exception 'FAIL: stale/terminal/fixture/suppressed/taken-over/expired/pending proposal became neglected';end if;
 if not exists(select 1 from public.product_records where workspace_id='a6000000-0000-4000-8000-000000000010' and starts_with(payload->>'evaluationRule','strategy.v1/unknown_status:') and jsonb_array_length(payload->'affectedIds')=3) then raise exception 'FAIL: missing unknown, conflicting or future source review';end if;
 if exists(select 1 from public.product_records where workspace_id='b6000000-0000-4000-8000-000000000010') then raise exception 'FAIL: findings leaked into other tenant';end if;
 perform set_config('test.neglected_finding',(select id::text from public.product_records where workspace_id='a6000000-0000-4000-8000-000000000010' and starts_with(payload->>'evaluationRule','strategy.v1/neglected:')),true);
 perform set_config('test.handoff_finding',(select id::text from public.product_records where workspace_id='a6000000-0000-4000-8000-000000000010' and starts_with(payload->>'evaluationRule','strategy.v1/missing_next_action:')),true);
end $$;
-- Approval creates a bounded internal initiative, not an external action.
do $$ declare initiative uuid; again uuid; begin
 initiative:=public.approve_work_finding('a6000000-0000-4000-8000-000000000010',current_setting('test.handoff_finding')::uuid);
 again:=public.approve_work_finding('a6000000-0000-4000-8000-000000000010',current_setting('test.handoff_finding')::uuid);
 if initiative<>again then raise exception 'FAIL: repeated initiative approval duplicated work';end if;
 if not exists(select 1 from public.product_records where id=initiative and kind='initiative' and parent_id=current_setting('test.handoff_finding')::uuid
  and payload ?& array['owner','baseline','target','reviewAt','assignments'] and payload->>'status'='active') then raise exception 'FAIL: missing structured initiative';end if;
 if not exists(select 1 from public.product_records where parent_id=initiative and kind='assignment' and payload->>'agentId'='appointment-coordinator' and payload->>'status'='awaiting_readiness') then raise exception 'FAIL: missing bounded specialist assignment';end if;
 if (select count(*) from public.actions where workspace_id='a6000000-0000-4000-8000-000000000010')<>1 or exists(select 1 from public.approvals where workspace_id='a6000000-0000-4000-8000-000000000010') or (select count(*) from public.outcomes where workspace_id='a6000000-0000-4000-8000-000000000010')<>2 then raise exception 'FAIL: finding approval manufactured action authority or outcomes';end if;
end $$;
reset role;

-- A missing or malformed policy must not turn unknown meeting capacity into zero
-- or retire an existing capacity observation as though conditions improved.
update public.policies set bounds='{"calendarCapacity":null,"replyReviewHours":"not-a-number","minContactIntervalMinutes":{}}'
 where id='a6000000-0000-4000-8000-000000000090';
set local role authenticated;
select public.refresh_work_findings('a6000000-0000-4000-8000-000000000010');
do $$ begin
 if not exists(select 1 from public.product_records where workspace_id='a6000000-0000-4000-8000-000000000010' and starts_with(payload->>'evaluationRule','strategy.v1/meeting_capacity:') and payload->>'status'='proposed') then raise exception 'FAIL: unavailable capacity inferred improvement';end if;
end $$;
reset role;
update public.policies set bounds='{"minContactIntervalMinutes":60,"replyReviewHours":4,"calendarCapacity":1,"calendarId":"synthetic-calendar","timeZone":"America/Denver"}' where id='a6000000-0000-4000-8000-000000000090';
update public.proposals set status='accepted' where workspace_id='a6000000-0000-4000-8000-000000000010' and source_key='1';
update public.contacts set human_takeover=true where workspace_id='a6000000-0000-4000-8000-000000000010' and source_key in ('2','3');
set local role authenticated;
do $$ declare result jsonb; rejected boolean:=false; begin
 result:=public.refresh_work_findings('a6000000-0000-4000-8000-000000000010');
 if (result->>'resolved')::integer<>3 then raise exception 'FAIL: obsolete proposed conditions not retired: %',result;end if;
 if not exists(select 1 from public.product_records where id=current_setting('test.neglected_finding')::uuid and payload->>'status'='reviewed' and payload->>'evaluationRule' like '%does not establish experiment success.%') then raise exception 'FAIL: original finding not retained with honest resolution';end if;
 if not exists(select 1 from public.product_records where id=current_setting('test.handoff_finding')::uuid and payload->>'status'='approved') then raise exception 'FAIL: refresh overwrote an approved initiative baseline';end if;
 begin perform public.approve_work_finding('a6000000-0000-4000-8000-000000000010',current_setting('test.neglected_finding')::uuid);exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'FAIL: stale retired finding approved';end if;
end $$;
reset role;

-- Recurrence creates a new dated history record, bounded to 200 affected IDs.
update public.proposals set status='open' where workspace_id='a6000000-0000-4000-8000-000000000010' and source_key='1';
update public.contacts set enrolled=true where workspace_id='a6000000-0000-4000-8000-000000000010' and source_key::integer>=13;
select set_config('test.strategy_route',(select route_token::text from private.run_routes where run_id='a6000000-0000-4000-8000-000000000110'),true);
set local role david_worker;
select private.bind_run('a6000000-0000-4000-8000-000000000110',current_setting('test.strategy_route')::uuid);
do $$ declare result jsonb; begin
 result:=private.refresh_current_findings();
 if (result->>'created')::integer<>1 then raise exception 'FAIL: bound worker recurrence not detected';end if;
 if not exists(select 1 from public.product_records where workspace_id='a6000000-0000-4000-8000-000000000010' and starts_with(payload->>'evaluationRule','strategy.v1/neglected:') and payload->>'status'='proposed'
  and id<>current_setting('test.neglected_finding')::uuid and jsonb_array_length(payload->'affectedIds')=200 and payload->>'observedCondition' like '%capped at 200%') then raise exception 'FAIL: recurrence history or affected-record bound';end if;
 begin perform public.refresh_work_findings('b6000000-0000-4000-8000-000000000010');raise exception 'FAIL: worker invoked arbitrary-tenant public wrapper';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 if exists(select 1 from public.product_records where workspace_id='b6000000-0000-4000-8000-000000000010') then raise exception 'FAIL: worker mutated other tenant';end if;
 if (select count(*) from public.product_records where workspace_id='a6000000-0000-4000-8000-000000000010' and kind='initiative')<>1 then raise exception 'FAIL: duplicate initiative';end if;
 if (select count(*) from public.outcomes where workspace_id='a6000000-0000-4000-8000-000000000010')<>2 then raise exception 'FAIL: analysis fabricated outcomes';end if;
end $$;
rollback;
select 'PASS: five sourced strategy rules, owner/operator MFA scope, run-bound worker, version/fixture exclusion, strict bounded records, deduplication, honest resolution/recurrence, structured non-executing initiative' as evidence;
