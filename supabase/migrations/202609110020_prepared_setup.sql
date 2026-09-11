begin;
-- Prepared drafts and selected briefs reuse the existing tenant export/deletion registry.
alter table public.product_records drop constraint product_records_kind_check;
alter table public.product_records add constraint product_records_kind_check check(kind in ('team_recommendation','activation_plan','work_opportunity','initiative','assignment','forecast_scenario','brief_snapshot','intervention','company_context','setup_document','prepared_setup'));
create unique index one_prepared_setup_per_workspace on public.product_records(workspace_id) where kind='prepared_setup';

create function private.setup_input_fingerprint(p_workspace uuid) returns text language sql stable security definer set search_path='' as $$
 select md5(jsonb_build_object(
 'records',(select coalesce(jsonb_agg(jsonb_build_array(id,version) order by id),'[]') from public.product_records where workspace_id=p_workspace and kind in ('company_context','setup_document')),
 'connections',(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') from public.connections c where c.workspace_id=p_workspace),
 'bindings',(select coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]') from public.source_bindings b where b.workspace_id=p_workspace),
 'metrics',(select coalesce(jsonb_agg((m-'evidenceIds')||jsonb_build_object('evidenceIds',(select coalesce(jsonb_agg(e order by e),'[]') from jsonb_array_elements(m->'evidenceIds') e)) order by m->>'key'),'[]') from jsonb_array_elements(public.read_workspace_metrics(p_workspace)) m))::text)
$$;
create function public.read_setup_fingerprint(p_workspace uuid) returns text language plpgsql security definer set search_path='' as $$ begin
 perform private.require_setup_owner(p_workspace);return private.setup_input_fingerprint(p_workspace);end $$;

create function public.save_setup_document(p_workspace uuid,p_name text,p_text text) returns uuid language plpgsql security definer set search_path='' as $$
declare doc uuid; hash text; payload jsonb; begin
 perform private.require_setup_owner(p_workspace);perform 1 from public.workspaces where id=p_workspace for update;
 if p_name is null or length(trim(p_name)) not between 1 and 200 or p_text is null or length(trim(p_text)) not between 1 and 30000 then raise exception 'Select a bounded text or Markdown company brief';end if;
 hash:=encode(extensions.digest(p_text,'sha256'),'hex');
 select id into doc from public.product_records where workspace_id=p_workspace and kind='setup_document' and public.product_records.payload->>'hash'=hash limit 1;
 if doc is not null then return doc;end if;
 if (select count(*) from public.product_records where workspace_id=p_workspace and kind='setup_document')>=5 then raise exception 'Remove a selected brief before adding another (maximum five)';end if;
 doc:=gen_random_uuid();payload:=jsonb_build_object('id',doc,'workspaceId',p_workspace,'name',p_name,'text',p_text,'hash',hash,'version',1,'capturedAt',now(),'fixture',false);
 insert into public.product_records(id,workspace_id,kind,payload) values(doc,p_workspace,'setup_document',payload);
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id,detail) values(p_workspace,auth.uid(),'setup_document_selected',doc,jsonb_build_object('name',p_name,'source_hash',hash,'facts_confirmed',false));
 return doc;
end $$;
create function public.remove_setup_document(p_workspace uuid,p_document uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 perform private.require_setup_owner(p_workspace);perform 1 from public.workspaces where id=p_workspace for update;
 if not exists(select 1 from public.product_records where workspace_id=p_workspace and id=p_document and kind='setup_document') then raise exception 'Selected document unavailable in this workspace' using errcode='42501';end if;
 if exists(select 1 from public.product_records r cross join lateral jsonb_array_elements(r.payload->'citations') c where r.workspace_id=p_workspace and r.kind='prepared_setup' and r.payload->>'acceptedRevision' is not null and c->>'sourceId'=p_document::text) then
  perform public.set_workspace_pause(p_workspace,true);
  update public.product_records set payload=jsonb_set(payload,'{context,confirmed}','false'),version=version+1 where workspace_id=p_workspace and kind='company_context';
 end if;
 delete from public.product_records where workspace_id=p_workspace and id=p_document and kind='setup_document';
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id) values(p_workspace,auth.uid(),'setup_document_removed',p_document);
end $$;

