-- Technical SEO: DAVID-managed DataForSEO crawl + Google organic/Labs ranks. No GSC. No CMS write.
begin;
update private.agent_catalog set mode='preparation', implemented=true where id='technical-seo-monitor';
update private.agent_required_tools set required_tools='{"tools":["dataforseo.crawl","dataforseo.serp","dataforseo.ranked_keywords","save_artifact"],"capabilities":["website.captured","company.confirmed","dataforseo.onpage","dataforseo.serp"],"systems":["website"],"prerequisites":["confirmed_company_facts","approved_website_snapshot","keyword_list","serp_location"]}'::jsonb
 where agent_id='technical-seo-monitor';
update public.agent_onboarding set required_tools=(select required_tools from private.agent_required_tools where agent_id='technical-seo-monitor')
 where agent_id='technical-seo-monitor';

alter table public.connections drop constraint if exists connections_provider_check;
alter table public.connections add constraint connections_provider_check check(provider in ('google','csv','website','fixture','instantly','hubspot','dataforseo'));

create table public.technical_seo_runs (
 workspace_id uuid primary key references public.workspaces(id),
 status text not null default 'needs_setup' check(status in ('needs_setup','queued','crawling','ready','blocked','paused')),
 target text,
 crawl_task_id text,
 max_pages integer not null default 50 check(max_pages between 1 and 50),
 keywords jsonb not null default '[]'::jsonb,
 location_name text not null default '',
 language_code text not null default 'en',
 fixture boolean not null default false,
 last_error text,
 updated_at timestamptz not null default now()
);
create table public.technical_seo_pages (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 url text not null,
 status_code integer not null default 0 check(status_code between 0 and 599),
 title text not null default '',
 description text not null default '',
 score numeric,
 failed_checks jsonb not null default '[]'::jsonb,
 unique(workspace_id,id), unique(workspace_id,url),
 foreign key(workspace_id) references public.technical_seo_runs(workspace_id)
);
create table public.technical_seo_rankings (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 keyword text not null,
 source text not null check(source in ('tracked','inventory')),
 rank integer check(rank is null or rank between 1 and 100),
 result_url text not null default '',
 location_name text not null,
 language_code text not null,
 unique(workspace_id,id), unique(workspace_id,keyword,source),
 foreign key(workspace_id) references public.technical_seo_runs(workspace_id)
);

