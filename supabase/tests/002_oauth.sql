-- Actual role/one-time state test. The token strings below are synthetic fixtures only.
begin;
insert into auth.users(id,email) values('a1000000-0000-4000-8000-000000000001','oauth-owner@example.invalid'),('b1000000-0000-4000-8000-000000000001','oauth-other@example.invalid');
insert into public.workspaces(id,name,environment,business_model,time_zone,currency) values('a1000000-0000-4000-8000-000000000010','OAuth fixture','shadow','b2b_services','UTC','USD');
insert into public.memberships(id,workspace_id,actor_id,role) values('a1000000-0000-4000-8000-000000000020','a1000000-0000-4000-8000-000000000010','a1000000-0000-4000-8000-000000000001','workspace_owner');
insert into private.allowed_oauth_redirects(redirect_uri) values('https://oauth-fixture.example.invalid/callback');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select public.begin_google_oauth('a1000000-0000-4000-8000-000000000010',repeat('a',64),repeat('v',64),'https://oauth-fixture.example.invalid/callback');
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
do $$ begin
 begin perform public.consume_google_oauth(repeat('a',64),'https://oauth-fixture.example.invalid/callback'); raise exception 'FAIL: wrong actor consumed state'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
do $$ declare result record; begin
 begin perform public.consume_google_oauth(repeat('a',64),'https://attacker.example.invalid/callback'); raise exception 'FAIL: unchecked redirect'; exception when insufficient_privilege then null; end;
 select * into result from public.consume_google_oauth(repeat('a',64),'https://oauth-fixture.example.invalid/callback');
 if result.workspace_id<>'a1000000-0000-4000-8000-000000000010' or result.verifier<>repeat('v',64) then raise exception 'FAIL: state binding'; end if;
 begin perform public.consume_google_oauth(repeat('a',64),'https://oauth-fixture.example.invalid/callback'); raise exception 'FAIL: replay accepted'; exception when insufficient_privilege then null; end;
 begin perform private.finish_google_oauth(repeat('a',64),'forged-subject','forged@example.invalid','{}','{}',now()+interval '1 hour'); raise exception 'FAIL: browser forged provider identity'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role david_oauth;
select set_config('test.oauth_connection',private.finish_google_oauth(repeat('a',64),'synthetic-google-subject','synthetic@example.invalid',array['https://www.googleapis.com/auth/gmail.readonly'],'{"accessToken":"SYNTHETIC_ACCESS","refreshToken":"SYNTHETIC_REFRESH"}',now()+interval '1 hour')::text,true);
do $$ begin
 begin perform * from vault.decrypted_secrets; raise exception 'FAIL: OAuth broker enumerated Vault'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.connections where id=current_setting('test.oauth_connection')::uuid and workspace_id='a1000000-0000-4000-8000-000000000010' and health='unconfigured') then raise exception 'FAIL: OAuth incorrectly claims verified capabilities'; end if;
 if not exists(select 1 from private.oauth_states where state_hash=repeat('a',64) and verifier_vault_id is null and completed_at is not null) then raise exception 'FAIL: used verifier retained'; end if;
end $$;
set local role authenticated;
select public.disconnect_google(current_setting('test.oauth_connection')::uuid);
reset role;
do $$ begin
 if exists(select 1 from private.connection_secrets where connection_id=current_setting('test.oauth_connection')::uuid) then raise exception 'FAIL: disconnected credential retained'; end if;
 if not exists(select 1 from public.connections where id=current_setting('test.oauth_connection')::uuid and health='revoked') then raise exception 'FAIL: disconnection not persisted'; end if;
end $$;
rollback;
select 'PASS: actor-bound state, strict redirect, replay prevention, restricted broker, deleted verifier, disconnected Vault token' as evidence;