create function public.save_prepared_setup(p_workspace uuid,p_expected_revision integer,p_expected_generation integer,p_fingerprint text,p_payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare old public.product_records; rev integer; doc uuid; begin
 perform private.require_setup_owner(p_workspace);perform 1 from public.workspaces where id=p_workspace for update;
 select revision into rev from public.onboarding_documents where workspace_id=p_workspace;
 select * into old from public.product_records where workspace_id=p_workspace and kind='prepared_setup' for update;
 if p_expected_revision is distinct from coalesce(rev,0) or p_expected_generation is distinct from coalesce((old.payload->>'generation')::integer,0) or p_fingerprint is distinct from private.setup_input_fingerprint(p_workspace) then raise exception 'Setup inputs changed; refresh discovery' using errcode='40001';end if;
 if p_payload is null or octet_length(p_payload::text)>150000 or p_payload->>'workspaceId' is distinct from p_workspace::text or p_payload->>'fixture' is distinct from 'false' or (p_payload->>'generation')::integer is distinct from p_expected_generation+1 or (p_payload->>'basedOnRevision')::integer is distinct from p_expected_revision or p_payload->>'acceptedRevision' is not null or jsonb_typeof(p_payload->'answers') is distinct from 'object' or p_payload#>>'{answers,operations,policyAcknowledged}' is distinct from 'false' or jsonb_typeof(p_payload->'citations') is distinct from 'array' or jsonb_array_length(p_payload->'citations')>80 then raise exception 'Invalid unapproved setup proposal';end if;
 doc:=(p_payload->>'id')::uuid;
 if doc is null or (old.id is not null and old.id<>doc) or exists(select 1 from public.product_records where id=doc and (workspace_id<>p_workspace or kind<>'prepared_setup')) then raise exception 'Setup proposal binding mismatch';end if;
 insert into public.product_records(id,workspace_id,kind,payload) values(doc,p_workspace,'prepared_setup',p_payload||jsonb_build_object('databaseFingerprint',p_fingerprint))
 on conflict(id) do update set payload=excluded.payload,version=public.product_records.version+1;
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id,detail) values(p_workspace,auth.uid(),'setup_proposed',doc,jsonb_build_object('generation',p_expected_generation+1,'based_on_revision',p_expected_revision,'permissions_granted',false));
end $$;
create function public.accept_prepared_setup(p_workspace uuid,p_generation integer,p_revision integer,p_answers jsonb) returns void language plpgsql security definer set search_path='' as $$
declare proposal public.product_records; begin
 perform private.require_setup_owner(p_workspace);perform 1 from public.workspaces where id=p_workspace for update;
 select * into proposal from public.product_records where workspace_id=p_workspace and kind='prepared_setup' for update;
 if proposal.id is null or (proposal.payload->>'generation')::integer is distinct from p_generation or (proposal.payload->>'basedOnRevision')::integer is distinct from p_revision or proposal.payload->>'databaseFingerprint' is distinct from private.setup_input_fingerprint(p_workspace) then raise exception 'Setup inputs changed; regenerate before review' using errcode='40001';end if;
 if p_answers#>>'{operations,policyAcknowledged}' is distinct from 'true' or p_answers#>>'{operations,modelDailyBudgetMinor}' is null or coalesce(p_answers#>>'{operations,escalationOwner}','')='' then raise exception 'Explicit policy, budget and responsibility review required';end if;
 perform public.save_onboarding(p_workspace,p_revision,p_answers);
 update public.product_records set payload=jsonb_set(payload,'{acceptedRevision}',to_jsonb(p_revision+1)),version=version+1 where id=proposal.id;
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id,detail) values(p_workspace,auth.uid(),'prepared_setup_accepted',proposal.id,jsonb_build_object('generation',p_generation,'revision',p_revision+1,'citations',proposal.payload->'citations','proposed_answers',proposal.payload->'answers','sources_confirmed',false));
end $$;
revoke all on function private.setup_input_fingerprint(uuid) from public,anon,authenticated;
revoke all on function public.read_setup_fingerprint(uuid),public.save_setup_document(uuid,text,text),public.remove_setup_document(uuid,uuid),public.save_prepared_setup(uuid,integer,integer,text,jsonb),public.accept_prepared_setup(uuid,integer,integer,jsonb) from public,anon;
grant execute on function public.read_setup_fingerprint(uuid),public.save_setup_document(uuid,text,text),public.remove_setup_document(uuid,uuid),public.save_prepared_setup(uuid,integer,integer,text,jsonb),public.accept_prepared_setup(uuid,integer,integer,jsonb) to authenticated;
create or replace function public.begin_onboarding_discovery(p_workspace uuid,p_connection uuid,p_request jsonb default '{}'::jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare installation uuid; result uuid; model text; mode text; begin
 perform private.require_setup_owner(p_workspace);
 if p_request is null or jsonb_typeof(p_request)<>'object' or octet_length(p_request::text)>4096 or exists(select 1 from jsonb_object_keys(p_request) k where k not in ('operation','fileId','tab')) then raise exception 'Invalid discovery request';end if;
 perform public.consume_request_quota(p_workspace,'commands');
 perform 1 from public.workspaces where id=p_workspace for update;
 update public.runs set status='blocked' where workspace_id=p_workspace and definition_version='onboarding-discovery-v1' and status='processing' and created_at<now()-interval '2 minutes';
 if not exists(select 1 from public.connections where workspace_id=p_workspace and id=p_connection and provider='google' and health not in ('revoked','expired') and 'sheets.read'=any(operations)) then raise exception 'Authorized spreadsheet access required' using errcode='42501';end if;
 select business_model,environment into model,mode from public.workspaces where id=p_workspace;
 select i.id into installation from public.installations i where i.workspace_id=p_workspace order by i.id limit 1;
 if installation is null then
  insert into public.installations(workspace_id,agent_id,definition_version,mode,status,daily_capacity)
  select p_workspace,c.id,'1.0.0',c.mode,'selected',0 from (select coalesce((select payload->'answers' from public.product_records where workspace_id=p_workspace and kind='prepared_setup'),(select answers from public.onboarding_documents where workspace_id=p_workspace)) as answers) d
   cross join lateral jsonb_array_elements_text(d.answers->'team') a join private.agent_catalog c on c.id=a.value
   where c.implemented and model=any(c.archetypes) order by c.id limit 1 returning id into installation;
 end if;
 if installation is null then raise exception 'Choose an applicable implemented team before discovering sources';end if;
 if (select count(*) from public.runs where workspace_id=p_workspace and definition_version='onboarding-discovery-v1' and created_at>now()-interval '1 day')>=100 then raise exception 'Daily discovery limit reached';end if;
 result:=gen_random_uuid();
 insert into public.runs(id,workspace_id,installation_id,connection_id,definition_version,sdk_version,deployment_id,environment,status)
 values(result,p_workspace,installation,p_connection,'onboarding-discovery-v1','4.8.8','request-bound',mode,'processing');
 insert into private.run_inputs(workspace_id,run_id,kind,payload) values(p_workspace,result,'onboarding_discovery',p_request||'{"read_only":true}'::jsonb);
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id,detail) values(p_workspace,auth.uid(),'onboarding_discovery_started',result,p_request||'{"read_only":true}'::jsonb);
 return result;
end $$;

commit;
