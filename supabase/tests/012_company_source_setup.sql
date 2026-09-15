-- Synthetic database regression only: no provider calls or customer accounts.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('e4000000-0000-4000-8000-000000000001','company-a-owner@example.invalid',now()),
 ('e4000000-0000-4000-8000-000000000002','company-a-viewer@example.invalid',now()),
 ('e4000000-0000-4000-8000-000000000003','company-b-owner@example.invalid',now());
insert into public.workspaces(id,name,environment,business_model,time_zone,currency) values
 ('e4000000-0000-4000-8000-000000000010','Company sources A','shadow','b2b_services','UTC','USD'),
 ('e4000000-0000-4000-8000-000000000011','Company sources B','shadow','b2b_services','UTC','USD');
insert into public.memberships(workspace_id,actor_id,role) values
 ('e4000000-0000-4000-8000-000000000010','e4000000-0000-4000-8000-000000000001','workspace_owner'),
 ('e4000000-0000-4000-8000-000000000010','e4000000-0000-4000-8000-000000000002','workspace_viewer'),
 ('e4000000-0000-4000-8000-000000000011','e4000000-0000-4000-8000-000000000003','workspace_owner');
insert into public.connections(id,workspace_id,provider,identity,operations,health) values
 ('e4000000-0000-4000-8000-000000000020','e4000000-0000-4000-8000-000000000010','google','company-a-owner@example.invalid',array['sheets.read','gmail.read','gmail.send','calendar.freebusy','calendar.book'],'unconfigured'),
 ('e4000000-0000-4000-8000-000000000021','e4000000-0000-4000-8000-000000000011','google','company-b-owner@example.invalid',array['sheets.read'],'unconfigured'),
 ('e4000000-0000-4000-8000-000000000022','e4000000-0000-4000-8000-000000000010','google','expired@example.invalid',array['sheets.read'],'expired'),
 ('e4000000-0000-4000-8000-000000000023','e4000000-0000-4000-8000-000000000010','google','failed@example.invalid',array['sheets.read'],'failed'),
 ('e4000000-0000-4000-8000-000000000024','e4000000-0000-4000-8000-000000000010','google','missing-scope@example.invalid',array['gmail.read'],'unconfigured');
