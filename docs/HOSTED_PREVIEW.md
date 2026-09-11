# Revengine hosted browser demo

Created September 11, 2026 at the user's request.

- Public application: https://revengine-bay.vercel.app
- Private source repository: https://github.com/DAVIDBUILDERS/revengine
- Production branch: `main`; local working branch: `codex/david-engine-v3`.
- Vercel team: `davidai` / DAVID AI (`team_1gapHJY0I4iOlFGiGKt9mdtz`).
- Vercel project: `revengine` (`prj_V97fBIpAc8J5QeOPbNTqhCj8h0qN`).
- Dashboard: https://vercel.com/davidai/revengine
- Root directory: `apps/preview`; include source files outside the root directory.
- Framework: Next.js; Node 24.x; pnpm 10.33.2; build command `pnpm build`; output directory uses the framework default. Next configuration sets `output: "export"`.

## What is deployed

The full shared customer/operator interface, the supplied DAVID wordmark, six-section resumable onboarding and operator setup queue, agent workspaces, proposals, decisions, journey, scenarios and fixture operator controls. The application loads deterministic synthetic workspaces and runs the existing pure domain fixture engine entirely inside the browser. A validated, bounded command journal in sessionStorage survives refresh, separates workspaces and resets only the selected workspace. Storage failure rejects a change rather than claiming it was saved. Separate browser contexts have independent data. Browser duplication/restoration may copy sessionStorage according to the browser's own behavior.

A persistent **Browser demo** banner says to use sample data only and identifies the simulation. There is no deployed operational API, authentication service, database, OAuth, workflow, model inference, email or calendar write. Real source capture and connection setup remain disabled with their existing fixture explanations. This is a shareable interface demonstration, not a hosted live product release.

Project environment-variable inspection returned an empty list. `.vercelignore` excludes local environment files, fixture persistence and local/generated evidence. The build also rejects operational credentials. The Vercel Content Security Policy sets `connect-src 'none'`; all app data changes are browser-local. The public domain is accessible without login, while preview deployments retain Vercel authentication. Search indexing is disabled. Repository source remains private.

## Verification

- 186 unit tests, module-boundary lint and TypeScript passed.
- All three production apps built locally; the preview also built successfully in Vercel on Node 24.x.
- All 14 Chromium tests passed locally, including the new preview test.
- The same Chromium preview test passed against the public Vercel domain (3.2 seconds), including all nine mobile screens, preparation/pause/reload and independent browser state. It is reusable with `PREVIEW_URL` (command below).
- Public HTTP checks verify application/activation/logo availability, security headers, and 404 responses for operational state and workflow routes.

## Deploy again

From the repository root with the existing authorized Vercel account:

```sh
nvm use
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
vercel link --yes --project revengine --scope davidai
vercel deploy --prod --yes --scope davidai --local-config apps/preview/vercel.json
PREVIEW_URL=https://revengine-bay.vercel.app pnpm exec playwright test tests/e2e/browser-preview.spec.ts
```

The explicit local config matters: the repository-root `vercel.json` is for a different, operational deployment. Do not deploy that root configuration to this browser-demo project. Do not set the Vercel Next output directory to `out`: the framework adapter needs the default `.next` manifests and handles static export itself. Vercel rejects pnpm's `use-node-version` setting in `.npmrc`; Node selection belongs in package engines, Vercel settings and `.nvmrc`.

## Git integration still needs an organization owner

The repository exists and its `main` branch is pushed. Vercel's existing GitHub app installation in DAVIDBUILDERS (`134359119`) only has selected-repository access and cannot see this new repository. GitHub rejected adding it through the signed-in CLI account with HTTP 403: “You do not have permission to modify this app on DAVIDBUILDERS. Please contact an Organization Owner.” No existing repository permissions were changed.

A DAVIDBUILDERS organization owner must open https://github.com/organizations/DAVIDBUILDERS/settings/installations/134359119 and add **revengine** to Vercel's selected repositories. Then connect **DAVIDBUILDERS/revengine** in the existing Vercel project's Settings → Git, production branch **main**, retaining root **apps/preview**. Do not create a second project. Until that is done, deployments are manual; pushing GitHub alone does not update the public application. GitHub Actions validation is independent of that connection.

## Live integration work remains separate

Use [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md) and [RELEASE_READINESS.md](RELEASE_READINESS.md) to provision the separate operational `apps/web` projects, Supabase Auth/database/storage/roles, Google OAuth, model access and workflow evidence. No Docker, AWS dependency, Supabase project, live recipient action or DNS cutover was introduced by this deployment.
