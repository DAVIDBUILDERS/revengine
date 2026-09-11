# Release readiness

Current assessed tier: **locally verified internal fixture demonstrator**, with product coverage implemented across the local customer/operator interface and further hosted implementation under integration review. This is not a live pilot, a verified hosted product-coverage release or a legacy replacement. No real customer email/appointment, production deployment, DNS change or legacy scheduler cutover has been performed.

The current evidence includes the deterministic proposal/approval/send/reply/booking journey, meaningful blocked paths, all 32 catalog definitions, five-slot guided teams, nine saved preparations, opportunities/initiatives, timeline, scenarios, cost distinctions and an isolated public demo. See [TEST_EVIDENCE.md](TEST_EVIDENCE.md) for the exact run timestamps and all 40 acceptance cases. New hosted SQL/workflow code is not considered proven merely because TypeScript and fixture tests pass.

## Gates

| Release tier | Assessment | Evidence still required |
| --- | --- | --- |
| Local internal demonstrator | Supported by domain/unit tests and final 12-test Chromium run | 170 unit tests, 12 Chromium tests, lint, TypeScript, both production builds and retained screenshots passed; real deployment remains a separate tier |
| Internal deployed demonstrator | Not deployed/verified | Authorized Vercel test project + hosted Supabase test project, verified Auth/session roles, applied migrations, private files, real deployed workflow/cron trace with nonproduction data |
| Bounded live DAVID AI pilot | **Blocked** | Current authoritative proposals, exact source mapping, Google consent/scopes/sender/reply/calendar coverage, explicitly enrolled cohort, operator/staffed hours, policy/approval record, enforced budgets, monitored exceptions, real receipts, all critical hosted failure tests |
| Hosted product coverage | **Not yet verified** | Nine scheduled source-grounded preparations through persisted budget/cadence, actual configured model, SQL metric parity, guided owner/operator activation, real authenticated product mutation coverage, operational readiness/health evidence |
| Replacement of v13/Sites/Netlify | **Blocked** | Actual source/export/identities/consents/ownership/jobs/evidence mapping, shadow comparison, single scheduler transfer, credential transition, rollback and restore rehearsal, explicit DNS/cutover authority |
| Commercial ROI / repeatability | **Unproven** | Observed external-customer outcomes, comparable baseline, cost/fulfillment evidence, staff intervention/time, explicit counterfactual where incremental claims are made |

## External setup blockers

| Required input | Accountable owner | Exact next step |
| --- | --- | --- |
| v13 source/ref/schema/data/source status | Legacy technical owner | Supply the repository/ref and scoped data/schema export, stable ID/consent/ownership/job mapping, active scheduler and deployment access. No source reuse or equivalence is verified yet. |
| Vercel projects/team/regions/plan/budget | Deployment owner | Name and authorize separate operational, nonproduction-test and public-demo projects, regions and commercial plan. Verify Workflow SDK availability and Cron frequency on that account. |
| Managed Supabase projects/region/roles | Database/deployment owner | Provide distinct nonproduction/production project IDs and approved direct/session migration + transaction runtime connection details. Apply migrations before promotion and execute tests using actual restricted roles. |
| Google Workspace OAuth/resource grants | Workspace admin + source owner | Confirm app ownership/audience/consent/restricted scopes; bind the exact Sheet/range/mapping, approved Gmail sender/enrolled threads and Calendar; verify read/send/reply/free-busy/event operations with authorized test targets. |
| Live cohort and business boundaries | DAVID source/operating owner | Confirm fresh open proposals, contact permissions, authoritative owner, overlapping contact systems, sender, working hours, cadence, capacity, approvals, operator and expiry/review date. Create the explicit live activation only after verification. |
| AI Gateway/model/provider + cost basis | Model/deployment owner | Supply selected allowed model/provider, region/retention requirements, gateway access, reviewed maximum per-job cost and global/workspace/day ceilings. Eight model preparations remain blocked without these; deterministic technical checks do not require inference. |
| Auth delivery/invitations/MFA | Identity owner | Configure supported commercial auth-email delivery, invited memberships and assigned operator MFA; verify browser refresh/logout/revocation and redirect restrictions. |
| Outcome/payment/fulfillment evidence | Source/finance owner | Retain separate attendance/signed/completed/invoiced/paid evidence. Manual confirmations remain labeled; payment integration is optional while financial claims stay unavailable. |
| Alert destination and coverage | Operations owner | Configure and prove alert delivery, staffed exception handling and escalation expectations before unattended operation. |
| Backups/restore/DNS/cutover | Deployment + legacy owners | Confirm plan-level database/PITR/object/Auth/Vault recovery, rehearse nonproduction restore/rollback, then review specific DNS/ownership transfer. |

