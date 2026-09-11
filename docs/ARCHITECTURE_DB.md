# Persistence and connection boundaries

SQL migrations are the schema authority. `202609110001_foundation.sql` creates tenant tables, compound foreign keys, private coordination records, RLS/grants, and a private evidence bucket. `002_operations` implements checked decisions, action reservations, receipts, durable dispatch, inbox deduplication and wait registration. `003_oauth` implements one-time state and Vault credential lifecycle. Subsequent migrations extend the product services.

The TypeScript row companions in `packages/db/src/database.types.ts` were manually derived from those SQL definitions. They are not claimed to be generated Supabase types. Run `pnpm db:types` against the authorized, migrated hosted development project to generate the full compatible schema types; record the project/migration versions and generation evidence.

## Runtime roles and transactions

User reads carry the user's verified Supabase JWT and use `authenticated` RLS. Every tenant read checks current `memberships.actor_id`, `active`, and assigned role. A DAVID operator additionally needs `aal2`; membership cannot be obtained by an email-domain match. Browser credentials have no direct write grants on approvals, receipts, memberships, entitlements, dispatch or audit. Public mutation functions validate the actor and current role; approval and its outbox event commit together.

`david_worker`, `david_dispatcher` and `david_oauth` are restricted roles created as NOLOGIN, NOSUPERUSER, NOINHERIT, NOBYPASSRLS and never own tenant tables. An authorized administrator must provision separate runtime login passwords, copied into environment-specific Vercel secrets. Migrations contain no passwords. The deployment credential is never a runtime fallback.

