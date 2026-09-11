begin;
-- Model spending is disabled until an authorized operator explicitly configures both limits.
create table private.model_global_limit(singleton boolean primary key default true check(singleton),daily_cost_ceiling_minor bigint not null default 0 check(daily_cost_ceiling_minor>=0),daily_output_token_ceiling bigint not null default 0 check(daily_output_token_ceiling>=0),currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'),pricing_basis text not null default 'Unconfigured; no model spend authorized');
insert into private.model_global_limit(singleton) values(true);
create table private.workspace_model_limits(workspace_id uuid primary key references public.workspaces(id),daily_cost_ceiling_minor bigint not null default 0 check(daily_cost_ceiling_minor>=0),daily_output_token_ceiling bigint not null default 0 check(daily_output_token_ceiling>=0),approved_by uuid not null references auth.users(id),pricing_basis text not null,approved_at timestamptz not null default now());
create table private.model_global_counters(day date primary key,reserved_minor bigint not null default 0,spent_minor bigint not null default 0,reserved_output_tokens bigint not null default 0,output_tokens bigint not null default 0);
create table private.model_workspace_counters(workspace_id uuid not null references public.workspaces(id),day date not null,reserved_minor bigint not null default 0,spent_minor bigint not null default 0,reserved_output_tokens bigint not null default 0,output_tokens bigint not null default 0,primary key(workspace_id,day));
create table private.model_reservations(id uuid primary key default gen_random_uuid(),workspace_id uuid not null,run_id uuid not null,day date not null,max_cost_minor bigint not null check(max_cost_minor>0),max_output_tokens integer not null check(max_output_tokens between 1 and 1500),status text not null default 'reserved' check(status in ('reserved','awaiting_cost','failed_review','settled')),input_tokens integer,output_tokens integer,model text,actual_cost_minor bigint,usage_record_id uuid,created_at timestamptz not null default now(),unique(workspace_id,run_id),foreign key(workspace_id,run_id) references public.runs(workspace_id,id),foreign key(workspace_id,usage_record_id) references public.usage_records(workspace_id,id));

create function public.set_workspace_model_limits(p_workspace uuid,p_daily_cost bigint,p_daily_output_tokens bigint,p_pricing_basis text) returns void language plpgsql security definer set search_path='' as $$ begin
 if coalesce(private.member_role(p_workspace),'') not in ('workspace_owner','david_operator') then raise exception 'Owner role required' using errcode='42501'; end if;
 if p_daily_cost is null or p_daily_cost<0 or p_daily_output_tokens is null or p_daily_output_tokens<0 or p_pricing_basis is null or length(trim(p_pricing_basis)) not between 10 and 1000 then raise exception 'Explicit nonnegative model limits and reviewed pricing basis required'; end if;
 insert into private.workspace_model_limits(workspace_id,daily_cost_ceiling_minor,daily_output_token_ceiling,approved_by,pricing_basis) values(p_workspace,p_daily_cost,p_daily_output_tokens,auth.uid(),p_pricing_basis)
 on conflict(workspace_id) do update set daily_cost_ceiling_minor=excluded.daily_cost_ceiling_minor,daily_output_token_ceiling=excluded.daily_output_token_ceiling,approved_by=excluded.approved_by,pricing_basis=excluded.pricing_basis,approved_at=now();
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(p_workspace,auth.uid(),'model_limits_changed',jsonb_build_object('daily_cost_minor',p_daily_cost,'daily_output_tokens',p_daily_output_tokens,'pricing_basis',p_pricing_basis));
end $$;
create function private.reserve_model_budget(p_workspace uuid,p_max_cost bigint,p_max_tokens integer) returns uuid language plpgsql security definer set search_path='' as $$
declare g private.model_global_limit; w private.workspace_model_limits; gc private.model_global_counters; wc private.model_workspace_counters; d date:=(now() at time zone 'UTC')::date; result uuid; begin
 if p_workspace is distinct from private.current_workspace() or not exists(select 1 from public.runs r join public.workspaces ws on ws.id=r.workspace_id where r.id=private.current_run() and r.workspace_id=p_workspace and not ws.paused and r.environment<>'fixture' and r.status='processing') then raise exception 'Model run context or pause gate failed' using errcode='42501'; end if;
 if p_max_cost is null or p_max_cost<=0 or p_max_tokens is null or p_max_tokens not between 1 and 1500 then raise exception 'Invalid bounded model reservation'; end if;
 -- Lock global, then workspace, in the same order for every tenant; no lock spans model I/O.
 select * into g from private.model_global_limit where singleton for update;
 select * into w from private.workspace_model_limits where workspace_id=p_workspace for update;
 if (select currency from public.workspaces where id=p_workspace) is distinct from g.currency then raise exception 'MODEL_BUDGET_CURRENCY: explicit reviewed conversion is required before using this global budget'; end if;
 if w.workspace_id is null or g.daily_cost_ceiling_minor=0 or g.daily_output_token_ceiling=0 or w.daily_cost_ceiling_minor=0 or w.daily_output_token_ceiling=0 then raise exception 'MODEL_BUDGET_UNCONFIGURED: global and workspace limits must both be approved'; end if;
 if exists(select 1 from private.model_reservations where workspace_id=p_workspace and run_id=private.current_run()) then raise exception 'MODEL_RUN_ALREADY_RESERVED: recover retained output or reconcile; no duplicate inference'; end if;
 insert into private.model_global_counters(day) values(d) on conflict do nothing;
 insert into private.model_workspace_counters(workspace_id,day) values(p_workspace,d) on conflict do nothing;
 select * into gc from private.model_global_counters where day=d for update;
 select * into wc from private.model_workspace_counters where workspace_id=p_workspace and day=d for update;
 if gc.reserved_minor+gc.spent_minor+p_max_cost>g.daily_cost_ceiling_minor or wc.reserved_minor+wc.spent_minor+p_max_cost>w.daily_cost_ceiling_minor or gc.reserved_output_tokens+gc.output_tokens+p_max_tokens>g.daily_output_token_ceiling or wc.reserved_output_tokens+wc.output_tokens+p_max_tokens>w.daily_output_token_ceiling then raise exception 'MODEL_BUDGET_EXHAUSTED'; end if;
 update private.model_global_counters set reserved_minor=reserved_minor+p_max_cost,reserved_output_tokens=reserved_output_tokens+p_max_tokens where day=d;
 update private.model_workspace_counters set reserved_minor=reserved_minor+p_max_cost,reserved_output_tokens=reserved_output_tokens+p_max_tokens where workspace_id=p_workspace and day=d;
 insert into private.model_reservations(workspace_id,run_id,day,max_cost_minor,max_output_tokens) values(p_workspace,private.current_run(),d,p_max_cost,p_max_tokens) returning id into result;
 return result;
end $$;
create function private.settle_model_budget(p_reservation uuid,p_input_tokens integer,p_output_tokens integer,p_model text,p_cost bigint) returns void language plpgsql security definer set search_path='' as $$
declare r private.model_reservations; usage_id uuid; begin
 select * into r from private.model_reservations where id=p_reservation and workspace_id=private.current_workspace() and run_id=private.current_run() for update;
 if r.id is null or p_input_tokens is null or p_input_tokens<0 or p_output_tokens is null or p_output_tokens<0 or p_model is null or length(p_model) not between 1 and 200 or (p_cost is not null and p_cost<0) then raise exception 'Invalid model usage settlement'; end if;
 if r.status='settled' then if r.actual_cost_minor is distinct from p_cost or r.input_tokens<>p_input_tokens or r.output_tokens<>p_output_tokens or r.model is distinct from p_model then raise exception 'Immutable settled usage requires an audited correction'; end if;return; end if;
 if r.status='awaiting_cost' and p_cost is null then if r.input_tokens<>p_input_tokens or r.output_tokens<>p_output_tokens or r.model is distinct from p_model then raise exception 'Usage correction cannot alter the retained token/model evidence'; end if;return; end if;
 if r.status='failed_review' then raise exception 'Failed inference requires operator cost reconciliation before retry'; end if;
 if r.status='reserved' then
  update private.model_global_counters set reserved_output_tokens=reserved_output_tokens-r.max_output_tokens,output_tokens=output_tokens+p_output_tokens where day=r.day;
  update private.model_workspace_counters set reserved_output_tokens=reserved_output_tokens-r.max_output_tokens,output_tokens=output_tokens+p_output_tokens where workspace_id=r.workspace_id and day=r.day;
  insert into public.usage_records(workspace_id,run_id,category,minutes,cost_minor,currency,note) select r.workspace_id,r.run_id,'provider',0,p_cost,w.currency,jsonb_build_object('model',p_model,'inputTokens',p_input_tokens,'outputTokens',p_output_tokens,'maxOutputTokens',r.max_output_tokens,'reservedCostMinor',r.max_cost_minor,'costState',case when p_cost is null then 'awaiting_provider_cost_reconciliation' else 'recorded' end)::text from public.workspaces w where w.id=r.workspace_id returning id into usage_id;
 else
  if r.input_tokens<>p_input_tokens or r.output_tokens<>p_output_tokens or r.model<>p_model then raise exception 'Usage correction cannot alter the retained token/model evidence'; end if;
  usage_id:=r.usage_record_id;update public.usage_records set cost_minor=p_cost,note=note||' | Provider cost reconciled' where workspace_id=r.workspace_id and id=usage_id;
 end if;
 if p_cost is not null then
  update private.model_global_counters set reserved_minor=reserved_minor-r.max_cost_minor,spent_minor=spent_minor+p_cost where day=r.day;
  update private.model_workspace_counters set reserved_minor=reserved_minor-r.max_cost_minor,spent_minor=spent_minor+p_cost where workspace_id=r.workspace_id and day=r.day;
 end if;
 update private.model_reservations set status=case when p_cost is null then 'awaiting_cost' else 'settled' end,input_tokens=p_input_tokens,output_tokens=p_output_tokens,model=p_model,actual_cost_minor=p_cost,usage_record_id=usage_id where id=r.id;
 insert into public.audit_events(workspace_id,event_type,entity_id,detail) values(r.workspace_id,'model_usage_retained',r.id,jsonb_build_object('cost_state',case when p_cost is null then 'awaiting_cost' else 'settled' end,'conservative_reservation_minor',case when p_cost is null then r.max_cost_minor else 0 end,'ceiling_overrun',p_output_tokens>r.max_output_tokens or coalesce(p_cost>r.max_cost_minor,false)));
end $$;
create function private.fail_model_budget(p_reservation uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare r private.model_reservations; begin
 select * into r from private.model_reservations where id=p_reservation and workspace_id=private.current_workspace() and run_id=private.current_run() for update;
 if r.id is null then raise exception 'Model reservation binding denied' using errcode='42501'; end if;
 if r.status<>'reserved' then return; end if;
 update private.model_reservations set status='failed_review' where id=r.id;
 insert into public.usage_records(workspace_id,run_id,category,minutes,cost_minor,currency,note) select r.workspace_id,r.run_id,'provider',0,null,w.currency,'Model attempt failed; cost unknown; conservative reservation retained. Reason: '||left(p_reason,200) from public.workspaces w where w.id=r.workspace_id;
 insert into public.audit_events(workspace_id,event_type,entity_id,detail) values(r.workspace_id,'model_failure_cost_review',r.id,jsonb_build_object('reason',left(p_reason,200),'reserved_cost_minor',r.max_cost_minor));
end $$;

alter table public.installations add column preparation_cadence_hours integer not null default 24 check(preparation_cadence_hours between 24 and 720),add column preparation_next_due_at timestamptz;
create table private.preparation_claims(workspace_id uuid not null,run_id uuid primary key,installation_id uuid not null,source_signature text not null check(source_signature ~ '^[a-f0-9]{64}$'),status text not null check(status in ('claimed','completed','failed')),artifact_id uuid,claimed_at timestamptz not null default now(),foreign key(workspace_id,run_id) references public.runs(workspace_id,id),foreign key(workspace_id,installation_id) references public.installations(workspace_id,id),foreign key(workspace_id,artifact_id) references public.prepared_artifacts(workspace_id,id));
create function private.claim_preparation(p_agent text,p_signature text) returns table(status text,artifact_id uuid) language plpgsql security definer set search_path='' as $$
declare r public.runs; i public.installations; prior private.preparation_claims; begin
 select * into r from public.runs where id=private.current_run() and workspace_id=private.current_workspace();
 select * into i from public.installations where id=r.installation_id and workspace_id=r.workspace_id for update;
 if r.id is null or i.agent_id is distinct from p_agent or i.mode<>'preparation' or i.status in ('paused','selected','blocked','failed') or r.status<>'processing' or r.environment='fixture' or p_signature is null or p_signature !~ '^[a-f0-9]{64}$' or exists(select 1 from public.workspaces where id=r.workspace_id and paused) then raise exception 'PREPARATION_NOT_READY'; end if;
 select * into prior from private.preparation_claims where run_id=r.id;
 if prior.status='completed' then if prior.source_signature is distinct from p_signature then raise exception 'PREPARATION_RUN_SOURCE_CHANGED'; end if;return query select 'completed'::text,prior.artifact_id;return; end if;
 if prior.run_id is not null then raise exception 'PREPARATION_RUN_ALREADY_CLAIMED: review retained work; no duplicate model operation'; end if;
 select * into prior from private.preparation_claims where workspace_id=r.workspace_id and installation_id=i.id and source_signature=p_signature and preparation_claims.status='completed' order by claimed_at desc limit 1;
 if prior.artifact_id is not null then
  update public.runs set status='completed',next_due_at=null where id=r.id;
  update public.installations set preparation_next_due_at=now()+make_interval(hours=>preparation_cadence_hours) where id=i.id;
  insert into public.audit_events(workspace_id,event_type,entity_id,detail) values(r.workspace_id,'preparation_source_unchanged',r.id,jsonb_build_object('artifact_id',prior.artifact_id,'source_signature',p_signature));
  return query select 'unchanged'::text,prior.artifact_id;return;
 end if;
 if (select count(*) from private.preparation_claims where workspace_id=r.workspace_id and installation_id=i.id and claimed_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' and preparation_claims.status in ('claimed','completed'))>=i.daily_capacity then raise exception 'PREPARATION_DAILY_CAPACITY'; end if;
 insert into private.preparation_claims(workspace_id,run_id,installation_id,source_signature,status) values(r.workspace_id,r.id,i.id,p_signature,'claimed');
 return query select 'claimed'::text,null::uuid;
end $$;
create function private.complete_preparation(p_signature text,p_artifact jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare r private.preparation_claims; result uuid; item jsonb; begin
 select * into r from private.preparation_claims where workspace_id=private.current_workspace() and run_id=private.current_run() for update;
 if r.status='completed' then if r.source_signature is distinct from p_signature then raise exception 'PREPARATION_RUN_SOURCE_CHANGED'; end if;return r.artifact_id; end if;
 if r.run_id is null or r.status<>'claimed' or r.source_signature is distinct from p_signature or exists(select 1 from public.workspaces where id=r.workspace_id and paused) or not exists(select 1 from public.installations i where i.id=r.installation_id and i.agent_id=p_artifact->>'agentId' and i.status not in ('paused','blocked','failed','selected')) then raise exception 'PREPARATION_SAVE_NOT_READY'; end if;
 if p_artifact is null or jsonb_typeof(p_artifact)<>'object' or octet_length(p_artifact::text)>150000 or jsonb_typeof(p_artifact->'sourceSnapshot') is distinct from 'array' or jsonb_array_length(p_artifact->'sourceSnapshot')<1 or jsonb_typeof(p_artifact->'factualInputs') is distinct from 'array' or length(p_artifact->>'content')<1 or length(p_artifact->>'title')<1 then raise exception 'Invalid bounded preparation artifact'; end if;
 for item in select value from jsonb_array_elements(p_artifact->'sourceSnapshot') loop
  if item->>'quality'='fixture' or not exists(select 1 from public.evidence where workspace_id=r.workspace_id and id=(item->>'id')::uuid and quality<>'fixture') then raise exception 'PREPARATION_EVIDENCE_BINDING'; end if;
 end loop;
 result:=(p_artifact->>'id')::uuid;
 insert into public.prepared_artifacts(id,workspace_id,run_id,agent_id,type,title,content,factual_inputs,source_snapshot,capability_version,review_state,limitation) values(result,r.workspace_id,r.run_id,p_artifact->>'agentId',p_artifact->>'type',p_artifact->>'title',p_artifact->>'content',p_artifact->'factualInputs',p_artifact->'sourceSnapshot','1.0.0','draft',p_artifact->>'limitation');
 insert into public.artifact_evidence(workspace_id,artifact_id,evidence_id) select r.workspace_id,result,(value->>'id')::uuid from jsonb_array_elements(p_artifact->'sourceSnapshot');
 update private.preparation_claims set status='completed',artifact_id=result where run_id=r.run_id;
 update public.runs set status='completed',next_due_at=null where id=r.run_id;
 update public.installations set last_preparation_at=now(),status='monitoring',preparation_next_due_at=now()+make_interval(hours=>preparation_cadence_hours) where id=r.installation_id;
 insert into public.audit_events(workspace_id,event_type,entity_id,detail) values(r.workspace_id,'preparation_saved',result,jsonb_build_object('run_id',r.run_id,'source_signature',p_signature,'external_actions',false));
 return result;
end $$;
create function private.fail_preparation(p_reason text) returns void language plpgsql security definer set search_path='' as $$ begin
 update private.preparation_claims set status='failed' where workspace_id=private.current_workspace() and run_id=private.current_run() and status='claimed';
 update public.runs set status='blocked',next_due_at=null where id=private.current_run() and workspace_id=private.current_workspace();
 insert into public.audit_events(workspace_id,event_type,entity_id,detail) values(private.current_workspace(),'preparation_blocked',private.current_run(),jsonb_build_object('reason',left(p_reason,200)));
end $$;

alter function private.claim_due(integer) rename to claim_due_core;
create function private.claim_due(p_limit integer default 25) returns table(outbox_id uuid,run_id uuid,event_type text,payload jsonb,lease_token uuid) language plpgsql security definer set search_path='' as $$
declare i record; rid uuid; begin
 if p_limit<1 or p_limit>100 then raise exception 'Batch limit 1..100'; end if;
 for i in select ins.* from public.installations ins join public.workspaces w on w.id=ins.workspace_id where ins.mode='preparation' and ins.status not in ('paused','selected','blocked','failed') and ins.preparation_next_due_at<=now() and not w.paused and w.environment<>'fixture' order by ins.preparation_next_due_at limit p_limit for update of ins skip locked loop
  if not exists(select 1 from public.runs where workspace_id=i.workspace_id and installation_id=i.id and status in ('scheduled','processing','awaiting_approval','waiting_for_input')) then
   rid:=gen_random_uuid();
   insert into public.runs(id,workspace_id,installation_id,definition_version,sdk_version,deployment_id,environment,status,next_due_at) select rid,i.workspace_id,i.id,'proposal-v1','4.8.8','pending-dispatch',w.environment,'scheduled',now() from public.workspaces w where w.id=i.workspace_id;
   insert into private.run_inputs(workspace_id,run_id,kind,payload) values(i.workspace_id,rid,'prepare',jsonb_build_object('type','prepare','agentId',i.agent_id));
   insert into private.outbox(workspace_id,run_id,event_type,dedupe_key,payload) values(i.workspace_id,rid,'run_due','preparation:'||i.id||':'||i.preparation_next_due_at::text,'{}') on conflict do nothing;
   update public.installations set preparation_next_due_at=now()+make_interval(hours=>preparation_cadence_hours) where id=i.id;
  end if;
 end loop;
 return query select * from private.claim_due_core(p_limit);
end $$;
revoke all on private.model_global_limit,private.workspace_model_limits,private.model_global_counters,private.model_workspace_counters,private.model_reservations,private.preparation_claims from public,anon,authenticated,david_worker,david_dispatcher;
revoke all on function public.set_workspace_model_limits(uuid,bigint,bigint,text) from public,anon;
grant execute on function public.set_workspace_model_limits(uuid,bigint,bigint,text) to authenticated;
revoke all on function private.reserve_model_budget(uuid,bigint,integer),private.settle_model_budget(uuid,integer,integer,text,bigint),private.fail_model_budget(uuid,text),private.claim_preparation(text,text),private.complete_preparation(text,jsonb),private.fail_preparation(text),private.claim_due_core(integer),private.claim_due(integer) from public,anon,authenticated,david_worker,david_dispatcher;
grant execute on function private.reserve_model_budget(uuid,bigint,integer),private.settle_model_budget(uuid,integer,integer,text,bigint),private.fail_model_budget(uuid,text),private.claim_preparation(text,text),private.complete_preparation(text,jsonb),private.fail_preparation(text) to david_worker;
grant execute on function private.claim_due(integer) to david_dispatcher;
commit;
