begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('e3000000-0000-4000-8000-000000000001','briefing-owner@example.invalid',now()),
 ('e3000000-0000-4000-8000-000000000002','briefing-viewer@example.invalid',now()),
 ('e3000000-0000-4000-8000-000000000003','invited-admin@example.invalid',now());
insert into public.workspaces(id,name,environment,business_model,time_zone,currency) values
 ('e3000000-0000-4000-8000-000000000010','Setup A','shadow','b2b_services','America/Denver','USD'),
 ('e3000000-0000-4000-8000-000000000011','Setup B','shadow','b2b_services','America/Denver','USD');
insert into public.memberships(workspace_id,actor_id,role) values
 ('e3000000-0000-4000-8000-000000000010','e3000000-0000-4000-8000-000000000001','workspace_owner'),
 ('e3000000-0000-4000-8000-000000000010','e3000000-0000-4000-8000-000000000002','workspace_viewer');
select set_config('test.setup_answers', $answers${"company": {"name": "Example", "website": "https://example.invalid", "businessModel": "b2b_services", "timeZone": "America/Denver", "offers": ["Advisory"], "customers": ["Owners"], "priorities": ["Replies"], "successDefinition": "Verified replies", "brandGuidance": "", "forbiddenClaims": ""}, "team": ["account-intelligence"], "systems": [], "operations": {"approvalMode": "each_action", "automationAcknowledged": false, "policyAcknowledged": true, "contactRestrictions": "", "workingDays": [1, 2, 3, 4, 5], "startHour": 9, "endHour": 17, "meetingMinutes": 30, "bufferMinutes": 15, "dailyCapacity": 1, "modelDailyBudgetMinor": 0, "actionDailyBudgetMinor": 0, "sender": "", "calendarId": "", "escalationOwner": "operator@example.invalid", "approvedContactIds": []}, "people": [], "measurement": {"owner": "Owner", "baseline": [], "sharing": "private"}}$answers$,true);
select set_config('request.jwt.claims','{"sub":"e3000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;

select set_config('test.briefing', '{"version":1,"step":"goal","name":"Owner","goal":"demand","otherGoal":"","description":"","websiteInput":"","proposalSource":"","conversionAction":"","researchId":"e3000000-0000-4000-8000-000000000070","noWebsite":false,"reviewedFacts":"","task":"","finished":false}',true);
select set_config('test.answers',jsonb_set(jsonb_set(current_setting('test.setup_answers')::jsonb,'{briefing}',current_setting('test.briefing')::jsonb),'{operations,policyAcknowledged}','false')::text,true);
select public.save_onboarding('e3000000-0000-4000-8000-000000000010',0,current_setting('test.answers')::jsonb);
do $$ begin
 if public.read_onboarding('e3000000-0000-4000-8000-000000000010')#>>'{answers,briefing,step}' <> 'goal' then raise exception 'FAIL resume missing';end if;
 if not(select paused from public.workspaces where id='e3000000-0000-4000-8000-000000000010') then raise exception 'FAIL autosave enabled execution';end if;
 begin perform public.apply_onboarding_settings('e3000000-0000-4000-8000-000000000010',1);raise exception 'FAIL autosave authorized';exception when raise_exception then if sqlerrm like 'FAIL%' then raise;end if;end;
 begin perform public.save_onboarding('e3000000-0000-4000-8000-000000000010',0,current_setting('test.answers')::jsonb);raise exception 'FAIL conflict allowed';exception when serialization_failure then null;end;
 begin perform public.save_onboarding('e3000000-0000-4000-8000-000000000011',0,current_setting('test.answers')::jsonb);raise exception 'FAIL cross tenant write';exception when insufficient_privilege then null;end;
 begin perform public.save_briefing_capture('e3000000-0000-4000-8000-000000000010','e3000000-0000-4000-8000-000000000071','https://example.invalid','e3000000-0000-4000-8000-000000000080','{}');raise exception 'FAIL abandoned request accepted';exception when serialization_failure then null;end;
 begin perform public.save_briefing_capture('e3000000-0000-4000-8000-000000000010','e3000000-0000-4000-8000-000000000070','https://changed.invalid','e3000000-0000-4000-8000-000000000080','{}');raise exception 'FAIL changed URL accepted';exception when serialization_failure then null;end;
 begin perform public.save_briefing_capture('e3000000-0000-4000-8000-000000000011','e3000000-0000-4000-8000-000000000070','https://example.invalid','e3000000-0000-4000-8000-000000000080','{}');raise exception 'FAIL cross tenant capture';exception when insufficient_privilege then null;end;
 begin perform public.save_onboarding('e3000000-0000-4000-8000-000000000010',1,jsonb_set(current_setting('test.answers')::jsonb,'{briefing,step}','"activate"'));raise exception 'FAIL invalid flow step';exception when raise_exception then if sqlerrm like 'FAIL%' then raise;end if;end;
end $$;
-- Capture/confirmation binds current request, facts, and the selected business objective.
select set_config('test.capture',jsonb_build_object('id','e3000000-0000-4000-8000-000000000080','workspaceId','e3000000-0000-4000-8000-000000000010','sourceHash',repeat('a',64),'context',jsonb_build_object('fixture',false,'confirmed',false,'companyName','Awaiting review','offers','[]'::jsonb,'customerTypes','[]'::jsonb,'locations','[]'::jsonb,'pages',jsonb_build_array(jsonb_build_object('url','https://example.invalid','title','Example','description','','text','Example offers Advisory for Owners','capturedAt',now())),'evidence',jsonb_build_array(jsonb_build_object('id','e3000000-0000-4000-8000-000000000081','label','Test capture','source','https://example.invalid','quality','unknown','capturedAt',now()))))::text,true);
select public.save_briefing_capture('e3000000-0000-4000-8000-000000000010','e3000000-0000-4000-8000-000000000070','https://example.invalid','e3000000-0000-4000-8000-000000000080',current_setting('test.capture')::jsonb);
select set_config('test.confirmed',jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(current_setting('test.capture')::jsonb,'{onboardingRevision}','1'),'{context,confirmed}','true'),'{context,companyName}','"Example"'),'{context,offers}','["Advisory"]'),'{context,customerTypes}','["Owners"]'),'{context,evidence,0,quality}','"manually_reported"'),'{context,operatingGuidance}','{"brand":"","forbiddenClaims":"","objective":"Replies","desiredAction":""}')::text,true);
do $$ begin
 begin perform public.save_company_context('e3000000-0000-4000-8000-000000000010','e3000000-0000-4000-8000-000000000080',jsonb_set(current_setting('test.confirmed')::jsonb,'{context,operatingGuidance,objective}','"Unreviewed objective"'));raise exception 'FAIL objective substitution accepted';exception when serialization_failure then null;end;
