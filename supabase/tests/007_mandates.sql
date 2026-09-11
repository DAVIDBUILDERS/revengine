-- Actual transactional functions, with entirely synthetic records. No provider I/O.
begin;
insert into auth.users(id,email) values('a7000000-0000-4000-8000-000000000001','action-owner@example.invalid'),('a7000000-0000-4000-8000-000000000002','action-operator@example.invalid');
insert into public.workspaces(id,name,environment,business_model,time_zone,currency,paused,daily_budget_minor) values('a7000000-0000-4000-8000-000000000010','Action fixture','live','b2b_services','UTC','USD',false,100);
insert into public.memberships(id,workspace_id,actor_id,role) values
 ('a7000000-0000-4000-8000-000000000020','a7000000-0000-4000-8000-000000000010','a7000000-0000-4000-8000-000000000001','workspace_owner'),
 ('a7000000-0000-4000-8000-000000000021','a7000000-0000-4000-8000-000000000010','a7000000-0000-4000-8000-000000000002','david_operator');
insert into public.connections(id,workspace_id,provider,identity,health,operations,last_sync_at,verified_at) values('a7000000-0000-4000-8000-000000000030','a7000000-0000-4000-8000-000000000010','google','sender@example.invalid','healthy',array['gmail.read','gmail.send'],now(),now());
insert into public.source_bindings(id,workspace_id,connection_id,resource_id,resource_type,source_owner,verified_at) values('a7000000-0000-4000-8000-000000000040','a7000000-0000-4000-8000-000000000010','a7000000-0000-4000-8000-000000000030','synthetic-sheet','sheet','Fixture owner',now());
insert into public.accounts(id,workspace_id,name,source_key) values('a7000000-0000-4000-8000-000000000050','a7000000-0000-4000-8000-000000000010','Synthetic customer','customer');
insert into public.contacts(id,workspace_id,account_id,name,email,source_key,owner,enrolled,cohort_id) values('a7000000-0000-4000-8000-000000000060','a7000000-0000-4000-8000-000000000010','a7000000-0000-4000-8000-000000000050','Synthetic','customer@example.invalid','customer','Fixture owner',true,'test-cohort');
insert into public.opportunities(id,workspace_id,contact_id,account_id,owner,stage,raw_stage,business_model,source_key) values('a7000000-0000-4000-8000-000000000070','a7000000-0000-4000-8000-000000000010','a7000000-0000-4000-8000-000000000060','a7000000-0000-4000-8000-000000000050','Fixture owner','proposal','open','b2b_services','opportunity');
insert into public.proposals(id,workspace_id,opportunity_id,contact_id,source_binding_id,source_key,version,reference,issued_at,valid_until,amount_minor,currency,value_kind,scope_summary,status,raw_status,owner,source_verified_at,synced_at,fixture) values('a7000000-0000-4000-8000-000000000080','a7000000-0000-4000-8000-000000000010','a7000000-0000-4000-8000-000000000070','a7000000-0000-4000-8000-000000000060','a7000000-0000-4000-8000-000000000040','proposal',1,'P-TEST',now(),now()+interval '1 day',1000,'USD','one_time','Approved factual scope','open','open','Fixture owner',now(),now(),false);
insert into public.policies(id,workspace_id,version,approved_by,bounds) values('a7000000-0000-4000-8000-000000000090','a7000000-0000-4000-8000-000000000010',1,'a7000000-0000-4000-8000-000000000020','{"minContactIntervalMinutes":60,"replyFreshnessSeconds":120}');
insert into public.installations(id,workspace_id,agent_id,definition_version,mode,status,policy_id,daily_capacity) values('a7000000-0000-4000-8000-000000000100','a7000000-0000-4000-8000-000000000010','deal-follow-up','1.0.0','bounded_autonomous_execution','monitoring','a7000000-0000-4000-8000-000000000090',10);
insert into public.live_activations(workspace_id,sender_connection_id,sender,cohort_id,operator_membership_id,policy_id,approved_by,expires_at,staffed_hours) values('a7000000-0000-4000-8000-000000000010','a7000000-0000-4000-8000-000000000030','sender@example.invalid','test-cohort','a7000000-0000-4000-8000-000000000021','a7000000-0000-4000-8000-000000000090','a7000000-0000-4000-8000-000000000020',now()+interval '1 day','{"days":[1,2,3,4,5,6,7],"startHour":0,"endHour":24}');
insert into public.runs(id,workspace_id,installation_id,connection_id,definition_version,sdk_version,deployment_id,environment,status,next_due_at) values('a7000000-0000-4000-8000-000000000110','a7000000-0000-4000-8000-000000000010','a7000000-0000-4000-8000-000000000100','a7000000-0000-4000-8000-000000000030','1.0.0','test','test','live','scheduled',now()-interval '1 hour');
-- All addresses/provider states are synthetic. These role/SQL assertions perform no provider I/O.
insert into public.mandates(id,workspace_id,version,grantor_id,action_type,bounds,starts_at,expires_at)
values('a7000000-0000-4000-8000-000000000150','a7000000-0000-4000-8000-000000000010',1,'a7000000-0000-4000-8000-000000000020','send_follow_up',
 jsonb_build_object('templateVersion','factual-followup.v1','subjectTemplate','Following up on {reference}',
 'bodyTemplate',E'I’m following up on proposal {reference}.\n\n{scopeSummary}\n\nWhat questions can we help answer?',
 'channel','gmail','policyId','a7000000-0000-4000-8000-000000000090','policyVersion',1,'senderConnectionId','a7000000-0000-4000-8000-000000000030',
 'cohortId','test-cohort','contactIds',jsonb_build_array('a7000000-0000-4000-8000-000000000060'),'recipientDomains',jsonb_build_array('example.invalid'),
 'approvedScope','Approved factual scope','maxActions',2,'maxCostMinor',20),now()-interval '1 hour',now()+interval '1 day');
