-- Synthetic setup configuration checks only. No live source verification is asserted.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('e5000000-0000-4000-8000-000000000001','baseline-owner@example.invalid',now()),
 ('e5000000-0000-4000-8000-000000000002','baseline-viewer@example.invalid',now()),
 ('e5000000-0000-4000-8000-000000000003','baseline-other-owner@example.invalid',now());
insert into public.workspaces(id,name,environment,business_model,time_zone,currency,created_at) values
 ('e5000000-0000-4000-8000-000000000010','Legacy before answers','shadow','b2b_services','UTC','USD',now()-interval '1 day'),
 ('e5000000-0000-4000-8000-000000000011','Other legacy company','shadow','home_services','UTC','USD',now()-interval '2 days');
insert into public.memberships(workspace_id,actor_id,role) values
 ('e5000000-0000-4000-8000-000000000010','e5000000-0000-4000-8000-000000000001','workspace_owner'),
 ('e5000000-0000-4000-8000-000000000010','e5000000-0000-4000-8000-000000000002','workspace_viewer'),
 ('e5000000-0000-4000-8000-000000000011','e5000000-0000-4000-8000-000000000003','workspace_owner');
insert into public.connections(id,workspace_id,provider,identity,operations,health,verified_at,last_sync_at) values
 ('e5000000-0000-4000-8000-000000000020','e5000000-0000-4000-8000-000000000010','google','baseline-owner@example.invalid',array['sheets.read'],'healthy',now()-interval '10 minutes',now()-interval '10 minutes');
insert into public.source_bindings(id,workspace_id,connection_id,resource_type,resource_id,range_name,mapping,source_owner,verified_at) values
 ('e5000000-0000-4000-8000-000000000021','e5000000-0000-4000-8000-000000000010','e5000000-0000-4000-8000-000000000020','sheet','synthetic-preteam-sheet','Proposals!A1:Q20','{}','Company owner',now()-interval '10 minutes');