insert into private.connection_secrets(workspace_id,connection_id,vault_id,expires_at)
values('e4000000-0000-4000-8000-000000000010','e4000000-0000-4000-8000-000000000020',vault.create_secret('{"accessToken":"SYNTHETIC_SOURCE_TOKEN","refreshToken":"SYNTHETIC_REFRESH"}'),now()+interval '1 hour');
select set_config('request.jwt.claims','{"sub":"e4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select public.bind_google_resource('e4000000-0000-4000-8000-000000000010','e4000000-0000-4000-8000-000000000020','sheet','synthetic-company-file','Proposals!A1:Q20','{}','Company A owner');
select set_config('test.company_check',public.queue_connection_check('e4000000-0000-4000-8000-000000000010','e4000000-0000-4000-8000-000000000020')::text,true);
select set_config('test.company_discovery',public.begin_onboarding_discovery('e4000000-0000-4000-8000-000000000010','e4000000-0000-4000-8000-000000000020','{"operation":"list_sheets"}')::text,true);
do $$ begin
 if exists(select 1 from public.installations where workspace_id='e4000000-0000-4000-8000-000000000010') then raise exception 'FAIL source setup consumed a specialist seat';end if;
 if (select entitlement from public.workspaces where id='e4000000-0000-4000-8000-000000000010')<>5 then raise exception 'FAIL source setup changed allowance';end if;
 if not exists(select 1 from public.runs where id=current_setting('test.company_check')::uuid and installation_id is null and definition_version='connection-check-v1') then raise exception 'FAIL check still requires agent';end if;
 if not exists(select 1 from public.runs where id=current_setting('test.company_discovery')::uuid and installation_id is null and definition_version='onboarding-discovery-v1') then raise exception 'FAIL discovery still requires agent';end if;
 if public.queue_connection_check('e4000000-0000-4000-8000-000000000010','e4000000-0000-4000-8000-000000000020')::text<>current_setting('test.company_check') then raise exception 'FAIL duplicate active verification';end if;
 begin perform public.queue_connection_check('e4000000-0000-4000-8000-000000000010','e4000000-0000-4000-8000-000000000021');raise exception 'FAIL cross-company resource';exception when insufficient_privilege then null;end;
 begin perform public.queue_connection_check('e4000000-0000-4000-8000-000000000011','e4000000-0000-4000-8000-000000000021');raise exception 'FAIL other company queue';exception when insufficient_privilege then null;end;
 begin perform public.queue_connection_check('e4000000-0000-4000-8000-000000000010','e4000000-0000-4000-8000-000000000022');raise exception 'FAIL expired connection';exception when insufficient_privilege then null;end;
 begin perform public.queue_connection_check('e4000000-0000-4000-8000-000000000010','e4000000-0000-4000-8000-000000000023');raise exception 'FAIL failed connection';exception when insufficient_privilege then null;end;
 begin perform public.queue_connection_check('e4000000-0000-4000-8000-000000000010','e4000000-0000-4000-8000-000000000024');raise exception 'FAIL verification without bound resources';exception when raise_exception then if sqlerrm like 'FAIL%' then raise;end if;end;
 begin perform public.begin_onboarding_discovery('e4000000-0000-4000-8000-000000000010','e4000000-0000-4000-8000-000000000024');raise exception 'FAIL missing discovery grant';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"e4000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
do $$ begin
 begin perform public.queue_connection_check('e4000000-0000-4000-8000-000000000010','e4000000-0000-4000-8000-000000000020');raise exception 'FAIL viewer verification';exception when insufficient_privilege then null;end;
 begin perform public.begin_onboarding_discovery('e4000000-0000-4000-8000-000000000010','e4000000-0000-4000-8000-000000000020');raise exception 'FAIL viewer discovery';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"e4000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
select public.bind_google_resource('e4000000-0000-4000-8000-000000000011','e4000000-0000-4000-8000-000000000021','sheet','synthetic-company-b-file','Proposals!A1:Q20','{}','Company B owner');
select public.queue_connection_check('e4000000-0000-4000-8000-000000000011','e4000000-0000-4000-8000-000000000021');
reset role;
select set_config('test.company_route',(select route_token::text from private.run_routes where run_id=current_setting('test.company_check')::uuid),true);
set local role david_worker;
select private.bind_run(current_setting('test.company_check')::uuid,current_setting('test.company_route')::uuid);
select private.claim_run('synthetic-company-source-check');
do $$ begin
 if private.connection_token('e4000000-0000-4000-8000-000000000020','sheets.read')->>'accessToken'<>'SYNTHETIC_SOURCE_TOKEN' then raise exception 'FAIL read token denied';end if;
 begin perform private.connection_token('e4000000-0000-4000-8000-000000000020','gmail.send');raise exception 'FAIL source job got send token';exception when insufficient_privilege then null;end;
 begin perform private.connection_token('e4000000-0000-4000-8000-000000000020','calendar.book');raise exception 'FAIL source job got booking token';exception when insufficient_privilege then null;end;
 begin perform private.connection_token('e4000000-0000-4000-8000-000000000021','sheets.read');raise exception 'FAIL source job crossed connection';exception when insufficient_privilege then null;end;
 begin perform private.create_action('e4000000-0000-4000-8000-000000000090','e4000000-0000-4000-8000-000000000091','e4000000-0000-4000-8000-000000000092','send_follow_up','{}',repeat('a',64),'e4000000-0000-4000-8000-000000000093',0,now()+interval '1 hour');raise exception 'FAIL source job created action';exception when insufficient_privilege then null;end;
 begin update public.runs set definition_version='proposal-v1' where id=current_setting('test.company_check')::uuid;raise exception 'FAIL source job became business job';exception when insufficient_privilege then null;end;
 begin update public.runs set status='awaiting_approval' where id=current_setting('test.company_check')::uuid;raise exception 'FAIL source job became approval workflow';exception when check_violation then null;end;
end $$;
reset role;
-- A connection that fails after queueing loses setup token access immediately.
update public.connections set health='failed' where id='e4000000-0000-4000-8000-000000000020';
set local role david_worker;
do $$ begin
 begin perform private.connection_token('e4000000-0000-4000-8000-000000000020','sheets.read');raise exception 'FAIL failed setup connection retained read token';exception when insufficient_privilege then null;end;
end $$;
reset role;
update public.connections set health='unconfigured' where id='e4000000-0000-4000-8000-000000000020';
do $$ begin
 begin insert into public.runs(workspace_id,installation_id,connection_id,definition_version,sdk_version,deployment_id,environment,status)
 values('e4000000-0000-4000-8000-000000000010',null,'e4000000-0000-4000-8000-000000000020','proposal-v1','4.8.8','synthetic','shadow','scheduled');raise exception 'FAIL business run without installation';exception when check_violation then null;end;
 begin update private.run_inputs set payload=payload-'connectionId' where run_id=current_setting('test.company_check')::uuid;raise exception 'FAIL source job input lost connection scope';exception when insufficient_privilege then null;end;
 begin update private.run_inputs set kind='draft' where run_id=current_setting('test.company_check')::uuid;raise exception 'FAIL source job input became business work';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.actions where workspace_id='e4000000-0000-4000-8000-000000000010') then raise exception 'FAIL source setup created external action';end if;
