begin;
create table private.agent_catalog(id text primary key, mode text not null, implemented boolean not null, archetypes text[] not null);
insert into private.agent_catalog(id,mode,implemented,archetypes) values
('account-intelligence','preparation',true,array['b2b_services','home_services','commerce']),
('buying-signal-scout','monitored_execution',false,array['b2b_services','home_services','commerce']),
('outbound-email-sdr','monitored_execution',false,array['b2b_services','home_services','commerce']),
('linkedin-outreach-assistant','preparation',false,array['b2b_services','home_services','commerce']),
('partner-development','monitored_execution',false,array['b2b_services','home_services','commerce']),
('rfp-opportunity-scout','monitored_execution',false,array['b2b_services','home_services','commerce']),
('competitor-intelligence','monitored_execution',false,array['b2b_services','home_services','commerce']),
('search-growth','preparation',true,array['b2b_services','home_services','commerce']),
('technical-seo-monitor','preparation',true,array['b2b_services','home_services','commerce']),
('local-search-manager','preparation',true,array['b2b_services','home_services','commerce']),
('creative-performance','preparation',true,array['b2b_services','home_services','commerce']),
('paid-campaign-operator','monitored_execution',false,array['b2b_services','home_services','commerce']),
('landing-page-optimizer','preparation',true,array['b2b_services','home_services','commerce']),
('social-content-publisher','preparation',true,array['b2b_services','home_services','commerce']),
('video-script-producer','preparation',true,array['b2b_services','home_services','commerce']),
('product-merchandiser','monitored_execution',false,array['commerce']),
('speed-to-lead-responder','monitored_execution',false,array['b2b_services','home_services','commerce']),
('ai-receptionist','monitored_execution',false,array['b2b_services','home_services','commerce']),
('website-sales-concierge','preparation',true,array['b2b_services','home_services','commerce']),
('appointment-coordinator','monitored_execution',true,array['b2b_services','home_services','commerce']),
('lead-qualification','monitored_execution',false,array['b2b_services','home_services','commerce']),
('proposal-operations','monitored_execution',false,array['b2b_services','home_services','commerce']),
('deal-follow-up','monitored_execution',true,array['b2b_services','home_services','commerce']),
('sales-call-coach','monitored_execution',false,array['b2b_services','home_services','commerce']),
('estimate-recovery','monitored_execution',false,array['home_services']),
('revenue-experiment-manager','monitored_execution',false,array['b2b_services','home_services','commerce']),
('abandoned-cart-recovery','monitored_execution',false,array['commerce']),
('lifecycle-email-manager','monitored_execution',false,array['b2b_services','home_services','commerce']),
('customer-win-back','monitored_execution',false,array['b2b_services','home_services','commerce']),
('expansion-opportunity-scout','monitored_execution',false,array['b2b_services','home_services','commerce']),
('renewal-and-retention','monitored_execution',false,array['b2b_services','home_services','commerce']),
('review-and-referral-manager','monitored_execution',false,array['b2b_services','home_services','commerce']);
revoke all on private.agent_catalog from public,anon,authenticated;

create table private.run_inputs(workspace_id uuid not null,run_id uuid primary key,kind text not null,payload jsonb not null,foreign key(workspace_id,run_id) references public.runs(workspace_id,id));
create function private.run_input() returns table(kind text,payload jsonb) language sql security definer set search_path='' as $$ select kind,payload from private.run_inputs where workspace_id=private.current_workspace() and run_id=private.current_run() $$;
revoke all on function private.run_input() from public,anon,authenticated;
grant execute on function private.run_input() to david_worker;

