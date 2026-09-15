-- Included website specialist, 12-hour live team-swap settle, and recorded team change time.
alter table public.workspaces add column if not exists team_selected_at timestamptz;

create or replace function public.select_team(p_workspace uuid,p_agents text[]) returns void language plpgsql security definer set search_path='' as $$
declare w public.workspaces; slot text[]; previous text[]; begin
 perform private.require_setup_owner(p_workspace);select * into w from public.workspaces where id=p_workspace for update;
 slot:=coalesce(array(select distinct a from unnest(coalesce(p_agents,'{}'::text[])) a where a is distinct from 'website-sales-concierge' order by 1),'{}');
 if p_agents is null or cardinality(slot)>w.entitlement or cardinality(p_agents)<>(select count(distinct a) from unnest(p_agents) a) then raise exception 'Distinct agents within workspace allowance required';end if;
 if exists(select 1 from unnest(slot) a left join private.agent_catalog c on c.id=a where c.id is null or not w.business_model=any(c.archetypes)) then raise exception 'Unknown or inapplicable specialist';end if;
 select coalesce(array_agg(i.agent_id order by i.agent_id),'{}') into previous from public.installations i where i.workspace_id=w.id and i.status is distinct from 'paused' and i.agent_id is distinct from 'website-sales-concierge';
 if exists(select 1 from unnest(previous) a where not a=any(slot))
    and w.team_selected_at is not null and w.team_selected_at>now()-interval '12 hours'
    and private.member_role(p_workspace) is distinct from 'david_operator'
 then raise exception 'Removing a specialist settles for 12 hours after the last live team change';end if;
 if exists(select 1 from public.runs r join public.installations i on i.id=r.installation_id where r.workspace_id=w.id and not i.agent_id=any(slot) and i.agent_id is distinct from 'website-sales-concierge' and r.status not in ('completed','cancelled','failed')) then raise exception 'Complete a controlled handoff before removing a specialist with unfinished work';end if;
 update public.installations set status='paused' where workspace_id=w.id and not agent_id=any(slot) and agent_id is distinct from 'website-sales-concierge';
 insert into public.installations(workspace_id,agent_id,definition_version,mode,status,daily_capacity)
 select w.id,c.id,'1.0.0',c.mode,'selected',0 from private.agent_catalog c where c.id=any(slot) or c.id='website-sales-concierge'
 on conflict(workspace_id,agent_id) do update set status='selected';
 if previous is distinct from slot then update public.workspaces set team_selected_at=now() where id=w.id;end if;
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(w.id,auth.uid(),'team_selected',jsonb_build_object('agent_ids',slot,'included',jsonb_build_array('website-sales-concierge')));
end $$;
