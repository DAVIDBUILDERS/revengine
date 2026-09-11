# Deployment runbook

Status: the private `DAVIDBUILDERS/revengine` GitHub repository and the `davidai/revengine` Vercel project were created for the separate browser demo. See [HOSTED_PREVIEW.md](HOSTED_PREVIEW.md) for deployment and Git integration status. Operational Supabase, provider authorization, migration, seed, restore and DNS cutover remain outstanding. This runbook is the concrete setup and verification path for the completed source tree. Local evidence is in [TEST_EVIDENCE.md](TEST_EVIDENCE.md); release decisions are separate in [RELEASE_READINESS.md](RELEASE_READINESS.md).

## Project and region record

Before deployment, the accountable release owner records:

| Boundary | Required verified value | Current value |
| --- | --- | --- |
| Vercel organization/team | Team ID, approved operators, billing owner and plan | Missing |
| Operational production | Exact project ID, Git repository, production branch and protected environments | Missing |
| Operational test | Different Vercel project ID; production target configured as shadow/test | Missing |
| Public demo | Separate project ID with no operational secrets, Auth/database or staff UI | Missing |
| Supabase production | Organization/project ref, region, database version, plan and backup options | Missing |
| Supabase test/development | Different project ref and credentials; no production data | Missing |
| Application compute | Supported Vercel region and project configuration | Not selected |
| Workflow execution/data | Actual account-supported placement and retention | Not verified; not inferred from application region |
| Database/Storage | Supabase project region; independent object-backup destination and policy | Not selected |
| Model processing | Selected model/provider, processing geography, retention and fallback policy | Not selected; fallback providers disabled in code |
| Email/alerts | Approved Auth SMTP sender and staffed alert destination | Missing |

Do not substitute a guessed IP allowlist or assume private networking between managed services. If egress restrictions are required, verify the account's supported stable-egress option first. Use verified TLS for every database connection; keep a required CA in the server-only `DATABASE_CA_CERT` setting. Runtime expects PEM contents; administrative tools also accept a trusted local CA path.

## Environment review

Use `.env.example` for the operational runtime and `.env.tools.example` only for an administrative shell. Review **each Vercel environment separately**. Never attach administrative credentials to an application project or inherit production credentials into preview/untrusted pull-request builds.

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are the only intended public service configuration.
- `EXPECTED_SUPABASE_PROJECT_ID` binds that URL and every worker/dispatcher/OAuth database URL. Runtime accepts only the matching direct Supabase hostname or known Supabase pooler plus project-qualified username.
- `PRODUCTION_SUPABASE_PROJECT_ID` must be declared for cloud isolation. Production must match it; preview must be test and cannot match it, even with the live flag off.
- `EXPECTED_VERCEL_PROJECT_ID` must equal the actual Vercel system `VERCEL_PROJECT_ID`. Enable the relevant Vercel system environment exposure and verify the actual project through the read-only doctor.
- `DAVID_MODE=shadow`, `DAVID_DEPLOYMENT=test`, `DAVID_LIVE_EXECUTION=false` in the test project's production deployment. `VERCEL_ENV=production` is not a live mandate.
- `APP_ORIGIN` is the exact HTTPS application origin. `GOOGLE_REDIRECT_URI` is its exact `/api/google/callback` and must match both Google and the database allowlist.
- Set a strong random `CRON_SECRET` of at least 32 characters in the named project. Managed Workflow endpoints use Workflow's delivery verification; they do not inherit customer-session authentication.
- OAuth client secret, restricted database passwords, AI key and Cron secret remain server-only. Public demo deployment rejects operational credentials at startup.

For local integrated development put test runtime variables in `apps/web/.env.local`; put tool credentials only in root `.env.tools.local`. Run `pnpm run doctor` and, with supplied read access, `pnpm run doctor --remote`. Configuration is not a successful Google or workflow trace.

## Database bootstrap and migrations