create function public.select_team(p_workspace uuid,p_agents text[]) returns void language plpgsql security definer set search_path='' as $$
declare w public.workspaces; begin
 if coalesce(private.member_role(p_workspace),'') not in ('workspace_owner','david_operator') then raise exception 'Owner role required' using errcode='42501'; end if;
 select * into w from public.workspaces where id=p_workspace for update;
 if p_agents is null or cardinality(p_agents)>least(w.entitlement,5) or cardinality(p_agents)<>(select count(distinct a) from unnest(p_agents) a) then raise exception 'Five distinct specialist slots required'; end if;
 if exists(select 1 from unnest(p_agents) a left join private.agent_catalog c on c.id=a where c.id is null or not w.business_model=any(c.archetypes)) then raise exception 'Unknown or inapplicable specialist'; end if;
 if exists(select 1 from public.runs r join public.installations i on i.id=r.installation_id where r.workspace_id=w.id and not i.agent_id=any(p_agents) and r.status not in ('completed','cancelled','failed')) then raise exception 'A specialist has unfinished work; complete a controlled handoff first'; end if;
 -- Preserve historical installations and all evidence. Removed slots become paused.
 update public.installations set status='paused' where workspace_id=w.id and not agent_id=any(p_agents);
 insert into public.installations(workspace_id,agent_id,definition_version,mode,status,daily_capacity)
 select w.id,c.id,'1.0.0',c.mode,'selected',0 from private.agent_catalog c where c.id=any(p_agents)
 on conflict(workspace_id,agent_id) do update set status='selected';
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(w.id,auth.uid(),'team_selected',jsonb_build_object('agent_ids',p_agents));
end $$;
create function public.save_product_record(p_workspace uuid,p_kind text,p_id uuid,p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare old public.product_records; begin
 if coalesce(private.member_role(p_workspace),'') not in ('workspace_owner','david_operator') then raise exception 'Owner role required' using errcode='42501'; end if;
 if p_kind is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or p_kind not in ('team_recommendation','activation_plan','forecast_scenario','company_context') or octet_length(p_payload::text)>150000 then raise exception 'Unsupported product mutation'; end if;
 if p_payload->>'workspaceId' is distinct from p_workspace::text or p_payload->>'id' is distinct from p_id::text then raise exception 'Product record binding mismatch'; end if;
 if p_kind='activation_plan' and (p_payload->>'milestone' is distinct from 'not_started' or jsonb_typeof(p_payload->'selectedTeam') is distinct from 'array' or jsonb_array_length(p_payload->'selectedTeam')>5 or jsonb_typeof(p_payload->'prerequisites') is distinct from 'array' or exists(select 1 from jsonb_array_elements(p_payload->'prerequisites') pr where pr->>'state'='verified')) then raise exception 'Activation progress cannot assert a verified workflow outcome'; end if;
 if p_kind='forecast_scenario' then
  if not (p_payload ?& array['volume','capacity','horizonDays','overlapResolved','currency','valueMinor','spendMinor','conversions']) or jsonb_typeof(p_payload->'conversions') is distinct from 'array' or jsonb_array_length(p_payload->'conversions') not between 1 and 8 or coalesce(p_payload->>'currency','') !~ '^[A-Z]{3}$' or p_payload->>'volume' is null or p_payload->>'capacity' is null or p_payload->>'horizonDays' is null or (p_payload->>'volume')::numeric<0 or (p_payload->>'capacity')::numeric<0 or (p_payload->>'horizonDays')::int not between 1 and 730 or not coalesce((p_payload->>'overlapResolved')::boolean,false) then raise exception 'Invalid scenario or unresolved overlap'; end if;
  if exists(select 1 from jsonb_array_elements(p_payload->'conversions') x where not (x ?& array['low','base','high','label']) or x->>'low' is null or x->>'base' is null or x->>'high' is null or (x->>'low')::numeric<0 or (x->>'low')::numeric>(x->>'base')::numeric or (x->>'base')::numeric>(x->>'high')::numeric or (x->>'high')::numeric>1) then raise exception 'Invalid scenario conversion'; end if;
 end if;
 select * into old from public.product_records where id=p_id for update;
 if old.id is not null and (old.workspace_id<>p_workspace or old.kind<>p_kind) then raise exception 'Cross-workspace product record denied'; end if;
 insert into public.product_records(id,workspace_id,kind,payload) values(p_id,p_workspace,p_kind,p_payload)
 on conflict(id) do update set payload=excluded.payload,version=product_records.version+1;
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id) values(p_workspace,auth.uid(),'product_'||p_kind||'_saved',p_id);
 return p_id;