insert into public.mandates(id,workspace_id,version,grantor_id,action_type,bounds,starts_at,expires_at,revoked_at)
select 'a7000000-0000-4000-8000-000000000151',workspace_id,2,grantor_id,action_type,bounds,now()-interval '2 days',now()-interval '1 day',null from public.mandates where id='a7000000-0000-4000-8000-000000000150';
insert into public.mandates(id,workspace_id,version,grantor_id,action_type,bounds,starts_at,expires_at,revoked_at)
select 'a7000000-0000-4000-8000-000000000152',workspace_id,3,grantor_id,action_type,bounds,now()-interval '1 hour',now()+interval '1 day',now() from public.mandates where id='a7000000-0000-4000-8000-000000000150';
select set_config('test.route_token',(select route_token::text from private.run_routes where run_id='a7000000-0000-4000-8000-000000000110'),true);
select set_config('test.factual_payload',jsonb_build_object('recipient','customer@example.invalid','proposalVersion',1,'subject','Following up on P-TEST','body',E'I’m following up on proposal P-TEST.\n\nApproved factual scope\n\nWhat questions can we help answer?')::text,true);
set local role david_worker;
select private.bind_run('a7000000-0000-4000-8000-000000000110',current_setting('test.route_token')::uuid);
select private.create_action('a7000000-0000-4000-8000-000000000120','a7000000-0000-4000-8000-000000000060','a7000000-0000-4000-8000-000000000080','send_follow_up',current_setting('test.factual_payload')::jsonb,repeat('a',64),'a7000000-0000-4000-8000-000000000090',10,now()+interval '1 hour');
do $$ begin
 if private.action_authority('a7000000-0000-4000-8000-000000000120')<>'mandated' then raise exception 'FAIL: eligible factual action did not receive standing authority'; end if;
 if private.action_authority('a7000000-0000-4000-8000-000000999999')<>'missing' then raise exception 'FAIL: unbound action authority visible'; end if;
