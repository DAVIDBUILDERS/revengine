# DAVID Engine implementation status

Updated 2026-09-11 after prepared onboarding implementation. Branch: `codex/david-engine-v3`. Full 539-line brief retained in [BUILD_BRIEF_v3.md](BUILD_BRIEF_v3.md). The repository started with only `.git`; no commits, remote, source, migrations, assets, environment files, Sites metadata or applicable AGENTS.md were present. The initial build had no legacy source to reuse; subsequent changes reuse the verified shared domain and UI, and update the existing browser-preview deployment.

See [repeatable onboarding](ONBOARDING_IMPLEMENTATION.md): six saved sections, per-workspace revision history, invitations, source/rule invalidation, operator requests, configurable allowance and evidence-based readiness for all 32 agents. The [prepared setup](ONBOARDING_AUTOFILL.md) now proposes cited company facts from pages/text briefs, objective-based teams, known owner responsibilities and evidence-backed or explicitly unknown baselines. Clients review summaries and correct exceptions. Migrations 018–020 and hosted Auth/provider paths are implemented but not externally verified.

The September 11 interface revision integrates the supplied house wordmark, a decision-first Today, shared inspectable agent workspaces and responsive/keyboard fixes. See [DESIGN_REVISION.md](DESIGN_REVISION.md) for decisions, screenshots and exact verification.

## Hosted browser demo

The private [DAVIDBUILDERS/revengine](https://github.com/DAVIDBUILDERS/revengine) repository and [Vercel browser demo](https://revengine-bay.vercel.app) are created. `apps/preview` shares the full product UI with an injected browser-only domain fixture source. All changes stay in validated sessionStorage journals; no operational API or credentials are deployed. Vercel project/root/commands and the organization-owner GitHub app access requirement are documented in [HOSTED_PREVIEW.md](HOSTED_PREVIEW.md). The live product release gates below remain open.

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

The integrated local suite most recently passed **203 tests across 23 files**, including privacy, mandate/domain authority, workflow routing and concurrency-target guards. Module-boundary lint and TypeScript passed. All three Next production apps built successfully, and all 16 Chromium end-to-end tests passed; the final evidence is retained in [TEST_EVIDENCE.md](TEST_EVIDENCE.md). SQL and PL/pgSQL static parsing is explicitly not database execution.

`pnpm run doctor` passed local fixture environment validation and returned BLOCKED (exit 2) for missing Vercel, Supabase, Google, model, region/email/alert configuration. `pnpm test:db` returned BLOCKED (exit 2) for missing hosted nonproduction project/credentials. No real message, appointment, model inference, operational deployment, migration or DNS change occurred. The separate static browser demo has now been deployed.

## Continuing work

Read [RELEASE_READINESS.md](RELEASE_READINESS.md), [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md), [PROVISIONING_RECORDS.md](PROVISIONING_RECORDS.md) and [TEST_EVIDENCE.md](TEST_EVIDENCE.md). Run the final offline commands first. Then supply the exact separately authorized cloud/Google/model targets and execute hosted verification. Repair any actual SQL/platform mismatch before enabling live work. Do not replace the existing experience until [LEGACY_MIGRATION.md](LEGACY_MIGRATION.md)'s independent replacement gate passes.

External inputs still missing: actual v13 source/ref/schema/data/ownership ledger; any additional official font/token/best-practice assets (the supplied logo is now integrated); intended Vercel team and web/test/demo projects; distinct hosted Supabase projects/regions; Google consent audience/API grants, sender/calendar and actual source owner; operator/staffed coverage and approved cohort; model/provider/pricing/processing region; Auth email and tested alert destination; backup/restore plan; DNS owner and cutover authority. These are named release dependencies, not evidence of a live product.