select set_config('request.jwt.claims','{"sub":"e5000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
do $$ declare baseline jsonb; begin
 if public.read_onboarding('e5000000-0000-4000-8000-000000000010') is not null then raise exception 'FAIL legacy fixture unexpectedly initialized';end if;
 baseline:=public.read_onboarding_v2('e5000000-0000-4000-8000-000000000010');
 if baseline->>'revision'<>'0' or baseline->>'configurationRevision'<>'0' or (baseline->>'configurationUpdatedAt')::timestamptz<>(select created_at from public.workspaces where id='e5000000-0000-4000-8000-000000000010') then raise exception 'FAIL initial company configuration time is not stable';end if;
 if baseline#>>'{answers,operations,dailyCapacity}'<>'0' or baseline#>>'{answers,operations,policyAcknowledged}'<>'false' or baseline#>>'{answers,operations,automationAcknowledged}'<>'false' or baseline#>'{answers,team}'<>'[]'::jsonb or baseline->>'appliedRevision' is not null then raise exception 'FAIL baseline granted operating permissions or team';end if;
 if public.read_onboarding_v2('e5000000-0000-4000-8000-000000000010') is distinct from baseline then raise exception 'FAIL repeat snapshot changed initial configuration';end if;
 begin perform public.read_onboarding_v2('e5000000-0000-4000-8000-000000000011');raise exception 'FAIL baseline read crossed workspace';exception when insufficient_privilege then null;end;
 begin perform private.initialize_onboarding_baseline('e5000000-0000-4000-8000-000000000011');raise exception 'FAIL browser called private baseline writer';exception when insufficient_privilege then null;end;
end $$;
select public.save_onboarding('e5000000-0000-4000-8000-000000000010',0,jsonb_set(public.read_onboarding_v2('e5000000-0000-4000-8000-000000000010')->'answers','{team}','["account-intelligence"]'));
do $$ declare doc jsonb; begin
 doc:=public.read_onboarding_v2('e5000000-0000-4000-8000-000000000010');
 if doc->>'revision'<>'1' or doc->>'configurationRevision'<>'0' then raise exception 'FAIL first team save invalidated shared source proof';end if;
 if not exists(select 1 from public.source_bindings where id='e5000000-0000-4000-8000-000000000021' and verified_at>(doc->>'configurationUpdatedAt')::timestamptz) then raise exception 'FAIL existing preteam read is older than baseline';end if;
 if exists(select 1 from public.installations where workspace_id='e5000000-0000-4000-8000-000000000010') or exists(select 1 from public.actions where workspace_id='e5000000-0000-4000-8000-000000000010') then raise exception 'FAIL saving team implicitly executed or installed work';end if;
 if not(select paused from public.workspaces where id='e5000000-0000-4000-8000-000000000010') then raise exception 'FAIL first team save resumed work';end if;
end $$;
select public.save_onboarding('e5000000-0000-4000-8000-000000000010',1,jsonb_set(public.read_onboarding_v2('e5000000-0000-4000-8000-000000000010')->'answers','{company,offers}','["Owner supplied service"]'));
do $$ begin
 if public.read_onboarding_v2('e5000000-0000-4000-8000-000000000010')->>'configurationRevision'<>'2' then raise exception 'FAIL actual company configuration did not invalidate stale proof';end if;
end $$;
select set_config('test.baseline_created',public.create_onboarding_workspace_once('e5000000-0000-4000-8000-000000000030','New company baseline','b2b_services','UTC')::text,true);
do $$ declare doc jsonb; begin
 doc:=public.read_onboarding(current_setting('test.baseline_created')::uuid);
 if doc is null or doc->>'revision'<>'0' or doc#>>'{answers,company,name}'<>'New company baseline' then raise exception 'FAIL new company did not start with persisted defaults';end if;
 if public.create_onboarding_workspace_once('e5000000-0000-4000-8000-000000000030','New company baseline','b2b_services','UTC')::text<>current_setting('test.baseline_created') then raise exception 'FAIL baseline broke retry-safe company creation';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"e5000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
do $$ begin
 if public.read_onboarding_v2('e5000000-0000-4000-8000-000000000010')->>'configurationRevision'<>'2' then raise exception 'FAIL viewer changed baseline';end if;
 begin perform public.save_onboarding('e5000000-0000-4000-8000-000000000010',2,public.read_onboarding_v2('e5000000-0000-4000-8000-000000000010')->'answers');raise exception 'FAIL viewer changed company answers';exception when insufficient_privilege then null;end;
end $$;
-- Older clients can save without ever invoking the v2 reader; the same baseline applies.
select set_config('request.jwt.claims','{"sub":"e5000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
select public.save_onboarding('e5000000-0000-4000-8000-000000000011',0,'{"company":{"name":"Other legacy company","website":"","businessModel":"home_services","timeZone":"UTC","offers":[],"customers":[],"priorities":[],"successDefinition":"","brandGuidance":"","forbiddenClaims":""},"team":["account-intelligence"],"systems":[],"operations":{"approvalMode":"each_action","automationAcknowledged":false,"contactRestrictions":"","workingDays":[1,2,3,4,5],"startHour":9,"endHour":17,"meetingMinutes":30,"bufferMinutes":15,"dailyCapacity":0,"modelDailyBudgetMinor":null,"actionDailyBudgetMinor":0,"sender":"","calendarId":"","escalationOwner":"","approvedContactIds":[],"policyAcknowledged":false},"people":[],"measurement":{"owner":"","outcomeSources":"","baseline":[],"sharing":"private"}}');
do $$ begin
 if public.read_onboarding_v2('e5000000-0000-4000-8000-000000000011')->>'configurationRevision'<>'0' then raise exception 'FAIL old direct save missed initial baseline';end if;
end $$;
reset role;
select private.privacy_assert_schema();
rollback;
