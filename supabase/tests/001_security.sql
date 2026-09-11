-- Hosted nonproduction integration test. Run with explicit test-project guard. Always rolls back.
begin;
insert into auth.users(id,email) values
 ('a0000000-0000-4000-8000-000000000001','test-owner-a@example.invalid'),
 ('b0000000-0000-4000-8000-000000000001','test-owner-b@example.invalid'),
 ('a0000000-0000-4000-8000-000000000002','test-viewer@example.invalid'),
 ('a0000000-0000-4000-8000-000000000003','test-operator@example.invalid');
insert into public.workspaces(id,name,environment,business_model,time_zone,currency) values
 ('a0000000-0000-4000-8000-000000000010','RLS test A','shadow','b2b_services','America/Denver','USD'),
 ('b0000000-0000-4000-8000-000000000010','RLS test B','shadow','b2b_services','America/Denver','USD');
insert into public.memberships(id,workspace_id,actor_id,role) values
 ('a0000000-0000-4000-8000-000000000020','a0000000-0000-4000-8000-000000000010','a0000000-0000-4000-8000-000000000001','workspace_owner'),
 ('b0000000-0000-4000-8000-000000000020','b0000000-0000-4000-8000-000000000010','b0000000-0000-4000-8000-000000000001','workspace_owner'),
 ('a0000000-0000-4000-8000-000000000021','a0000000-0000-4000-8000-000000000010','a0000000-0000-4000-8000-000000000002','workspace_viewer'),
 ('a0000000-0000-4000-8000-000000000022','a0000000-0000-4000-8000-000000000010','a0000000-0000-4000-8000-000000000003','david_operator');
insert into public.installations(id,workspace_id,agent_id,definition_version,mode,daily_capacity) values
 ('a0000000-0000-4000-8000-000000000030','a0000000-0000-4000-8000-000000000010','deal-follow-up','1.0.0','monitored_execution',10);
insert into public.runs(id,workspace_id,installation_id,definition_version,sdk_version,deployment_id,environment,status) values
 ('a0000000-0000-4000-8000-000000000040','a0000000-0000-4000-8000-000000000010','a0000000-0000-4000-8000-000000000030','1.0.0','test','test','shadow','scheduled');
insert into public.accounts(id,workspace_id,name,source_key) values
 ('a0000000-0000-4000-8000-000000000050','a0000000-0000-4000-8000-000000000010','A','a'),
 ('b0000000-0000-4000-8000-000000000050','b0000000-0000-4000-8000-000000000010','B','b');
select set_config('test.route_token',(select route_token::text from private.run_routes where run_id='a0000000-0000-4000-8000-000000000040'),true);
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.workspaces)<>1 then raise exception 'FAIL: membership read isolation'; end if;
 if exists(select 1 from public.accounts where workspace_id='b0000000-0000-4000-8000-000000000010') then raise exception 'FAIL: cross workspace read'; end if;
 begin update public.workspaces set entitlement=32; raise exception 'FAIL: browser forged entitlement'; exception when insufficient_privilege then null; end;
 begin update public.approvals set status='approved'; raise exception 'FAIL: browser forged approval'; exception when insufficient_privilege then null; end;
 begin insert into public.receipts(workspace_id,action_id,status,provider,message,reconciliation) values('a0000000-0000-4000-8000-000000000010',gen_random_uuid(),'confirmed','google','forged','resolved'); raise exception 'FAIL: browser forged receipt'; exception when insufficient_privilege then null; end;
 begin perform * from vault.decrypted_secrets; raise exception 'FAIL: browser read secrets'; exception when insufficient_privilege then null; end;
 begin perform public.set_workspace_pause('b0000000-0000-4000-8000-000000000010',true); raise exception 'FAIL: null membership accepted'; exception when insufficient_privilege then null; end;
 begin perform public.begin_google_oauth('b0000000-0000-4000-8000-000000000010',repeat('a',64),repeat('v',64),'https://test.example.invalid/callback'); raise exception 'FAIL: cross-workspace OAuth'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
do $$ begin
 if exists(select 1 from public.workspaces) then raise exception 'FAIL: operator without MFA saw workspace'; end if;
 begin perform public.set_workspace_pause('a0000000-0000-4000-8000-000000000010',true); raise exception 'FAIL: operator without MFA wrote'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
do $$ begin
 if (select count(*) from public.workspaces)<>1 then raise exception 'FAIL: assigned operator MFA read'; end if;
end $$;
reset role;
set local role david_worker;
do $$ begin
 if private.current_workspace() is not null then raise exception 'FAIL: unbound transaction has context'; end if;
 if exists(select 1 from public.accounts) then raise exception 'FAIL: unbound worker read tenant'; end if;
 perform set_config('david.workspace_id','b0000000-0000-4000-8000-000000000010',true);
 if exists(select 1 from public.accounts) then raise exception 'FAIL: custom GUC forged scope'; end if;
 begin perform private.bind_run('a0000000-0000-4000-8000-000000000040',gen_random_uuid()); raise exception 'FAIL: forged routing token'; exception when insufficient_privilege then null; end;
 perform private.bind_run('a0000000-0000-4000-8000-000000000040',current_setting('test.route_token')::uuid);
 if (select count(*) from public.accounts)<>1 then raise exception 'FAIL: scoped worker read'; end if;
 if exists(select 1 from public.accounts where workspace_id='b0000000-0000-4000-8000-000000000010') then raise exception 'FAIL: worker cross workspace'; end if;
 begin insert into public.contacts(workspace_id,account_id,name,email,source_key,owner) values('a0000000-0000-4000-8000-000000000010','b0000000-0000-4000-8000-000000000050','Bad','bad@example.invalid','bad','Owner'); raise exception 'FAIL: cross workspace foreign key accepted'; exception when foreign_key_violation then null; end;
 begin update public.approvals set status='approved'; raise exception 'FAIL: worker forged approval'; exception when insufficient_privilege then null; end;
 begin perform * from vault.decrypted_secrets; raise exception 'FAIL: worker enumerated secrets'; exception when insufficient_privilege then null; end;
 begin perform * from private.run_routes; raise exception 'FAIL: worker enumerated routing capabilities'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role david_dispatcher;
do $$ begin
 begin perform * from public.contacts; raise exception 'FAIL: dispatcher read customer content'; exception when insufficient_privilege then null; end;
 if not exists(select 1 from private.route_run('a0000000-0000-4000-8000-000000000040')) then raise exception 'FAIL: dispatcher route lookup'; end if;
end $$;
reset role;
do $$ declare r record; begin
 for r in select rolname,rolsuper,rolbypassrls from pg_roles where rolname in ('david_worker','david_dispatcher','david_oauth') loop
  if r.rolsuper or r.rolbypassrls then raise exception 'FAIL: privileged runtime role %',r.rolname; end if;
 end loop;
 if exists(select 1 from pg_tables where schemaname='public' and tableowner in ('david_worker','david_dispatcher','david_oauth')) then raise exception 'FAIL: runtime role owns table'; end if;
 if exists(select 1 from storage.buckets where id='david-evidence' and public) then raise exception 'FAIL: evidence bucket public'; end if;
end $$;
rollback;
-- New transaction models a reused pooled connection: prior checked context must never survive.
begin;
set local role david_worker;
do $$ begin if private.current_workspace() is not null or exists(select 1 from public.accounts) then raise exception 'FAIL: pooled context leak'; end if; end $$;
rollback;
select 'PASS: actual authenticated/worker/dispatcher roles, MFA, RLS, tenant FKs, secret denials, pooled isolation' as evidence;
