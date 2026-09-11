begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('e2000000-0000-4000-8000-000000000001','prepared-owner@example.invalid',now()),
 ('e2000000-0000-4000-8000-000000000002','prepared-viewer@example.invalid',now()),
 ('e2000000-0000-4000-8000-000000000003','invited-admin@example.invalid',now());
insert into public.workspaces(id,name,environment,business_model,time_zone,currency) values
 ('e2000000-0000-4000-8000-000000000010','Setup A','shadow','b2b_services','America/Denver','USD'),
 ('e2000000-0000-4000-8000-000000000011','Setup B','shadow','b2b_services','America/Denver','USD');
insert into public.memberships(workspace_id,actor_id,role) values
 ('e2000000-0000-4000-8000-000000000010','e2000000-0000-4000-8000-000000000001','workspace_owner'),
 ('e2000000-0000-4000-8000-000000000010','e2000000-0000-4000-8000-000000000002','workspace_viewer');
select set_config('test.setup_answers', $answers${"company": {"name": "Example", "website": "https://example.invalid", "businessModel": "b2b_services", "timeZone": "America/Denver", "offers": ["Advisory"], "customers": ["Owners"], "priorities": ["Replies"], "successDefinition": "Verified replies", "brandGuidance": "", "forbiddenClaims": ""}, "team": ["account-intelligence"], "systems": [], "operations": {"approvalMode": "each_action", "automationAcknowledged": false, "policyAcknowledged": true, "contactRestrictions": "", "workingDays": [1, 2, 3, 4, 5], "startHour": 9, "endHour": 17, "meetingMinutes": 30, "bufferMinutes": 15, "dailyCapacity": 1, "modelDailyBudgetMinor": 0, "actionDailyBudgetMinor": 0, "sender": "", "calendarId": "", "escalationOwner": "operator@example.invalid", "approvedContactIds": []}, "people": [], "measurement": {"owner": "Owner", "baseline": [], "sharing": "private"}}$answers$,true);
select set_config('request.jwt.claims','{"sub":"e2000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;

-- Provider/source suggestions are persisted separately from effective answers.
select set_config('test.prepared_doc',public.save_setup_document('e2000000-0000-4000-8000-000000000010','Company.md','Company: Example Advisory')::text,true);
select set_config('test.prepared_fingerprint',public.read_setup_fingerprint('e2000000-0000-4000-8000-000000000010'),true);
select set_config('test.prepared_payload',jsonb_build_object('id','e2000000-0000-4000-8000-000000000050','workspaceId','e2000000-0000-4000-8000-000000000010','generation',1,'basedOnRevision',0,'createdAt',now(),'fixture',false,'goal','demand','captureId',null,'sourceHash',null,'inputSignature','[]','answers',jsonb_set(current_setting('test.setup_answers')::jsonb,'{operations,policyAcknowledged}','false'),'citations','[]'::jsonb,'conflicts','[]'::jsonb,'limitations','[]'::jsonb,'acceptedRevision',null)::text,true);
select public.save_prepared_setup('e2000000-0000-4000-8000-000000000010',0,0,current_setting('test.prepared_fingerprint'),current_setting('test.prepared_payload')::jsonb);
do $$ begin
 if exists(select 1 from public.onboarding_documents where workspace_id='e2000000-0000-4000-8000-000000000010') then raise exception 'FAIL discovery accepted answers';end if;
 if not(select paused from public.workspaces where id='e2000000-0000-4000-8000-000000000010') then raise exception 'FAIL discovery resumed workspace';end if;
 begin perform public.save_setup_document('e2000000-0000-4000-8000-000000000011','x.md','Company: Other');raise exception 'FAIL cross-workspace write';exception when insufficient_privilege then null;end;
 begin perform public.accept_prepared_setup('e2000000-0000-4000-8000-000000000010',2,0,current_setting('test.setup_answers')::jsonb);raise exception 'FAIL stale proposal accepted';exception when serialization_failure then null;end;
 begin perform public.accept_prepared_setup('e2000000-0000-4000-8000-000000000010',1,0,jsonb_set(current_setting('test.setup_answers')::jsonb,'{operations,policyAcknowledged}','false'));raise exception 'FAIL unapproved policy accepted';exception when raise_exception then if sqlerrm like 'FAIL%' then raise;end if;end;
end $$;
-- A newly selected document changes the proposal's source fingerprint.
select public.save_setup_document('e2000000-0000-4000-8000-000000000010','Services.md','Services: Advisory');
do $$ begin
 begin perform public.accept_prepared_setup('e2000000-0000-4000-8000-000000000010',1,0,current_setting('test.setup_answers')::jsonb);raise exception 'FAIL changed sources accepted';exception when serialization_failure then null;end;
end $$;
select public.save_prepared_setup('e2000000-0000-4000-8000-000000000010',0,1,public.read_setup_fingerprint('e2000000-0000-4000-8000-000000000010'),jsonb_set(current_setting('test.prepared_payload')::jsonb,'{generation}','2'));
select public.accept_prepared_setup('e2000000-0000-4000-8000-000000000010',2,0,current_setting('test.setup_answers')::jsonb);
do $$ begin
 if (public.read_onboarding('e2000000-0000-4000-8000-000000000010')->>'revision')::int<>1 then raise exception 'FAIL accepted revision missing';end if;
 if not(select paused from public.workspaces where id='e2000000-0000-4000-8000-000000000010') then raise exception 'FAIL acceptance resumed execution';end if;
 begin update public.product_records set payload='{}' where kind='prepared_setup';raise exception 'FAIL direct proposal write';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"e2000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
do $$ begin
 begin perform public.save_setup_document('e2000000-0000-4000-8000-000000000010','x.md','Company: Viewer');raise exception 'FAIL viewer edited sources';exception when insufficient_privilege then null;end;
 begin perform public.read_setup_fingerprint('e2000000-0000-4000-8000-000000000010');raise exception 'FAIL viewer initiated setup discovery';exception when insufficient_privilege then null;end;
end $$;
reset role;
select private.privacy_assert_schema();
rollback;
