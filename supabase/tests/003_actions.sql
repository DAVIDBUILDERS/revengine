-- Actual transactional functions, with entirely synthetic records. No provider I/O.
begin;
insert into auth.users(id,email) values('a2000000-0000-4000-8000-000000000001','action-owner@example.invalid'),('a2000000-0000-4000-8000-000000000002','action-operator@example.invalid');
insert into public.workspaces(id,name,environment,business_model,time_zone,currency,paused,daily_budget_minor) values('a2000000-0000-4000-8000-000000000010','Action fixture','live','b2b_services','UTC','USD',false,100);
insert into public.memberships(id,workspace_id,actor_id,role) values
 ('a2000000-0000-4000-8000-000000000020','a2000000-0000-4000-8000-000000000010','a2000000-0000-4000-8000-000000000001','workspace_owner'),
 ('a2000000-0000-4000-8000-000000000021','a2000000-0000-4000-8000-000000000010','a2000000-0000-4000-8000-000000000002','david_operator');
insert into public.connections(id,workspace_id,provider,identity,health,operations,last_sync_at,verified_at) values('a2000000-0000-4000-8000-000000000030','a2000000-0000-4000-8000-000000000010','google','sender@example.invalid','healthy',array['gmail.read','gmail.send'],now(),now());
insert into public.source_bindings(id,workspace_id,connection_id,resource_id,resource_type,source_owner,verified_at) values('a2000000-0000-4000-8000-000000000040','a2000000-0000-4000-8000-000000000010','a2000000-0000-4000-8000-000000000030','synthetic-sheet','sheet','Fixture owner',now());
insert into public.accounts(id,workspace_id,name,source_key) values('a2000000-0000-4000-8000-000000000050','a2000000-0000-4000-8000-000000000010','Synthetic customer','customer');
insert into public.contacts(id,workspace_id,account_id,name,email,source_key,owner,enrolled,cohort_id) values('a2000000-0000-4000-8000-000000000060','a2000000-0000-4000-8000-000000000010','a2000000-0000-4000-8000-000000000050','Synthetic','customer@example.invalid','customer','Fixture owner',true,'test-cohort');
insert into public.opportunities(id,workspace_id,contact_id,account_id,owner,stage,raw_stage,business_model,source_key) values('a2000000-0000-4000-8000-000000000070','a2000000-0000-4000-8000-000000000010','a2000000-0000-4000-8000-000000000060','a2000000-0000-4000-8000-000000000050','Fixture owner','proposal','open','b2b_services','opportunity');
insert into public.proposals(id,workspace_id,opportunity_id,contact_id,source_binding_id,source_key,version,reference,issued_at,valid_until,amount_minor,currency,value_kind,scope_summary,status,raw_status,owner,source_verified_at,synced_at,fixture) values('a2000000-0000-4000-8000-000000000080','a2000000-0000-4000-8000-000000000010','a2000000-0000-4000-8000-000000000070','a2000000-0000-4000-8000-000000000060','a2000000-0000-4000-8000-000000000040','proposal',1,'P-TEST',now(),now()+interval '1 day',1000,'USD','one_time','Approved factual scope','open','open','Fixture owner',now(),now(),false);
insert into public.policies(id,workspace_id,version,approved_by,bounds) values('a2000000-0000-4000-8000-000000000090','a2000000-0000-4000-8000-000000000010',1,'a2000000-0000-4000-8000-000000000020','{"minContactIntervalMinutes":60,"replyFreshnessSeconds":120}');
insert into public.installations(id,workspace_id,agent_id,definition_version,mode,status,policy_id,daily_capacity) values('a2000000-0000-4000-8000-000000000100','a2000000-0000-4000-8000-000000000010','deal-follow-up','1.0.0','monitored_execution','monitoring','a2000000-0000-4000-8000-000000000090',10);
insert into public.live_activations(workspace_id,sender_connection_id,sender,cohort_id,operator_membership_id,policy_id,approved_by,expires_at,staffed_hours) values('a2000000-0000-4000-8000-000000000010','a2000000-0000-4000-8000-000000000030','sender@example.invalid','test-cohort','a2000000-0000-4000-8000-000000000021','a2000000-0000-4000-8000-000000000090','a2000000-0000-4000-8000-000000000020',now()+interval '1 day','{"days":[1,2,3,4,5,6,7],"startHour":0,"endHour":24}');
insert into public.runs(id,workspace_id,installation_id,connection_id,definition_version,sdk_version,deployment_id,environment,status,next_due_at) values('a2000000-0000-4000-8000-000000000110','a2000000-0000-4000-8000-000000000010','a2000000-0000-4000-8000-000000000100','a2000000-0000-4000-8000-000000000030','1.0.0','test','test','live','scheduled',now()-interval '1 hour');
select set_config('test.route_token',(select route_token::text from private.run_routes where run_id='a2000000-0000-4000-8000-000000000110'),true);
set local role david_worker;
select private.bind_run('a2000000-0000-4000-8000-000000000110',current_setting('test.route_token')::uuid);
select private.create_action('a2000000-0000-4000-8000-000000000120','a2000000-0000-4000-8000-000000000060','a2000000-0000-4000-8000-000000000080','send_follow_up','{"recipient":"customer@example.invalid","proposalVersion":1,"subject":"Approved subject","body":"Approved text"}',repeat('a',64),'a2000000-0000-4000-8000-000000000090',10,now()+interval '1 hour');
reset role;
select set_config('request.jwt.claims','{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select public.decide_action('a2000000-0000-4000-8000-000000000120','approved',repeat('a',64));
select public.decide_action('a2000000-0000-4000-8000-000000000120','approved',repeat('a',64));
reset role;
do $$ begin
 if (select count(*) from private.outbox where workspace_id='a2000000-0000-4000-8000-000000000010' and event_type='approval_decided')<>1 then raise exception 'FAIL: duplicate approval outbox'; end if;
 if not exists(select 1 from public.approvals where action_id='a2000000-0000-4000-8000-000000000120' and status='approved') then raise exception 'FAIL: approval not committed'; end if;
end $$;
set local role david_worker;
-- Decision precedes hook registration; registering must enqueue recovery delivery.
select private.register_wait('a2000000-0000-4000-8000-000000000120','SYNTHETIC_HOOK_TOKEN',now()+interval '1 hour');
do $$ declare result record; begin
 if not exists(select 1 from private.pending_hook('a2000000-0000-4000-8000-000000000120') where decision='approved') then raise exception 'FAIL: lost early decision'; end if;
 select * into result from private.reserve_action('a2000000-0000-4000-8000-000000000120');
 if result.claim_token is null then raise exception 'FAIL: eligible action did not reserve'; end if;
 perform set_config('test.action_token',result.claim_token::text,true);perform set_config('test.action_fence',result.fence::text,true);
 if exists(select 1 from private.reserve_action('a2000000-0000-4000-8000-000000000120')) then raise exception 'FAIL: duplicate reservation'; end if;
 if not private.mark_submitting('a2000000-0000-4000-8000-000000000120',result.claim_token,result.fence) then raise exception 'FAIL: valid submit rejected'; end if;
 if private.mark_submitting('a2000000-0000-4000-8000-000000000120',result.claim_token,result.fence) then raise exception 'FAIL: duplicated provider dispatch'; end if;
 perform private.record_receipt('a2000000-0000-4000-8000-000000000120',result.claim_token,result.fence,'uncertain','google',null,'Synthetic timeout',0);
 if private.mark_submitting('a2000000-0000-4000-8000-000000000120',result.claim_token,result.fence) then raise exception 'FAIL: uncertain send was resubmitted'; end if;
 perform private.record_receipt('a2000000-0000-4000-8000-000000000120',result.claim_token,result.fence,'provider_accepted','google','SYNTHETIC_PROVIDER_ID','Reconciled fixture identity',8);
end $$;
reset role;
do $$ begin
 if (select actions from private.budget_counters where workspace_id='a2000000-0000-4000-8000-000000000010')<>1 then raise exception 'FAIL: budget duplicated'; end if;
 if (select reserved_minor from private.budget_counters where workspace_id='a2000000-0000-4000-8000-000000000010')<>0 then raise exception 'FAIL: reservation not settled'; end if;
 if (select spent_minor from private.budget_counters where workspace_id='a2000000-0000-4000-8000-000000000010')<>8 then raise exception 'FAIL: cost not settled'; end if;
 if exists(select 1 from public.outcomes where workspace_id='a2000000-0000-4000-8000-000000000010' and stage in ('paid','attended','signed')) then raise exception 'FAIL: send fabricated business outcome'; end if;
end $$;
rollback;
select 'PASS: atomic/repeated approval, early decision hook recovery, reservation fence, no uncertain resend, single budget settlement' as evidence;
