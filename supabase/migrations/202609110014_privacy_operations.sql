-- Isolated, operator-invoked privacy tools. No browser/service/worker grants.
begin;
create table private.privacy_jobs (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null unique references public.workspaces(id),
 request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'), retention_policy text not null check(retention_policy='approved_expiry_or_erasure'),
 objects_at_quarantine bigint not null, vault_secrets_removed bigint not null, created_at timestamptz not null default now()
);
-- This completion record deliberately contains no workspace, actor, request, source or contact identifiers.
create table private.privacy_completion_audit (
 id uuid primary key default gen_random_uuid(), operation text not null check(operation='workspace_erased'),
 completed_at timestamptz not null default now(), rows_removed bigint not null, objects_at_quarantine bigint not null,
 vault_secrets_removed bigint not null, retention_policy text not null check(retention_policy='approved_expiry_or_erasure')
);
create function private.privacy_assert_admin() returns void language plpgsql security invoker set search_path='' as $$ begin
 if session_user<>'postgres' or current_user<>'postgres' then raise exception 'PRIVACY_ADMIN_REQUIRED'; end if;
end $$;
create function private.privacy_tables() returns table(table_name text,exportable boolean,delete_order integer) language sql immutable set search_path='' as $$
 values
 ('private.transaction_context',false,1),('private.wait_registrations',false,2),('private.outbox',true,3),('private.inbox',true,4),
 ('private.run_routes',false,5),('private.run_inputs',true,6),('private.preparation_claims',true,7),('private.model_reservations',true,8),
 ('private.proposal_threads',true,9),('private.gmail_cursors',true,10),('private.import_rows',true,11),('private.source_cursors',true,12),
 ('private.request_quotas',true,13),('private.connection_secrets',false,14),('private.oauth_states',false,15),('private.model_workspace_counters',true,16),
 ('private.workspace_model_limits',true,17),('private.budget_counters',true,18),('public.artifact_evidence',true,19),('public.action_evidence',true,20),
 ('public.appointments',true,21),('public.outcomes',true,22),('public.approvals',true,23),('public.receipts',true,24),('public.conversations',true,25),
 ('public.actions',true,26),('public.prepared_artifacts',true,27),('public.usage_records',true,28),('public.runs',true,29),('public.installations',true,30),
 ('public.live_activations',true,31),('public.mandates',true,32),('public.policies',true,33),('public.proposals',true,34),('public.evidence',true,35),
 ('public.product_records',true,36),('public.opportunities',true,37),('public.contacts',true,38),('public.accounts',true,39),('public.source_bindings',true,40),
 ('public.connections',true,41),('public.audit_events',true,42),('public.memberships',true,43),('private.privacy_jobs',false,44),('public.workspaces',true,45)
$$;
create function private.privacy_assert_schema() returns void language plpgsql security invoker set search_path='' as $$ begin
 perform private.privacy_assert_admin();
 if exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace join pg_catalog.pg_attribute a on a.attrelid=c.oid
   where n.nspname in ('public','private') and c.relkind in ('r','p') and a.attname='workspace_id' and not a.attisdropped
   and not exists(select 1 from private.privacy_tables() t where t.table_name=n.nspname||'.'||c.relname))
 then raise exception 'PRIVACY_SCHEMA_CHANGED_REVIEW_REQUIRED'; end if;
end $$;
create function private.privacy_authorize(p_workspace uuid,p_actor uuid,p_operator_authority uuid,p_operation text,p_request_hash text default null) returns void language plpgsql security invoker set search_path='' as $$ begin
 perform private.privacy_assert_admin(); perform private.privacy_assert_schema();
 if p_workspace is null or p_operation is null or p_operation not in ('export','delete') or (p_actor is null)=(p_operator_authority is null)
 then raise exception 'PRIVACY_AUTHORITY_REQUIRED'; end if;
 if not exists(select 1 from public.workspaces where id=p_workspace) then raise exception 'PRIVACY_WORKSPACE_NOT_FOUND'; end if;
 -- Same approved request can resume after quarantine disables tenant memberships.
 if p_operation='delete' and p_request_hash is not null and exists(select 1 from private.privacy_jobs where workspace_id=p_workspace and request_hash=p_request_hash) then return; end if;
 if p_actor is not null and not exists(select 1 from public.memberships where workspace_id=p_workspace and actor_id=p_actor and active
   and (role='workspace_owner' or (p_operation='export' and role='workspace_member')))
 then raise exception 'PRIVACY_MEMBERSHIP_PROOF_FAILED'; end if;
 -- Operator authority is an explicit approved request reference, asserted by the actual postgres operator login.