do $$ declare t text; begin
 foreach t in array array['technical_seo_runs','technical_seo_pages','technical_seo_rankings'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on public.%I from public, anon, authenticated, david_worker, david_dispatcher', t);
  execute format('grant select on public.%I to authenticated, david_worker', t);
  execute format('create policy member_read on public.%I for select to authenticated using (private.member_role(workspace_id) is not null)', t);
  execute format('create policy scoped_worker_read on public.%I for select to david_worker using (workspace_id=private.current_workspace())', t);
  execute format('grant insert, update, delete on public.%I to david_worker', t);
  execute format('create policy scoped_worker_insert on public.%I for insert to david_worker with check (workspace_id=private.current_workspace())', t);
  execute format('create policy scoped_worker_update on public.%I for update to david_worker using (workspace_id=private.current_workspace()) with check (workspace_id=private.current_workspace())', t);
  execute format('create policy scoped_worker_delete on public.%I for delete to david_worker using (workspace_id=private.current_workspace())', t);
 end loop;
end $$;

create function private.ensure_technical_seo_run(p_workspace uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.technical_seo_runs(workspace_id) values(p_workspace) on conflict(workspace_id) do nothing;
end $$;

create function public.save_technical_seo_setup(p_workspace uuid, p_expected_revision integer, p_keywords jsonb, p_location text, p_language text) returns text language plpgsql security definer set search_path='' as $$
declare keywords text[]; location text; language text;
begin
 perform private.require_setup_owner(p_workspace);
 if not exists(select 1 from public.installations where workspace_id=p_workspace and agent_id='technical-seo-monitor' and status is distinct from 'paused') then raise exception 'Select Technical SEO in the team.'; end if;
 if p_keywords is null or jsonb_typeof(p_keywords)<>'array' then raise exception 'Add 1–20 keywords this specialist should rank-check.'; end if;
 select array_agg(distinct trim(value)) into keywords from jsonb_array_elements_text(p_keywords) as t(value) where length(trim(value)) between 1 and 200;
 if keywords is null or cardinality(keywords) not between 1 and 20 then raise exception 'Add 1–20 keywords this specialist should rank-check.'; end if;
 location:=trim(coalesce(p_location,''));
 if location not in ('United States','United Kingdom','Canada','Australia','Germany') then raise exception 'Choose a supported SERP location.'; end if;
 language:=nullif(trim(coalesce(p_language,'')),'');
 if language is null then language:=case location when 'Germany' then 'de' else 'en' end; end if;
 if length(language) not between 2 and 8 then raise exception 'Choose a supported SERP location.'; end if;
 perform public.save_agent_onboarding(p_workspace,'technical-seo-monitor',p_expected_revision,jsonb_build_object('keywords',to_jsonb(keywords),'locationName',location,'languageCode',language));
 perform private.ensure_technical_seo_run(p_workspace);
 update public.technical_seo_runs set keywords=to_jsonb(keywords), location_name=location, language_code=language,
  status=case when status in ('ready','crawling','queued') then status else 'needs_setup' end, last_error=null, updated_at=now()
  where workspace_id=p_workspace;
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(p_workspace,auth.uid(),'technical_seo.setup',jsonb_build_object('keywords',cardinality(keywords),'location',location));
 return 'Technical SEO keywords and SERP location saved. Company website capture was not copied into this agent.';
end $$;

create function public.pause_technical_seo(p_workspace uuid) returns text language plpgsql security definer set search_path='' as $$
begin
 perform private.require_setup_owner(p_workspace);
 perform private.ensure_technical_seo_run(p_workspace);
 update public.technical_seo_runs set status='paused', updated_at=now() where workspace_id=p_workspace;
 update public.installations set status='paused' where workspace_id=p_workspace and agent_id='technical-seo-monitor';
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(p_workspace,auth.uid(),'technical_seo.paused',jsonb_build_object('task',(select crawl_task_id from public.technical_seo_runs where workspace_id=p_workspace)));
 return 'Technical SEO paused. DataForSEO will not start a new crawl.';
end $$;

create function public.prepare_technical_seo_launch(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.workspaces; r public.technical_seo_runs; website text; target text; start_url text;
begin
 perform private.require_setup_owner(p_workspace);
 select * into w from public.workspaces where id=p_workspace for update;
 if w.paused then raise exception 'Workspace is paused.'; end if;
 if w.environment='fixture' then raise exception 'Live DataForSEO crawl must use the hosted Technical SEO launcher.'; end if;
 if not exists(select 1 from public.installations i join private.agent_catalog a on a.id=i.agent_id where i.workspace_id=p_workspace and i.agent_id='technical-seo-monitor' and a.implemented and i.status is distinct from 'paused') then raise exception 'Select Technical SEO in the team.'; end if;
 perform private.ensure_technical_seo_run(p_workspace);
 select * into r from public.technical_seo_runs where workspace_id=p_workspace;
 if r.status in ('queued','crawling') then raise exception 'A crawl is already in progress.'; end if;
 if jsonb_typeof(coalesce(r.keywords,'[]'::jsonb)) is distinct from 'array' or jsonb_array_length(r.keywords)<1 then raise exception 'Add 1–20 keywords this specialist should rank-check.'; end if;
 if coalesce(r.location_name,'') not in ('United States','United Kingdom','Canada','Australia','Germany') then raise exception 'Choose a supported SERP location.'; end if;
 select nullif(trim(answers#>>'{company,website}'),'') into website from public.onboarding_documents where workspace_id=p_workspace;
 if website is null then
  select payload#>>'{context,pages,0,url}' into website from public.product_records where workspace_id=p_workspace and kind='company_context' order by created_at desc limit 1;
 end if;
 if coalesce(website,'')='' then raise exception 'Capture the company website in Connections.'; end if;
 if website !~ '^https?://' then website:='https://'||website; end if;
 target:=lower(split_part(regexp_replace(website,'^https?://',''),'/',1));
 target:=regexp_replace(target,':[0-9]+$','');
 target:=regexp_replace(target,'^www\.','');
 if target is null or target='' or target='localhost' or target ~ '\.invalid$' or target ~ '\.local$' then raise exception 'Crawl target must be the confirmed public company domain.'; end if;
 start_url:=website;
 insert into public.connections(id,workspace_id,provider,identity,operations,health) values(private.source_uuid(p_workspace,'connection','dataforseo'),p_workspace,'dataforseo','DAVID-managed DataForSEO',array['dataforseo.onpage','dataforseo.serp'],'unconfigured') on conflict(id) do nothing;
 return jsonb_build_object(
  'target',target,
  'startUrl',start_url,
  'maxPages',r.max_pages,
  'keywords',r.keywords,
  'locationName',r.location_name,
  'languageCode',coalesce(nullif(r.language_code,''),'en'),
  'priorityUrls','[]'::jsonb
 );
end $$;

create function public.record_technical_seo_task(p_workspace uuid, p_task text, p_target text) returns text language plpgsql security definer set search_path='' as $$
declare conn uuid;
begin
 perform private.require_setup_owner(p_workspace);
 if coalesce(p_task,'')='' or length(p_task)>128 then raise exception 'DataForSEO crawl task id is required.'; end if;
 if coalesce(p_target,'')='' or length(p_target)>253 then raise exception 'Crawl target is required.'; end if;
 perform private.ensure_technical_seo_run(p_workspace);
 update public.technical_seo_runs set crawl_task_id=p_task, target=p_target, status='crawling', fixture=false, last_error=null, updated_at=now() where workspace_id=p_workspace;
 update public.installations set status='monitoring', last_preparation_at=now() where workspace_id=p_workspace and agent_id='technical-seo-monitor';
 conn:=private.source_uuid(p_workspace,'connection','dataforseo');
 insert into public.connections(id,workspace_id,provider,identity,operations,health,last_sync_at,verified_at) values(conn,p_workspace,'dataforseo','DAVID-managed DataForSEO',array['dataforseo.onpage','dataforseo.serp'],'healthy',now(),now())
  on conflict(id) do update set health='healthy', last_sync_at=now(), verified_at=now(), operations=array['dataforseo.onpage','dataforseo.serp'];
 insert into public.source_bindings(id,workspace_id,connection_id,resource_id,resource_type,mapping,source_owner,verified_at)
  values(private.source_uuid(p_workspace,'source','dataforseo-crawl'),p_workspace,conn,p_target,'website','{"provider":"dataforseo"}'::jsonb,'DAVID operator',now())
  on conflict(id) do update set resource_id=excluded.resource_id, verified_at=now();
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(p_workspace,auth.uid(),'technical_seo.started',jsonb_build_object('task',p_task));
 return 'DataForSEO crawl queued. Rankings appear after the pingback finishes.';
end $$;

create function private.technical_seo_pingback_context(p_workspace uuid, p_task text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.technical_seo_runs;
begin
 if p_workspace is null or coalesce(p_task,'')='' then return null; end if;
 select * into r from public.technical_seo_runs where workspace_id=p_workspace and crawl_task_id=p_task;
 if r.workspace_id is null then return null; end if;
 return jsonb_build_object('target',r.target,'keywords',r.keywords,'locationName',r.location_name,'languageCode',coalesce(nullif(r.language_code,''),'en'));
end $$;

create function private.apply_technical_seo_crawl(p_payload jsonb) returns text language plpgsql security definer set search_path='' as $$
declare workspace uuid; task text; target text; page jsonb; ranking jsonb; ev uuid; artifact uuid; run_id uuid; installation uuid; env text;
begin
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then return 'ignored'; end if;
 begin workspace:=nullif(p_payload->>'workspaceId','')::uuid; exception when others then return 'ignored'; end;
 task:=left(coalesce(p_payload->>'crawlTaskId',''),128);
 target:=left(coalesce(p_payload->>'target',''),253);
 if workspace is null or task='' or target='' then return 'ignored'; end if;
 if not exists(select 1 from public.technical_seo_runs where workspace_id=workspace and crawl_task_id=task) then return 'unmatched'; end if;
 update public.technical_seo_runs set target=target, status='ready', fixture=false, last_error=null, updated_at=now() where workspace_id=workspace;
 delete from public.technical_seo_pages where workspace_id=workspace;
 delete from public.technical_seo_rankings where workspace_id=workspace;
 for page in select value from jsonb_array_elements(coalesce(p_payload->'pages','[]'::jsonb)) loop
  if coalesce(page->>'url','')='' then continue; end if;
  insert into public.technical_seo_pages(workspace_id,url,status_code,title,description,score,failed_checks)
   values(workspace,left(page->>'url',2000),coalesce(nullif(page->>'statusCode','')::integer,0),left(coalesce(page->>'title',''),500),left(coalesce(page->>'description',''),2000),nullif(page->>'score','')::numeric,coalesce(page->'failedChecks','[]'::jsonb))
   on conflict(workspace_id,url) do nothing;
 end loop;
 for ranking in select value from jsonb_array_elements(coalesce(p_payload->'rankings','[]'::jsonb)) loop
  if coalesce(ranking->>'keyword','')='' or coalesce(ranking->>'source','') not in ('tracked','inventory') then continue; end if;
  insert into public.technical_seo_rankings(workspace_id,keyword,source,rank,result_url,location_name,language_code)
   values(workspace,left(ranking->>'keyword',200),ranking->>'source',nullif(ranking->>'rank','')::integer,left(coalesce(ranking->>'resultUrl',''),2000),left(coalesce(ranking->>'locationName',''),120),left(coalesce(ranking->>'languageCode',''),8))
   on conflict(workspace_id,keyword,source) do nothing;
 end loop;
 insert into public.evidence(workspace_id,label,source,quality,captured_at) values(workspace,'DataForSEO crawl','dataforseo pingback','provider_verified',now()) returning id into ev;
 select i.id, w.environment into installation, env from public.installations i join public.workspaces w on w.id=i.workspace_id where i.workspace_id=workspace and i.agent_id='technical-seo-monitor' limit 1;
 if installation is not null then
  run_id:=gen_random_uuid();
  artifact:=gen_random_uuid();
  insert into public.runs(id,workspace_id,installation_id,definition_version,sdk_version,deployment_id,environment,status)
   values(run_id,workspace,installation,'technical-seo-v1','4.8.8','dataforseo-pingback',env,'completed');
  insert into public.prepared_artifacts(id,workspace_id,run_id,agent_id,type,title,content,factual_inputs,source_snapshot,capability_version,review_state,limitation)
   values(artifact,workspace,run_id,'technical-seo-monitor','TechnicalSeoReport','Technical SEO crawl and rank snapshot',
    'Target: '||target||E'\nPages crawled: '||(select count(*) from public.technical_seo_pages where workspace_id=workspace)::text||E'\nTask: '||task||E'\n\nCopy titles, descriptions and fixes into the CMS. DAVID does not write the live site.',
    jsonb_build_array('Target: '||target,'Task: '||task),
    jsonb_build_array(jsonb_build_object('id',ev,'label','DataForSEO crawl','source','dataforseo pingback','capturedAt',now(),'quality','provider_verified')),
    '1.0.0','draft','Bounded crawl and observed SERP/Labs snapshot. Not Search Console, not a CMS write.');
  update public.installations set status='monitoring', last_preparation_at=now() where id=installation;
 end if;
 insert into public.audit_events(workspace_id,event_type,detail) values(workspace,'technical_seo.crawled',jsonb_build_object('task',task));
 return 'DataForSEO crawl recorded for this workspace.';
end $$;

create or replace function private.privacy_tables() returns table(table_name text,exportable boolean,delete_order integer) language sql immutable set search_path='' as $$
 values
 ('public.technical_seo_rankings',true,-11),('public.technical_seo_pages',true,-10),('public.technical_seo_runs',true,-9),
 ('public.outbound_events',true,-8),('public.outbound_leads',true,-7),('public.outbound_campaigns',true,-6),
 ('public.agent_onboarding',true,-5),
 ('public.onboarding_documents',true,-4),('public.onboarding_tasks',true,-3),('private.onboarding_revisions',true,-2),('private.workspace_invitations',false,-1),
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

revoke all on function private.ensure_technical_seo_run(uuid),private.technical_seo_pingback_context(uuid,text),private.apply_technical_seo_crawl(jsonb) from public,anon,authenticated,david_worker,david_dispatcher,david_oauth;
revoke all on function public.save_technical_seo_setup(uuid,integer,jsonb,text,text),public.pause_technical_seo(uuid),public.prepare_technical_seo_launch(uuid),public.record_technical_seo_task(uuid,text,text) from public,anon;
grant execute on function public.save_technical_seo_setup(uuid,integer,jsonb,text,text),public.pause_technical_seo(uuid),public.prepare_technical_seo_launch(uuid),public.record_technical_seo_task(uuid,text,text) to authenticated;
grant execute on function private.technical_seo_pingback_context(uuid,text),private.apply_technical_seo_crawl(jsonb) to david_dispatcher;
commit;
