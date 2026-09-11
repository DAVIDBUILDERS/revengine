begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('e1000000-0000-4000-8000-000000000001','discovery-owner@example.invalid',now()),
 ('e1000000-0000-4000-8000-000000000002','discovery-viewer@example.invalid',now());
insert into public.workspaces(id,name,environment,business_model,time_zone,currency) values
 ('e1000000-0000-4000-8000-000000000010','Discovery A','shadow','b2b_services','America/Denver','USD'),
 ('e1000000-0000-4000-8000-000000000011','Discovery B','shadow','b2b_services','America/Denver','USD');
insert into public.memberships(workspace_id,actor_id,role) values
 ('e1000000-0000-4000-8000-000000000010','e1000000-0000-4000-8000-000000000001','workspace_owner'),
 ('e1000000-0000-4000-8000-000000000010','e1000000-0000-4000-8000-000000000002','workspace_viewer');
insert into public.installations(workspace_id,agent_id,definition_version,mode,status,daily_capacity) values
 ('e1000000-0000-4000-8000-000000000010','account-intelligence','1.0.0','preparation','selected',0);
insert into public.connections(id,workspace_id,provider,identity,operations,health) values
 ('e1000000-0000-4000-8000-000000000020','e1000000-0000-4000-8000-000000000010','google','discovery-owner@example.invalid',array['sheets.read'],'unconfigured'),
 ('e1000000-0000-4000-8000-000000000021','e1000000-0000-4000-8000-000000000011','google','other@example.invalid',array['sheets.read'],'unconfigured'),
 ('e1000000-0000-4000-8000-000000000022','e1000000-0000-4000-8000-000000000010','google','expired@example.invalid',array['sheets.read'],'expired');
select set_config('request.jwt.claims','{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select public.begin_onboarding_discovery('e1000000-0000-4000-8000-000000000010','e1000000-0000-4000-8000-000000000020');
do $$ begin
 if not (select paused from public.workspaces where id='e1000000-0000-4000-8000-000000000010') then raise exception 'FAIL discovery resumed workspace';end if;
 if exists(select 1 from public.connections where id='e1000000-0000-4000-8000-000000000020' and health='healthy') then raise exception 'FAIL metadata marked capability verified';end if;
 begin perform public.begin_onboarding_discovery('e1000000-0000-4000-8000-000000000010','e1000000-0000-4000-8000-000000000021');raise exception 'FAIL cross-workspace discovery';exception when insufficient_privilege then null;end;
 begin perform public.begin_onboarding_discovery('e1000000-0000-4000-8000-000000000010','e1000000-0000-4000-8000-000000000022');raise exception 'FAIL expired discovery';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"e1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
do $$ begin
 begin perform public.begin_onboarding_discovery('e1000000-0000-4000-8000-000000000010','e1000000-0000-4000-8000-000000000020');raise exception 'FAIL viewer discovery';exception when insufficient_privilege then null;end;
end $$;
reset role;
select private.privacy_assert_schema();
rollback;
