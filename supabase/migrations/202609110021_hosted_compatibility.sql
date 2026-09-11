-- Hosted PostgreSQL verification: disambiguate the Vault variable and JSONB operator precedence.
begin;
create or replace function private.privacy_begin_delete(p_workspace uuid,p_actor uuid,p_operator_authority uuid,p_request_hash text,p_confirmed_workspace uuid,p_retention_released boolean,p_policy text) returns uuid language plpgsql security invoker set search_path='' as $$
declare existing private.privacy_jobs; secret_ids uuid[]; n bigint; objects bigint; result uuid;
begin
 perform private.privacy_authorize(p_workspace,p_actor,p_operator_authority,'delete',p_request_hash);
 if p_confirmed_workspace is distinct from p_workspace or p_retention_released is distinct from true or p_policy is distinct from 'approved_expiry_or_erasure' or p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$' then raise exception 'PRIVACY_EXPLICIT_ERASURE_APPROVAL_REQUIRED'; end if;
 perform 1 from public.workspaces where id=p_workspace for update;
 select * into existing from private.privacy_jobs where workspace_id=p_workspace;
 if found then if existing.request_hash<>p_request_hash then raise exception 'PRIVACY_DIFFERENT_REQUEST_IN_PROGRESS'; end if; return existing.id; end if;
 if cardinality(private.privacy_blockers(p_workspace))>0 then raise exception 'PRIVACY_PAUSE_AND_RECONCILIATION_REQUIRED'; end if;
 select coalesce(array_agg(v),'{}') into secret_ids from (select vault_id v from private.connection_secrets where workspace_id=p_workspace union select verifier_vault_id from private.oauth_states where workspace_id=p_workspace and verifier_vault_id is not null) x;
 if exists(select 1 from private.connection_secrets where workspace_id<>p_workspace and vault_id=any(secret_ids)) or exists(select 1 from private.oauth_states where workspace_id<>p_workspace and verifier_vault_id=any(secret_ids)) then raise exception 'PRIVACY_CROSS_WORKSPACE_SECRET_REFERENCE'; end if;
 -- Quarantine commits BEFORE remote Storage removal. Failure leaves a paused, inaccessible workspace and retryable job.
 update public.memberships set active=false where workspace_id=p_workspace;
 update public.connections set health='revoked',scopes='{}',operations='{}' where workspace_id=p_workspace;
 update public.live_activations set revoked_at=coalesce(revoked_at,now()) where workspace_id=p_workspace;
 update public.mandates set revoked_at=coalesce(revoked_at,now()) where workspace_id=p_workspace;
 update public.approvals set status='invalidated' where workspace_id=p_workspace and status in ('pending','approved');
 update public.runs set status='cancelled',next_due_at=null,fence=fence+1,workflow_claim=null,claim_until=null where workspace_id=p_workspace;
 update public.conversations set active=false,takeover=true,fence=fence+1 where workspace_id=p_workspace;
 delete from private.connection_secrets where workspace_id=p_workspace;
 delete from private.oauth_states where workspace_id=p_workspace;
 delete from vault.secrets where id=any(secret_ids); get diagnostics n=row_count;
 select count(*) into objects from storage.objects where bucket_id='david-evidence' and split_part(name,'/',1)=p_workspace::text;
 insert into private.privacy_jobs(workspace_id,request_hash,retention_policy,objects_at_quarantine,vault_secrets_removed) values(p_workspace,p_request_hash,p_policy,objects,n) returning id into result;
 return result;
end $$;

