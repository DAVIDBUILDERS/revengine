begin;
-- Company context and its evidence must commit together. Generic JSON saves cannot bypass this.
alter function public.save_product_record(uuid,text,uuid,jsonb) rename to save_product_record_v1;
revoke all on function public.save_product_record_v1(uuid,text,uuid,jsonb) from public,anon,authenticated;
create function public.save_product_record(p_workspace uuid,p_kind text,p_id uuid,p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$ begin
 if p_kind='company_context' then raise exception 'Use the atomic company-context operation';end if;
 return public.save_product_record_v1(p_workspace,p_kind,p_id,p_payload);
end $$;

create function public.save_company_context(p_workspace uuid,p_id uuid,p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare old public.product_records; context jsonb; item jsonb; confirmed boolean; ev uuid; result uuid; begin
 if coalesce(private.member_role(p_workspace),'') not in ('workspace_owner','david_operator') then raise exception 'Company context owner required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or p_payload->>'workspaceId' is distinct from p_workspace::text or p_payload->>'id' is distinct from p_id::text or coalesce(p_payload->>'sourceHash','') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid context source binding';end if;
 context:=p_payload->'context';
 if jsonb_typeof(context) is distinct from 'object' or context->>'fixture' is distinct from 'false' or jsonb_typeof(context->'confirmed') is distinct from 'boolean' or jsonb_typeof(context->'evidence') is distinct from 'array' or jsonb_array_length(context->'evidence') not between 1 and 3 or jsonb_typeof(context->'pages') is distinct from 'array' or jsonb_array_length(context->'pages') not between 1 and 3 then raise exception 'Bounded nonfixture pages and evidence required';end if;
 confirmed:=(context->>'confirmed')::boolean;
 select * into old from public.product_records where id=p_id for update;
 if old.id is not null and (old.workspace_id<>p_workspace or old.kind<>'company_context') then raise exception 'Cross-workspace context denied';end if;
 if confirmed then
  if old.id is null or old.payload->>'sourceHash' is distinct from p_payload->>'sourceHash' or old.payload->'context'->'pages' is distinct from context->'pages' then raise exception 'Review the current capture before confirming';end if;
  if coalesce(context->>'companyName','')='' or jsonb_typeof(context->'offers') is distinct from 'array' or jsonb_array_length(context->'offers') not between 1 and 10 or jsonb_typeof(context->'customerTypes') is distinct from 'array' or jsonb_array_length(context->'customerTypes') not between 1 and 10 or jsonb_typeof(context->'locations') is distinct from 'array' or jsonb_array_length(context->'locations')>20 then raise exception 'Review company name, offers, customer types and locations';end if;
 else
  if old.id is not null then raise exception 'Create a new capture to refresh public sources';end if;
 end if;
 for item in select value from jsonb_array_elements(context->'evidence') loop
  ev:=(item->>'id')::uuid;
  if ev is null or coalesce(item->>'label','')='' or coalesce(item->>'source','')='' or (item->>'capturedAt')::timestamptz>now()+interval '5 minutes' or item->>'capturedAt' is null or item->>'quality' is distinct from (case when confirmed then 'manually_reported' else 'unknown' end) then raise exception 'Context evidence has invalid provenance';end if;
  if confirmed and not exists(select 1 from jsonb_array_elements(old.payload->'context'->'evidence') e where e->>'id'=ev::text and e->>'source'=item->>'source' and e->>'capturedAt'=item->>'capturedAt') then raise exception 'Confirmation cannot substitute captured evidence';end if;
  if exists(select 1 from public.evidence where id=ev and workspace_id<>p_workspace) then raise exception 'Cross-workspace evidence denied';end if;
  if not confirmed and exists(select 1 from public.evidence where id=ev) then raise exception 'Capture evidence ID must be new';end if;
  insert into public.evidence(id,workspace_id,label,source,quality,captured_at,url,content_hash)
  values(ev,p_workspace,item->>'label',item->>'source',item->>'quality',(item->>'capturedAt')::timestamptz,item->>'url',p_payload->>'sourceHash')
  on conflict(id) do update set quality=excluded.quality;
 end loop;
 result:=public.save_product_record_v1(p_workspace,'company_context',p_id,p_payload);
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id,detail) values(p_workspace,auth.uid(),case when confirmed then 'company_facts_confirmed' else 'untrusted_source_captured' end,p_id,jsonb_build_object('source_hash',p_payload->>'sourceHash','evidence_count',jsonb_array_length(context->'evidence')));
 return result;
end $$;
revoke all on function public.save_product_record(uuid,text,uuid,jsonb),public.save_company_context(uuid,uuid,jsonb) from public,anon;
grant execute on function public.save_product_record(uuid,text,uuid,jsonb),public.save_company_context(uuid,uuid,jsonb) to authenticated;
commit;
