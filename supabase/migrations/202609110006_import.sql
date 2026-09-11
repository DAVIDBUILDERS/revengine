begin;
create function private.source_uuid(p_workspace uuid,p_kind text,p_source text) returns uuid language sql immutable set search_path='' as $$
 select (substr(h,1,8)||'-'||substr(h,9,4)||'-5'||substr(h,14,3)||'-a'||substr(h,18,3)||'-'||substr(h,21,12))::uuid from (select md5(p_workspace::text||':'||p_kind||':'||p_source) h) x
$$;
create table private.import_rows(workspace_id uuid not null references public.workspaces(id),source_binding_id uuid not null,source_key text not null,raw jsonb not null,imported_at timestamptz not null default now(),primary key(workspace_id,source_binding_id,source_key),foreign key(workspace_id,source_binding_id) references public.source_bindings(workspace_id,id));
create function private.import_source_rows(p_workspace uuid,p_binding uuid,p_rows jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare conn uuid; binding uuid; item jsonb; contact uuid; account uuid; opportunity uuid; proposal uuid; count_rows integer:=0; prior public.contacts; duplicate_count integer; ev uuid; source_quality text; source_label text; begin
 if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>500 or octet_length(p_rows::text)>1000000 then raise exception 'Import bounded to 500 rows / 1 MB'; end if;
 select count(*)-count(distinct x->>'proposal_id') into duplicate_count from jsonb_array_elements(p_rows) x;
 if duplicate_count>0 then raise exception 'Duplicate proposal source IDs in batch'; end if;
 perform 1 from public.workspaces where id=p_workspace for update;
 binding:=p_binding;
 select s.connection_id,case when c.provider='google' then 'provider_verified' else 'manually_reported' end,case when c.provider='google' then 'Google Sheet' else 'CSV batch' end into conn,source_quality,source_label
 from public.source_bindings s join public.connections c on c.workspace_id=s.workspace_id and c.id=s.connection_id where s.workspace_id=p_workspace and s.id=binding;
 if conn is null then raise exception 'Source binding missing'; end if;
 for item in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(item)<>'object' or not (item ?& array['proposal_id','opportunity_id','contact_id','contact_name','account','owner','scope_summary','status','email','currency','value_kind','version','source_verified_at','reference','issued_at']) or coalesce(item->>'reference','')='' or coalesce(item->>'contact_name','')='' or coalesce(item->>'account','')='' or coalesce(item->>'proposal_id','')='' or coalesce(item->>'opportunity_id','')='' or coalesce(item->>'contact_id','')='' or coalesce(item->>'owner','')='' or coalesce(item->>'scope_summary','')='' or length(item->>'scope_summary')>4000 then raise exception 'Missing stable ID, owner or approved factual scope'; end if;
  if coalesce(item->>'status','') not in ('open','accepted','declined','on_hold','expired','unknown') or item->>'status'='unknown' then raise exception 'Unmapped status requires review'; end if;
  if coalesce(item->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or coalesce(item->>'currency','') !~ '^[A-Z]{3}$' or coalesce(item->>'value_kind','') not in ('one_time','monthly_recurring','total_contract','unknown') then raise exception 'Invalid contact/currency/value kind'; end if;
  if coalesce(item->>'version','') !~ '^[0-9]+$' or item->>'source_verified_at' is null or item->>'issued_at' is null or (item->>'version')::integer<1 or (item->>'source_verified_at')::timestamptz>now()+interval '5 minutes' or (nullif(item->>'amount_minor','') is not null and (item->>'amount_minor' !~ '^[0-9]+$' or (item->>'amount_minor')::numeric not between 0 and 9007199254740991)) then raise exception 'Invalid version, freshness or amount'; end if;
  contact:=private.source_uuid(p_workspace,'contact',item->>'contact_id');
  -- Do not merge different business entities just because their displayed names match.
  account:=private.source_uuid(p_workspace,'account',coalesce(nullif(item->>'account_id',''),item->>'opportunity_id'));
  opportunity:=private.source_uuid(p_workspace,'opportunity',item->>'opportunity_id');
  proposal:=private.source_uuid(p_workspace,'proposal',(item->>'proposal_id')||':v'||(item->>'version'));
  if exists(select 1 from public.proposals where id=proposal and (workspace_id<>p_workspace or source_binding_id<>binding)) then raise exception 'Source authority conflict: map the prior source explicitly before rebinding stable proposal IDs'; end if;
  select * into prior from public.contacts where workspace_id=p_workspace and id=contact;
  if prior.id is not null and (prior.email is distinct from item->>'email' or prior.account_id<>account) then raise exception 'Contact stable ID conflicts with prior identity; review mapping'; end if;
  if exists(select 1 from public.contacts where workspace_id=p_workspace and lower(email)=lower(item->>'email') and id<>contact) then raise exception 'Conflicting stable contact IDs share one email; review identity before enrollment'; end if;
  if exists(select 1 from public.proposals where workspace_id=p_workspace and source_binding_id=binding and source_key=item->>'proposal_id' and version>(item->>'version')::integer) then raise exception 'Import would regress a proposal version'; end if;
  insert into public.accounts(id,workspace_id,name,source_key) values(account,p_workspace,item->>'account',coalesce(nullif(item->>'account_id',''),item->>'opportunity_id')) on conflict(workspace_id,source_key) do nothing;
  insert into public.contacts(id,workspace_id,account_id,name,email,source_key,owner,enrolled) values(contact,p_workspace,account,item->>'contact_name',item->>'email',item->>'contact_id',item->>'owner',false) on conflict(workspace_id,source_key) do update set name=excluded.name,owner=excluded.owner;
  if exists(select 1 from public.opportunities where id=opportunity and workspace_id=p_workspace and (contact_id<>contact or account_id<>account)) then raise exception 'Opportunity stable ID conflicts with contact/account mapping'; end if;
  insert into public.opportunities(id,workspace_id,contact_id,account_id,owner,stage,raw_stage,business_model,source_key) select opportunity,p_workspace,contact,account,item->>'owner','proposal',item->>'status',business_model,item->>'opportunity_id' from public.workspaces where id=p_workspace on conflict(workspace_id,source_key) do update set raw_stage=excluded.raw_stage;
  -- Status updates cannot silently rewrite an approved message's factual content.
  if exists(select 1 from public.proposals where id=proposal and (scope_summary is distinct from item->>'scope_summary' or amount_minor is distinct from nullif(item->>'amount_minor','')::bigint or currency is distinct from item->>'currency' or value_kind is distinct from item->>'value_kind' or valid_until is distinct from nullif(item->>'valid_until','')::timestamptz or owner is distinct from item->>'owner' or issued_at is distinct from (item->>'issued_at')::timestamptz or contact_id<>contact or opportunity_id<>opportunity)) then raise exception 'Material contact, scope, amount, currency, validity, value kind, owner or issue date change requires a new proposal version'; end if;
  insert into public.proposals(id,workspace_id,opportunity_id,contact_id,source_binding_id,source_key,version,reference,issued_at,valid_until,amount_minor,currency,value_kind,scope_summary,status,raw_status,owner,source_verified_at,synced_at,fixture)
  values(proposal,p_workspace,opportunity,contact,binding,item->>'proposal_id',(item->>'version')::integer,item->>'reference',(item->>'issued_at')::timestamptz,nullif(item->>'valid_until','')::timestamptz,nullif(item->>'amount_minor','')::bigint,item->>'currency',item->>'value_kind',item->>'scope_summary',item->>'status',item->>'status',item->>'owner',(item->>'source_verified_at')::timestamptz,now(),false)
  on conflict(id) do update set status=excluded.status,raw_status=excluded.raw_status,source_verified_at=excluded.source_verified_at,synced_at=now();
  insert into private.import_rows(workspace_id,source_binding_id,source_key,raw) values(p_workspace,binding,item->>'proposal_id',item) on conflict(workspace_id,source_binding_id,source_key) do update set raw=excluded.raw,imported_at=now();
  insert into public.evidence(workspace_id,source_binding_id,label,source,quality,captured_at,content_hash) values(p_workspace,binding,source_label||' imported '||(item->>'reference'),source_label||' · '||(item->>'proposal_id'),source_quality,now(),encode(extensions.digest(item::text,'sha256'),'hex')) returning id into ev;
  if item->>'status'<>'open' then update public.approvals set status='invalidated' where workspace_id=p_workspace and action_id in(select id from public.actions where workspace_id=p_workspace and proposal_id=proposal and status='not_attempted');end if;
  count_rows:=count_rows+1;
 end loop;
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(p_workspace,auth.uid(),'source_rows_imported',jsonb_build_object('rows',count_rows,'source_binding_id',binding,'missing_rows_are_not_deletions',true));
 return count_rows;
end $$;
create function public.import_proposal_rows(p_workspace uuid,p_rows jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare conn uuid; binding uuid; begin
 if coalesce(private.member_role(p_workspace),'') not in ('workspace_owner','david_operator') then raise exception 'Source owner permission required' using errcode='42501'; end if;
 conn:=private.source_uuid(p_workspace,'connection','csv-bootstrap');binding:=private.source_uuid(p_workspace,'source','csv-bootstrap');
 insert into public.connections(id,workspace_id,provider,identity,operations,health,last_sync_at) values(conn,p_workspace,'csv','Owner imported proposal batch',array['proposals.read'],'unconfigured',now()) on conflict(id) do update set last_sync_at=now();
 insert into public.source_bindings(id,workspace_id,connection_id,resource_id,resource_type,mapping,source_owner) values(binding,p_workspace,conn,'csv-bootstrap','csv','{"version":1,"partialExport":true}'::jsonb,auth.uid()::text) on conflict(id) do nothing;
 return private.import_source_rows(p_workspace,binding,p_rows);
end $$;
revoke all on function private.import_source_rows(uuid,uuid,jsonb) from public,anon,authenticated,david_worker,david_dispatcher,david_oauth;
revoke all on function private.source_uuid(uuid,text,text) from public,anon,authenticated;
revoke all on private.import_rows from public,anon,authenticated;
revoke all on function public.import_proposal_rows(uuid,jsonb) from public,anon;
grant execute on function public.import_proposal_rows(uuid,jsonb) to authenticated;
commit;
