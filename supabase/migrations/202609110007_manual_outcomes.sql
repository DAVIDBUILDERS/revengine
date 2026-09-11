begin;
create function public.record_manual_outcome(p_workspace uuid,p_proposal uuid,p_stage text,p_value numeric,p_currency text,p_reference text,p_at timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.proposals; result uuid; e uuid; prior public.outcomes; begin
 if coalesce(private.member_role(p_workspace),'') not in ('workspace_owner','david_operator') then raise exception 'Responsible owner permission required' using errcode='42501'; end if;
 select * into p from public.proposals where id=p_proposal and workspace_id=p_workspace;
 if p.id is null or p_stage is null or p_stage not in ('attended','signed','completed','invoiced','paid') or p_at is null or p_at>now()+interval '1 minute' or length(trim(coalesce(p_reference,''))) not between 1 and 1000 then raise exception 'Invalid outcome observation'; end if;
 if p_stage in ('attended','completed') and (p_value is null or p_value not in (0,1) or p_currency is not null) then raise exception 'Count observation needs zero/one and no currency'; end if;
 if p_stage in ('signed','invoiced','paid') and (coalesce(p_currency,'') !~ '^[A-Z]{3}$' or (p_value is not null and (p_value<0 or p_value>9007199254740991 or p_value<>trunc(p_value)))) then raise exception 'Money observation needs explicit currency and safe minor units'; end if;
 result:=private.source_uuid(p_workspace,'reported-outcome',p_proposal::text||':'||p_stage||':'||p_reference);
 select * into prior from public.outcomes where id=result;
 if prior.id is not null then
  if prior.value is distinct from p_value or prior.currency is distinct from p_currency or prior.period_end<>p_at then raise exception 'Reference is immutable; corrections require a new dated reference'; end if;return result;
 end if;
 e:=gen_random_uuid();
 insert into public.evidence(id,workspace_id,label,source,quality,captured_at) values(e,p_workspace,'Responsible-person confirmation: '||p_stage,left(p_reference,1000),'manually_reported',p_at);
 insert into public.outcomes(id,workspace_id,opportunity_id,evidence_id,metric,stage,source,period_start,period_end,value,value_type,currency,quality)
 values(result,p_workspace,p.opportunity_id,e,'reported_'||p_stage,p_stage,'responsible-person confirmation',p_at,p_at,p_value,case when p_stage in ('attended','completed') then 'count' else 'money_minor' end,p_currency,'manually_reported');
 if p_stage='signed' then
  update public.contacts set human_takeover=true where id=p.contact_id and workspace_id=p_workspace;
  update public.approvals set status='invalidated' where workspace_id=p_workspace and action_id in(select id from public.actions where workspace_id=p_workspace and contact_id=p.contact_id and status='not_attempted');
 end if;
 insert into public.audit_events(workspace_id,actor_id,event_type,entity_id,detail) values(p_workspace,auth.uid(),'manual_outcome_recorded',result,jsonb_build_object('reference',p_reference,'stage',p_stage,'quality','manually_reported'));
 return result;
end $$;
revoke all on function public.record_manual_outcome(uuid,uuid,text,numeric,text,text,timestamptz) from public,anon;
grant execute on function public.record_manual_outcome(uuid,uuid,text,numeric,text,text,timestamptz) to authenticated;
commit;