end $$;
-- A new promise, even under the same proposal/version, must not receive automatic authority.
select private.create_action('a7000000-0000-4000-8000-000000000121','a7000000-0000-4000-8000-000000000060','a7000000-0000-4000-8000-000000000080','send_follow_up',current_setting('test.factual_payload')::jsonb||'{"body":"We offer a new discount."}'::jsonb,repeat('b',64),'a7000000-0000-4000-8000-000000000090',10,now()+interval '1 hour');
select private.create_action('a7000000-0000-4000-8000-000000000122','a7000000-0000-4000-8000-000000000060','a7000000-0000-4000-8000-000000000080','book_appointment',current_setting('test.factual_payload')::jsonb,repeat('c',64),'a7000000-0000-4000-8000-000000000090',10,now()+interval '1 hour');
do $$ begin
 if private.action_authority('a7000000-0000-4000-8000-000000000121')<>'pending' or private.action_authority('a7000000-0000-4000-8000-000000000122')<>'pending' then raise exception 'FAIL: new commitment or booking bypassed review'; end if;
end $$;
reset role;
do $$ begin
 if (select mandate_id from public.actions where id='a7000000-0000-4000-8000-000000000120') is distinct from 'a7000000-0000-4000-8000-000000000150'::uuid then raise exception 'FAIL: wrong mandate binding'; end if;
 if not exists(select 1 from public.audit_events where entity_id='a7000000-0000-4000-8000-000000000120' and event_type='standing_mandate_bound' and detail->>'mandate_version'='1') then raise exception 'FAIL: mandate authority not audited'; end if;
 begin update public.mandates set bounds=bounds||'{"maxActions":100}' where id='a7000000-0000-4000-8000-000000000150';raise exception 'FAIL: mandate mutated';
 exception when raise_exception then if sqlerrm='FAIL: mandate mutated' then raise; end if; end;
