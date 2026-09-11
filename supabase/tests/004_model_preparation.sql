-- Authored hosted nonproduction test. This file does not run during unit tests and is not proof until executed against Supabase.
begin;
insert into auth.users(id,email) values('a3000000-0000-4000-8000-000000000001','model-owner@example.invalid');
insert into public.workspaces(id,name,environment,business_model,time_zone,currency,paused) values('a3000000-0000-4000-8000-000000000010','Synthetic model budget test','shadow','b2b_services','UTC','USD',false);
insert into public.memberships(id,workspace_id,actor_id,role) values('a3000000-0000-4000-8000-000000000020','a3000000-0000-4000-8000-000000000010','a3000000-0000-4000-8000-000000000001','workspace_owner');
insert into public.installations(id,workspace_id,agent_id,definition_version,mode,status,daily_capacity) values('a3000000-0000-4000-8000-000000000030','a3000000-0000-4000-8000-000000000010','account-intelligence','1.0.0','preparation','monitoring',1);
insert into public.runs(id,workspace_id,installation_id,definition_version,sdk_version,deployment_id,environment,status) values
 ('a3000000-0000-4000-8000-000000000040','a3000000-0000-4000-8000-000000000010','a3000000-0000-4000-8000-000000000030','proposal-v1','test','test','shadow','processing'),
 ('a3000000-0000-4000-8000-000000000041','a3000000-0000-4000-8000-000000000010','a3000000-0000-4000-8000-000000000030','proposal-v1','test','test','shadow','processing');
insert into public.evidence(id,workspace_id,label,source,quality,captured_at) values('a3000000-0000-4000-8000-000000000050','a3000000-0000-4000-8000-000000000010','Synthetic source for SQL behavior only','test manually confirmed context','manually_reported',now());
select set_config('test.route_model',(select route_token::text from private.run_routes where run_id='a3000000-0000-4000-8000-000000000040'),true);
select set_config('test.route_second',(select route_token::text from private.run_routes where run_id='a3000000-0000-4000-8000-000000000041'),true);
select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select public.set_workspace_model_limits('a3000000-0000-4000-8000-000000000010',10,1200,'Synthetic test limit; no provider calls or real spend');
do $$ begin
 begin update private.model_global_limit set daily_cost_ceiling_minor=999999;raise exception 'FAIL: owner raised global model budget';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- Defaults remain zero until deployment administrator explicitly configures the global budget.
update private.model_global_limit set daily_cost_ceiling_minor=0,daily_output_token_ceiling=0;
set local role david_worker;
select private.bind_run('a3000000-0000-4000-8000-000000000040',current_setting('test.route_model')::uuid);
do $$ begin
 begin perform private.reserve_model_budget('a3000000-0000-4000-8000-000000000010',5,600);raise exception 'FAIL: zero global budget allowed inference';exception when raise_exception then if sqlerrm not like 'MODEL_BUDGET_UNCONFIGURED%' then raise;end if;end;
end $$;
reset role;
update private.model_global_limit set daily_cost_ceiling_minor=10,daily_output_token_ceiling=1200,pricing_basis='Synthetic SQL test only';
set local role david_worker;
select set_config('test.model_reservation',private.reserve_model_budget('a3000000-0000-4000-8000-000000000010',5,600)::text,true);
do $$ begin
 begin perform private.reserve_model_budget('a3000000-0000-4000-8000-000000000010',5,600);raise exception 'FAIL: duplicate model inference reservation';exception when raise_exception then if sqlerrm not like 'MODEL_RUN_ALREADY_RESERVED%' then raise;end if;end;
end $$;
select private.settle_model_budget(current_setting('test.model_reservation')::uuid,200,80,'synthetic-model',null);
select private.settle_model_budget(current_setting('test.model_reservation')::uuid,200,80,'synthetic-model',null);
select * from private.claim_preparation('account-intelligence',repeat('a',64));
select private.complete_preparation(repeat('a',64),'{"id":"a3000000-0000-4000-8000-000000000060","agentId":"account-intelligence","type":"WebsiteProfile","title":"Synthetic SQL artifact","content":"Approved confirmed facts only. No provider action.","factualInputs":["Synthetic approved fact"],"sourceSnapshot":[{"id":"a3000000-0000-4000-8000-000000000050","quality":"manually_reported"}],"limitation":"SQL fixture only; no model or provider call."}'::jsonb);
reset role;
do $$ begin
 if not exists(select 1 from private.model_reservations where id=current_setting('test.model_reservation')::uuid and status='awaiting_cost') then raise exception 'FAIL: unknown model cost disguised as settled';end if;
 if (select reserved_minor from private.model_workspace_counters where workspace_id='a3000000-0000-4000-8000-000000000010' and day=(now() at time zone 'UTC')::date)<>5 then raise exception 'FAIL: unknown cost reservation released';end if;
 if (select count(*) from public.usage_records where run_id='a3000000-0000-4000-8000-000000000040')<>1 then raise exception 'FAIL: duplicate usage settlement';end if;
 if (select cost_minor from public.usage_records where run_id='a3000000-0000-4000-8000-000000000040') is not null then raise exception 'FAIL: unknown actual cost became zero';end if;
 if not exists(select 1 from public.installations where id='a3000000-0000-4000-8000-000000000030' and preparation_next_due_at>now() and last_preparation_at is not null) then raise exception 'FAIL: preparation cadence not retained';end if;
 if exists(select 1 from public.outcomes where workspace_id='a3000000-0000-4000-8000-000000000010') then raise exception 'FAIL: preparation created business outcome';end if;
end $$;
-- Change only the test harness's transaction routing row to exercise a second run. This is not a concurrency test.
delete from private.transaction_context where transaction_id=txid_current() and backend_pid=pg_backend_pid();
set local role david_worker;
select private.bind_run('a3000000-0000-4000-8000-000000000041',current_setting('test.route_second')::uuid);
do $$ begin
 begin perform private.claim_preparation('account-intelligence',repeat('b',64));raise exception 'FAIL: installation daily capacity ignored';exception when raise_exception then if sqlerrm not like 'PREPARATION_DAILY_CAPACITY%' then raise;end if;end;
 if not exists(select 1 from private.claim_preparation('account-intelligence',repeat('a',64)) where status='unchanged' and artifact_id='a3000000-0000-4000-8000-000000000060') then raise exception 'FAIL: identical source regenerated';end if;
end $$;
reset role;
rollback;
select 'PASS: explicit budget defaults, owner/global separation, per-run model reservation, unknown cost retention, preparation daily cap, cadence and unchanged-source reuse (no external inference)' as evidence;