## Remaining engineering and verification work

These are not merely “missing keys.” They require implementation completion, actual execution or a concrete operating decision:

1. Run and repair the hosted SQL suites against the real roles. Run the authored independent-session approval/reservation/fence harness; add controlled global dispatcher/model budget races. Validate that migrations execute in order, including the model/preparation dispatcher wrapper and later Gmail hardening.
2. Exercise Vercel durable approval waits, decision-before-registration, missed/overlapping Cron ticks, uncertain workflow start, function restart, pause while in flight, and a version-one→version-two deployment transition. Keep v1 compatible handlers available until all v1 runs finish or are reconciled.
3. Execute a full authorized Google Sheet→draft→approval→send→reply→handoff→booking trace. Verify same-version source edits block, old unprocessed replies stop follow-up, pagination checkpoints commit atomically, and timeout reconciliation does not duplicate a write.
4. Verify production preparation jobs end to end: confirmed captured source, per-installation capacity, model budget reservation, actual restricted model call, semantic validation, saved artifact/evidence, unknown cost retention, next due state and unchanged-source reuse. No green schedule may imply a new artifact or business outcome.
5. Test HTTP tenant denial for every operational mutation/download/callback, browser/PostgREST direct-write denial, private Storage, Realtime where enabled, CSRF/origin and real Auth session/MFA refresh. SQL policy declarations alone do not finish this gate.
6. Execute/test the implemented admin-only privacy export/erasure path through actual database + Storage permissions and retention decisions. `scripts/privacy.ts`, SQL014 and 12 offline tests exist; [PRIVACY_OPERATIONS.md](PRIVACY_OPERATIONS.md) documents complete pagination, secret exclusion, preview, request binding, quarantine/retry, credential revocation and limits. Hosted erasure, provider-side revocation and database/object/Auth/Vault restore have not been executed.
7. Verify SQL metric/brief parity with domain examples, including latest corrected snapshots, unknown values, mixed currencies/value kinds, manual quality and synthetic exclusion. Real payment/refund adapters must produce cumulative reconciled snapshots, not unlinked additive rows.
8. Validate deployed component probes, exception queues, alert delivery and support ownership. Hosted state intentionally shows unverified components until retained evidence exists.
9. Rehearse legacy mapping, shadow comparison and scheduler transfer only after source access. Preserve approvals only where recipient/content/version/meaning remain valid; reconcile in-flight writes before rollback or old-runtime resumption.

The public demo deliberately has no URL-retrieval endpoint; its preset fallback is explicit. Enabling public profiling later requires session/global quotas, short retention, bounded approved tools and a separately verified SSRF/resource-budget path. Planned external integrations in the catalog remain unavailable even when selected.

## Model spending and preparation operations

The new model budget path uses `AI_GATEWAY_API_KEY`, `AI_MODEL_ID`, `AI_ALLOWED_PROVIDER`, required explicit `AI_MAX_JOB_COST_MINOR` (1–100000 minor units), and optional `AI_MAX_OUTPUT_TOKENS` (100–1500, default 600). The maximum job-cost assumption must cover the configured input cap, output cap and bounded model retry policy under the reviewed provider prices. A provider spend alert is not this application limit.

SQL defaults both global and workspace cost/output-token ceilings to zero. A deployment administrator configures the global limit in the verified project under an approved budget; an authenticated owner/assigned operator calls `public.set_workspace_model_limits` for their workspace and records the pricing basis. The global currency must match the workspace currency; no implicit conversion is permitted. These configuration acts require the actual approved account/budget, and have not been executed by the build.

Model reservations are unique per run. Unknown actual cost retains the conservative reserved amount as `awaiting_cost`; a failed attempt retains it as `failed_review`. Usage cost stays null, and internal margin remains unavailable where costs are incomplete. A worker must reconcile provider billing evidence before releasing uncertain cost; it cannot blindly replay the same inference to make a dashboard look busy. A completed preparation sets a daily cadence; a subsequent unchanged source signature returns the existing artifact without another model call. Pause prevents due execution and saving newly generated work after pause.

## Live activation decision

Approve a live pilot only when an accountable operator can trace one real eligible proposal through the full chain with retained evidence and can explain why each blocked case stops. Missing financial evidence may remain explicitly unavailable. Missing current status, cohort permission, sender/reply coverage, conversation ownership, capacity, exception coverage or safe uncertainty handling may not be waived to meet a date.

Keep the existing deployment active until the independent replacement gate passes. The conditional ten-working-day target is a planning target for demonstration/bounded pilot, not evidence of full migration or 32 autonomous integrations.
