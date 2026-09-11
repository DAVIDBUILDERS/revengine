begin;
-- Only reviewed, immutable factual-followup.v1 scope can replace a per-message decision.
-- Mandates are provisioned by the migration administrator; runtime/browser roles cannot grant them.
create function private.guard_mandate_revision() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if (to_jsonb(new)-'revoked_at') is distinct from (to_jsonb(old)-'revoked_at')
  or old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at
  or new.revoked_at>now() then raise exception 'Mandates are immutable; grant a new reviewed version or revoke the current one'; end if;
 return new;
end $$;
create trigger immutable_mandate before update on public.mandates for each row execute function private.guard_mandate_revision();

create function private.mandate_matches(p_mandate uuid,p_action uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare a public.actions; m public.mandates; p public.proposals; c public.contacts; r public.runs; pol public.policies; installation public.installations;
 b jsonb; expected jsonb; used_actions bigint; used_cost numeric; max_actions integer; max_cost bigint; begin
 select * into a from public.actions where id=p_action and workspace_id=private.current_workspace() and run_id=private.current_run();
 if a.id is null or a.type<>'send_follow_up' or a.expires_at<=now() then return false; end if;
 select * into m from public.mandates where id=p_mandate and workspace_id=a.workspace_id;
 if m.id is null or m.version<=0 or m.action_type<>'send_follow_up' or m.revoked_at is not null or m.starts_at>now() or m.expires_at<=now()
  or not exists(select 1 from public.memberships grantor where grantor.workspace_id=m.workspace_id and grantor.id=m.grantor_id and grantor.active and grantor.role='workspace_owner') then return false; end if;
 select * into r from public.runs where workspace_id=a.workspace_id and id=a.run_id;
 select * into p from public.proposals where workspace_id=a.workspace_id and id=a.proposal_id;
 select * into c from public.contacts where workspace_id=a.workspace_id and id=a.contact_id;
 select * into pol from public.policies where workspace_id=a.workspace_id and id=a.policy_id;
 select * into installation from public.installations where workspace_id=a.workspace_id and id=a.installation_id;
 if r.environment is distinct from 'live' or (select environment from public.workspaces where id=a.workspace_id) is distinct from 'live'
  or p.id is null or p.fixture or p.reference !~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$' or p.status<>'open' or p.version<>a.proposal_version or c.id is null or not c.enrolled or c.suppressed or c.human_takeover
  or installation.mode is distinct from 'bounded_autonomous_execution' or installation.agent_id is distinct from 'deal-follow-up' or installation.policy_id is distinct from pol.id or pol.id is null
  then return false; end if;
 b:=m.bounds;
 -- Typed reviewed bounds. Bad administrator input blocks this mandate rather than widening it.
 if jsonb_typeof(b) is distinct from 'object' or b->>'templateVersion' is distinct from 'factual-followup.v1'
  or b->>'subjectTemplate' is distinct from 'Following up on {reference}'
  or b->>'bodyTemplate' is distinct from E'I’m following up on proposal {reference}.\n\n{scopeSummary}\n\nWhat questions can we help answer?'
  or b->>'channel' is distinct from 'gmail' or b->>'policyId' is distinct from a.policy_id::text
  or jsonb_typeof(b->'policyVersion') is distinct from 'number' or b->>'policyVersion' is distinct from pol.version::text
  or b->>'senderConnectionId' is distinct from r.connection_id::text
  or coalesce(b->>'cohortId','')='' or b->>'cohortId' is distinct from c.cohort_id
  or jsonb_typeof(b->'contactIds') is distinct from 'array' or not coalesce(b->'contactIds' ? c.id::text,false)
  or jsonb_typeof(b->'recipientDomains') is distinct from 'array' or not coalesce(b->'recipientDomains' ? lower(split_part(c.email,'@',2)),false)
  or b->>'approvedScope' is distinct from p.scope_summary or coalesce(b->>'approvedScope','')=''
  or jsonb_typeof(b->'maxActions') is distinct from 'number' or coalesce(b->>'maxActions','') !~ '^[1-9][0-9]{0,3}$'
  or jsonb_typeof(b->'maxCostMinor') is distinct from 'number' or coalesce(b->>'maxCostMinor','') !~ '^(0|[1-9][0-9]{0,14})$'
  then return false; end if;
 max_actions:=(b->>'maxActions')::integer; max_cost:=(b->>'maxCostMinor')::bigint;
 if max_actions>1000 or max_cost>9007199254740991 then return false; end if;
 expected:=jsonb_build_object('recipient',c.email,'proposalVersion',p.version,'subject','Following up on '||p.reference,
  'body',E'I’m following up on proposal '||p.reference||E'.\n\n'||p.scope_summary||E'\n\nWhat questions can we help answer?');
 if a.payload is distinct from expected then return false; end if;
 -- Include unresolved reservations, accepted, confirmed and failed attempts for this mandate.
 -- Exclude this action, then include it once both before reserve and before submitting.
 select count(*),coalesce(sum(other.reserved_cost_minor),0) into used_actions,used_cost
 from public.actions other where other.workspace_id=a.workspace_id and other.mandate_id=m.id and other.id<>a.id and other.reserved_at is not null;
 return used_actions+1<=max_actions and used_cost+a.reserved_cost_minor<=max_cost;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end $$;

create or replace function private.action_authority(p_action uuid) returns text
language plpgsql security definer set search_path='' as $$
declare a public.actions; ap public.approvals; begin
 select * into a from public.actions where id=p_action and workspace_id=private.current_workspace() and run_id=private.current_run();
 if a.id is null then return 'missing'; end if;
 select * into ap from public.approvals where workspace_id=a.workspace_id and action_id=a.id;
 if ap.id is null then return 'missing'; end if;
 -- An explicit rejection or material-source invalidation always overrides standing authority.
 if ap.status in ('rejected','invalidated') then return ap.status; end if;
 if a.expires_at<=now() or ap.expires_at<=now() then return 'expired'; end if;
 if ap.payload_hash is distinct from a.payload_hash then return 'invalidated'; end if;
 if ap.status='approved' then return 'approved'; end if;
 if a.mandate_id is not null and private.mandate_matches(a.mandate_id,a.id) then return 'mandated'; end if;
 return ap.status;
end $$;

alter function private.create_action(uuid,uuid,uuid,text,jsonb,text,uuid,bigint,timestamptz) rename to create_action_before_mandates;
revoke all on function private.create_action_before_mandates(uuid,uuid,uuid,text,jsonb,text,uuid,bigint,timestamptz) from public,anon,authenticated,david_worker,david_dispatcher,david_oauth;
create function private.create_action(p_id uuid,p_contact uuid,p_proposal uuid,p_type text,p_payload jsonb,p_hash text,p_policy uuid,p_cost bigint,p_expires timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; a public.actions; chosen public.mandates; begin
 result:=private.create_action_before_mandates(p_id,p_contact,p_proposal,p_type,p_payload,p_hash,p_policy,p_cost,p_expires);
 select * into a from public.actions where id=result and workspace_id=private.current_workspace() and run_id=private.current_run();
 -- Do not silently replace expired/revoked authority on an existing draft.
 if a.mandate_id is null and a.status='not_attempted' and a.reserved_at is null and private.action_authority(a.id)='pending' then
  perform 1 from public.workspaces where id=a.workspace_id for update;
  select candidate.* into chosen from public.mandates candidate where candidate.workspace_id=a.workspace_id
   and private.mandate_matches(candidate.id,a.id) order by candidate.starts_at desc,candidate.version desc,candidate.id limit 1;
  if chosen.id is not null then
   update public.actions set mandate_id=chosen.id where id=a.id;
   insert into public.audit_events(workspace_id,event_type,entity_id,detail) values(a.workspace_id,'standing_mandate_bound',a.id,
    jsonb_build_object('mandate_id',chosen.id,'mandate_version',chosen.version,'grantor_membership_id',chosen.grantor_id,'policy_id',a.policy_id,'payload_hash',a.payload_hash,'template_version','factual-followup.v1'));
  end if;
 end if;
 return result;
end $$;
revoke all on function private.guard_mandate_revision(),private.mandate_matches(uuid,uuid),private.action_authority(uuid),private.create_action(uuid,uuid,uuid,text,jsonb,text,uuid,bigint,timestamptz) from public,anon,authenticated,david_worker,david_dispatcher,david_oauth;
grant execute on function private.action_authority(uuid),private.create_action(uuid,uuid,uuid,text,jsonb,text,uuid,bigint,timestamptz) to david_worker;
commit;