end $$;
select public.save_company_context('e3000000-0000-4000-8000-000000000010','e3000000-0000-4000-8000-000000000080',current_setting('test.confirmed')::jsonb);
select public.save_onboarding('e3000000-0000-4000-8000-000000000010',1,jsonb_set(current_setting('test.answers')::jsonb,'{briefing,researchId}','"e3000000-0000-4000-8000-000000000072"'));
do $$ begin
 if exists(select 1 from public.product_records where workspace_id='e3000000-0000-4000-8000-000000000010' and kind='company_context' and payload#>>'{context,confirmed}'='true') then raise exception 'FAIL changed research retained confirmation';end if;
 begin perform public.save_briefing_capture('e3000000-0000-4000-8000-000000000010','e3000000-0000-4000-8000-000000000070','https://example.invalid','e3000000-0000-4000-8000-000000000080',current_setting('test.capture')::jsonb);raise exception 'FAIL late old capture accepted';exception when serialization_failure then null;end;
end $$;

-- An authenticated retry must return the same workspace, without another membership or charge.
select set_config('test.created_workspace',public.create_onboarding_workspace_once('e3000000-0000-4000-8000-000000000090','Retry-safe company','b2b_services','America/Denver')::text,true);
do $$ begin
 if public.create_onboarding_workspace_once('e3000000-0000-4000-8000-000000000090','Retry-safe company','b2b_services','America/Denver')::text<>current_setting('test.created_workspace') then raise exception 'FAIL duplicate workspace';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"e3000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
do $$ begin
 begin perform public.save_onboarding('e3000000-0000-4000-8000-000000000010',1,current_setting('test.answers')::jsonb);raise exception 'FAIL viewer saved';exception when insufficient_privilege then null;end;
 begin perform public.save_briefing_capture('e3000000-0000-4000-8000-000000000010','e3000000-0000-4000-8000-000000000070','https://example.invalid','e3000000-0000-4000-8000-000000000080','{}');raise exception 'FAIL viewer captured';exception when insufficient_privilege then null;end;
end $$;
reset role;
select private.privacy_assert_schema();
rollback;
