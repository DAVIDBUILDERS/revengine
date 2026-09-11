begin;
create table private.proposal_threads (
 workspace_id uuid not null references public.workspaces(id), proposal_id uuid not null, connection_id uuid not null, provider_thread_id text not null,
 source_verified_at timestamptz not null, primary key(workspace_id,proposal_id), foreign key(workspace_id,proposal_id) references public.proposals(workspace_id,id),
 foreign key(workspace_id,connection_id) references public.connections(workspace_id,id)
);
create function private.ingest_sheet_rows(p_binding uuid,p_rows jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare binding public.source_bindings; item jsonb; proposal uuid; thread text; result integer; begin
 select s.* into binding from public.source_bindings s join public.runs r on r.workspace_id=s.workspace_id and r.connection_id=s.connection_id join public.connections c on c.workspace_id=s.workspace_id and c.id=s.connection_id
 where s.id=p_binding and s.workspace_id=private.current_workspace() and r.id=private.current_run() and s.resource_type='sheet' and c.provider='google' and c.health not in ('revoked','expired');
 if binding.id is null then raise exception 'Sheet run/connection binding denied' using errcode='42501'; end if;
 result:=private.import_source_rows(binding.workspace_id,binding.id,p_rows);
 for item in select value from jsonb_array_elements(p_rows) loop
  proposal:=private.source_uuid(binding.workspace_id,'proposal',(item->>'proposal_id')||':v'||(item->>'version'));
  thread:=nullif(item->>'gmail_thread_id','');
  if thread is not null then
   if thread !~ '^[A-Za-z0-9_-]{1,128}$' then raise exception 'Invalid Gmail thread source identity'; end if;
   if exists(select 1 from public.conversations cv join public.proposals p on p.workspace_id=cv.workspace_id and p.contact_id=cv.contact_id where p.id=proposal and cv.active and cv.provider_thread_id is distinct from thread) then raise exception 'Active conversation thread change requires reviewed handoff'; end if;
   insert into private.proposal_threads(workspace_id,proposal_id,connection_id,provider_thread_id,source_verified_at) values(binding.workspace_id,proposal,binding.connection_id,thread,(item->>'source_verified_at')::timestamptz)
   on conflict(workspace_id,proposal_id) do update set provider_thread_id=excluded.provider_thread_id,source_verified_at=excluded.source_verified_at;
  else
   -- An authoritative missing thread cannot silently retain a stale reply association.
   delete from private.proposal_threads where workspace_id=binding.workspace_id and proposal_id=proposal;
  end if;
 end loop;
 return result;
end $$;
create function private.ensure_proposal_conversation(p_proposal uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.proposals; r public.runs; t private.proposal_threads; c public.contacts; existing public.conversations; result uuid; begin
 select * into r from public.runs where id=private.current_run() and workspace_id=private.current_workspace();
 select * into p from public.proposals where id=p_proposal and workspace_id=r.workspace_id;
 select * into c from public.contacts where id=p.contact_id and workspace_id=r.workspace_id for update;
 if p.id is null or c.id is null or c.suppressed or c.human_takeover or p.status<>'open' or p.fixture then raise exception 'Conversation requires an unsuppressed current proposal contact'; end if;
 select * into existing from public.conversations where workspace_id=r.workspace_id and contact_id=c.id and active for update;
 if existing.id is not null then
  if existing.run_id<>r.id then raise exception 'Another run owns the contact; a reviewed handoff is required'; end if;
  return existing.id;
 end if;
 select * into t from private.proposal_threads where workspace_id=r.workspace_id and proposal_id=p.id and connection_id=r.connection_id;
 if t.proposal_id is null or not exists(select 1 from public.source_bindings where id=p.source_binding_id and workspace_id=r.workspace_id and connection_id=r.connection_id and resource_type='sheet' and verified_at is not null) then raise exception 'REPLY_COVERAGE_MISSING: Supply and verify gmail_thread_id in the bound authoritative Sheet'; end if;
 insert into public.conversations(workspace_id,contact_id,run_id,connection_id,purpose,provider_thread_id,owner_agent_id)
 values(r.workspace_id,c.id,r.id,r.connection_id,'proposal_follow_up',t.provider_thread_id,(select agent_id from public.installations where id=r.installation_id)) returning id into result;
 insert into public.audit_events(workspace_id,event_type,entity_id,detail) values(r.workspace_id,'proposal_conversation_bound',result,jsonb_build_object('proposal_id',p.id,'source_binding_id',p.source_binding_id));
 return result;
end $$;
revoke all on private.proposal_threads from public,anon,authenticated,david_worker,david_dispatcher,david_oauth;
revoke all on function private.ingest_sheet_rows(uuid,jsonb),private.ensure_proposal_conversation(uuid) from public,anon,authenticated,david_dispatcher,david_oauth;
grant execute on function private.ingest_sheet_rows(uuid,jsonb),private.ensure_proposal_conversation(uuid) to david_worker;
commit;