1. Verify distinct project IDs and direct/session administrative database URL. Confirm Auth, pgcrypto, Supabase Vault and private Storage availability in that specific project. Capture the starting schema/backup record.
2. Review `pnpm db:preview` output before `pnpm db:apply`. Migrations are numerically ordered, checksum tracked and protected by an advisory lock. They run through the Node PostgreSQL client without a local database or container.
3. Provision independent LOGIN credentials for `david_worker`, `david_dispatcher` and `david_oauth` using the approved administrator/secret manager. Roles are initially NOLOGIN. Preserve NOSUPERUSER, NOBYPASSRLS, NOINHERIT and the migration's narrow grants; they must not own application tables. Do not grant them `postgres`, service-role or an unrestricted function.
4. Copy the actual role-specific direct/pooler connection details into only the corresponding server settings. Runtime uses small pools and `prepare:false`; migration/restore uses direct or session mode, not transaction port 6543.
5. Add the exact OAuth redirect to `private.allowed_oauth_redirects` under administrator review. Configure Supabase allowed URLs, invited account flow, SMTP delivery and operator TOTP. Assign membership by verified Auth user ID, never an email-domain rule. Do not grant an operator active access until MFA works.
6. Run `pnpm test:db` against the hosted nonproduction project and actual roles. Run `pnpm db:seed` only after two test Auth IDs exist; it creates paused synthetic records. Use `pnpm db:types` to inspect actual schema/type differences.
7. Review and apply real workspace/policy/capacity records following [PROVISIONING_RECORDS.md](PROVISIONING_RECORDS.md). Bootstrap never automatically enrolls imported contacts.

The workflow CI has separate checks and a manual environment-protected migration job. Configure approved reviewers, secrets and Git permissions before enabling production. Never run migrations as an automatic side effect of every Next build. Before the initial hosted application, apply all migrations. After any migration has been applied, freeze its file and add a new additive migration for changes.

## Vercel Git setup

Connect the verified repository/branch to the three approved projects. Set root directory **`apps/web`** for operational test/production and **`apps/demo`** for the public demo; include workspace files outside the root directory. Use pnpm 10.33.2, Node 24.x and the committed lockfile. Each app has its own `vercel.json` and `pnpm build` script. Root `pnpm build` is the local/CI command that builds all three apps. Do not deploy the repository as one shared web/demo project.

Production operational settings remain shadow/outbound-disabled through initial testing. Verify headers, TLS, authentication, redirected OAuth origin, membership revocation, private files and correct database roles. Use deployment protection/firewall controls supported by the actual Vercel plan. Public demo's anonymous access grants no route into operational records.

