# DAVID Engine implementation status

Updated 2026-09-10 during final integration. Branch: `codex/david-engine-v3`. Full 539-line brief retained in [BUILD_BRIEF_v3.md](BUILD_BRIEF_v3.md). The repository started with only `.git`; no commits, remote, source, migrations, assets, environment files, Sites metadata or applicable AGENTS.md were present. No legacy source reuse is claimed and no existing deployment was modified.

## Plan and checkpoints

| Milestone | Implementation now present | Verification boundary |
| --- | --- | --- |
| 1 — Foundation | Pinned Node/pnpm/Next/React/Workflow/Supabase/AI stack; workspace packages; strict shared schemas/examples; two fixtures; tenant SQL and actual-role suites | Local installation/type/build evidence; hosted migrations/RLS not run |
| 2 — First journey | Proposal source validation, factual draft, exact approval, checked send/receipt, human reply stop, owned appointment handoff, booking and separate outcomes | Complete Chromium/domain fixture journey passes; actual Google trace blocked by access |
| 3 — Durable coordination | Persisted run/input/outbox, leases, internal approval hooks, decision-before-registration, missed-tick recovery, fencing, budgets, ownership, pause/takeover, uncertainty reconciliation | Build and mocked/domain checks; hosted restart/concurrency/version-transition gates remain |
| 4 — Real boundaries | One-time OAuth/PKCE/Vault broker; bounded Sheet/Gmail/Calendar adapters; shared Sheet/CSV ingestion and thread baseline; SSRF-safe website capture; actual AI Gateway adapter | Synthetic HTTP/error tests pass; real account/permission/receipt tests not performed |
| 5 — Product coverage | Nine executive surfaces, all 32 honest catalog entries/five slots, goal recommendation/activation, nine saved preparations, findings/initiatives, evidence journeys, saved scenarios, delivery economics, brief and isolated demo | Local UI/domain checks pass; hosted source-grounded model preparation and read-model parity need actual project |
| 6 — Operations and handoff | Guarded remote migration/seed/type/doctor tools, region/environment review, readiness/resume, component health, privacy path, strategy persistence, documented rollout/restore/legacy transfer | Source complete under final checks; account configuration, real alerts/restore and legacy rehearsal remain unverified |

## Decisions made

- Vercel plus hosted Supabase only. No local database service, Docker, AWS account, self-hosted worker or extra queue vendor.
- Modular monolith; domain depends on typed ports. One action service owns provider writes; dependency boundary checks enforce it.
- Local fixture mode is explicit, per-browser/per-workspace and rejects real credentials. The public demo is a separate app/session store and cannot import operational services.
- Source systems own status/identity/version. Manual outcome references are immutable and labeled. Stage snapshots and current proposal versions prevent double-counted revenue.
- Google uses polling rather than Pub/Sub. Gmail readonly remains disclosed as a restricted mailbox-wide grant despite enrolled-thread processing. The first live action needs a verified original thread.
- Models choose reviewed facts/framing, not authority or financial numbers. Per-run/global/workspace limits default to zero; unknown actual cost remains unknown and reserved.
- Paused source verification is permitted because it is read-only. Checked resume cancels obsolete paused work and never revives an old approval.
- Health is component-specific: dispatcher heartbeat, source sync, saved preparation, model usage and accepted business action are distinct. Unverified legacy runtime timestamps stay null.
- Migration files in this initial branch are unapplied. Freeze their checksums once applied; subsequent changes must be additive new migrations.

## Verification record

The integrated local suite most recently passed **170 tests across 19 files**, including privacy, mandate/domain authority, workflow routing and concurrency-target guards. Module-boundary lint and TypeScript passed. Both Next production apps built successfully, and all nine Chromium end-to-end tests passed; the final evidence is retained in [TEST_EVIDENCE.md](TEST_EVIDENCE.md). SQL and PL/pgSQL static parsing is explicitly not database execution.

`pnpm run doctor` passed local fixture environment validation and returned BLOCKED (exit 2) for missing Vercel, Supabase, Google, model, region/email/alert configuration. `pnpm test:db` returned BLOCKED (exit 2) for missing hosted nonproduction project/credentials. No real message, appointment, model inference, deployment, migration or DNS change occurred.

## Continuing work

Read [RELEASE_READINESS.md](RELEASE_READINESS.md), [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md), [PROVISIONING_RECORDS.md](PROVISIONING_RECORDS.md) and [TEST_EVIDENCE.md](TEST_EVIDENCE.md). Run the final offline commands first. Then supply the exact separately authorized cloud/Google/model targets and execute hosted verification. Repair any actual SQL/platform mismatch before enabling live work. Do not replace the existing experience until [LEGACY_MIGRATION.md](LEGACY_MIGRATION.md)'s independent replacement gate passes.

External inputs still missing: actual v13 source/ref/schema/data/ownership ledger; referenced brand/best-practice assets; intended Vercel team and web/test/demo projects; distinct hosted Supabase projects/regions; Google consent audience/API grants, sender/calendar and actual source owner; operator/staffed coverage and approved cohort; model/provider/pricing/processing region; Auth email and tested alert destination; backup/restore plan; DNS owner and cutover authority. These are named release dependencies, not evidence of a live product.
