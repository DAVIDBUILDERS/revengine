begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('e0000000-0000-4000-8000-000000000001','setup-owner@example.invalid',now()),
 ('e0000000-0000-4000-8000-000000000002','setup-viewer@example.invalid',now()),
 ('e0000000-0000-4000-8000-000000000003','invited-admin@example.invalid',now());
insert into public.workspaces(id,name,environment,business_model,time_zone,currency) values
 ('e0000000-0000-4000-8000-000000000010','Setup A','shadow','b2b_services','America/Denver','USD'),
 ('e0000000-0000-4000-8000-000000000011','Setup B','shadow','b2b_services','America/Denver','USD');
insert into public.memberships(workspace_id,actor_id,role) values
 ('e0000000-0000-4000-8000-000000000010','e0000000-0000-4000-8000-000000000001','workspace_owner'),
 ('e0000000-0000-4000-8000-000000000010','e0000000-0000-4000-8000-000000000002','workspace_viewer');
select set_config('test.setup_answers', $answers${"company": {"name": "Example", "website": "https://example.invalid", "businessModel": "b2b_services", "timeZone": "America/Denver", "offers": ["Advisory"], "customers": ["Owners"], "priorities": ["Replies"], "successDefinition": "Verified replies", "brandGuidance": "", "forbiddenClaims": ""}, "team": ["account-intelligence"], "systems": [], "operations": {"approvalMode": "each_action", "automationAcknowledged": false, "policyAcknowledged": true, "contactRestrictions": "", "workingDays": [1, 2, 3, 4, 5], "startHour": 9, "endHour": 17, "meetingMinutes": 30, "bufferMinutes": 15, "dailyCapacity": 1, "modelDailyBudgetMinor": 0, "actionDailyBudgetMinor": 0, "sender": "", "calendarId": "", "escalationOwner": "operator@example.invalid", "approvedContactIds": []}, "people": [], "measurement": {"owner": "Owner", "baseline": [], "sharing": "private"}}$answers$,true);
select set_config('request.jwt.claims','{"sub":"e0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select public.save_onboarding('e0000000-0000-4000-8000-000000000010',0,current_setting('test.setup_answers')::jsonb);
do $$ begin
 if (public.read_onboarding('e0000000-0000-4000-8000-000000000010')->>'revision')::int<>1 then raise exception 'FAIL saved revision';end if;
 begin perform public.read_onboarding('e0000000-0000-4000-8000-000000000011');raise exception 'FAIL cross-workspace read';exception when insufficient_privilege then null;end;
 begin perform public.save_onboarding('e0000000-0000-4000-8000-000000000010',0,current_setting('test.setup_answers')::jsonb);raise exception 'FAIL stale write';exception when serialization_failure then null;end;
 begin update public.onboarding_documents set revision=999;raise exception 'FAIL direct mutation';exception when insufficient_privilege then null;end;
 begin perform public.assign_onboarding_operator('e0000000-0000-4000-8000-000000000010','setup-owner@example.invalid');raise exception 'FAIL client promoted to operator';exception when insufficient_privilege then null;end;
 begin perform public.configure_workspace_allowance('e0000000-0000-4000-8000-000000000010',32);raise exception 'FAIL owner entitlement escalation';exception when insufficient_privilege then null;end;
 begin perform public.create_workspace_invitation('e0000000-0000-4000-8000-000000000011','invited-admin@example.invalid','workspace_owner',repeat('b',64));raise exception 'FAIL cross-workspace invitation';exception when insufficient_privilege then null;end;
end $$;
select public.update_onboarding_task('e0000000-0000-4000-8000-000000000010',1,'access','Grant account access','Administrator','open','');
select public.create_workspace_invitation('e0000000-0000-4000-8000-000000000010','invited-admin@example.invalid','workspace_owner',repeat('a',64));
select public.create_workspace_invitation('e0000000-0000-4000-8000-000000000010','invited-admin@example.invalid','workspace_viewer',repeat('c',64));
select public.revoke_workspace_invitation('e0000000-0000-4000-8000-000000000010',public.create_workspace_invitation('e0000000-0000-4000-8000-000000000010','invited-admin@example.invalid','workspace_viewer',repeat('d',64)));
reset role;
update private.workspace_invitations set expires_at=now()-interval '1 second' where token_hash=repeat('c',64);
set local role authenticated;
select public.apply_onboarding_settings('e0000000-0000-4000-8000-000000000010',1);
do $$ begin
 if not (select paused from public.workspaces where id='e0000000-0000-4000-8000-000000000010') then raise exception 'FAIL applying setup resumed execution';end if;
 if not exists(select 1 from public.installations where workspace_id='e0000000-0000-4000-8000-000000000010' and agent_id='account-intelligence' and daily_capacity=1) then raise exception 'FAIL capacity not applied';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"e0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
do $$ begin
 begin perform public.save_onboarding('e0000000-0000-4000-8000-000000000010',1,current_setting('test.setup_answers')::jsonb);raise exception 'FAIL viewer saved setup';exception when insufficient_privilege then null;end;
 begin perform public.accept_workspace_invitation(repeat('a',64));raise exception 'FAIL wrong recipient accepted';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"e0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
do $$ begin
 begin perform public.accept_workspace_invitation(repeat('c',64));raise exception 'FAIL expired invitation accepted';exception when insufficient_privilege then null;end;
 begin perform public.accept_workspace_invitation(repeat('d',64));raise exception 'FAIL revoked invitation accepted';exception when insufficient_privilege then null;end;
end $$;
select public.accept_workspace_invitation(repeat('a',64));
do $$ begin
 if not exists(select 1 from public.memberships where actor_id='e0000000-0000-4000-8000-000000000003' and workspace_id='e0000000-0000-4000-8000-000000000010' and role='workspace_owner') then raise exception 'FAIL invitation membership';end if;
 begin perform public.accept_workspace_invitation(repeat('a',64));raise exception 'FAIL invitation replay';exception when insufficient_privilege then null;end;
end $$;
reset role;
select private.privacy_assert_schema();
rollback;