create or replace function public.save_onboarding(p_workspace uuid,p_expected_revision integer,p_answers jsonb) returns void language plpgsql security definer set search_path='' as $$
declare d public.onboarding_documents; w public.workspaces; o jsonb; changed boolean; rev integer; begin
 perform private.require_setup_owner(p_workspace);
 select * into w from public.workspaces where id=p_workspace for update;
 select * into d from public.onboarding_documents where workspace_id=p_workspace for update;
 if p_expected_revision is distinct from coalesce(d.revision,0) then raise exception 'Setup revision conflict; reload before saving' using errcode='40001';end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>150000
 or not(p_answers ?& array['company','team','systems','operations','people','measurement'])
 or exists(select 1 from jsonb_object_keys(p_answers) k where k not in ('company','team','systems','operations','people','measurement')) then raise exception 'Invalid onboarding document';end if;
 if jsonb_typeof(p_answers->'company') is distinct from 'object' or jsonb_typeof(p_answers->'operations') is distinct from 'object'
 or jsonb_typeof(p_answers->'measurement') is distinct from 'object' or jsonb_typeof(p_answers->'team') is distinct from 'array'
 or jsonb_typeof(p_answers->'systems') is distinct from 'array' or jsonb_typeof(p_answers->'people') is distinct from 'array'
 then raise exception 'Invalid onboarding sections';end if;
 if jsonb_array_length(p_answers->'team')>w.entitlement or jsonb_array_length(p_answers->'systems')>40 or jsonb_array_length(p_answers->'people')>30
 or (select count(distinct value) from jsonb_array_elements_text(p_answers->'team'))<>jsonb_array_length(p_answers->'team')
 or exists(select 1 from jsonb_array_elements_text(p_answers->'team') a where not exists(select 1 from private.agent_catalog c where c.id=a.value)) then raise exception 'Invalid team or workspace allowance';end if;
 if coalesce(p_answers#>>'{company,businessModel}','') not in ('b2b_services','home_services','commerce')
 or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_answers#>>'{company,timeZone}')
 or coalesce(length(p_answers#>>'{company,name}'),0)>4000 then raise exception 'Invalid company settings';end if;
 o:=p_answers->'operations';
 if not(o ?& array['approvalMode','automationAcknowledged','policyAcknowledged','workingDays','startHour','endHour','meetingMinutes','bufferMinutes','dailyCapacity','modelDailyBudgetMinor','actionDailyBudgetMinor','approvedContactIds'])
 or coalesce(o->>'approvalMode','') not in ('each_action','bounded_follow_up') or jsonb_typeof(o->'policyAcknowledged') is distinct from 'boolean'
 or jsonb_typeof(o->'automationAcknowledged') is distinct from 'boolean'
 or (o->>'approvalMode'='bounded_follow_up' and o->>'automationAcknowledged' is distinct from 'true')
 or exists(select 1 from unnest(array['startHour','endHour','meetingMinutes','bufferMinutes','dailyCapacity','actionDailyBudgetMinor']) k where jsonb_typeof(o->k) is distinct from 'number' or (o->>k) !~ '^[0-9]+$')
 or jsonb_typeof(o->'modelDailyBudgetMinor') not in ('number','null')
 or (jsonb_typeof(o->'modelDailyBudgetMinor')='number' and (o->>'modelDailyBudgetMinor') !~ '^[0-9]+$')
 or (o->>'startHour')::int not between 0 and 23 or (o->>'endHour')::int not between 1 and 24 or (o->>'endHour')::int<=(o->>'startHour')::int
 or (o->>'meetingMinutes')::int not between 5 and 240 or (o->>'bufferMinutes')::int not between 0 and 120
 or (o->>'dailyCapacity')::int not between 0 and 1000 or (o->>'actionDailyBudgetMinor')::bigint not between 0 and 1000000
 or (o->>'modelDailyBudgetMinor')::bigint not between 0 and 1000000
 or jsonb_typeof(o->'approvedContactIds') is distinct from 'array' or jsonb_array_length(o->'approvedContactIds')>500
 or jsonb_typeof(o->'workingDays') is distinct from 'array' or jsonb_array_length(o->'workingDays') not between 1 and 7
 or exists(select 1 from jsonb_array_elements_text(o->'workingDays') day where day.value::int not between 1 and 7)
 then raise exception 'Invalid operating settings or automation authorization';end if;
 if exists(select 1 from jsonb_array_elements_text(o->'approvedContactIds') c where not exists(select 1 from public.contacts actual where actual.workspace_id=p_workspace and actual.id=c.value::uuid)) then raise exception 'Contact belongs to another workspace';end if;
 if exists(select 1 from jsonb_array_elements(p_answers->'systems') s where coalesce(s->>'connectionId','')<>'' and not exists(select 1 from public.connections c where c.workspace_id=p_workspace and c.id=(s->>'connectionId')::uuid)) then raise exception 'Connection belongs to another workspace';end if;
 changed:=d.workspace_id is null or (d.answers-'measurement') is distinct from (p_answers-'measurement');rev:=coalesce(d.revision,0)+1;
 if changed then
  perform public.set_workspace_pause(p_workspace,true);
  if d.workspace_id is null or ((d.answers->'company')-array['priorities','successDefinition','businessModel','timeZone']) is distinct from ((p_answers->'company')-array['priorities','successDefinition','businessModel','timeZone']) then
   update public.product_records set payload=jsonb_set(payload,'{context,confirmed}','false'::jsonb),version=version+1 where workspace_id=p_workspace and kind='company_context';
  end if;
  update public.approvals set status='invalidated' where workspace_id=p_workspace and status in ('pending','approved') and action_id in(select id from public.actions where workspace_id=p_workspace and status='not_attempted');
  update public.mandates set revoked_at=now() where workspace_id=p_workspace and revoked_at is null;
  update public.live_activations set revoked_at=now() where workspace_id=p_workspace and revoked_at is null;
 end if;
 insert into public.onboarding_documents(workspace_id,revision,answers,updated_by) values(p_workspace,rev,p_answers,auth.uid())
 on conflict(workspace_id) do update set revision=excluded.revision,answers=excluded.answers,updated_at=now(),updated_by=auth.uid();
 insert into private.onboarding_revisions(workspace_id,revision,answers,actor,summary) values(p_workspace,rev,p_answers,auth.uid(),case when changed then 'Configuration changed; execution paused and authority invalidated.' else 'Measurement settings saved.' end);
 insert into public.audit_events(workspace_id,actor_id,event_type,detail) values(p_workspace,auth.uid(),'onboarding_saved',jsonb_build_object('revision',rev,'authority_invalidated',changed));
end $$;
commit;