end $$;
-- Simulate persisted revoked/expired references as administrative fixture setup.
update public.actions set mandate_id='a7000000-0000-4000-8000-000000000151' where id='a7000000-0000-4000-8000-000000000120';
set local role david_worker;
do $$ begin if private.action_authority('a7000000-0000-4000-8000-000000000120')<>'pending' or exists(select 1 from private.reserve_action('a7000000-0000-4000-8000-000000000120')) then raise exception 'FAIL: expired mandate authorized'; end if;end $$;
reset role;
update public.actions set mandate_id='a7000000-0000-4000-8000-000000000152' where id='a7000000-0000-4000-8000-000000000120';
set local role david_worker;
do $$ begin if private.action_authority('a7000000-0000-4000-8000-000000000120')<>'pending' then raise exception 'FAIL: revoked mandate authorized'; end if;end $$;
reset role;
update public.actions set mandate_id='a7000000-0000-4000-8000-000000000150' where id='a7000000-0000-4000-8000-000000000120';
-- A retained uncertain reservation consumes the mandate cost, independently of the global budget.
insert into public.actions(id,workspace_id,installation_id,run_id,contact_id,proposal_id,type,payload,source_snapshot,payload_hash,proposal_version,policy_id,mandate_id,status,reserved_cost_minor,reserved_at,expires_at)
select 'a7000000-0000-4000-8000-000000000123',workspace_id,installation_id,run_id,contact_id,proposal_id,type,payload,source_snapshot,repeat('d',64),proposal_version,policy_id,mandate_id,'uncertain',19,now(),expires_at from public.actions where id='a7000000-0000-4000-8000-000000000120';
set local role david_worker;
do $$ begin if private.action_authority('a7000000-0000-4000-8000-000000000120')<>'pending' then raise exception 'FAIL: mandate cost ceiling exceeded';end if;end $$;
reset role;
update public.actions set reserved_cost_minor=5 where id='a7000000-0000-4000-8000-000000000123';
set local role david_worker;
do $$ begin if private.action_authority('a7000000-0000-4000-8000-000000000120')<>'mandated' then raise exception 'FAIL: exact count and cost capacity rejected';end if;end $$;
reset role;
insert into public.actions(id,workspace_id,installation_id,run_id,contact_id,proposal_id,type,payload,source_snapshot,payload_hash,proposal_version,policy_id,mandate_id,status,reserved_cost_minor,reserved_at,expires_at)
select 'a7000000-0000-4000-8000-000000000124',workspace_id,installation_id,run_id,contact_id,proposal_id,type,payload,source_snapshot,repeat('e',64),proposal_version,policy_id,mandate_id,'confirmed',0,now(),expires_at from public.actions where id='a7000000-0000-4000-8000-000000000120';
set local role david_worker;
do $$ begin if private.action_authority('a7000000-0000-4000-8000-000000000120')<>'pending' then raise exception 'FAIL: mandate count ceiling exceeded';end if;end $$;
reset role;
delete from public.actions where id in ('a7000000-0000-4000-8000-000000000123','a7000000-0000-4000-8000-000000000124');
update public.memberships set active=false where id='a7000000-0000-4000-8000-000000000020';
set local role david_worker;
do $$ begin if private.action_authority('a7000000-0000-4000-8000-000000000120')<>'pending' then raise exception 'FAIL: inactive grantor authority retained';end if;end $$;
reset role;
update public.memberships set active=true where id='a7000000-0000-4000-8000-000000000020';
select set_config('request.jwt.claims','{"sub":"a7000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
do $$ begin
 begin perform private.action_authority('a7000000-0000-4000-8000-000000000120');raise exception 'FAIL: browser accessed worker authority';exception when insufficient_privilege then null;end;
 begin update public.mandates set revoked_at=now() where id='a7000000-0000-4000-8000-000000000150';raise exception 'FAIL: browser mutated mandate';exception when insufficient_privilege then null;end;
 begin perform public.decide_action('a7000000-0000-4000-8000-000000000120','approved',null);raise exception 'FAIL: null content hash accepted';exception when insufficient_privilege then null;end;
end $$;
select public.decide_action('a7000000-0000-4000-8000-000000000120','rejected',repeat('a',64));
-- A separately reviewed commitment may use per-action authority even outside the mandate.
select public.decide_action('a7000000-0000-4000-8000-000000000121','approved',repeat('b',64));
reset role;
set local role david_worker;
do $$ begin
 if private.action_authority('a7000000-0000-4000-8000-000000000120')<>'rejected' or exists(select 1 from private.reserve_action('a7000000-0000-4000-8000-000000000120')) then raise exception 'FAIL: mandate overrode explicit rejection'; end if;
 if private.action_authority('a7000000-0000-4000-8000-000000000121')<>'approved' then raise exception 'FAIL: exact per-action approval fallback failed'; end if;
end $$;
-- Fresh factual action can reserve and pass the final fence without an approved message row.
select private.create_action('a7000000-0000-4000-8000-000000000125','a7000000-0000-4000-8000-000000000060','a7000000-0000-4000-8000-000000000080','send_follow_up',current_setting('test.factual_payload')::jsonb,repeat('f',64),'a7000000-0000-4000-8000-000000000090',10,now()+interval '1 hour');
do $$ declare claim record;begin
 select * into claim from private.reserve_action('a7000000-0000-4000-8000-000000000125');
 if claim.claim_token is null or not private.mark_submitting('a7000000-0000-4000-8000-000000000125',claim.claim_token,claim.fence) then raise exception 'FAIL: standing-authorized action failed final gate';end if;
end $$;
reset role;
rollback;
select 'PASS: current factual mandate, scope/booking restriction, exact hash, grantor/revocation/expiry, cost/count reservations, rejection precedence, approved fallback and final fenced gate' as evidence;