end $$;
create function public.record_time(p_workspace uuid,p_category text,p_minutes integer,p_cost bigint,p_note text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; begin
 if coalesce(private.member_role(p_workspace),'') not in ('workspace_owner','david_operator') then raise exception 'Owner role required' using errcode='42501'; end if;
 if p_category is null or p_minutes is null or p_note is null or p_category not in ('setup','recurring_support','provider','infrastructure','research') or p_minutes not between 0 and 1440 or (p_cost is not null and p_cost<0) or length(p_note) not between 1 and 500 then raise exception 'Invalid time record'; end if;
 insert into public.usage_records(workspace_id,category,minutes,cost_minor,currency,note) select p_workspace,p_category,p_minutes,p_cost,currency,p_note from public.workspaces where id=p_workspace returning id into result;
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id) values(p_workspace,auth.uid(),'delivery_time_recorded',result); return result;
end $$;
create function public.request_work(p_workspace uuid,p_agent text,p_kind text,p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.installations; w public.workspaces; conn uuid; rid uuid; handoff public.conversations; begin
 if coalesce(private.member_role(p_workspace),'') not in ('workspace_owner','david_operator') then raise exception 'Owner role required' using errcode='42501'; end if;
 select * into w from public.workspaces where id=p_workspace for update;
 select * into i from public.installations where workspace_id=p_workspace and agent_id=p_agent and status not in ('paused','failed','blocked');
 if i.id is null or w.paused or not exists(select 1 from private.agent_catalog where id=p_agent and implemented) then raise exception 'Selected installed capability and unpaused workspace required'; end if;
 if (p_kind='draft' and p_agent<>'deal-follow-up') or (p_kind='book' and p_agent<>'appointment-coordinator') or p_kind not in ('draft','book','prepare','reconcile') then raise exception 'Unsupported responsibility'; end if;
 if p_kind='prepare' and i.mode<>'preparation' then raise exception 'Preparation capability missing'; end if;
 if exists(select 1 from public.runs where workspace_id=w.id and installation_id=i.id and status in ('scheduled','processing','awaiting_approval','waiting_for_input')) then raise exception 'Existing unfinished run requires review'; end if;
 if (select count(*) from public.runs where workspace_id=w.id and created_at>=date_trunc('day',now()))>=100 then raise exception 'Workspace daily run ceiling reached'; end if;
 if p_kind in ('draft','book') then
  if not exists(select 1 from public.proposals where id=(p_payload->>'proposalId')::uuid and workspace_id=w.id and status='open' and not fixture) then raise exception 'Current nonfixture proposal required'; end if;
 end if;
 if p_kind in ('draft','book') then
  select c.id into conn from public.proposals p join public.source_bindings s on s.workspace_id=p.workspace_id and s.id=p.source_binding_id join public.connections c on c.workspace_id=s.workspace_id and c.id=s.connection_id where p.id=(p_payload->>'proposalId')::uuid and p.workspace_id=w.id and c.health='healthy';
 end if;
 if p_kind='book' then
  select cv.* into handoff from public.conversations cv join public.proposals p on p.workspace_id=cv.workspace_id and p.contact_id=cv.contact_id join public.contacts c on c.workspace_id=cv.workspace_id and c.id=cv.contact_id
   where p.id=(p_payload->>'proposalId')::uuid and cv.workspace_id=w.id and cv.active and cv.reply_class='positive' and cv.replied_at is not null and cv.booked_at is null
    and not cv.takeover and not c.human_takeover and not c.suppressed and c.enrolled and cv.connection_id=conn for update of cv;
  if handoff.id is null then raise exception 'Reviewed positive conversation handoff required'; end if;
  if exists(select 1 from public.actions where workspace_id=w.id and contact_id=handoff.contact_id and (status in ('submitting','uncertain') or reserved_at is not null and status='not_attempted')) then raise exception 'Reconcile pending contact actions before handoff'; end if;
 end if;
 rid:=gen_random_uuid();
 insert into public.runs(id,workspace_id,installation_id,connection_id,definition_version,sdk_version,deployment_id,environment,status,next_due_at) values(rid,w.id,i.id,conn,'proposal-v1','4.8.8','pending-dispatch',w.environment,'scheduled',now());
 if handoff.id is not null then
  update public.runs set status='cancelled',next_due_at=null where id=handoff.run_id and workspace_id=w.id and status not in ('completed','cancelled');
  update public.approvals set status='invalidated' where workspace_id=w.id and action_id in(select id from public.actions where workspace_id=w.id and contact_id=handoff.contact_id and type='send_follow_up' and status='not_attempted');
  update public.conversations set run_id=rid,owner_agent_id='appointment-coordinator',purpose='approved_scheduling_handoff',fence=fence+1 where id=handoff.id;
  insert into public.audit_events(workspace_id,actor_id,event_type,entity_id,detail) values(w.id,auth.uid(),'conversation_handoff',handoff.id,jsonb_build_object('from_run',handoff.run_id,'to_run',rid,'purpose','approved_scheduling_handoff'));
 end if;
 insert into private.run_inputs(workspace_id,run_id,kind,payload) values(w.id,rid,p_kind,p_payload);
 insert into private.outbox(workspace_id,run_id,event_type,dedupe_key) values(w.id,rid,'run_due','initial:'||rid);
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id) values(w.id,auth.uid(),'work_requested',rid);
 return rid;
end $$;
revoke all on function public.select_team(uuid,text[]),public.save_product_record(uuid,text,uuid,jsonb),public.record_time(uuid,text,integer,bigint,text),public.request_work(uuid,text,text,jsonb) from public,anon;
grant execute on function public.select_team(uuid,text[]),public.save_product_record(uuid,text,uuid,jsonb),public.record_time(uuid,text,integer,bigint,text),public.request_work(uuid,text,text,jsonb) to authenticated;
commit;
