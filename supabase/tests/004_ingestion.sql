-- Shared CSV/Sheet importer and private Sheet routing; synthetic rows, rollback only.
begin;
insert into public.workspaces(id,name,environment,business_model,time_zone,currency) values
 ('a3000000-0000-4000-8000-000000000010','Sheet fixture A','shadow','b2b_services','UTC','USD'),
 ('b3000000-0000-4000-8000-000000000010','Sheet fixture B','shadow','b2b_services','UTC','USD');
insert into public.connections(id,workspace_id,provider,identity,operations,health) values
 ('a3000000-0000-4000-8000-000000000020','a3000000-0000-4000-8000-000000000010','google','sender-a@example.invalid',array['sheets.read'],'unconfigured'),
 ('b3000000-0000-4000-8000-000000000020','b3000000-0000-4000-8000-000000000010','google','sender-b@example.invalid',array['sheets.read'],'unconfigured');
insert into public.source_bindings(id,workspace_id,connection_id,resource_id,resource_type,range_name,source_owner) values
 ('a3000000-0000-4000-8000-000000000030','a3000000-0000-4000-8000-000000000010','a3000000-0000-4000-8000-000000000020','sheet-a','sheet','Proposals!A1:N501','Owner A'),
 ('b3000000-0000-4000-8000-000000000030','b3000000-0000-4000-8000-000000000010','b3000000-0000-4000-8000-000000000020','sheet-b','sheet','Proposals!A1:N501','Owner B');
insert into public.installations(id,workspace_id,agent_id,definition_version,mode,status,daily_capacity) values('a3000000-0000-4000-8000-000000000040','a3000000-0000-4000-8000-000000000010','deal-follow-up','1.0.0','monitored_execution','monitoring',10);
insert into public.runs(id,workspace_id,installation_id,connection_id,definition_version,sdk_version,deployment_id,environment,status) values('a3000000-0000-4000-8000-000000000050','a3000000-0000-4000-8000-000000000010','a3000000-0000-4000-8000-000000000040','a3000000-0000-4000-8000-000000000020','source-check-v1','test','test','shadow','processing');
select set_config('test.route_token',(select route_token::text from private.run_routes where run_id='a3000000-0000-4000-8000-000000000050'),true);
select set_config('test.proposal_id',private.source_uuid('a3000000-0000-4000-8000-000000000010','proposal','P-100:v1')::text,true);
select set_config('test.source_rows',jsonb_build_array(jsonb_build_object('proposal_id','P-100','opportunity_id','O-100','contact_id','C-100','contact_name','Synthetic Buyer','email','buyer@example.invalid','account','Synthetic Account','owner','Fixture owner','scope_summary','Approved scope','status','open','currency','USD','value_kind','one_time','version','1','source_verified_at',now(),'reference','P-100','issued_at',now()-interval '1 day','valid_until',now()+interval '1 day','amount_minor','10000','gmail_thread_id','syntheticThread100'))::text,true);
set local role david_worker;
select private.bind_run('a3000000-0000-4000-8000-000000000050',current_setting('test.route_token')::uuid);
select private.ingest_sheet_rows('a3000000-0000-4000-8000-000000000030',current_setting('test.source_rows')::jsonb);
select private.ingest_sheet_rows('a3000000-0000-4000-8000-000000000030',current_setting('test.source_rows')::jsonb);
select private.ingest_sheet_rows('a3000000-0000-4000-8000-000000000030','[]');
do $$ declare rejected boolean:=false; begin
 if (select count(*) from public.proposals)<>1 or (select count(*) from public.contacts)<>1 then raise exception 'FAIL: repeat/missing row import duplicated or deleted records'; end if;
 if exists(select 1 from public.contacts where enrolled) then raise exception 'FAIL: source ingestion granted contact consent'; end if;
 if exists(select 1 from public.outcomes) then raise exception 'FAIL: source import fabricated outcomes'; end if;
 begin perform private.ingest_sheet_rows('b3000000-0000-4000-8000-000000000030',current_setting('test.source_rows')::jsonb); raise exception 'FAIL: cross-workspace source import'; exception when insufficient_privilege then null; end;
 begin perform private.ingest_sheet_rows('a3000000-0000-4000-8000-000000000030',jsonb_set(current_setting('test.source_rows')::jsonb,'{0,scope_summary}','"Changed approved scope"')); exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'FAIL: same-version material source edit accepted'; end if;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from private.proposal_threads where workspace_id='a3000000-0000-4000-8000-000000000010' and proposal_id=current_setting('test.proposal_id')::uuid and provider_thread_id='syntheticThread100') then raise exception 'FAIL: source thread mapping was not retained'; end if;
 if not exists(select 1 from public.evidence where workspace_id='a3000000-0000-4000-8000-000000000010' and quality='provider_verified') then raise exception 'FAIL: provider source provenance missing'; end if;
end $$;
set local role authenticated;
do $$ begin
 begin perform private.import_source_rows('a3000000-0000-4000-8000-000000000010','a3000000-0000-4000-8000-000000000030',current_setting('test.source_rows')::jsonb);raise exception 'FAIL: browser bypassed source provenance guard';exception when insufficient_privilege then null;end;
end $$;
rollback;
select 'PASS: worker-bound Sheet import, cross-tenant denial, stable repeat IDs, partial omission preserved, material version guard, thread metadata, no automatic enrollment' as evidence;
