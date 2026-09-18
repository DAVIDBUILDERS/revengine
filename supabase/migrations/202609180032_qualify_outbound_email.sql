-- Qualify email column vs plpgsql variable so lead import is not ambiguous.
begin;
create or replace function public.import_outbound_leads(p_workspace uuid, p_rows jsonb) returns text language plpgsql security definer set search_path='' as $$
declare item jsonb; account uuid; contact uuid; opportunity uuid; proposal uuid; binding uuid; conn uuid; count_rows integer:=0; lead_email text; lead_name text; company text;
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
  lead_email:=lower(trim(coalesce(item->>'email','')));
  if lead_email='' or lead_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Email is required on every lead row.'; end if;
  company:=coalesce(nullif(trim(item->>'company'),''),split_part(lead_email,'@',2),'Unknown account');
  lead_name:=trim(concat_ws(' ',nullif(item->>'firstName',''),nullif(item->>'lastName','')));
  if lead_name='' then lead_name:=lead_email; end if;
  account:=private.source_uuid(p_workspace,'account','outbound:'||company);
  contact:=private.source_uuid(p_workspace,'contact','outbound:'||lead_email);
  opportunity:=private.source_uuid(p_workspace,'opportunity','outbound:'||lead_email);
  proposal:=private.source_uuid(p_workspace,'proposal','outbound:'||lead_email);
  if exists(select 1 from public.contacts c where c.workspace_id=p_workspace and lower(c.email)=lead_email and c.id<>contact) then raise exception 'Selected email already belongs to a different source contact identity.'; end if;
  insert into public.accounts(id,workspace_id,name,source_key) values(account,p_workspace,company,'outbound:'||company) on conflict(workspace_id,source_key) do nothing;
  insert into public.contacts(id,workspace_id,account_id,name,email,source_key,owner,enrolled) values(contact,p_workspace,account,lead_name,lead_email,'outbound:'||lead_email,'Workspace owner',false) on conflict(workspace_id,source_key) do update set name=excluded.name;
  insert into public.opportunities(id,workspace_id,contact_id,account_id,owner,stage,raw_stage,business_model,source_key)
   select opportunity,p_workspace,contact,account,'Workspace owner','inquiry','outbound_list',business_model,'outbound:'||lead_email from public.workspaces where id=p_workspace
   on conflict(workspace_id,source_key) do nothing;
  insert into public.proposals(id,workspace_id,opportunity_id,contact_id,source_binding_id,source_key,version,reference,issued_at,amount_minor,currency,value_kind,scope_summary,status,raw_status,owner,source_verified_at,synced_at,fixture)
   values(proposal,p_workspace,opportunity,contact,binding,'outbound:'||lead_email,1,left('OUT-'||split_part(lead_email,'@',1),40),now(),null,'USD','unknown','Outbound Email SDR list row. Not a priced proposal. Instantly sends after ready gates.','open','outbound_list','Workspace owner',now(),now(),false)
   on conflict(id) do nothing;
  insert into public.outbound_leads(id,workspace_id,opportunity_id,email,first_name,last_name,company,title,website,custom,status)
   values(private.source_uuid(p_workspace,'outbound-lead',lead_email),p_workspace,opportunity,lead_email,coalesce(item->>'firstName',''),coalesce(item->>'lastName',''),company,coalesce(item->>'title',''),coalesce(item->>'website',''),coalesce(item->'custom','{}'::jsonb),'imported')
   on conflict(workspace_id,email) do nothing;
  count_rows:=count_rows+1;
 end loop;
 perform private.refresh_outbound_status(p_workspace);
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(p_workspace,auth.uid(),'outbound.leads_imported',jsonb_build_object('rows',count_rows));
 return 'Imported '||(select count(*) from public.outbound_leads where workspace_id=p_workspace)::text||' lead(s) for Instantly. This agent does not generate leads.';
end $$;

