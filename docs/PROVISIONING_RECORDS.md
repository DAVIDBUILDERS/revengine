# Reviewed provisioning records

These templates are not seeds and have not been run. A named release/operator owner must review real IDs, resources, rules, dates and budgets before the deployment administrator applies them to the explicitly bound project. Do not place the migration credential in Vercel runtime variables. UUID placeholders intentionally fail until replaced. Keep the workspace paused while preparing these records; no record alone authorizes a provider write.

First invite the owner and assigned operator through the approved Auth flow, establish current memberships, and verify operator MFA. Select the five-specialist team through the application. Capture public sources and confirm company context. Configure the exact OAuth redirect allowlist, connect the approved Google account, bind the selected Sheet/range and calendar, and run the real read/source validation workflow. A pasted URL or OAuth callback is not capability verification.

For shadow preparation, provision capacity on selected implemented installations. Technical SEO preparation can use its bounded deterministic checks; generated preparations additionally require the configured/verified model and both global/workspace model spending limits. The example values below are illustrative limits for review, not live defaults.

```sql
begin;
-- Replace with IDs returned by the intended project after current-membership review.
update public.installations
set daily_capacity = 1, status = 'selected'
where workspace_id = 'REPLACE_WORKSPACE_UUID'::uuid
  and agent_id in ('technical-seo-monitor', 'search-growth');
-- Keep model spend disabled unless a release owner approves a real pricing basis.
-- The application's set_workspace_model_limits RPC records the owner's reviewed
-- workspace limit; an administrator separately sets private.model_global_limit.
commit;
```

Resume through the authenticated application's `set_workspace_pause(workspace, false)` operation. Shadow resume checks confirmed source-backed company context, implemented selected team and provisioned capacity; it permits internal work only. Missing model access/budget remains a per-preparation blocker. It cancels prior paused runs and invalidates their decisions, then schedules new preparation work. It never revives an old approved message.

For the live follow-up pilot, record an immutable reviewed policy. This example uses one policy for the two execution installations. The calendar settings are exact typed bounds used by SQL and the action service. The calendar and policy time zones must equal the workspace IANA time zone. Working-day values are ISO weekdays (1 Monday through 7 Sunday). The operator must replace all sample rules with confirmed operating rules.

```sql
begin;
insert into public.policies(id, workspace_id, version, approved_by, bounds)
values (
 'REPLACE_POLICY_UUID'::uuid, 'REPLACE_WORKSPACE_UUID'::uuid, 1,
 'REPLACE_OWNER_MEMBERSHIP_UUID'::uuid,
 '{"minContactIntervalMinutes":1440,"replyFreshnessSeconds":120,
   "calendarId":"REPLACE_EXACT_OWNED_CALENDAR_ID","timeZone":"America/Denver",
   "meetingMinutes":30,"workingDays":[1,2,3,4,5],
   "workingStartHour":9,"workingEndHour":17,"calendarCapacity":4,
   "bufferMinutes":15,"reservedCostMinor":1}'::jsonb
);
update public.installations
set policy_id='REPLACE_POLICY_UUID'::uuid, daily_capacity=3, status='selected'
where workspace_id='REPLACE_WORKSPACE_UUID'::uuid
  and agent_id in ('deal-follow-up','appointment-coordinator');
-- Daily budgets use workspace-currency minor units. Approve a conservative provider
-- cost reservation per attempted action; 1 is an example, not a measured cost claim.
update public.workspaces set daily_limit=6, daily_budget_minor=10
where id='REPLACE_WORKSPACE_UUID'::uuid;
commit;
```

Inspect current proposal source rows and the optional `gmail_thread_id` mapping. Establish the explicit cohort by stable contact IDs after permissions/identity/overlapping-campaign review. Do not enroll by scanning an entire mailbox. A verified read import deliberately leaves `contacts.enrolled=false`.

```sql
begin;
update public.contacts
set enrolled=true, cohort_id='REPLACE_APPROVED_COHORT_ID'
where workspace_id='REPLACE_WORKSPACE_UUID'::uuid
  and id in ('REPLACE_REVIEWED_CONTACT_UUID'::uuid)
  and not suppressed and not human_takeover;
insert into public.live_activations(
 workspace_id,sender_connection_id,sender,cohort_id,operator_membership_id,
 policy_id,approved_by,expires_at,staffed_hours
) values (
 'REPLACE_WORKSPACE_UUID'::uuid, 'REPLACE_GOOGLE_CONNECTION_UUID'::uuid,
 'REPLACE_EXACT_AUTHORIZED_SENDER_EMAIL', 'REPLACE_APPROVED_COHORT_ID',
 'REPLACE_OPERATOR_MEMBERSHIP_UUID'::uuid, 'REPLACE_POLICY_UUID'::uuid,
 'REPLACE_OWNER_MEMBERSHIP_UUID'::uuid, 'REPLACE_REVIEW_EXPIRATION_UTC'::timestamptz,
 '{"days":[1,2,3,4,5],"startHour":9,"endHour":17}'::jsonb
);
insert into public.audit_events(workspace_id,actor_id,event_type,detail)
values ('REPLACE_WORKSPACE_UUID'::uuid,'REPLACE_REVIEWER_AUTH_USER_UUID'::uuid,
 'live_cohort_and_policy_provisioned',
 '{"review_reference":"REPLACE_APPROVAL_REFERENCE","outbound_enabled":false}'::jsonb);
commit;
```