Cron is one protected dispatcher every five minutes. It claims at most ten entries per request, persists leases/retry/dead-letter state and starts/resumes versioned workflows. Its heartbeat proves a database dispatch tick, not a successful email. A missed tick is recovered from persisted due dates. Authorize a manual test tick with `pnpm dispatch:tick` only after checking `APP_ORIGIN`, project IDs and Cron secret. [Cron behavior](https://vercel.com/docs/cron-jobs), [Cron plan limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

## Hosted verification before live use

Record private evidence IDs, timestamps, project/deployment IDs and the operator for each check. Never place tokens or message bodies in a public test report.

1. Apply all SQL and run actual-role isolation, OAuth replay, action, ingestion, readiness, strategy and privacy tests. Add/run two-session budget/claim races and HTTP/RLS/Storage boundary tests.
2. Start a v1 work request; save approval before and after hook registration, restart the function, miss/repeat a Cron tick and force an uncertain start. Verify one business action and retained decision. Deploy a compatible v2 handler for **new** work; prove the v1 wait still resumes with its original content.
3. Capture an approved website, confirm facts, configure model limits and produce a saved preparation with real evidence and usage. Run again unchanged and confirm no new inference; change a fact, exhaust budget and pause during generation to test recovery.
4. With explicit test-recipient/calendar permission, verify the complete Google trace and adversarial cases in [GOOGLE_ACCESS.md](GOOGLE_ACCESS.md). Real test outbound still requires a reviewed live activation; never weaken preview/test safeguards to send a test email. Use an isolated authorized test cohort in the operational release process.
5. Verify alert delivery and staffed response using the chosen monitoring integration; no alert destination is connected by this build. Trigger stale Cron, expired OAuth, blocked/overdue work and uncertain action conditions and confirm the responsible person receives them.
6. Complete the joint database/object/Auth/Vault restore rehearsal and rollback below. Only then set the production environment live flag and create/enable the approved current cohort record. Each action still repeats its own checks.

## Rollback and restore

Keep v1 handler/input contracts and compatible schema while v1 work exists. Promotion does not rewrite current approvals or start a new conversation. For a bad release, pause dispatch, identify submitting/uncertain actions, reconcile provider IDs, preserve reservations and only then revert to a compatible application. Never reset an uncertain write to not-attempted. A UI rollback alone is insufficient.

Proposed operating objectives for approval: database RPO 24 hours with daily backups, RTO 8 hours during staffed operation; if the pilot needs a smaller RPO, select and verify PITR before live use. These are proposed targets, not achieved recovery measurements. [Supabase backup capabilities](https://supabase.com/docs/guides/platform/backups).

Take database/schema backups and **separate private object backups** with manifests/hash checks. Database backups do not contain the uploaded bytes. Record Auth user/configuration and SMTP restoration, Vault encryption/secret accessibility, custom role credential reset, OAuth redirect/client ownership, job version/outbox/claim state and model/alert configuration. Restore into a distinct authorized nonproduction project, keep outbound off, reconcile object manifests and tenant access, rotate/reconnect credentials as required, then replay read-only recovery tests. Record actual elapsed time/data-loss window and repair the procedure before claiming the objectives are met. Do not restore or clone production into an ordinary preview.

## Cost assumptions (checked 2026-09-10)

No account has been purchased or billed. An illustrative minimum planning base with **one Vercel Pro developer seat** and **two Supabase Micro projects on one Pro organization** is approximately **USD 55/month before metered usage/add-ons/tax**: Vercel Pro starts at $20/month and Supabase Pro at $25 with the first Micro project's compute credit, plus roughly $10 for the second Micro project. Additional developer seats, project sizing and commercial requirements change that base. Verify the actual account quote. [Vercel pricing](https://vercel.com/pricing), [Supabase pricing](https://supabase.com/pricing).

The configured five-minute Cron does not fit Hobby's daily-only limit. Two operational projects produce 17,280 dispatcher invocations in a 30-day month even before workflow steps. Public demo consumes application hosting resources but no operational database or model calls. [Cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Workflow events currently list $0.02/1,000, data written $0.50/GB and retained data $0.50/GB-month, with function compute and underlying managed queue usage billed separately. Treat these as variable components, not a quoted end-to-end bill. Measure events/bytes/compute for the actual journey in the test account. [Workflow pricing](https://vercel.com/docs/workflows/pricing).

Budget separately for model input/output and bounded retries; function compute/requests; managed workflow/queue events; database compute/disk/egress; Storage bytes/egress and backup copies; Auth SMTP/email; Google account licenses or API charges; monitoring/alerts; backup/PITR; and operator labor. Illustrative workload for sizing: one workspace, at most five daily preparations (150/month), up to ten reviewed outbound actions/day (300/month), 500 proposal rows and 500 enrolled conversations per bounded sync. This is a sizing assumption, not granted customer capacity.

Model calls are disabled by default global/workspace limits of zero. Approve `AI_MAX_JOB_COST_MINOR` from the actual selected model's input/output/retry price, and set both global and workspace daily cost/output-token ceilings. Unknown provider cost stays null in delivery economics and retains the conservative reservation; no fabricated measured margin. The action policy's `reservedCostMinor` is a reviewed **budget assumption**, not proof of a provider bill. Workspace daily action/count limits and model budgets are application controls; provider spend alerts are an additional layer.

Do not confuse DAVID's $5,000/month subscription package with infrastructure cost, customer gross profit or measured incremental revenue. Track actual setup, recurring support, provider, infrastructure and research costs separately. Financial claims require their own source evidence.
