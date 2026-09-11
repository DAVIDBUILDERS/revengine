begin;
create function private.invalidate_action(p_action uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from public.actions where id=p_action and workspace_id=private.current_workspace() and run_id=private.current_run() and status='not_attempted') then return; end if;
 update public.approvals set status='invalidated' where action_id=p_action and workspace_id=private.current_workspace() and status in ('pending','approved');
 update public.runs set status='blocked',next_due_at=null where id=private.current_run() and workspace_id=private.current_workspace();
 insert into public.audit_events(workspace_id,event_type,entity_id,detail) values(private.current_workspace(),'approval_invalidated',p_action,jsonb_build_object('reason',left(p_reason,300)));
end $$;
create table private.gmail_cursors (
 workspace_id uuid not null references public.workspaces(id), connection_id uuid not null, cursor jsonb not null default '{}', checkpointed_at timestamptz not null default now(),
 primary key(workspace_id,connection_id), foreign key(workspace_id,connection_id) references public.connections(workspace_id,id)
);
create function private.gmail_cursor() returns jsonb language plpgsql security definer set search_path='' as $$ declare c uuid; result jsonb; begin
 select connection_id into c from public.runs where id=private.current_run() and workspace_id=private.current_workspace();
 if c is null then raise exception 'Bound connection required'; end if;
 select cursor into result from private.gmail_cursors where workspace_id=private.current_workspace() and connection_id=c;
 return coalesce(result,'{}');
end $$;
create function private.checkpoint_gmail(p_expected jsonb,p_next jsonb) returns boolean language plpgsql security definer set search_path='' as $$ declare c uuid; begin
 select connection_id into c from public.runs where id=private.current_run() and workspace_id=private.current_workspace();
 if c is null or p_next is null or jsonb_typeof(p_next)<>'object' or octet_length(p_next::text)>10000 then raise exception 'Invalid Gmail checkpoint'; end if;
 insert into private.gmail_cursors(workspace_id,connection_id) values(private.current_workspace(),c) on conflict do nothing;
 update private.gmail_cursors set cursor=p_next,checkpointed_at=now() where workspace_id=private.current_workspace() and connection_id=c and cursor=p_expected;
 return found;
end $$;
revoke all on private.gmail_cursors from public,anon,authenticated,david_worker,david_dispatcher,david_oauth;
revoke all on function private.invalidate_action(uuid,text),private.gmail_cursor(),private.checkpoint_gmail(jsonb,jsonb) from public,anon,authenticated;
grant execute on function private.invalidate_action(uuid,text),private.gmail_cursor(),private.checkpoint_gmail(jsonb,jsonb) to david_worker;
commit;
