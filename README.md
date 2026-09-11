# DAVID Engine

Vercel + hosted Supabase implementation of the complete v3 build brief. One modular Next.js application, a separate credential-free sales demo, shared domain services, PostgreSQL migrations, Google adapters and versioned Vercel workflows. No Docker or AWS setup is required.

**Current release:** [hosted browser demo](https://revengine-bay.vercel.app) and a local operational fixture demonstrator. Source: [private DAVIDBUILDERS/revengine repository](https://github.com/DAVIDBUILDERS/revengine). The hosted demo uses synthetic browser-session data; live Supabase, Google, model and workflow verification remain outstanding. See [hosted deployment and Git setup](docs/HOSTED_PREVIEW.md) and [release readiness](docs/RELEASE_READINESS.md).

## Repeatable client onboarding

[Open the onboarding preview](https://revengine-bay.vercel.app/?view=activation). Six resumable sections collect company context, team, sources, permissions, people and measurement, followed by evidence-based activation. The operator queue shares the same workspace record. See [implementation and exact remaining hosted setup](docs/ONBOARDING_IMPLEMENTATION.md). The preview remains synthetic; the Supabase-backed version requires the separate operational deployment.

## Start locally

Use Node **24.21.0 LTS** and pnpm **10.33.2**. `.nvmrc` pins Node; run `nvm use` (or select that version with your Node manager) before pnpm. Vercel uses `package.json` engines; `.npmrc` must not contain `use-node-version`.

```sh
pnpm install --frozen-lockfile
pnpm fixture
```

Open [the local engine](http://localhost:3000). No environment file or credentials are needed. Keep real credentials out of fixture mode. The persistent synthetic session uses an opaque browser cookie and local `.fixture/` files. The clock starts at 2026-09-10 16:00 UTC so stale-data cases are repeatable. Reset affects only that browser session/workspace.

In a second terminal:

```sh
pnpm demo
```

Open [the separate sales demo](http://localhost:3001). Its synthetic planning state stays in sessionStorage. It has no operational API, Google, database, model or workflow credentials. Public website analysis is unavailable in this version; the UI offers labeled B2B and home-service presets.

## Walk through the first journey

1. Open **Opportunities → Sales records**, inspect **P-1001 / Maya Chen** and its synthetic source.
2. Prepare a follow-up, inspect the immutable recipient/message/version evidence, approve it and run the fixture send. The receipt means simulated provider acceptance, not delivery.
3. Add the explicitly labeled fixture reply “Let’s schedule a meeting.” Further follow-up stops.
4. Propose a precise time in the configured zone, approve the appointment action and run it. A fixture booking appears in the shared customer journey. Attendance and payment remain unknown unless separately confirmed with evidence.
5. Try an accepted, declined, suppressed or stale proposal to see a real domain blocker. Pause execution or take human ownership; subsequent dispatch is denied. Use the uncertain-timeout control to inspect reconciliation without another send.
6. Explore all 32 specialists, choose up to five, resume activation, save a scenario, approve a work finding, review an initiative, create a weekly brief and record delivery time. The nine preparation capabilities produce saved source-grounded artifacts; the internal evaluation runner tests all nine without granting customers extra slots.

[fixtures/proposals.csv](fixtures/proposals.csv) exercises import preview, identity, status and version validation. CSV bootstrap never grants a live sending mandate.

## Verification commands

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
pnpm run doctor
```

`pnpm run doctor` intentionally exits **2 (BLOCKED)** when required external setup is missing. Use `pnpm run doctor`, because `pnpm doctor` is pnpm's own command. Unit tests run offline. Browser installation needs a download once. The production build compiles all three apps and Workflow entrypoints without a local database.

These commands require an explicitly approved hosted nonproduction project. Put tool-only values in an untracked root `.env.tools.local` or the shell, never in Vercel runtime configuration:

```sh
pnpm db:preview
pnpm db:apply
pnpm db:seed
pnpm db:types
pnpm test:db
pnpm test:db:concurrency
pnpm dispatch:tick
pnpm run doctor --remote
```

See [development without Docker](docs/DEVELOPMENT_WITHOUT_DOCKER.md) for exact variables. Hosted tests do not silently substitute a mock database. Missing access returns BLOCKED, not PASS.

## Project map and continuation

- `apps/web`: customer/operator UI, Supabase SSR Auth, protected API routes, Workflow entrypoints and Cron dispatch.
- `apps/demo`: separate anonymous sales demo, with its own Vercel project configuration.
- `apps/preview`: full customer/operator browser demo, sharing the product UI and pure domain fixtures; static export, sessionStorage, no operational API. See [hosted preview](docs/HOSTED_PREVIEW.md).
- `packages/contracts`, `domain`, `agents`: shared executable schemas, deterministic rules, catalog, preparations, read models and fixture engine.
- `packages/db`, `connectors`, `orchestration`, `ai`, `ui`, `observability`: tenant SQL access, real provider adapters, checked external writes, model boundary, theme and redaction.
- `supabase/migrations`, `supabase/tests`: tenant-aware database definitions, exact checked mutations and hosted tests.
- `docs/IMPLEMENTATION_STATUS.md`: current progress, decisions, verification, blockers and next executable steps.
- `docs/PRODUCT_ALIGNMENT.md`, `docs/TEST_EVIDENCE.md`: requirement and evidence matrices.

The repository began empty on `codex/david-engine-v3`. No v13 source, existing schema, brand assets or remote was available to verify reuse. The supplied DAVIDENGINE house wordmark was integrated on September 11 alongside the [product design revision](docs/DESIGN_REVISION.md). The legacy system has not been replaced. [Legacy migration](docs/LEGACY_MIGRATION.md) defines the handoff and cutover gate.

Verified locally: **173 unit tests, 13 Chromium tests, lint, TypeScript and all three production builds pass**. The [evidence matrix](docs/TEST_EVIDENCE.md) distinguishes these results from blocked hosted checks. [Deployment/setup](docs/DEPLOYMENT_RUNBOOK.md), [reviewed operating records](docs/PROVISIONING_RECORDS.md), [privacy operations](docs/PRIVACY_OPERATIONS.md) and [current implementation status](docs/IMPLEMENTATION_STATUS.md) provide the continuation path.
