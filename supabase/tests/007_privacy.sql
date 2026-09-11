-- Authored only. Execute through guarded nonproduction test-db.ts; rollback removes all synthetic state.
begin;
insert into auth.users(id,email) values('a7000000-0000-4000-8000-000000000001','privacy-test@example.invalid');
insert into public.workspaces(id,name,environment,business_model,time_zone,currency,paused) values
 ('a7000000-0000-4000-8000-000000000010','Synthetic privacy target','shadow','b2b_services','UTC','USD',false),
 ('a7000000-0000-4000-8000-000000000011','Synthetic second tenant','shadow','b2b_services','UTC','USD',true);
insert into public.memberships(id,workspace_id,actor_id,role) values('a7000000-0000-4000-8000-000000000020','a7000000-0000-4000-8000-000000000010','a7000000-0000-4000-8000-000000000001','workspace_owner');
insert into public.accounts(id,workspace_id,name,source_key) values
 ('a7000000-0000-4000-8000-000000000030','a7000000-0000-4000-8000-000000000010','Target synthetic company','privacy-company'),
 ('a7000000-0000-4000-8000-000000000031','a7000000-0000-4000-8000-000000000011','Other synthetic company','privacy-company');
insert into public.connections(id,workspace_id,provider,identity,health,owner_id) values('a7000000-0000-4000-8000-000000000040','a7000000-0000-4000-8000-000000000010','google','synthetic-privacy@example.invalid','healthy','a7000000-0000-4000-8000-000000000020');
select set_config('test.privacy_vault',vault.create_secret('{"accessToken":"SYNTHETIC_PRIVACY_TEST_ONLY"}')::text,true);
insert into private.connection_secrets(workspace_id,connection_id,vault_id,expires_at) values('a7000000-0000-4000-8000-000000000010','a7000000-0000-4000-8000-000000000040',current_setting('test.privacy_vault')::uuid,now()+interval '1 hour');
set local role authenticated;
do $$ begin
 begin perform private.privacy_preview('a7000000-0000-4000-8000-000000000010','a7000000-0000-4000-8000-000000000001',null,'export');raise exception 'FAIL: browser called privileged privacy API';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role david_worker;
do $$ begin
 begin perform private.privacy_begin_delete('a7000000-0000-4000-8000-000000000010',null,'a7000000-0000-4000-8000-000000000099',repeat('a',64),'a7000000-0000-4000-8000-000000000010',true,'approved_expiry_or_erasure');raise exception 'FAIL: worker called privacy mutation';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ declare p jsonb; begin
 begin perform private.privacy_preview('a7000000-0000-4000-8000-000000000011','a7000000-0000-4000-8000-000000000001',null,'export');raise exception 'FAIL: actor exported another workspace';exception when raise_exception then if sqlerrm<>'PRIVACY_MEMBERSHIP_PROOF_FAILED' then raise;end if;end;
 select private.privacy_preview('a7000000-0000-4000-8000-000000000010','a7000000-0000-4000-8000-000000000001',null,'export') into p;
 if not(p->'blockers' ? 'WORKSPACE_MUST_BE_PAUSED') then raise exception 'FAIL: erasure preview omitted pause blocker';end if;
 if exists(select 1 from private.privacy_export_page('a7000000-0000-4000-8000-000000000010','a7000000-0000-4000-8000-000000000001',null,'public.accounts',0,500) r where r->>'workspace_id'<>'a7000000-0000-4000-8000-000000000010') then raise exception 'FAIL: export leaked another workspace';end if;
 begin perform private.privacy_export_page('a7000000-0000-4000-8000-000000000010','a7000000-0000-4000-8000-000000000001',null,'private.connection_secrets',0,500);raise exception 'FAIL: credential table exported';exception when raise_exception then if sqlerrm<>'PRIVACY_EXPORT_TABLE_OR_PAGE_INVALID' then raise;end if;end;
 begin perform private.privacy_begin_delete('a7000000-0000-4000-8000-000000000010','a7000000-0000-4000-8000-000000000001',null,repeat('a',64),'a7000000-0000-4000-8000-000000000010',true,'approved_expiry_or_erasure');raise exception 'FAIL: unpaused workspace quarantined';exception when raise_exception then if sqlerrm<>'PRIVACY_PAUSE_AND_RECONCILIATION_REQUIRED' then raise;end if;end;
 if not exists(select 1 from vault.secrets where id=current_setting('test.privacy_vault')::uuid) then raise exception 'FAIL: preview/blocker removed credential';end if;
