begin;
do $$ begin if not exists(select 1 from pg_roles where rolname='david_oauth') then create role david_oauth nologin noinherit nobypassrls; end if; end $$;
alter role david_oauth nobypassrls nocreatedb nocreaterole;
-- Managed Supabase postgres cannot ALTER NOSUPERUSER. New roles default to it;
-- fail closed on an existing privileged role instead of requiring superuser.
do $$ begin
  if exists(select 1 from pg_roles where rolname in ('david_oauth') and (rolsuper or rolbypassrls or rolcreatedb or rolcreaterole)) then
    raise exception 'RUNTIME_ROLE_PRIVILEGED';
  end if;
end $$;
grant usage on schema private to david_oauth;
create table private.allowed_oauth_redirects (redirect_uri text primary key check(redirect_uri ~ '^https://'));
alter table private.oauth_states add column completed_at timestamptz;

create function public.begin_google_oauth(p_workspace_id uuid,p_state_hash text,p_verifier text,p_redirect_uri text) returns void
language plpgsql security definer set search_path='' as $$
declare secret uuid; begin
 if auth.uid() is null or coalesce(private.member_role(p_workspace_id),'') not in ('workspace_owner','david_operator') then raise exception 'Connection owner role required' using errcode='42501'; end if;
 if p_state_hash !~ '^[a-f0-9]{64}$' or length(p_verifier) not between 43 and 128 or not exists(select 1 from private.allowed_oauth_redirects where redirect_uri=p_redirect_uri) then raise exception 'Invalid OAuth request'; end if;
 secret:=vault.create_secret(p_verifier);
 insert into private.oauth_states(state_hash,workspace_id,actor_id,redirect_uri,verifier_vault_id,expires_at)
 values(p_state_hash,p_workspace_id,auth.uid(),p_redirect_uri,secret,now()+interval '10 minutes');
end $$;
create function public.consume_google_oauth(p_state_hash text,p_redirect_uri text) returns table(workspace_id uuid,verifier text)
language plpgsql security definer set search_path='' as $$
declare s private.oauth_states; begin
 select * into s from private.oauth_states where state_hash=p_state_hash for update;
 if auth.uid() is null or s.actor_id is distinct from auth.uid() or s.consumed_at is not null or s.expires_at<=now() or s.redirect_uri is distinct from p_redirect_uri
 or coalesce(private.member_role(s.workspace_id),'') not in ('workspace_owner','david_operator') then raise exception 'OAuth state invalid, expired or replayed' using errcode='42501'; end if;
 update private.oauth_states set consumed_at=now() where state_hash=s.state_hash;
 return query select s.workspace_id,v.decrypted_secret from vault.decrypted_secrets v where v.id=s.verifier_vault_id;
end $$;
create function private.finish_google_oauth(p_state_hash text,p_subject text,p_email text,p_scopes text[],p_tokens jsonb,p_expires timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare s private.oauth_states; conn uuid; secret uuid; ops text[] := '{}'; begin
 select * into s from private.oauth_states where state_hash=p_state_hash for update;
 if s.state_hash is null or s.consumed_at is null or s.completed_at is not null or s.expires_at<=now() or s.consumed_at < now()-interval '5 minutes'
 or not exists(select 1 from public.memberships m where m.workspace_id=s.workspace_id and m.actor_id=s.actor_id and m.active and m.role in ('workspace_owner','david_operator')) then raise exception 'OAuth completion not authorized'; end if;
 if length(p_subject)<1 or p_tokens->>'accessToken' is null or p_expires<=now() then raise exception 'Invalid provider credentials'; end if;
 if 'https://www.googleapis.com/auth/drive.file'=any(p_scopes) or 'https://www.googleapis.com/auth/spreadsheets.readonly'=any(p_scopes) then ops:=array_append(ops,'sheets.read'); end if;
 if 'https://www.googleapis.com/auth/gmail.readonly'=any(p_scopes) then ops:=array_append(ops,'gmail.read'); end if;
 if 'https://www.googleapis.com/auth/gmail.send'=any(p_scopes) then ops:=array_append(ops,'gmail.send'); end if;
 if 'https://www.googleapis.com/auth/calendar.events.owned'=any(p_scopes) or 'https://www.googleapis.com/auth/calendar.events'=any(p_scopes) then ops:=array_append(ops,'calendar.book'); end if;
 if 'https://www.googleapis.com/auth/calendar.freebusy'=any(p_scopes) or 'https://www.googleapis.com/auth/calendar.events.freebusy'=any(p_scopes) then ops:=array_append(ops,'calendar.freebusy'); end if;
 select id into conn from public.connections where workspace_id=s.workspace_id and provider='google' and subject_id=p_subject for update;
 if conn is null then
  insert into public.connections(workspace_id,provider,identity,subject_id,scopes,operations,health) values(s.workspace_id,'google',p_email,p_subject,p_scopes,ops,'unconfigured') returning id into conn;
 else
  update public.connections set scopes=p_scopes,operations=ops,identity=p_email,health='unconfigured',verified_at=null where id=conn;
  -- Same subject reconnect is explicit; preserve source bindings, replace stored secrets atomically.
  select vault_id into secret from private.connection_secrets where workspace_id=s.workspace_id and connection_id=conn;
  delete from private.connection_secrets where workspace_id=s.workspace_id and connection_id=conn;
  if secret is not null then delete from vault.secrets where id=secret; end if;
 end if;
 secret:=vault.create_secret(p_tokens::text);
 insert into private.connection_secrets(workspace_id,connection_id,vault_id,expires_at) values(s.workspace_id,conn,secret,p_expires);
 update private.oauth_states set completed_at=now() where state_hash=s.state_hash;
 delete from vault.secrets where id=s.verifier_vault_id; -- Remove PKCE verifier; FK cleared below first by deferral migration fix.
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id) values(s.workspace_id,s.actor_id,'google_connected_unverified',conn);
 return conn;
