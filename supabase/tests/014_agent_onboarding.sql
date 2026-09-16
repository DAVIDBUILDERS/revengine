-- Per-client agent onboarding isolation. No provider calls.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('e6000000-0000-4000-8000-000000000001','agent-onboard-a@example.invalid',now()),
 ('e6000000-0000-4000-8000-000000000002','agent-onboard-viewer@example.invalid',now()),
 ('e6000000-0000-4000-8000-000000000003','agent-onboard-b@example.invalid',now());
insert into public.workspaces(id,name,environment,business_model,time_zone,currency) values
 ('e6000000-0000-4000-8000-000000000010','Agent onboard A','shadow','b2b_services','UTC','USD'),
 ('e6000000-0000-4000-8000-000000000011','Agent onboard B','shadow','b2b_services','UTC','USD');
insert into public.memberships(workspace_id,actor_id,role) values
 ('e6000000-0000-4000-8000-000000000010','e6000000-0000-4000-8000-000000000001','workspace_owner'),
 ('e6000000-0000-4000-8000-000000000010','e6000000-0000-4000-8000-000000000002','workspace_viewer'),
 ('e6000000-0000-4000-8000-000000000011','e6000000-0000-4000-8000-000000000003','workspace_owner');
select set_config('request.jwt.claims','{"sub":"e6000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select public.read_onboarding_v2('e6000000-0000-4000-8000-000000000010');
do $$ declare records jsonb; begin
 records:=public.read_agent_onboarding('e6000000-0000-4000-8000-000000000010');
 if jsonb_array_length(records)<>32 then raise exception 'FAIL missing per-agent onboarding rows';end if;
 if records->0->>'status'<>'not_started' then raise exception 'FAIL default status';end if;
 if not exists(select 1 from jsonb_array_elements(records) r where r->>'agentId'='outbound-email-sdr' and r#>'{requiredTools,tools}' @> '["instantly.campaign"]'::jsonb) then raise exception 'FAIL outbound tools not stored';end if;
 begin perform public.read_agent_onboarding('e6000000-0000-4000-8000-000000000011');raise exception 'FAIL cross-workspace agent onboarding read';exception when insufficient_privilege then null;end;
 begin update public.agent_onboarding set status='ready';raise exception 'FAIL direct mutation';exception when insufficient_privilege then null;end;
end $$;
select public.save_agent_onboarding('e6000000-0000-4000-8000-000000000010','outbound-email-sdr',0,'{"bookingUrl":"https://calendly.com/example"}');
select public.select_team('e6000000-0000-4000-8000-000000000010',array['account-intelligence']);
do $$ declare records jsonb; sdr jsonb; intel jsonb; begin
 records:=public.read_agent_onboarding('e6000000-0000-4000-8000-000000000010');
 select value into sdr from jsonb_array_elements(records) r(value) where value->>'agentId'='outbound-email-sdr';
 select value into intel from jsonb_array_elements(records) r(value) where value->>'agentId'='account-intelligence';
 if sdr->>'status'<>'in_progress' or sdr->>'revision'<>'1' or sdr#>>'{answers,bookingUrl}'<>'https://calendly.com/example' then raise exception 'FAIL agent answers not retained';end if;
 if intel->>'status'<>'not_started' or intel->>'revision'<>'0' then raise exception 'FAIL other agent onboarding mutated';end if;
 if jsonb_array_length(records)<>32 then raise exception 'FAIL team swap deleted agent onboarding';end if;
 begin perform public.save_agent_onboarding('e6000000-0000-4000-8000-000000000010','outbound-email-sdr',0,'{"bookingUrl":"https://calendly.com/stale"}');raise exception 'FAIL stale agent save';exception when serialization_failure then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"e6000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
do $$ begin
 if jsonb_array_length(public.read_agent_onboarding('e6000000-0000-4000-8000-000000000010'))<>32 then raise exception 'FAIL viewer lost read';end if;
 begin perform public.save_agent_onboarding('e6000000-0000-4000-8000-000000000010','account-intelligence',0,'{"note":"viewer"}');raise exception 'FAIL viewer saved agent onboarding';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"e6000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
select public.read_onboarding_v2('e6000000-0000-4000-8000-000000000011');
do $$ begin
 if exists(select 1 from jsonb_array_elements(public.read_agent_onboarding('e6000000-0000-4000-8000-000000000011')) r where r#>>'{answers,bookingUrl}' is not null) then raise exception 'FAIL client B received client A answers';end if;
end $$;
reset role;
select private.privacy_assert_schema();
rollback;