end $$;
create function private.privacy_blockers(p_workspace uuid) returns text[] language plpgsql security invoker set search_path='' as $$
declare reasons text[]:='{}';
begin
 perform private.privacy_assert_admin();
 if not exists(select 1 from public.workspaces where id=p_workspace and paused) then reasons:=array_append(reasons,'WORKSPACE_MUST_BE_PAUSED'); end if;
 if exists(select 1 from public.runs where workspace_id=p_workspace and status='processing') then reasons:=array_append(reasons,'RUN_STILL_PROCESSING'); end if;
 if exists(select 1 from public.actions where workspace_id=p_workspace and status in ('submitting','uncertain')) then reasons:=array_append(reasons,'ACTION_RECONCILIATION_REQUIRED'); end if;
 if exists(select 1 from public.actions a where a.workspace_id=p_workspace and a.status in ('provider_accepted','confirmed') and not exists(
   select 1 from public.receipts r where r.workspace_id=p_workspace and r.action_id=a.id and r.status=a.status and r.provider_id is not null and length(r.provider_id)>0
   and r.reconciliation in ('not_required','resolved') and r.id=(select r2.id from public.receipts r2 where r2.workspace_id=p_workspace and r2.action_id=a.id order by r2.observed_at desc,r2.id desc limit 1)))
 then reasons:=array_append(reasons,'SUBMITTED_ACTION_EVIDENCE_REQUIRED'); end if;
 if exists(select 1 from private.model_reservations where workspace_id=p_workspace and status='reserved') then reasons:=array_append(reasons,'MODEL_ATTEMPT_STILL_RESERVED'); end if;
 return reasons;