end $$;
-- No business work is bound to these checks; choosing/swapping a team must not stop them.
select set_config('request.jwt.claims','{"sub":"e4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select public.select_team('e4000000-0000-4000-8000-000000000010',array['account-intelligence']);
reset role;
update public.workspaces set team_selected_at=now()-interval '13 hours' where id='e4000000-0000-4000-8000-000000000010';
set local role authenticated;
select public.select_team('e4000000-0000-4000-8000-000000000010','{}');
select set_config('test.company_answers',$answers${"company":{"name":"Company A","website":"https://example.invalid","businessModel":"b2b_services","timeZone":"UTC","offers":["Advice"],"customers":["Owners"],"priorities":["Replies"],"successDefinition":"Verified replies","brandGuidance":"","forbiddenClaims":""},"team":[],"systems":[],"operations":{"approvalMode":"each_action","automationAcknowledged":false,"policyAcknowledged":true,"contactRestrictions":"","workingDays":[1,2,3,4,5],"startHour":9,"endHour":17,"meetingMinutes":30,"bufferMinutes":15,"dailyCapacity":1,"modelDailyBudgetMinor":0,"actionDailyBudgetMinor":0,"sender":"","calendarId":"","escalationOwner":"owner@example.invalid","approvedContactIds":[]},"people":[],"measurement":{"owner":"Owner","baseline":[],"sharing":"private"}}$answers$,true);
select public.save_onboarding('e4000000-0000-4000-8000-000000000010',0,current_setting('test.company_answers')::jsonb);
select set_config('test.company_config_at',public.read_onboarding_v2('e4000000-0000-4000-8000-000000000010')->>'configurationUpdatedAt',true);
reset role;
-- Minimal synthetic sentinels test invalidation only; these are not usable source evidence or authority.
insert into public.product_records(workspace_id,kind,payload) values
 ('e4000000-0000-4000-8000-000000000010','company_context','{"fixture":true,"context":{"confirmed":true}}');
insert into public.mandates(id,workspace_id,version,grantor_id,action_type,bounds,starts_at,expires_at)
select 'e4000000-0000-4000-8000-000000000080',workspace_id,1,id,'send_follow_up','{}',now(),now()+interval '1 hour'
from public.memberships where workspace_id='e4000000-0000-4000-8000-000000000010' and actor_id='e4000000-0000-4000-8000-000000000001';
set local role authenticated;
select public.save_onboarding('e4000000-0000-4000-8000-000000000010',1,jsonb_set(current_setting('test.company_answers')::jsonb,'{team}','["account-intelligence"]'));
do $$ begin
 if not exists(select 1 from public.mandates where id='e4000000-0000-4000-8000-000000000080' and revoked_at is not null) then raise exception 'FAIL team change retained old business authority';end if;
 if not exists(select 1 from public.product_records where workspace_id='e4000000-0000-4000-8000-000000000010' and kind='company_context' and payload#>>'{context,confirmed}'='true') then raise exception 'FAIL team change discarded confirmed company context';end if;
end $$;
reset role;
insert into public.mandates(id,workspace_id,version,grantor_id,action_type,bounds,starts_at,expires_at)
select 'e4000000-0000-4000-8000-000000000081',workspace_id,2,id,'send_follow_up','{}',now(),now()+interval '1 hour'
from public.memberships where workspace_id='e4000000-0000-4000-8000-000000000010' and actor_id='e4000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('test.company_answers',(public.read_onboarding('e4000000-0000-4000-8000-000000000010')->'answers')::text,true);
select set_config('test.company_briefing','{"version":1,"step":"website","name":"Owner","goal":"","otherGoal":"","description":"","websiteInput":"","proposalSource":"","conversionAction":"","researchId":"","noWebsite":false,"reviewedFacts":"","task":"","finished":false}',true);
select public.save_onboarding('e4000000-0000-4000-8000-000000000010',2,jsonb_set(current_setting('test.company_answers')::jsonb,'{briefing}',current_setting('test.company_briefing')::jsonb));
select public.save_onboarding('e4000000-0000-4000-8000-000000000010',3,jsonb_set(public.read_onboarding('e4000000-0000-4000-8000-000000000010')->'answers','{measurement,owner}','"Measurement owner"'));
do $$ declare record jsonb; begin
 record:=public.read_onboarding_v2('e4000000-0000-4000-8000-000000000010');
 if not exists(select 1 from public.product_records where workspace_id='e4000000-0000-4000-8000-000000000010' and kind='company_context' and payload#>>'{context,confirmed}'='true') then raise exception 'FAIL initial navigation briefing discarded confirmed company context';end if;
 if not exists(select 1 from public.mandates where id='e4000000-0000-4000-8000-000000000081' and revoked_at is null) then raise exception 'FAIL navigation-only save revoked unchanged business rules';end if;
 if record->>'revision'<>'4' or record->>'configurationRevision'<>'1' or record->>'configurationUpdatedAt'<>current_setting('test.company_config_at') then raise exception 'FAIL team/navigation/measurement invalidated source configuration';end if;
 if public.read_onboarding('e4000000-0000-4000-8000-000000000010') ? 'configurationRevision' then raise exception 'FAIL old reader shape changed';end if;
 if not exists(select 1 from public.runs where id=current_setting('test.company_check')::uuid and status='processing') then raise exception 'FAIL business pause interrupted source check';end if;
 if not(select paused from public.workspaces where id='e4000000-0000-4000-8000-000000000010') then raise exception 'FAIL team save resumed business execution';end if;
end $$;
reset role;
insert into public.audit_events(workspace_id,event_type,entity_id,detail) values('e4000000-0000-4000-8000-000000000010','artifact_reviewed','e4000000-0000-4000-8000-000000000099','{"revision":2,"decision":"reviewed"}');
set local role authenticated;
do $$ begin
 if public.read_onboarding_v2('e4000000-0000-4000-8000-000000000010')#>>'{reviews,0,configurationRevision}'<>'1' then raise exception 'FAIL review configuration stamp not preserved';end if;
 if public.read_onboarding('e4000000-0000-4000-8000-000000000010')#>'{reviews,0}' ? 'configurationRevision' then raise exception 'FAIL old review shape changed';end if;
end $$;
select public.save_onboarding('e4000000-0000-4000-8000-000000000010',4,jsonb_set(public.read_onboarding('e4000000-0000-4000-8000-000000000010')->'answers','{operations,dailyCapacity}','2'));
select public.save_onboarding('e4000000-0000-4000-8000-000000000010',5,jsonb_set(public.read_onboarding('e4000000-0000-4000-8000-000000000010')->'answers','{systems}','[{"id":"company-sheet","kind":"proposals","tool":"Sheets","availability":"available","resource":"synthetic-company-file","owner":"Owner","mapping":"Approved columns","connectionId":"e4000000-0000-4000-8000-000000000020"}]'));
do $$ begin
 if not exists(select 1 from public.mandates where id='e4000000-0000-4000-8000-000000000081' and revoked_at is not null) then raise exception 'FAIL changed operating rules retained business authority';end if;
 if public.read_onboarding_v2('e4000000-0000-4000-8000-000000000010')->>'configurationRevision'<>'6' then raise exception 'FAIL changed rules or sources did not invalidate config proof';end if;
 begin perform public.read_onboarding_v2('e4000000-0000-4000-8000-000000000011');raise exception 'FAIL v2 cross tenant read';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- Rebind the test worker transaction to the discovery run for its narrower read guard.
delete from private.transaction_context where transaction_id=txid_current() and backend_pid=pg_backend_pid();
select set_config('test.company_route',(select route_token::text from private.run_routes where run_id=current_setting('test.company_discovery')::uuid),true);
set local role david_worker;
select private.bind_run(current_setting('test.company_discovery')::uuid,current_setting('test.company_route')::uuid);
do $$ begin
 if private.connection_token('e4000000-0000-4000-8000-000000000020','sheets.read')->>'accessToken'<>'SYNTHETIC_SOURCE_TOKEN' then raise exception 'FAIL metadata token denied';end if;
 begin perform private.connection_token('e4000000-0000-4000-8000-000000000020','gmail.read');raise exception 'FAIL metadata discovery got mailbox token';exception when insufficient_privilege then null;end;
end $$;
select private.finish_onboarding_discovery(true);
reset role;
select private.privacy_assert_schema();
rollback;