end $$;
update public.workspaces set paused=true where id='a7000000-0000-4000-8000-000000000010';
do $$ begin
 begin perform private.privacy_begin_delete('a7000000-0000-4000-8000-000000000010','a7000000-0000-4000-8000-000000000001',null,repeat('a',64),'a7000000-0000-4000-8000-000000000011',true,'approved_expiry_or_erasure');raise exception 'FAIL: wrong confirmation accepted';exception when raise_exception then if sqlerrm<>'PRIVACY_EXPLICIT_ERASURE_APPROVAL_REQUIRED' then raise;end if;end;
 begin perform private.privacy_begin_delete('a7000000-0000-4000-8000-000000000010','a7000000-0000-4000-8000-000000000001',null,repeat('a',64),'a7000000-0000-4000-8000-000000000010',false,'approved_expiry_or_erasure');raise exception 'FAIL: retention hold ignored';exception when raise_exception then if sqlerrm<>'PRIVACY_EXPLICIT_ERASURE_APPROVAL_REQUIRED' then raise;end if;end;
end $$;
select private.privacy_begin_delete('a7000000-0000-4000-8000-000000000010','a7000000-0000-4000-8000-000000000001',null,repeat('a',64),'a7000000-0000-4000-8000-000000000010',true,'approved_expiry_or_erasure');
-- Same request is resumable even though its member was quarantined; a different request is denied.
select private.privacy_begin_delete('a7000000-0000-4000-8000-000000000010','a7000000-0000-4000-8000-000000000001',null,repeat('a',64),'a7000000-0000-4000-8000-000000000010',true,'approved_expiry_or_erasure');
do $$ begin
 if exists(select 1 from vault.secrets where id=current_setting('test.privacy_vault')::uuid) or exists(select 1 from private.connection_secrets where workspace_id='a7000000-0000-4000-8000-000000000010') then raise exception 'FAIL: quarantine retained usable credential';end if;
 if exists(select 1 from public.memberships where workspace_id='a7000000-0000-4000-8000-000000000010' and active) then raise exception 'FAIL: quarantined membership remained active';end if;
 if not exists(select 1 from public.accounts where id='a7000000-0000-4000-8000-000000000030') then raise exception 'FAIL: quarantine deleted source records before Storage verification';end if;
end $$;
select private.privacy_finish_delete('a7000000-0000-4000-8000-000000000010',repeat('a',64),'a7000000-0000-4000-8000-000000000010',true);
do $$ begin
 if exists(select 1 from public.workspaces where id='a7000000-0000-4000-8000-000000000010') then raise exception 'FAIL: target workspace remains';end if;
 if not exists(select 1 from public.accounts where id='a7000000-0000-4000-8000-000000000031') then raise exception 'FAIL: second tenant was erased';end if;
 if not exists(select 1 from auth.users where id='a7000000-0000-4000-8000-000000000001') then raise exception 'FAIL: shared Auth identity was erased';end if;
 if not exists(select 1 from private.privacy_completion_audit where operation='workspace_erased' and vault_secrets_removed=1) then raise exception 'FAIL: minimal completion audit missing';end if;
end $$;
rollback;
select 'PASS: admin-only privacy grants, member/workspace export binding, pause/retention guards, quarantine/retry/Vault handling, scoped erasure and shared identity preservation (no Storage HTTP)' as evidence;
