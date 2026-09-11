begin;
create table private.runtime_heartbeats(component text primary key,observed_at timestamptz not null,meaning text not null);
revoke all on private.runtime_heartbeats from public,anon,authenticated,david_worker,david_dispatcher;
alter function private.claim_due(integer) rename to claim_due_before_health;
revoke all on function private.claim_due_before_health(integer) from public,anon,authenticated,david_worker,david_dispatcher;
create function private.claim_due(p_limit integer default 25) returns table(outbox_id uuid,run_id uuid,event_type text,payload jsonb,lease_token uuid)
language plpgsql security definer set search_path='' as $$ begin
 return query select * from private.claim_due_before_health(p_limit);
 insert into private.runtime_heartbeats(component,observed_at,meaning) values('cron_dispatcher',now(),'Authenticated dispatcher reached the database and claimed due work; this does not establish successful workflow start or a customer outcome.')
 on conflict(component) do update set observed_at=excluded.observed_at;
end $$;
revoke all on function private.claim_due(integer) from public,anon,authenticated,david_worker;
grant execute on function private.claim_due(integer) to david_dispatcher;

create function public.read_workspace_health(p_workspace uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare tick timestamptz; preparation timestamptz; business timestamptz; source_sync timestamptz; model_success timestamptz; failures integer; overdue integer; uncertain integer; backlog integer; dead integer; leases integer; result jsonb:='[]'; component text; state text; success timestamptz; prep timestamptz; action_at timestamptz; coverage text; begin
 if private.member_role(p_workspace) is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 select observed_at into tick from private.runtime_heartbeats where runtime_heartbeats.component='cron_dispatcher';
 select max(created_at) into preparation from public.prepared_artifacts where workspace_id=p_workspace;
 select max(observed_at) into business from public.receipts where workspace_id=p_workspace and provider='google' and status in ('provider_accepted','confirmed');
 select max(last_sync_at) into source_sync from public.connections where workspace_id=p_workspace and provider='google' and health='healthy';
 select max(u.created_at) into model_success from private.model_reservations m join public.usage_records u on u.workspace_id=m.workspace_id and u.id=m.usage_record_id where m.workspace_id=p_workspace and m.status in ('awaiting_cost','settled');
 select count(*) into failures from public.runs where workspace_id=p_workspace and status in ('blocked','failed');
 select count(*) into overdue from public.runs where workspace_id=p_workspace and (status in ('awaiting_approval','waiting_for_input') and created_at<now()-interval '1 day' or next_due_at<now()-interval '15 minutes' and status in ('scheduled','waiting_for_reply'));
 select count(*) into uncertain from public.actions where workspace_id=p_workspace and status in ('submitting','uncertain');
 select count(*) filter(where attempts<8),count(*) filter(where attempts>=8),count(*) filter(where lease_until<now()) into backlog,dead,leases from private.outbox where workspace_id=p_workspace and dispatched_at is null;
 foreach component in array array['Web application','Supabase','Vercel workflow','Cron dispatcher','Google synchronization','AI Gateway','Legacy Sites','Legacy Netlify'] loop
  state:='unverified';success:=null;prep:=null;action_at:=null;coverage:='No retained successful component probe. Assigned operator verification required.';
  if component in ('Web application','Supabase') then state:='healthy';success:=now();coverage:='Current authenticated request/database read succeeded. This does not prove isolated access, backup recovery or business outcomes.';
  elsif component='Cron dispatcher' then success:=tick;state:=case when tick is null then 'unverified' when tick<now()-interval '15 minutes' then 'stale' when dead>0 then 'blocked' else 'healthy' end;coverage:=format('%s pending dispatch entries; %s dead letters; %s expired leases. Last tick means the protected dispatcher reached PostgreSQL.',backlog,dead,leases);
  elsif component='Vercel workflow' then success:=greatest(preparation,business);prep:=preparation;state:=case when failures>0 or overdue>0 then 'blocked' when success is null then 'unverified' else 'healthy' end;coverage:=format('%s blocked/failed runs; %s overdue approval/input/due runs; %s submitting/uncertain actions. Retained artifacts and receipts are separate from platform uptime.',failures,overdue,uncertain);
  elsif component='Google synchronization' then success:=source_sync;action_at:=business;state:=case when exists(select 1 from public.connections where workspace_id=p_workspace and provider='google' and health in ('expired','revoked','failed')) then 'blocked' when source_sync is null then 'unverified' when source_sync<now()-interval '15 minutes' then 'stale' else 'healthy' end;coverage:='Actual bound-resource read evidence. Sender/calendar writes require their own receipts. An accepted email does not prove delivery.';
  elsif component='AI Gateway' then success:=model_success;state:=case when exists(select 1 from private.model_reservations where workspace_id=p_workspace and status='failed_review') then 'blocked' when model_success is null then 'unverified' else 'healthy' end;coverage:='Validated model usage is separate from saved preparations. Unknown provider costs retain reservations until billing reconciliation.';
  end if;
  result:=result||jsonb_build_array(jsonb_build_object('component',component,'health',state,'observedAt',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'lastSuccessAt',to_char(success at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'lastPreparationAt',to_char(prep at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'lastBusinessActionAt',to_char(action_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'coverage',coverage,'owner','Assigned DAVID operator','nextStep','Review this component and its retained evidence; reconcile exceptions before increasing capacity.'));
 end loop;
 return result;
end $$;
revoke all on function public.read_workspace_health(uuid) from public,anon;
grant execute on function public.read_workspace_health(uuid) to authenticated;
commit;