end $$;
create function private.privacy_preview(p_workspace uuid,p_actor uuid,p_operator_authority uuid,p_operation text,p_request_hash text default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare t record; n bigint; counts jsonb:='[]'; objects bigint;
begin
 perform private.privacy_authorize(p_workspace,p_actor,p_operator_authority,p_operation,p_request_hash);
 for t in select * from private.privacy_tables() order by delete_order loop
   execute format('select count(*) from %s where %I=$1',t.table_name,case when t.table_name='public.workspaces' then 'id' else 'workspace_id' end) into n using p_workspace;
   counts:=counts||jsonb_build_array(jsonb_build_object('table',t.table_name,'count',n,'exportable',t.exportable));
 end loop;
 select count(*) into objects from storage.objects where bucket_id='david-evidence' and split_part(name,'/',1)=p_workspace::text;
 return jsonb_build_object('workspaceId',p_workspace,'tables',counts,'objects',objects,'blockers',private.privacy_blockers(p_workspace),'quarantined',exists(select 1 from private.privacy_jobs where workspace_id=p_workspace));
end $$;
create function private.privacy_export_page(p_workspace uuid,p_actor uuid,p_operator_authority uuid,p_table text,p_offset bigint,p_limit integer) returns setof jsonb language plpgsql security invoker set search_path='' as $$ begin
 perform private.privacy_authorize(p_workspace,p_actor,p_operator_authority,'export');
 if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 500 or not exists(select 1 from private.privacy_tables() where table_name=p_table and exportable)
 then raise exception 'PRIVACY_EXPORT_TABLE_OR_PAGE_INVALID'; end if;
 -- No credential tables are exportable. Runtime routing/claim capabilities never leave this query.
 return query execute format('select to_jsonb(t)-array[''workflow_claim'',''claim_token'',''lease_token'',''route_token'',''hook_token''] from %s t where %I=$1 order by to_jsonb(t)::text offset $2 limit $3',p_table,case when p_table='public.workspaces' then 'id' else 'workspace_id' end) using p_workspace,p_offset,p_limit;
end $$;
create function private.privacy_object_page(p_workspace uuid,p_actor uuid,p_operator_authority uuid,p_operation text,p_request_hash text,p_offset bigint,p_limit integer) returns setof jsonb language plpgsql security invoker set search_path='' as $$ begin
 perform private.privacy_authorize(p_workspace,p_actor,p_operator_authority,p_operation,p_request_hash);
 if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 500 then raise exception 'PRIVACY_OBJECT_PAGE_INVALID'; end if;
 return query select jsonb_build_object('workspaceId',p_workspace,'bucket','david-evidence','id',o.id,'path',o.name,'createdAt',o.created_at,'updatedAt',o.updated_at,'metadata',o.metadata)
 from storage.objects o where o.bucket_id='david-evidence' and split_part(o.name,'/',1)=p_workspace::text order by o.name,o.id offset p_offset limit p_limit;
end $$;
create function private.privacy_begin_delete(p_workspace uuid,p_actor uuid,p_operator_authority uuid,p_request_hash text,p_confirmed_workspace uuid,p_retention_released boolean,p_policy text) returns uuid language plpgsql security invoker set search_path='' as $$
declare existing private.privacy_jobs; secrets uuid[]; n bigint; objects bigint; result uuid;
begin
 perform private.privacy_authorize(p_workspace,p_actor,p_operator_authority,'delete',p_request_hash);
 if p_confirmed_workspace is distinct from p_workspace or p_retention_released is distinct from true or p_policy is distinct from 'approved_expiry_or_erasure' or p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$' then raise exception 'PRIVACY_EXPLICIT_ERASURE_APPROVAL_REQUIRED'; end if;
 perform 1 from public.workspaces where id=p_workspace for update;
 select * into existing from private.privacy_jobs where workspace_id=p_workspace;
 if found then if existing.request_hash<>p_request_hash then raise exception 'PRIVACY_DIFFERENT_REQUEST_IN_PROGRESS'; end if; return existing.id; end if;
 if cardinality(private.privacy_blockers(p_workspace))>0 then raise exception 'PRIVACY_PAUSE_AND_RECONCILIATION_REQUIRED'; end if;
 select coalesce(array_agg(v),'{}') into secrets from (select vault_id v from private.connection_secrets where workspace_id=p_workspace union select verifier_vault_id from private.oauth_states where workspace_id=p_workspace and verifier_vault_id is not null) x;
 if exists(select 1 from private.connection_secrets where workspace_id<>p_workspace and vault_id=any(secrets)) or exists(select 1 from private.oauth_states where workspace_id<>p_workspace and verifier_vault_id=any(secrets)) then raise exception 'PRIVACY_CROSS_WORKSPACE_SECRET_REFERENCE'; end if;
 -- Quarantine commits BEFORE remote Storage removal. Failure leaves a paused, inaccessible workspace and retryable job.
 update public.memberships set active=false where workspace_id=p_workspace;
 update public.connections set health='revoked',scopes='{}',operations='{}' where workspace_id=p_workspace;
 update public.live_activations set revoked_at=coalesce(revoked_at,now()) where workspace_id=p_workspace;
 update public.mandates set revoked_at=coalesce(revoked_at,now()) where workspace_id=p_workspace;
 update public.approvals set status='invalidated' where workspace_id=p_workspace and status in ('pending','approved');
 update public.runs set status='cancelled',next_due_at=null,fence=fence+1,workflow_claim=null,claim_until=null where workspace_id=p_workspace;
 update public.conversations set active=false,takeover=true,fence=fence+1 where workspace_id=p_workspace;
 delete from private.connection_secrets where workspace_id=p_workspace;
 delete from private.oauth_states where workspace_id=p_workspace;
 delete from vault.secrets where id=any(secrets); get diagnostics n=row_count;
 select count(*) into objects from storage.objects where bucket_id='david-evidence' and split_part(name,'/',1)=p_workspace::text;
 insert into private.privacy_jobs(workspace_id,request_hash,retention_policy,objects_at_quarantine,vault_secrets_removed) values(p_workspace,p_request_hash,p_policy,objects,n) returning id into result;
 return result;
end $$;
create function private.privacy_finish_delete(p_workspace uuid,p_request_hash text,p_confirmed_workspace uuid,p_retention_released boolean) returns jsonb language plpgsql security invoker set search_path='' as $$
declare job private.privacy_jobs; t record; n bigint; total bigint:=0; receipt uuid;
begin
 perform private.privacy_assert_admin(); perform private.privacy_assert_schema();
 if p_workspace is null or p_confirmed_workspace is distinct from p_workspace or p_retention_released is distinct from true or p_request_hash is null then raise exception 'PRIVACY_EXPLICIT_ERASURE_APPROVAL_REQUIRED'; end if;
 perform 1 from public.workspaces where id=p_workspace for update;
 select * into job from private.privacy_jobs where workspace_id=p_workspace for update;
 if not found or job.request_hash<>p_request_hash then raise exception 'PRIVACY_QUARANTINE_REQUEST_REQUIRED'; end if;
 if cardinality(private.privacy_blockers(p_workspace))>0 or exists(select 1 from public.memberships where workspace_id=p_workspace and active) or exists(select 1 from private.connection_secrets where workspace_id=p_workspace) or exists(select 1 from private.oauth_states where workspace_id=p_workspace) then raise exception 'PRIVACY_QUARANTINE_CHANGED'; end if;
 -- Serialize final emptiness check with in-flight Storage metadata writes; never directly delete Storage metadata.
 lock table storage.objects in share mode;
 if exists(select 1 from storage.objects where bucket_id='david-evidence' and split_part(name,'/',1)=p_workspace::text) then raise exception 'PRIVACY_STORAGE_REMOVAL_REQUIRED'; end if;
 for t in select * from private.privacy_tables() order by delete_order loop
   execute format('delete from %s where %I=$1',t.table_name,case when t.table_name='public.workspaces' then 'id' else 'workspace_id' end) using p_workspace;
   get diagnostics n=row_count; total:=total+n;
 end loop;
 -- Global aggregate usage/reservations remain conservative; auth.users and other tenants are untouched.
 insert into private.privacy_completion_audit(operation,rows_removed,objects_at_quarantine,vault_secrets_removed,retention_policy)
 values('workspace_erased',total,job.objects_at_quarantine,job.vault_secrets_removed,job.retention_policy) returning id into receipt;
 return jsonb_build_object('completionId',receipt,'rowsRemoved',total,'objectsAtQuarantine',job.objects_at_quarantine,'vaultSecretsRemoved',job.vault_secrets_removed);
end $$;
revoke all on private.privacy_jobs,private.privacy_completion_audit from public,anon,authenticated,service_role,david_worker,david_dispatcher,david_oauth;
do $$ declare f record; begin
 for f in select p.oid::regprocedure function_name from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'privacy_%'
 loop execute format('revoke all on function %s from public,anon,authenticated,service_role,david_worker,david_dispatcher,david_oauth',f.function_name); end loop;
end $$;
commit;
