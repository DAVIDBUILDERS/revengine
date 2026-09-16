-- Outbound Email SDR: DAVID-managed Instantly, customer-supplied lists, no SuperSearch.
begin;
update private.agent_catalog set mode='bounded_autonomous_execution', implemented=true where id='outbound-email-sdr';

alter table public.connections drop constraint if exists connections_provider_check;
alter table public.connections add constraint connections_provider_check check(provider in ('google','csv','website','fixture','instantly','hubspot'));
alter table public.receipts drop constraint if exists receipts_provider_check;
alter table public.receipts add constraint receipts_provider_check check(provider in ('google','fixture','instantly'));
alter table public.source_bindings drop constraint if exists source_bindings_resource_type_check;
alter table public.source_bindings add constraint source_bindings_resource_type_check check(resource_type in ('sheet','mailbox','calendar','website','csv','campaign'));

create table public.outbound_campaigns (
 workspace_id uuid primary key references public.workspaces(id),
 booking_url text,
 sequence jsonb not null default '[]'::jsonb,
 campaign_id text,
 instantly_workspace_id text,
 warmup_ready boolean not null default false,
 sending_accounts jsonb not null default '[]'::jsonb,
 status text not null default 'needs_setup' check(status in ('needs_setup','warming','ready','sending','paused','blocked')),
 crm_provider text not null default 'none' check(crm_provider in ('none','hubspot')),
 crm_status text not null default 'not_connected' check(crm_status in ('not_connected','needs_access','connected')),
 last_error text,
 updated_at timestamptz not null default now(),
 unique(campaign_id)
);
create table public.outbound_leads (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 opportunity_id uuid,
 email text not null,
 first_name text not null default '',
 last_name text not null default '',
 company text not null default '',
 title text not null default '',
 website text not null default '',
 custom jsonb not null default '{}'::jsonb,
 status text not null default 'imported' check(status in ('imported','queued','sent','replied','booked','bounced','unsubscribed','skipped')),
 last_reply text,
 last_event_at timestamptz,
 unique(workspace_id,id), unique(workspace_id,email),
 foreign key(workspace_id,opportunity_id) references public.opportunities(workspace_id,id)
);
create table public.outbound_events (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 lead_id uuid not null,
 provider_event_id text not null,
 event_type text not null check(event_type in ('email_sent','reply_received','auto_reply_received','email_bounced','lead_unsubscribed','lead_meeting_booked')),
 occurred_at timestamptz not null default now(),
 body text,
 unique(workspace_id,id), unique(workspace_id,provider_event_id),
 foreign key(workspace_id,lead_id) references public.outbound_leads(workspace_id,id)
);

