-- Instantly parent tenancy: one Instantly sub-workspace per DAVID workspace.
-- Live API calls must send x-as-workspace. Webhooks route by Instantly workspace UUID, never by email alone.
begin;

create unique index if not exists outbound_campaigns_instantly_workspace_id_key
  on public.outbound_campaigns (instantly_workspace_id)
  where instantly_workspace_id is not null and instantly_workspace_id <> 'fixture';

create or replace function public.bind_instantly_workspace(p_workspace uuid, p_instantly_workspace text) returns text
language plpgsql security definer set search_path='' as $$
declare bound text;
begin
  perform private.require_setup_owner(p_workspace);
  bound:=lower(trim(coalesce(p_instantly_workspace,'')));
  if bound='' or bound='fixture' or bound ~* '^fixture_only' then
    raise exception 'Bind a DAVID Instantly sub-workspace before live send. Do not send from the admin Instantly workspace.';
  end if;
  if bound !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Instantly sub-workspace id must be the Instantly workspace UUID.';
  end if;
  if exists(select 1 from public.outbound_campaigns where instantly_workspace_id=bound and workspace_id is distinct from p_workspace) then
    raise exception 'That Instantly workspace is already bound to another DAVID workspace.';
  end if;
  perform private.ensure_outbound_campaign(p_workspace);
  update public.outbound_campaigns set instantly_workspace_id=bound, updated_at=now() where workspace_id=p_workspace;
  perform private.refresh_outbound_status(p_workspace);
  insert into public.audit_events(workspace_id,actor_id,event_type,detail)
    values(p_workspace,auth.uid(),'outbound.instantly_workspace',jsonb_build_object('instantly_workspace_id',bound));
  return 'Instantly sub-workspace bound. Live send will use x-as-workspace for this DAVID workspace only.';
end $$;

create or replace function private.refresh_outbound_status(p_workspace uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c public.outbound_campaigns; w public.workspaces; reasons text[] := '{}';
begin
  select * into w from public.workspaces where id=p_workspace;
  select * into c from public.outbound_campaigns where workspace_id=p_workspace;
  if c.workspace_id is null or c.status in ('paused','sending') then return; end if;
  if w.paused then reasons:=reasons||array['Workspace is paused.']; end if;
  if coalesce(c.booking_url,'')='' then reasons:=reasons||array['Add a Calendly or meeting URL before Instantly can book.']; end if;
  if jsonb_typeof(c.sequence) is distinct from 'array' or jsonb_array_length(c.sequence)=0 then reasons:=reasons||array['Generate the sequence before Instantly can send.']; end if;
  if not exists(select 1 from public.outbound_leads where workspace_id=p_workspace and status<>'skipped') then reasons:=reasons||array['Upload a CSV or connect a CRM list. This agent does not find leads.']; end if;
  if w.environment<>'fixture' and (c.instantly_workspace_id is null or c.instantly_workspace_id='fixture' or c.instantly_workspace_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    reasons:=reasons||array['Bind a DAVID Instantly sub-workspace before live send. Do not send from the admin Instantly workspace.'];
  end if;
  if w.environment<>'fixture' and not c.warmup_ready then reasons:=reasons||array['Wait until Instantly warmup is healthy. Cold inboxes do not send.']; end if;
  update public.outbound_campaigns set status=case when cardinality(reasons)>0 then case when c.warmup_ready or w.environment='fixture' then 'needs_setup' else 'warming' end else 'ready' end, last_error=reasons[1], updated_at=now() where workspace_id=p_workspace;
end $$;

create or replace function public.prepare_outbound_launch(p_workspace uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
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
  if c.instantly_workspace_id is null or c.instantly_workspace_id='fixture' or c.instantly_workspace_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Bind a DAVID Instantly sub-workspace before live send. Do not send from the admin Instantly workspace.';
  end if;
  insert into public.connections(id,workspace_id,provider,identity,operations,health) values(private.source_uuid(p_workspace,'connection','instantly'),p_workspace,'instantly','DAVID-managed Instantly',array['instantly.send','instantly.warmup','instantly.replies'],'unconfigured') on conflict(id) do nothing;
  return jsonb_build_object(
    'name','david:'||p_workspace::text,
    'dailyLimit',40,
    'sequence',c.sequence,
    'campaignId',c.campaign_id,
    'instantlyWorkspaceId',c.instantly_workspace_id,
    'leads',coalesce((select jsonb_agg(jsonb_build_object('email',l.email,'firstName',l.first_name,'lastName',l.last_name,'company',l.company,'title',l.title,'website',l.website,'custom',l.custom) order by l.email) from public.outbound_leads l where l.workspace_id=p_workspace and l.status<>'skipped'),'[]'::jsonb)
  );
end $$;

create or replace function private.ingest_instantly_webhook(p_payload jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare event_type text; email text; campaign text; hint text; occurred timestamptz; provider_id text; workspace uuid; lead public.outbound_leads; body text; ev uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then return 'ignored'; end if;
  event_type:=p_payload->>'eventType';
  email:=lower(trim(coalesce(p_payload->>'email','')));
  campaign:=nullif(p_payload->>'campaignId','');
  hint:=nullif(lower(trim(coalesce(p_payload->>'workspaceHint',''))),'');
  provider_id:=left(coalesce(p_payload->>'providerEventId',''),200);
  body:=left(p_payload->>'text',8000);
  if event_type not in ('email_sent','reply_received','auto_reply_received','email_bounced','lead_unsubscribed','lead_meeting_booked') or email='' or provider_id='' then return 'ignored'; end if;
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
  insert into public.audit_events(workspace_id,event_type,detail) values(workspace,'outbound.event',jsonb_build_object('eventType',event_type,'email',email,'instantlyWorkspace',hint));
  return event_type||' recorded';
end $$;

revoke all on function public.bind_instantly_workspace(uuid,text) from public,anon;
grant execute on function public.bind_instantly_workspace(uuid,text) to authenticated;
commit;
