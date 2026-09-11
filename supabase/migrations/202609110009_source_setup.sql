begin;
create table private.request_quotas(scope text not null,workspace_id uuid not null,period text not null,count integer not null,primary key(scope,workspace_id,period));
create table private.application_quotas(scope text not null,period text not null,count integer not null,primary key(scope,period));
create function public.consume_request_quota(p_workspace uuid,p_scope text) returns void language plpgsql security definer set search_path='' as $$
declare period_key text; workspace_limit integer; global_limit integer; n integer; begin
 if private.member_role(p_workspace) is null then raise exception 'Workspace access denied' using errcode='42501'; end if;
 if p_scope='website_capture' then period_key:=to_char(now() at time zone 'UTC','YYYY-MM-DD');workspace_limit:=10;global_limit:=100;
 elsif p_scope='commands' then period_key:=to_char(now() at time zone 'UTC','YYYY-MM-DD HH24:MI');workspace_limit:=120;global_limit:=1000;
 else raise exception 'Unknown request scope';end if;
 insert into private.application_quotas values(p_scope,period_key,1) on conflict(scope,period) do update set count=application_quotas.count+1 returning count into n;
 if n>global_limit then raise exception 'Global application quota reached';end if;
 insert into private.request_quotas values(p_scope,p_workspace,period_key,1) on conflict(scope,workspace_id,period) do update set count=request_quotas.count+1 returning count into n;
 if n>workspace_limit then raise exception 'Workspace request quota reached';end if;
end $$;
create function public.bind_google_resource(p_workspace uuid,p_connection uuid,p_type text,p_resource text,p_range text,p_mapping jsonb,p_owner text) returns uuid language plpgsql security definer set search_path='' as $$
declare binding uuid; begin
 if coalesce(private.member_role(p_workspace),'') not in ('workspace_owner','david_operator') then raise exception 'Connection owner required' using errcode='42501';end if;
 if not exists(select 1 from public.connections where id=p_connection and workspace_id=p_workspace and provider='google' and health not in ('revoked','expired')) then raise exception 'Authorized Google connection required';end if;
 if p_type not in ('sheet','calendar','mailbox') or length(trim(coalesce(p_resource,''))) not between 1 and 512 or length(trim(coalesce(p_owner,''))) not between 1 and 200 or octet_length(p_mapping::text)>20000 then raise exception 'Invalid source binding';end if;
 if p_type='sheet' and length(trim(coalesce(p_range,''))) not between 1 and 200 then raise exception 'Explicit Sheet range required';end if;
 if exists(select 1 from public.runs where workspace_id=p_workspace and connection_id=p_connection and status in ('processing','awaiting_approval','waiting_for_reply')) then raise exception 'Review pending work and pause before changing resource bindings';end if;
 insert into public.source_bindings(workspace_id,connection_id,resource_type,resource_id,range_name,mapping,source_owner) values(p_workspace,p_connection,p_type,p_resource,p_range,p_mapping,p_owner)
 on conflict(workspace_id,connection_id,resource_id) do update set mapping=excluded.mapping,range_name=excluded.range_name,verified_at=null,source_owner=excluded.source_owner returning id into binding;
 update public.connections set health='unconfigured',verified_at=null where id=p_connection;
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id,detail) values(p_workspace,auth.uid(),'resource_bound_unverified',binding,jsonb_build_object('type',p_type,'permission_not_implied',true));
 return binding;
end $$;
create function public.queue_connection_check(p_workspace uuid,p_connection uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare i uuid; r uuid; mode text; begin
 if coalesce(private.member_role(p_workspace),'') not in ('workspace_owner','david_operator') then raise exception 'Connection owner required' using errcode='42501';end if;
 if not exists(select 1 from public.connections where id=p_connection and workspace_id=p_workspace and health not in ('revoked','expired')) then raise exception 'Connection denied';end if;
 select id into i from public.installations where workspace_id=p_workspace order by id limit 1;
 if i is null then raise exception 'Select your team before validating a resource';end if;
 select environment into mode from public.workspaces where id=p_workspace;r:=gen_random_uuid();
 insert into public.runs(id,workspace_id,installation_id,connection_id,definition_version,sdk_version,deployment_id,environment,status,next_due_at) values(r,p_workspace,i,p_connection,'connection-check-v1','4.8.8','pending-dispatch',mode,'scheduled',now());
 insert into private.run_inputs values(p_workspace,r,'verify_connection',jsonb_build_object('connectionId',p_connection));
 insert into private.outbox(workspace_id,run_id,event_type,dedupe_key) values(p_workspace,r,'connection_check','connection-check:'||r);
 return r;
end $$;
create function private.record_connection_check(p_connection uuid,p_evidence jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.runs where id=private.current_run() and workspace_id=private.current_workspace() and connection_id=p_connection) then raise exception 'Run binding denied';end if;
 if jsonb_typeof(p_evidence->'verifiedResourceIds') is distinct from 'array' or jsonb_array_length(p_evidence->'verifiedResourceIds')=0 or p_evidence->>'externalWritesVerified' is distinct from 'false' then raise exception 'Actual read-check evidence required';end if;
 update public.connections set health='healthy',verified_at=now(),last_sync_at=now() where id=p_connection and workspace_id=private.current_workspace() and health not in ('revoked','expired');
 update public.source_bindings set verified_at=now() where connection_id=p_connection and workspace_id=private.current_workspace() and p_evidence->'verifiedResourceIds' ? id::text;
 update public.runs set status='completed',next_due_at=null where id=private.current_run();
 insert into public.audit_events(workspace_id,event_type,entity_id,detail) values(private.current_workspace(),'connection_read_checks_passed',p_connection,p_evidence);
end $$;
revoke all on private.request_quotas,private.application_quotas from public,anon,authenticated;
revoke all on function public.consume_request_quota(uuid,text),public.bind_google_resource(uuid,uuid,text,text,text,jsonb,text),public.queue_connection_check(uuid,uuid) from public,anon;
grant execute on function public.consume_request_quota(uuid,text),public.bind_google_resource(uuid,uuid,text,text,text,jsonb,text),public.queue_connection_check(uuid,uuid) to authenticated;
revoke all on function private.record_connection_check(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.record_connection_check(uuid,jsonb) to david_worker;
commit;