do $$ declare t text; begin
 foreach t in array array['outbound_campaigns','outbound_leads','outbound_events'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on public.%I from public, anon, authenticated, david_worker, david_dispatcher', t);
  execute format('grant select on public.%I to authenticated, david_worker', t);
  execute format('create policy member_read on public.%I for select to authenticated using (private.member_role(workspace_id) is not null)', t);
  execute format('create policy scoped_worker_read on public.%I for select to david_worker using (workspace_id=private.current_workspace())', t);
  execute format('grant insert, update on public.%I to david_worker', t);
  execute format('create policy scoped_worker_insert on public.%I for insert to david_worker with check (workspace_id=private.current_workspace())', t);
  execute format('create policy scoped_worker_update on public.%I for update to david_worker using (workspace_id=private.current_workspace()) with check (workspace_id=private.current_workspace())', t);
 end loop;
end $$;

create function private.ensure_outbound_campaign(p_workspace uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.outbound_campaigns(workspace_id) values(p_workspace) on conflict(workspace_id) do nothing;
end $$;

create function private.refresh_outbound_status(p_workspace uuid) returns void language plpgsql security definer set search_path='' as $$
declare c public.outbound_campaigns; w public.workspaces; reasons text[] := '{}';
begin
 select * into w from public.workspaces where id=p_workspace;
 select * into c from public.outbound_campaigns where workspace_id=p_workspace;
 if c.workspace_id is null or c.status in ('paused','sending') then return; end if;
 if w.paused then reasons:=reasons||array['Workspace is paused.']; end if;
 if coalesce(c.booking_url,'')='' then reasons:=reasons||array['Add a Calendly or meeting URL before Instantly can book.']; end if;
 if jsonb_typeof(c.sequence) is distinct from 'array' or jsonb_array_length(c.sequence)=0 then reasons:=reasons||array['Generate the sequence before Instantly can send.']; end if;
 if not exists(select 1 from public.outbound_leads where workspace_id=p_workspace and status<>'skipped') then reasons:=reasons||array['Upload a CSV or connect a CRM list. This agent does not find leads.']; end if;
 if w.environment<>'fixture' and not c.warmup_ready then reasons:=reasons||array['Wait until Instantly warmup is healthy. Cold inboxes do not send.']; end if;
 update public.outbound_campaigns set status=case when cardinality(reasons)>0 then case when c.warmup_ready or w.environment='fixture' then 'needs_setup' else 'warming' end else 'ready' end, last_error=reasons[1], updated_at=now() where workspace_id=p_workspace;
end $$;

create function public.upsert_outbound_booking(p_workspace uuid, p_url text) returns text language plpgsql security definer set search_path='' as $$
begin
 perform private.require_setup_owner(p_workspace);
 if p_url is null or length(trim(p_url))<8 or length(p_url)>500 or p_url !~ '^https?://' then raise exception 'Meeting link must be a valid http(s) URL.'; end if;
 if not exists(select 1 from public.installations where workspace_id=p_workspace and agent_id='outbound-email-sdr' and status is distinct from 'paused') then raise exception 'Select Outbound Email SDR in the team.'; end if;
 perform private.ensure_outbound_campaign(p_workspace);
 update public.outbound_campaigns set booking_url=trim(p_url), updated_at=now() where workspace_id=p_workspace;
 perform private.refresh_outbound_status(p_workspace);
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(p_workspace,auth.uid(),'outbound.booking_url',jsonb_build_object('calendly',trim(p_url)~*'calendly\.com'));
 if trim(p_url)~*'calendly\.com' then return 'Calendly saved. Instantly can auto-book from replies.'; end if;
 return 'Meeting link saved. Instantly will include it; auto-book is strongest with Calendly.';
end $$;

create function public.save_outbound_sequence(p_workspace uuid, p_sequence jsonb) returns text language plpgsql security definer set search_path='' as $$
begin
 perform private.require_setup_owner(p_workspace);
 if p_sequence is null or jsonb_typeof(p_sequence)<>'array' or jsonb_array_length(p_sequence) not between 1 and 8 then raise exception 'A 1–8 step sequence is required.'; end if;
 if exists(select 1 from jsonb_array_elements(p_sequence) s where coalesce(s->>'subject','')='' or coalesce(s->>'body','')='' or length(s->>'subject')>200 or length(s->>'body')>8000) then raise exception 'Each sequence step needs a subject and body.'; end if;
 if not exists(select 1 from public.installations where workspace_id=p_workspace and agent_id='outbound-email-sdr' and status is distinct from 'paused') then raise exception 'Select Outbound Email SDR in the team.'; end if;
 perform private.ensure_outbound_campaign(p_workspace);
 if coalesce((select booking_url from public.outbound_campaigns where workspace_id=p_workspace),'')='' then raise exception 'Add a Calendly or meeting URL before Instantly can book.'; end if;
 update public.outbound_campaigns set sequence=p_sequence, updated_at=now() where workspace_id=p_workspace;
 perform private.refresh_outbound_status(p_workspace);
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(p_workspace,auth.uid(),'outbound.sequence',jsonb_build_object('steps',jsonb_array_length(p_sequence)));
 return 'Three-step sequence written from confirmed company facts. Instantly will send it; no copy-out to another mail tool.';
end $$;

create function public.import_outbound_leads(p_workspace uuid, p_rows jsonb) returns text language plpgsql security definer set search_path='' as $$
declare item jsonb; account uuid; contact uuid; opportunity uuid; proposal uuid; binding uuid; conn uuid; count_rows integer:=0; email text; name text; company text;
begin
 perform private.require_setup_owner(p_workspace);
 if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>2000 or octet_length(p_rows::text)>1000000 then raise exception 'Lead import bounded to 2,000 rows / 1 MB'; end if;
 if not exists(select 1 from public.installations where workspace_id=p_workspace and agent_id='outbound-email-sdr' and status is distinct from 'paused') then raise exception 'Select Outbound Email SDR in the team.'; end if;
 perform 1 from public.workspaces where id=p_workspace for update;
 perform private.ensure_outbound_campaign(p_workspace);
 conn:=private.source_uuid(p_workspace,'connection','outbound-lead-csv');
 binding:=private.source_uuid(p_workspace,'source','outbound-lead-csv');
 insert into public.connections(id,workspace_id,provider,identity,operations,health,last_sync_at) values(conn,p_workspace,'csv','Outbound Email SDR list',array['leads.import'],'unconfigured',now()) on conflict(id) do update set last_sync_at=now();
 insert into public.source_bindings(id,workspace_id,connection_id,resource_id,resource_type,mapping,source_owner) values(binding,p_workspace,conn,'outbound-lead-csv','csv','{"version":1}'::jsonb,coalesce(auth.uid()::text,'workspace owner')) on conflict(id) do nothing;
 for item in select value from jsonb_array_elements(p_rows) loop
  email:=lower(trim(coalesce(item->>'email','')));
  if email='' or email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Email is required on every lead row.'; end if;
  company:=coalesce(nullif(trim(item->>'company'),''),split_part(email,'@',2),'Unknown account');
  name:=trim(concat_ws(' ',nullif(item->>'firstName',''),nullif(item->>'lastName','')));
  if name='' then name:=email; end if;
  account:=private.source_uuid(p_workspace,'account','outbound:'||company);
  contact:=private.source_uuid(p_workspace,'contact','outbound:'||email);
  opportunity:=private.source_uuid(p_workspace,'opportunity','outbound:'||email);
  proposal:=private.source_uuid(p_workspace,'proposal','outbound:'||email);
  if exists(select 1 from public.contacts where workspace_id=p_workspace and lower(email)=email and id<>contact) then raise exception 'Selected email already belongs to a different source contact identity.'; end if;
  insert into public.accounts(id,workspace_id,name,source_key) values(account,p_workspace,company,'outbound:'||company) on conflict(workspace_id,source_key) do nothing;
  insert into public.contacts(id,workspace_id,account_id,name,email,source_key,owner,enrolled) values(contact,p_workspace,account,name,email,'outbound:'||email,'Workspace owner',false) on conflict(workspace_id,source_key) do update set name=excluded.name;
  insert into public.opportunities(id,workspace_id,contact_id,account_id,owner,stage,raw_stage,business_model,source_key)
   select opportunity,p_workspace,contact,account,'Workspace owner','inquiry','outbound_list',business_model,'outbound:'||email from public.workspaces where id=p_workspace
   on conflict(workspace_id,source_key) do nothing;
  insert into public.proposals(id,workspace_id,opportunity_id,contact_id,source_binding_id,source_key,version,reference,issued_at,amount_minor,currency,value_kind,scope_summary,status,raw_status,owner,source_verified_at,synced_at,fixture)
   values(proposal,p_workspace,opportunity,contact,binding,'outbound:'||email,1,left('OUT-'||split_part(email,'@',1),40),now(),null,'USD','unknown','Outbound Email SDR list row. Not a priced proposal. Instantly sends after ready gates.','open','outbound_list','Workspace owner',now(),now(),false)
   on conflict(id) do nothing;
  insert into public.outbound_leads(id,workspace_id,opportunity_id,email,first_name,last_name,company,title,website,custom,status)
   values(private.source_uuid(p_workspace,'outbound-lead',email),p_workspace,opportunity,email,coalesce(item->>'firstName',''),coalesce(item->>'lastName',''),company,coalesce(item->>'title',''),coalesce(item->>'website',''),coalesce(item->'custom','{}'::jsonb),'imported')
   on conflict(workspace_id,email) do nothing;
  count_rows:=count_rows+1;
 end loop;
 perform private.refresh_outbound_status(p_workspace);
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(p_workspace,auth.uid(),'outbound.leads_imported',jsonb_build_object('rows',count_rows));
 return 'Imported '||(select count(*) from public.outbound_leads where workspace_id=p_workspace)::text||' lead(s) for Instantly. This agent does not generate leads.';
end $$;

create function public.set_outbound_crm(p_workspace uuid, p_provider text) returns text language plpgsql security definer set search_path='' as $$
begin
 perform private.require_setup_owner(p_workspace);
 if p_provider not in ('none','hubspot') then raise exception 'Unsupported CRM.'; end if;
 if not exists(select 1 from public.installations where workspace_id=p_workspace and agent_id='outbound-email-sdr' and status is distinct from 'paused') then raise exception 'Select Outbound Email SDR in the team.'; end if;
 perform private.ensure_outbound_campaign(p_workspace);
 update public.outbound_campaigns set crm_provider=p_provider, crm_status=case when p_provider='none' then 'not_connected' else 'needs_access' end, updated_at=now() where workspace_id=p_workspace;
 if p_provider='hubspot' then
  insert into public.connections(id,workspace_id,provider,identity,operations,health) values(private.source_uuid(p_workspace,'connection','hubspot'),p_workspace,'hubspot','HubSpot (needs access)','{}','unconfigured') on conflict(id) do update set health='unconfigured';
 end if;
 perform private.refresh_outbound_status(p_workspace);
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(p_workspace,auth.uid(),'outbound.crm',jsonb_build_object('provider',p_provider));
 if p_provider='hubspot' then return 'HubSpot is the first CRM path. Authorize it so DAVID can pull contacts into Instantly. CSV upload works now.'; end if;
 return 'CRM disconnected. Upload a CSV to send.';
end $$;

create function public.pause_outbound_sdr(p_workspace uuid) returns text language plpgsql security definer set search_path='' as $$
begin
 perform private.require_setup_owner(p_workspace);
 perform private.ensure_outbound_campaign(p_workspace);
 update public.outbound_campaigns set status='paused', updated_at=now() where workspace_id=p_workspace;
 update public.installations set status='paused' where workspace_id=p_workspace and agent_id='outbound-email-sdr';
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(p_workspace,auth.uid(),'outbound.paused',jsonb_build_object('campaign_id',(select campaign_id from public.outbound_campaigns where workspace_id=p_workspace)));
 return 'Outbound Email SDR paused. Instantly will not start new sends.';
end $$;

create function public.prepare_outbound_launch(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.outbound_campaigns; w public.workspaces;
begin
 perform private.require_setup_owner(p_workspace);
 select * into w from public.workspaces where id=p_workspace for update;
 if w.paused then raise exception 'Workspace is paused.'; end if;
 if w.environment='fixture' then raise exception 'Live Instantly send must use the hosted outbound launcher.'; end if;
 if not exists(select 1 from public.installations i join private.agent_catalog a on a.id=i.agent_id where i.workspace_id=p_workspace and i.agent_id='outbound-email-sdr' and a.implemented and i.status is distinct from 'paused') then raise exception 'Select Outbound Email SDR in the team.'; end if;
 perform private.ensure_outbound_campaign(p_workspace);
 perform private.refresh_outbound_status(p_workspace);
 select * into c from public.outbound_campaigns where workspace_id=p_workspace;
 if coalesce(c.booking_url,'')='' then raise exception 'Add a Calendly or meeting URL before Instantly can book.'; end if;
 if jsonb_typeof(c.sequence) is distinct from 'array' or jsonb_array_length(c.sequence)=0 then raise exception 'Generate the sequence before Instantly can send.'; end if;
 if not exists(select 1 from public.outbound_leads where workspace_id=p_workspace and status<>'skipped') then raise exception 'Upload a CSV or connect a CRM list. This agent does not find leads.'; end if;
 insert into public.connections(id,workspace_id,provider,identity,operations,health) values(private.source_uuid(p_workspace,'connection','instantly'),p_workspace,'instantly','DAVID-managed Instantly',array['instantly.send','instantly.warmup','instantly.replies'],'unconfigured') on conflict(id) do nothing;
 return jsonb_build_object(
  'name','david:'||p_workspace::text,
  'dailyLimit',40,
  'sequence',c.sequence,
  'campaignId',c.campaign_id,
  'leads',coalesce((select jsonb_agg(jsonb_build_object('email',l.email,'firstName',l.first_name,'lastName',l.last_name,'company',l.company,'title',l.title,'website',l.website,'custom',l.custom) order by l.email) from public.outbound_leads l where l.workspace_id=p_workspace and l.status<>'skipped'),'[]'::jsonb)
 );
end $$;

create function public.record_outbound_campaign(p_workspace uuid, p_campaign text, p_accounts jsonb, p_warmup boolean) returns text language plpgsql security definer set search_path='' as $$
declare conn uuid;
begin
 perform private.require_setup_owner(p_workspace);
 if coalesce(p_campaign,'')='' or length(p_campaign)>128 then raise exception 'Instantly campaign id is required.'; end if;
 perform private.ensure_outbound_campaign(p_workspace);
 update public.outbound_campaigns set campaign_id=p_campaign, warmup_ready=coalesce(p_warmup,false), sending_accounts=coalesce(p_accounts,'[]'::jsonb), status='sending', last_error=null, updated_at=now() where workspace_id=p_workspace;
 update public.outbound_leads set status='queued' where workspace_id=p_workspace and status='imported';
 update public.installations set status='monitoring', last_business_action_at=now() where workspace_id=p_workspace and agent_id='outbound-email-sdr';
 conn:=private.source_uuid(p_workspace,'connection','instantly');
 insert into public.connections(id,workspace_id,provider,identity,operations,health,last_sync_at,verified_at) values(conn,p_workspace,'instantly','DAVID-managed Instantly',array['instantly.send','instantly.warmup','instantly.replies'],'healthy',now(),now())
  on conflict(id) do update set health='healthy', last_sync_at=now(), verified_at=now(), operations=array['instantly.send','instantly.warmup','instantly.replies'];
 insert into public.source_bindings(id,workspace_id,connection_id,resource_id,resource_type,mapping,source_owner,verified_at)
  values(private.source_uuid(p_workspace,'source','instantly-campaign'),p_workspace,conn,p_campaign,'campaign','{"provider":"instantly"}'::jsonb,'DAVID operator',now())
  on conflict(id) do update set resource_id=excluded.resource_id, verified_at=now();
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(p_workspace,auth.uid(),'outbound.started',jsonb_build_object('campaign_id',p_campaign));
 return 'Instantly campaign is sending. Replies and bookings appear in this workspace.';
end $$;

create function private.ingest_instantly_webhook(p_payload jsonb) returns text language plpgsql security definer set search_path='' as $$
declare event_type text; email text; campaign text; occurred timestamptz; provider_id text; workspace uuid; lead public.outbound_leads; body text; ev uuid;
begin
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then return 'ignored'; end if;
 event_type:=p_payload->>'eventType';
 email:=lower(trim(coalesce(p_payload->>'email','')));
 campaign:=nullif(p_payload->>'campaignId','');
 provider_id:=left(coalesce(p_payload->>'providerEventId',''),200);
 body:=left(p_payload->>'text',8000);
 if event_type not in ('email_sent','reply_received','auto_reply_received','email_bounced','lead_unsubscribed','lead_meeting_booked') or email='' or provider_id='' then return 'ignored'; end if;
 begin occurred:=nullif(p_payload->>'occurredAt','')::timestamptz; exception when others then occurred:=now(); end;
 if occurred is null then occurred:=now(); end if;
 if campaign is not null then select workspace_id into workspace from public.outbound_campaigns where campaign_id=campaign; end if;
 if workspace is null then
  if (select count(distinct workspace_id) from public.outbound_leads where email=email)=1 then
   select workspace_id into workspace from public.outbound_leads where email=email limit 1;
  else return 'unmatched'; end if;
 end if;
 select * into lead from public.outbound_leads where workspace_id=workspace and email=email;
 if lead.id is null then return 'unmatched'; end if;
 if exists(select 1 from public.outbound_events where workspace_id=workspace and provider_event_id=provider_id) then return 'duplicate'; end if;
 insert into public.outbound_events(workspace_id,lead_id,provider_event_id,event_type,occurred_at,body) values(workspace,lead.id,provider_id,event_type,occurred,body);
 insert into public.evidence(workspace_id,label,source,quality,captured_at) values(workspace,'Instantly '||event_type,'instantly webhook','provider_verified',occurred) returning id into ev;
 update public.outbound_leads set last_event_at=occurred,
  status=case event_type when 'email_sent' then case when lead.status='imported' then 'sent' else lead.status end when 'reply_received' then 'replied' when 'auto_reply_received' then 'replied' when 'email_bounced' then 'bounced' when 'lead_unsubscribed' then 'unsubscribed' when 'lead_meeting_booked' then 'booked' else lead.status end,
  last_reply=case when event_type in ('reply_received','auto_reply_received') then coalesce(body,lead.last_reply) else lead.last_reply end
  where workspace_id=workspace and id=lead.id;
 if event_type in ('email_bounced','lead_unsubscribed') then update public.contacts set suppressed=true where workspace_id=workspace and lower(email)=email; end if;
 if event_type in ('reply_received','auto_reply_received') then update public.contacts set last_contact_at=occurred where workspace_id=workspace and lower(email)=email; end if;
 if event_type='reply_received' and lead.opportunity_id is not null and not exists(select 1 from public.outcomes where workspace_id=workspace and opportunity_id=lead.opportunity_id and stage='reply') then
  insert into public.outcomes(workspace_id,opportunity_id,evidence_id,metric,metric_version,stage,source,period_start,period_end,value,value_type,currency,quality)
   values(workspace,lead.opportunity_id,ev,'human_replies',1,'reply','instantly webhook',occurred,occurred,1,'count',null,'provider_verified');
 end if;
 if event_type='lead_meeting_booked' and lead.opportunity_id is not null and not exists(select 1 from public.outcomes where workspace_id=workspace and opportunity_id=lead.opportunity_id and stage='booked') then
  insert into public.outcomes(workspace_id,opportunity_id,evidence_id,metric,metric_version,stage,source,period_start,period_end,value,value_type,currency,quality)
   values(workspace,lead.opportunity_id,ev,'verified_bookings',1,'booked','instantly webhook',occurred,occurred,1,'count',null,'provider_verified');
 end if;
 insert into public.audit_events(workspace_id,event_type,detail) values(workspace,'outbound.event',jsonb_build_object('eventType',event_type,'email',email));
 return event_type||' recorded';
end $$;

create or replace function private.privacy_tables() returns table(table_name text,exportable boolean,delete_order integer) language sql immutable set search_path='' as $$
 values
 ('public.outbound_events',true,-8),('public.outbound_leads',true,-7),('public.outbound_campaigns',true,-6),
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

revoke all on function private.ensure_outbound_campaign(uuid),private.refresh_outbound_status(uuid),private.ingest_instantly_webhook(jsonb) from public,anon,authenticated,david_worker,david_dispatcher,david_oauth;
revoke all on function public.upsert_outbound_booking(uuid,text),public.save_outbound_sequence(uuid,jsonb),public.import_outbound_leads(uuid,jsonb),public.set_outbound_crm(uuid,text),public.pause_outbound_sdr(uuid),public.prepare_outbound_launch(uuid),public.record_outbound_campaign(uuid,text,jsonb,boolean) from public,anon;
grant execute on function public.upsert_outbound_booking(uuid,text),public.save_outbound_sequence(uuid,jsonb),public.import_outbound_leads(uuid,jsonb),public.set_outbound_crm(uuid,text),public.pause_outbound_sdr(uuid),public.prepare_outbound_launch(uuid),public.record_outbound_campaign(uuid,text,jsonb,boolean) to authenticated;
grant execute on function private.ingest_instantly_webhook(jsonb) to david_dispatcher;
commit;