`createDatabase` keeps a one-connection Postgres.js pool per role. It uses verified TLS (`rejectUnauthorized: true`, with the project's certificate when required), `prepare: false`, an 8-second connection timeout and 15-second statement timeout. Copy the actual transaction-pooler host and custom-role username from the project's connection configuration. Do not derive a pooler hostname from its region. Public trust roots may suffice; configure the actual project root certificate when its certificate requires it. A TLS verification failure is a blocker, not a reason to disable verification. [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).

`withRun(runId, callback)` first obtains an opaque routing token from the dispatcher's narrow `private.route_run` function. A worker transaction calls `private.bind_run(runId, token)`, which validates the persisted routing record and stores context keyed by the current PostgreSQL transaction ID plus backend PID. RLS retrieves only that checked context. A worker cannot select/insert this context table. `SET david.workspace_id = ...` cannot forge scope; a reused pooled connection has a different transaction ID. Do not run network requests inside this transaction. Expired context rows are removed during dispatch sweeps.

The dispatcher can claim bounded routing/outbox rows and update delivery leases. It cannot select contacts, messages, tokens or arbitrary tenant content. The route token and hook token must stay inside server adapters, never client responses or workflow output records. The OAuth broker can finalize a consumed state only; it cannot enumerate Vault or customer records.

## Callable operations

| Entry point | Authority / effect |
| --- | --- |
| `public.decide_action(action_id, decision, payload_hash)` | Current owner or assigned MFA operator; immutable action binding, pending/unexpired decision; decision + audit + outbox in one transaction; repeats preserve one decision |
| `public.set_workspace_pause(workspace_id, true)` | Current owner/operator; immediate pause and pending follow-up cancellation; submitted provider calls may still complete |
| `public.set_contact_takeover(contact_id, enabled)` | Current owner/operator; shared contact ownership fence and takeover persisted |
| `private.create_action(id, contact, proposal, type, payload, hash, policy, cost, expires)` | Bound worker run; retained action and pending approval before UI exposure |
| `private.reserve_action(action)` | Current live eligibility and authority; contact serialization, daily capacity and spending reserved once; returns claim token and fence |
| `private.mark_submitting(action, token, fence)` | Final checked transition before network call; takes workspace lock so pause has a defined ordering; returns false after prior submission |
| `private.record_receipt(...)` | Same action/run/token/fence; settled costs and append-only receipt; uncertainty retains reservation until reconciliation |
| `private.claim_run(workflow_id)` | Stable owner for the domain run; another workflow cannot independently own it |
| `private.register_wait(action, hook, expires)` | Protected registration; a decision saved before registration generates recovery delivery |
| `private.pending_hook` / `private.complete_hook` | Worker-bound pending decision lookup and idempotent completion |
| `private.receive_event(connection, provider_event_id)` | Same run connection; inbox uniqueness determines first receipt |
| `private.checkpoint_source(binding, cursor)` | Same run/source connection; caller persists processed page and cursor in one transaction |
| `private.claim_due(limit)` | Dispatcher; catch-up from stored `next_due_at`, `FOR UPDATE SKIP LOCKED` leases, bounded retries, expired waits and uncertain abandoned submissions |
| `private.finish_dispatch` / `private.retry_dispatch` | Dispatcher; conditional update by outbox ID and lease token |

A workflow start acknowledged by Vercel is not a business action. A crash before saving the workflow ID can produce another workflow, which must fail the existing domain-run ownership claim before any effect. Recovery of an unavailable owning workflow requires explicit reconciliation; another workflow cannot silently steal its identity.

## Live action authority

The database guard requires a live workspace/run, current approved action or a matching active mandate, an unpaused installation/workspace, current proposal version and open status, fresh authoritative proposal data, enrolled unsuppressed contact, no takeover, one conversation owner, available capacity and spending, and a current release record.

`contacts.cohort_id` must match the activation's cohort. Its sender must equal the connected Google identity. The operator membership must remain active. `live_activations.staffed_hours` has the reviewed shape `{ "days": [1,2,3,4,5], "startHour": 9, "endHour": 17 }`, using ISO weekday numbers and `workspaces.time_zone`. An absent staffed-hours definition blocks dispatch. These values are test examples, never live defaults.

The policy bounds include `minContactIntervalMinutes` (conservative fallback 1440) and `replyFreshnessSeconds` (fallback 120). Current reply synchronization and `gmail.read` are required, plus the actual send or Calendar operations. Booking requires `payload.calendarId` to match a verified bound calendar. The action service additionally applies the environment live flag, source refresh, model semantic validation and policy-specific content/meeting rules. SQL does not infer broader permission from a prompt.

Mandates bind allowed contact IDs, exact content payload hashes, expiry and cost. The current SQL path uses `bounds.contact_ids`, `bounds.payload_hashes`, `bounds.max_cost_minor`; it cannot authorize an arbitrary model-generated template variation. Broader mandate semantics require a reviewed migration/service change. Per-action review remains the default.

All money values use minor currency units with bounded safe integers; unknown amount is nullable. Reservations are distinct from settled cost. Outcomes have explicit evidence quality/stages. There is no SQL rule converting accepted Gmail calls into delivery, bookings into attendance, or proposal value into payment.

## Evidence, retention and verification

The `david-evidence` bucket is private. Membership is required for reads in addition to the workspace path. Uploads must use `<workspace_id>/quarantine/...`, allowed MIME types and the 5 MiB bucket limit. Application parsing must validate content before promotion; a supplied MIME type alone is not proof of safe contents. Signed links should be issued only after evidence authorization and expire quickly. No browser policy permits object overwrite/deletion.

Private tables are outside the exposed PostgREST schema. No Realtime subscription is needed for correctness; ordinary authorized refetch remains authoritative. Public policies also apply to customer-visible Realtime tables if explicitly enabled. Do not add private outbox or secret tables to publication.

Hosted suites in `supabase/tests` execute actual `authenticated`, `david_worker`, `david_dispatcher` and `david_oauth` roles using synthetic records and rollback. They cover tenant reads/FKs, direct write denials, operator MFA, nonmember NULL-role denial, forged routing context, pooled context isolation, OAuth identity/state/replay, early approval registration, action fences and budget settlement. These suites have been authored but not run: no authorized hosted project credentials are available. Concurrent separate-connection race/load verification and restore verification remain release gates, even where sequential idempotency cases are covered.

Additional hardening in `010_platform_hardening` adds worker-scoped approval invalidation and a private mailbox history cursor with optimistic checkpoint comparison. The reply step processes all enrolled conversations for that bound connection, deduplicates each event and commits cursor progress in the same transaction; another poll winning the cursor comparison rolls the losing transaction back. Mailbox synchronization does not silently advance past unbound conversation baselines.

The operational metrics RPC `public.read_workspace_metrics(workspace)` and weekly-brief RPC call the same private SQL aggregation. Browser-supplied metrics/evidence/narrative are ignored when freezing a brief. Current stage snapshots are aggregated once per opportunity, unknown/conflicting/mixed-currency financial values remain null, signed contract value kinds cannot be mixed, and manual evidence is labeled. Source-derived totals are not restricted to the UI's row-display cap.

`011_sheet_ingestion` adds the real bounded Sheet ingestion path. The worker-only `private.ingest_sheet_rows(binding, rows)` calls the same `private.import_source_rows` validation/identity/version/provenance core as the authenticated CSV wrapper. Rows are limited to 500 per selected bounded range. Repeat imports preserve stable IDs; omitted rows do not imply deletion or success. Exact-email collisions across different stable contact IDs require identity review. CSV-to-Sheet reassignment of an existing proposal is an explicit source-authority migration, never a silent overwrite.

Optional source `gmail_thread_id` metadata is retained in a private tenant-bound table. Initial action preparation materializes a shared conversation only from that verified proposal-source/connection binding, or explains the missing thread/ownership blocker. It does not enroll the contact. Shadow preparation and draft records do not confer live authority. Actual dispatch still requires live enrollment/cohort, refreshed Gmail evidence and the full action-service gates. Source-check code must invoke ingestion only after the real selected Sheet response, never from a browser-provided provider-verified payload.

## Additional local parser evidence

The build additionally parsed every migration and hosted SQL test as both SQL and PL/pgSQL with `pglast==7.10` in a temporary `/tmp/david-sql-parser` virtual environment. This did not start PostgreSQL and did not validate Supabase catalog objects, function runtime name resolution, grants, extensions or concurrent behavior. The repository's Node-only `tests/sql-syntax.test.ts` provides repeatable CI SQL syntax coverage without adding Python to the required development path. Optional repetition of the deeper static audit:

```sh
python3 -m venv /tmp/david-sql-parser
/tmp/david-sql-parser/bin/pip install 'pglast==7.10' --only-binary=:all:
/tmp/david-sql-parser/bin/python - <<'PY'
from pathlib import Path
from pglast import parser
for path in sorted(Path('supabase').glob('*/*.sql')):
    parser.parse_sql(path.read_text())
    parser.parse_plpgsql_json(path.read_text())
print('Static SQL/PLpgSQL syntax passed; hosted execution remains unverified.')
PY
```

`013_readiness_resume` provides authenticated database readiness and a checked resume path. Shadow mode can resume confirmed internal preparation with provisioned implemented capacity. Live resume requires current release/cohort/sender/operator coverage, fresh source and reply permissions, policy/resources and budgets. Pause invalidates unsubmitted approvals; resume cancels old paused runs. It never turns an old approval into a fresh dispatch. Calendar policy validation additionally checks explicit duration, time zone, working days/hours, per-day capacity and buffers against both retained appointments and pending action reservations. Reviewed provisioning examples are in [PROVISIONING_RECORDS.md](PROVISIONING_RECORDS.md); those examples are not applied defaults.

Migration 017 narrows standing authority to immutable owner-reviewed `factual-followup.v1` mandates. `create_action` retains its pending decision row and attaches a matching current mandate through a checked wrapper. `private.action_authority(action_id)` is visible only to the scoped worker and returns `mandated` or the current decision state; the workflow may skip waiting only for current mandated authority. `action_ready`, reservation and final submission reuse this same authority check. Mandate consumption counts retained attempts plus unresolved reservations under the existing workspace serialization lock, excluding and re-including the candidate exactly once. Rejected/invalidated decisions override mandates. No booking mandate or browser grant capability exists. See `PROVISIONING_RECORDS.md` for exact reviewed fields. Hosted SQL007 covers scope, expiry/revocation, aggregate count/cost, rejection precedence and the fenced gate; it is authored but unexecuted until a disposable bound hosted test project is configured.
