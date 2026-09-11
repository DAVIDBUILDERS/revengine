begin;
insert into auth.users(id,email) values('a4000000-0000-4000-8000-000000000001','readiness-owner@example.invalid'),('b4000000-0000-4000-8000-000000000001','readiness-nonmember@example.invalid');
insert into public.workspaces(id,name,environment,business_model,time_zone,currency) values('a4000000-0000-4000-8000-000000000010','Shadow readiness fixture','shadow','b2b_services','UTC','USD');
insert into public.memberships(id,workspace_id,actor_id,role) values('a4000000-0000-4000-8000-000000000020','a4000000-0000-4000-8000-000000000010','a4000000-0000-4000-8000-000000000001','workspace_owner');
insert into public.installations(id,workspace_id,agent_id,definition_version,mode,status,daily_capacity) values('a4000000-0000-4000-8000-000000000030','a4000000-0000-4000-8000-000000000010','technical-seo-monitor','1.0.0','preparation','selected',1);
insert into public.runs(id,workspace_id,installation_id,definition_version,sdk_version,deployment_id,environment,status,next_due_at) values('a4000000-0000-4000-8000-000000000040','a4000000-0000-4000-8000-000000000010','a4000000-0000-4000-8000-000000000030','proposal-v1','test','test','shadow','paused',now());
select set_config('request.jwt.claims','{"sub":"b4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
do $$ begin
 begin perform public.read_workspace_readiness('a4000000-0000-4000-8000-000000000010');raise exception 'FAIL: nonmember read readiness';exception when insufficient_privilege then null;end;
 begin perform public.set_workspace_pause('a4000000-0000-4000-8000-000000000010',false);raise exception 'FAIL: nonmember resumed workspace';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
do $$ declare rejected boolean:=false; begin
 begin perform public.set_workspace_pause('a4000000-0000-4000-8000-000000000010',false);exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'FAIL: shadow resumed without confirmed context';end if;
end $$;
reset role;
insert into public.evidence(id,workspace_id,label,source,quality,captured_at) values('a4000000-0000-4000-8000-000000000050','a4000000-0000-4000-8000-000000000010','Source fixture','https://example.invalid','manually_reported',now());
insert into public.product_records(workspace_id,kind,payload) values('a4000000-0000-4000-8000-000000000010','company_context','{"confirmed":true,"fixture":false,"evidence":[{"id":"a4000000-0000-4000-8000-000000000050"}]}');
set local role authenticated;
select public.set_workspace_pause('a4000000-0000-4000-8000-000000000010',false);
do $$ declare readiness jsonb;begin
 if (select paused from public.workspaces where id='a4000000-0000-4000-8000-000000000010') then raise exception 'FAIL: eligible shadow preparation did not resume';end if;
 if not exists(select 1 from public.runs where id='a4000000-0000-4000-8000-000000000040' and status='cancelled' and next_due_at is null) then raise exception 'FAIL: old paused run revived';end if;
 if not exists(select 1 from public.installations where id='a4000000-0000-4000-8000-000000000030' and status='monitoring' and preparation_next_due_at is not null) then raise exception 'FAIL: resumed preparation not scheduled';end if;
 readiness:=public.read_workspace_readiness('a4000000-0000-4000-8000-000000000010');
 if (readiness->>'action')::boolean or (readiness->>'measurement')::boolean then raise exception 'FAIL: shadow preparation claims live/financial readiness';end if;
end $$;
reset role;
update public.workspaces set environment='live',paused=true where id='a4000000-0000-4000-8000-000000000010';
set local role authenticated;
do $$ declare rejected boolean:=false; begin
 begin perform public.set_workspace_pause('a4000000-0000-4000-8000-000000000010',false);exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'FAIL: live resumed without sender/cohort/operator activation';end if;
end $$;
rollback;
select 'PASS: private readiness, safe shadow resume, no revival of paused work, no live/financial claims, missing live activation blocks' as evidence;