end $$;
-- PKCE FK permits deleting the used verifier while preserving replay evidence.
alter table private.oauth_states drop constraint oauth_states_verifier_vault_id_fkey;
alter table private.oauth_states alter column verifier_vault_id drop not null;
alter table private.oauth_states add foreign key(verifier_vault_id) references vault.secrets(id) on delete set null;

create function private.connection_token(p_connection uuid,p_operation text) returns jsonb language plpgsql security definer set search_path='' as $$
declare token jsonb; begin
 if not exists(select 1 from public.runs r join public.connections c on c.workspace_id=r.workspace_id and c.id=r.connection_id
  where r.id=private.current_run() and r.workspace_id=private.current_workspace() and c.id=p_connection and c.health not in ('revoked','expired')
  and p_operation=any(c.operations)) then raise exception 'Connection/operation denied' using errcode='42501'; end if;
 select v.decrypted_secret::jsonb || jsonb_build_object('expiresAt',s.expires_at) into token
 from private.connection_secrets s join vault.decrypted_secrets v on v.id=s.vault_id
 where s.workspace_id=private.current_workspace() and s.connection_id=p_connection;
 if token is null then raise exception 'Connection requires reauthorization'; end if;
 return token;
end $$;
create function private.lease_token_refresh(p_connection uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare token uuid; begin
 if not exists(select 1 from public.runs where id=private.current_run() and connection_id=p_connection and workspace_id=private.current_workspace()) then raise exception 'Connection denied'; end if;
 update private.connection_secrets s set refresh_lease=gen_random_uuid(),refresh_until=now()+interval '45 seconds' where s.workspace_id=private.current_workspace() and s.connection_id=p_connection
 and (s.refresh_until is null or s.refresh_until<now()) returning s.refresh_lease into token;
 return token;
end $$;
create function private.store_refreshed_token(p_connection uuid,p_lease uuid,p_tokens jsonb,p_expires timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare s private.connection_secrets; begin
 select * into s from private.connection_secrets where workspace_id=private.current_workspace() and connection_id=p_connection for update;
 if not exists(select 1 from public.runs where id=private.current_run() and connection_id=p_connection) or s.refresh_lease is distinct from p_lease or s.refresh_until<=now() then raise exception 'Refresh fence lost'; end if;
 if not exists(select 1 from public.connections where workspace_id=s.workspace_id and id=s.connection_id and health<>'revoked') then raise exception 'Connection disconnected'; end if;
 perform vault.update_secret(s.vault_id,p_tokens::text);
 update private.connection_secrets set expires_at=p_expires,refresh_lease=null,refresh_until=null where workspace_id=s.workspace_id and connection_id=s.connection_id;
end $$;
create function private.expire_connection(p_connection uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.runs where id=private.current_run() and connection_id=p_connection and workspace_id=private.current_workspace()) then raise exception 'Connection denied'; end if;
 update public.connections set health='expired' where workspace_id=private.current_workspace() and id=p_connection and health<>'revoked';
end $$;
create function public.disconnect_google(p_connection_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare c public.connections; v uuid; begin
 select * into c from public.connections where id=p_connection_id for update;
 if auth.uid() is null or coalesce(private.member_role(c.workspace_id),'') not in ('workspace_owner','david_operator') then raise exception 'Connection owner role required' using errcode='42501'; end if;
 update public.connections set health='revoked',operations='{}' where id=c.id;
 select vault_id into v from private.connection_secrets where workspace_id=c.workspace_id and connection_id=c.id;
 delete from private.connection_secrets where workspace_id=c.workspace_id and connection_id=c.id;
 if v is not null then delete from vault.secrets where id=v; end if;
 update public.runs set status='blocked' where workspace_id=c.workspace_id and connection_id=c.id and status not in ('completed','cancelled');
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id) values(c.workspace_id,auth.uid(),'connection_disconnected',c.id);
end $$;
revoke all on function public.begin_google_oauth(uuid,text,text,text),public.consume_google_oauth(text,text),public.disconnect_google(uuid) from public,anon;
grant execute on function public.begin_google_oauth(uuid,text,text,text),public.consume_google_oauth(text,text),public.disconnect_google(uuid) to authenticated;
revoke all on function private.finish_google_oauth(text,text,text,text[],jsonb,timestamptz),private.connection_token(uuid,text),private.lease_token_refresh(uuid),private.store_refreshed_token(uuid,uuid,jsonb,timestamptz),private.expire_connection(uuid) from public,anon,authenticated;
grant execute on function private.finish_google_oauth(text,text,text,text[],jsonb,timestamptz) to david_oauth;
grant execute on function private.connection_token(uuid,text),private.lease_token_refresh(uuid),private.store_refreshed_token(uuid,uuid,jsonb,timestamptz),private.expire_connection(uuid) to david_worker;
revoke all on all tables in schema private from public,anon,authenticated,david_worker,david_dispatcher,david_oauth;
revoke all on all tables in schema vault from public,anon,authenticated,david_worker,david_dispatcher,david_oauth;
revoke usage on schema vault from public,anon,authenticated,david_worker,david_dispatcher,david_oauth;
do $$ begin execute format('grant usage on schema vault to %I',current_user); end $$;
commit;
