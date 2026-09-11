# Architecture

DAVID is a modular monolith. `apps/web` runs Next.js App Router in the Vercel Node runtime; `apps/demo` is an independently deployed synthetic application. Supabase hosts PostgreSQL, Auth, Vault and private evidence objects. Google Workspace is an external, separately authorized customer system. AI SDK connects through Vercel AI Gateway with an explicit model/provider allowlist. There is no self-hosted queue, container service, AWS account dependency, local Supabase instance or long-running worker.

## Boundaries

Contracts are strict Zod schemas and include unknown/nullable values, UTC timestamps, IANA zones, UUIDs and bounded integer minor currency units. Domain functions accept typed state/ports, not request objects, database clients, credentials or Google responses. Catalog metadata drives specialist names, modes, dependencies and activation requirements. Shared numeric read models distinguish acceptance, replies, booking, attendance, signed value and payments. Production metrics are computed by SQL and reused for the immutable brief; local fixture metrics use equivalent typed domain rules.

Only `packages/orchestration/src/action-service.ts` imports real provider writes. `scripts/check-boundaries.ts` enforces that boundary and prevents operational imports by the public demo. Models select bounded wording/factual IDs or classify source data; they cannot choose recipients, authorize actions, modify numeric metrics or select secrets.

## Local path

The local web UI calls `/api/state` and `/api/command`. Explicit fixture mode selects the real domain services with a deterministic fixture clock/provider. A local per-session file repository serializes mutations through locks and atomically replaces JSON state. Two synthetic workspaces are available via the workspace query parameter. The public demo has its own sessionStorage and does not share this repository. Local file persistence proves neither SQL transaction behavior nor Vercel durability.

## Hosted path

Supabase SSR validates claims and current membership; sensitive operations perform `getUser` and operators require AAL2. User reads carry the user session through RLS. SQL functions handle approved mutations atomically; browser grants cannot directly change receipts, approval state, entitlements or audit records. `apps/web/lib/operational.ts` maps relational data to the shared UI contract without falling back to fixtures.

An authorized work request creates a domain run, versioned input and outbox entry together. Cron claims a bounded batch using leases. It starts the version-one Workflow handler or resumes a stored approval hook. Each workflow step performs bounded I/O. The first step claims a unique domain run; repeated starts exit before effects. Hooks are internal credentials. Decisions committed before registration are re-enqueued and remain authoritative. The workflow reloads the saved decision rather than trusting a hook payload. Approval timeouts become visible blocked runs.

The action service loads a workspace/run-bound action, checks the exact content hash, reserves capacity/contact ownership in SQL, refreshes critical source and reply state, rechecks pause/policy/suppression and commits submitting before the provider call. No database lock spans the network call. A stable Gmail Message-ID or Calendar event ID aids reconciliation. Uncertain acceptance retains ownership/reservation and is never blindly retried. Retained receipts and typed evidence are the business history, regardless of Vercel log retention.

Read the detailed role/RLS model in [ARCHITECTURE_DB.md](ARCHITECTURE_DB.md). The custom worker uses a small transaction-mode pool with verified TLS, no prepared statements and transaction-local checked routing. Admin/migration credentials are excluded from runtime. OAuth completion has a separate narrow broker role.

## Deployment and recovery

Migrations are additive, checksum tracked, advisory-lock serialized and committed atomically with the version ledger before promoting dependent app code. Existing Workflow v1 entrypoints must remain available for in-flight waits. Preview deployments cannot use live execution or production database bindings. Automatic Cron runs on a project's production deployment; verify this in a dedicated test Vercel project.

No actual cloud region, account, platform capability or recovery objective has been verified. [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md) names the checks needed before live use. Runtime health is component-specific and does not equate scheduler uptime with completed business work.