create or replace function private.ingest_instantly_webhook(p_payload jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare event_type text; lead_email text; campaign text; hint text; occurred timestamptz; provider_id text; workspace uuid; lead public.outbound_leads; body text; ev uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then return 'ignored'; end if;
  event_type:=p_payload->>'eventType';
  lead_email:=lower(trim(coalesce(p_payload->>'email','')));
  campaign:=nullif(p_payload->>'campaignId','');
  hint:=nullif(lower(trim(coalesce(p_payload->>'workspaceHint',''))),'');
  provider_id:=left(coalesce(p_payload->>'providerEventId',''),200);
  body:=left(p_payload->>'text',8000);
  if event_type not in ('email_sent','reply_received','auto_reply_received','email_bounced','lead_unsubscribed','lead_meeting_booked') or lead_email='' or provider_id='' then return 'ignored'; end if;
  begin occurred:=nullif(p_payload->>'occurredAt','')::timestamptz; exception when others then occurred:=now(); end;
  if occurred is null then occurred:=now(); end if;
  if hint is not null then
    select workspace_id into workspace from public.outbound_campaigns where instantly_workspace_id=hint;
    if workspace is null then return 'unmatched'; end if;
  elsif campaign is not null then
    select workspace_id into workspace from public.outbound_campaigns where campaign_id=campaign;
    if workspace is null then return 'unmatched'; end if;
  else
    return 'unmatched';
  end if;
  select * into lead from public.outbound_leads where workspace_id=workspace and outbound_leads.email=lead_email;
  if lead.id is null then return 'unmatched'; end if;
  if exists(select 1 from public.outbound_events where workspace_id=workspace and provider_event_id=provider_id) then return 'duplicate'; end if;
  insert into public.outbound_events(workspace_id,lead_id,provider_event_id,event_type,occurred_at,body) values(workspace,lead.id,provider_id,event_type,occurred,body);
  insert into public.evidence(workspace_id,label,source,quality,captured_at) values(workspace,'Instantly '||event_type,'instantly webhook','provider_verified',occurred) returning id into ev;
  update public.outbound_leads set last_event_at=occurred,
    status=case event_type when 'email_sent' then case when lead.status='imported' then 'sent' else lead.status end when 'reply_received' then 'replied' when 'auto_reply_received' then 'replied' when 'email_bounced' then 'bounced' when 'lead_unsubscribed' then 'unsubscribed' when 'lead_meeting_booked' then 'booked' else lead.status end,
    last_reply=case when event_type in ('reply_received','auto_reply_received') then coalesce(body,lead.last_reply) else lead.last_reply end
    where workspace_id=workspace and id=lead.id;
  if event_type in ('email_bounced','lead_unsubscribed') then update public.contacts c set suppressed=true where c.workspace_id=workspace and lower(c.email)=lead_email; end if;
  if event_type in ('reply_received','auto_reply_received') then update public.contacts c set last_contact_at=occurred where c.workspace_id=workspace and lower(c.email)=lead_email; end if;
  if event_type='reply_received' and lead.opportunity_id is not null and not exists(select 1 from public.outcomes where workspace_id=workspace and opportunity_id=lead.opportunity_id and stage='reply') then
    insert into public.outcomes(workspace_id,opportunity_id,evidence_id,metric,metric_version,stage,source,period_start,period_end,value,value_type,currency,quality)
      values(workspace,lead.opportunity_id,ev,'human_replies',1,'reply','instantly webhook',occurred,occurred,1,'count',null,'provider_verified');
  end if;
  if event_type='lead_meeting_booked' and lead.opportunity_id is not null and not exists(select 1 from public.outcomes where workspace_id=workspace and opportunity_id=lead.opportunity_id and stage='booked') then
    insert into public.outcomes(workspace_id,opportunity_id,evidence_id,metric,metric_version,stage,source,period_start,period_end,value,value_type,currency,quality)
      values(workspace,lead.opportunity_id,ev,'verified_bookings',1,'booked','instantly webhook',occurred,occurred,1,'count',null,'provider_verified');
  end if;
  insert into public.audit_events(workspace_id,event_type,detail) values(workspace,'outbound.event',jsonb_build_object('eventType',event_type,'email',lead_email,'instantlyWorkspace',hint));
  return event_type||' recorded';
end $$;
commit;