Only after hosted RLS/Storage, Google test receipts, workflow recovery/version-transition, ownership, suppression, restore and alert-delivery verification may the release owner change the workspace to live mode and enable the environment's independent live flag in the authorized operational deployment. Resume still checks current operator coverage, policy/capacity, sender, selected resources, eligible enrolled source rows and fresh reply access. It does not silently restart prior approvals. Every action then repeats its own stricter checks and exact-content approval.

`read_workspace_readiness` is a database prerequisite summary. The web application combines it with deployment/model availability and display-coverage blockers. Financial measurement readiness stays false until a supported independent payment-plus-fulfillment-cost path is implemented and verified; a manually reported payment alone does not unlock customer profit claims.

Calendar operations check future time, exact duration/calendar/time zone, same local working day, allowed weekdays/hours, per-day capacity and retained appointment/pending reservation buffers. Provider availability is separately read over the buffered window immediately before dispatch. Unknown or missing meeting bounds block the action. Cancellation and rescheduling automation are outside the initial bounded operation: use the assigned operator and retain a reviewed handoff/correction rather than implying those external operations exist.

A standing mandate is optional and starts only after a named workspace owner reviews the exact factual template, scope, recipients, sender, policy, time interval and aggregate limits. Its installation must explicitly allow bounded autonomous execution. There is no browser or worker grant endpoint; an authorized administrator records this reviewed version. Mandate bounds are immutable. Changing scope, cohort, template, cost or dates requires a new record/version. Revocation is one-way.

```sql
begin;
-- Deliberately invalid placeholders: replace only after retaining the owner's approval.
update public.installations set mode='bounded_autonomous_execution'
where workspace_id='REPLACE_WORKSPACE_UUID'::uuid and agent_id='deal-follow-up';
insert into public.mandates(
 id,workspace_id,version,grantor_id,action_type,bounds,starts_at,expires_at
) values (
 'REPLACE_MANDATE_UUID'::uuid,'REPLACE_WORKSPACE_UUID'::uuid,1,
 'REPLACE_OWNER_MEMBERSHIP_UUID'::uuid,'send_follow_up',
 jsonb_build_object(
  'templateVersion','factual-followup.v1',
  'subjectTemplate','Following up on {reference}',
  'bodyTemplate',E'I’m following up on proposal {reference}.\n\n{scopeSummary}\n\nWhat questions can we help answer?',
  'channel','gmail','policyId','REPLACE_POLICY_UUID','policyVersion',1,
  'senderConnectionId','REPLACE_GOOGLE_CONNECTION_UUID',
  'cohortId','REPLACE_APPROVED_COHORT_ID',
  'contactIds',jsonb_build_array('REPLACE_REVIEWED_CONTACT_UUID'),
  'recipientDomains',jsonb_build_array('REPLACE_EXACT_LOWERCASE_DOMAIN'),
  'approvedScope','REPLACE_EXACT_REVIEWED_PROPOSAL_SCOPE',
  'maxActions',2,'maxCostMinor',2
 ),'REPLACE_START_UTC'::timestamptz,'REPLACE_EXPIRATION_UTC'::timestamptz
);
insert into public.audit_events(workspace_id,actor_id,event_type,entity_id,detail)
values('REPLACE_WORKSPACE_UUID'::uuid,'REPLACE_OWNER_AUTH_USER_UUID'::uuid,
 'standing_mandate_granted','REPLACE_MANDATE_UUID'::uuid,
 '{"review_reference":"REPLACE_OWNER_APPROVAL_REFERENCE","version":1}'::jsonb);
commit;
```

Automatic content is limited to the exact template above, with an alphanumeric proposal reference (up to 80 characters; dot, slash, underscore and hyphen allowed) and the exact reviewed scope. Other reference formats require per-action review. Extra payload fields, a new promise, booking, a changed policy/cohort/sender, a removed grantor, or missing bounds do not receive standing authority. Recipient domains are exact lowercase values, without wildcards. The action records the mandate ID and audit version; no model chooses authorization.

Reservations serialize on the workspace before counting all retained mandate attempts and unresolved reservations. Final submission repeats the same authority checks. Expired, revoked or exhausted authority blocks automatic submission; a separately reviewed exact action may still proceed through current per-action approval. Explicit rejection or source invalidation takes precedence over a mandate. Current pauses, suppression, reply stops, Google access, capacity, live activation and the deployment's independent live flag continue to apply.

```sql
-- One-way revocation: the next checked reservation/submission loses this authority.
update public.mandates set revoked_at=now()
where workspace_id='REPLACE_WORKSPACE_UUID'::uuid
  and id='REPLACE_MANDATE_UUID'::uuid and revoked_at is null;
```
