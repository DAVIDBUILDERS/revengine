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

The full shared customer/operator interface, the supplied DAVID wordmark, prepared four-stage onboarding, the complete six-section profile and operator setup queue, agent workspaces, proposals, decisions, journey, scenarios and fixture operator controls. The application loads deterministic synthetic workspaces and runs the existing pure domain fixture engine entirely inside the browser. A validated, bounded command journal in sessionStorage survives refresh, separates workspaces and resets only the selected workspace. Storage failure rejects a change rather than claiming it was saved. Separate browser contexts have independent data. Browser duplication/restoration may copy sessionStorage according to the browser's own behavior.

A persistent **Browser demo** banner says to use sample data only and identifies the simulation. There is no deployed operational API, authentication service, database, OAuth, workflow, model inference, email or calendar write. Real source capture and connection setup remain disabled with their existing fixture explanations. This is a shareable interface demonstration, not a hosted live product release.

Project environment-variable inspection returned an empty list. `.vercelignore` excludes local environment files, fixture persistence and local/generated evidence. The build also rejects operational credentials. The Vercel Content Security Policy sets `connect-src 'none'`; all app data changes are browser-local. The public domain is accessible without login, while preview deployments retain Vercel authentication. Search indexing is disabled. Repository source remains private.

## Verification

- 203 unit tests, module-boundary lint and TypeScript passed.
- All three production apps built locally; the preview also built successfully in Vercel on Node 24.x.
- All 16 Chromium tests passed locally, including the new preview test.
- The same Chromium preview test passed against the public Vercel domain (3.2 seconds), including all nine mobile screens, preparation/pause/reload and independent browser state. It is reusable with `PREVIEW_URL` (command below).
- Public HTTP checks verify application/activation/logo availability, security headers, and 404 responses for operational state and workflow routes.

## Onboarding deployment verification

Implementation commit `7ae989853ca501ac197c550a7d79f5a597ecb168` deployed successfully to the existing project, deployment `A26sSn35VTGUtpAtdVHRA3WuH1Cu` / `revengine-iia9h2hxe-davidai.vercel.app`, aliased to the public domain. Both `browser-preview.spec.ts` and `onboarding.spec.ts` passed against `https://revengine-bay.vercel.app` (2 tests, 10.6 seconds). Activation returns HTTP 200; `/api/state`, `/api/onboarding/access` and the workflow route return 404. CSP still includes `connect-src 'none'`.

The public onboarding flow stores synthetic setup in browser sessionStorage. Migrations 018–019, real invitations, authentication and Supabase persistence are implemented in the separate operational app and remain externally unverified. See [remaining platform setup](ONBOARDING_IMPLEMENTATION.md).

## Guided onboarding deployment verification

Implementation commit `508b234193d6dda603b6d81711998f33d9327476` is pushed to GitHub `main` and deployed to this same Vercel project. Deployment `HY3HiAiVMf2g3Fty6V3etE8rHnHW` / `revengine-4nzizs6v8-davidai.vercel.app` is aliased to `https://revengine-bay.vercel.app`. The guided journey, full-profile onboarding and browser isolation tests all passed against that public URL: **3 Chromium tests, 10.4 seconds**. Activation returns HTTP 200; `/api/state`, `/api/google/discover`, `/api/onboarding/access` and the workflow route return 404. CSP retains `connect-src 'none'`.

The default activation screen now suggests cited sample facts, recommends a team, previews column mapping and requires explicit policy/budget review before first useful work. The operational implementation and exact missing configuration are documented in [GUIDED_ONBOARDING.md](GUIDED_ONBOARDING.md). This was a manual CLI deployment. GitHub-to-Vercel automatic deployment remains blocked by the installation access described below; a public deployment and successful repository push do not prove that integration.

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

## Git integration still needs GitHub installation access

The repository exists and its `main` branch is pushed. Vercel's existing GitHub app installation in DAVIDBUILDERS (`134359119`) only has selected-repository access and cannot see this new repository. GitHub rejected adding it through the signed-in CLI account with HTTP 403: “You do not have permission to modify this app on DAVIDBUILDERS. Please contact an Organization Owner.” No existing repository permissions were changed. On September 11, the guided-onboarding retry of `vercel git connect` again failed because Vercel could not access the private repository. Read-only Vercel inspection still returned `link: null`, with root `apps/preview`. The current CLI reports repository/org administration but lacks the token access needed to manage the installation; a GitHub installation API read returned HTTP 403. The owner was asked to grant this exact repository in GitHub, and no alternate identity was used to bypass that denial.

A DAVIDBUILDERS organization owner must open https://github.com/organizations/DAVIDBUILDERS/settings/installations/134359119 and add **revengine** to Vercel's selected repositories. Then connect **DAVIDBUILDERS/revengine** in the existing Vercel project's Settings → Git, production branch **main**, retaining root **apps/preview**. Do not create a second project. Until that is done, deployments are manual; pushing GitHub alone does not update the public application. GitHub Actions validation is independent of that connection.

## Live integration work remains separate

Use [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md) and [RELEASE_READINESS.md](RELEASE_READINESS.md) to provision the separate operational `apps/web` projects, Supabase Auth/database/storage/roles, Google OAuth, model access and workflow evidence. No Docker, AWS dependency, Supabase project, live recipient action or DNS cutover was introduced by this deployment.

GitHub Actions independently passed the implementation commit `508b234193d6dda603b6d81711998f33d9327476`: [Application checks 34647667962](https://github.com/DAVIDBUILDERS/revengine/actions/runs/34647667962), including install, lint, TypeScript, unit tests, all three builds and the complete browser suite (job duration 3m44s). This CI success does not establish a Vercel Git connection.

## Prepared setup deployment verification

Commit `f76f4ef8b06f24a05b25e62dc15cbb05379e14a1` is pushed to GitHub `main` and deployed to the existing `revengine` project. Deployment `7ea9TPSBZdNTb7xAN9vHY9QYs26A` / `revengine-qpc27ta51-davidai.vercel.app` is aliased to `https://revengine-bay.vercel.app`. The published browser-isolation test, two prepared-setup journeys and complete-profile test all passed: **4 Chromium tests, 11.5 seconds**. Activation returns 200; operational `/api/state`, `/api/google/discover`, `/api/command` and workflow endpoints return 404. CSP retains `connect-src 'none'`.

The public sample journey requires one typed field (the spending limit), plus the user's objective, review and start/accept choices. Actual clients may need to correct missing facts, choose resources or name a responsible person when identity data is unavailable. This is not a universal one-field claim. Real Supabase storage, selected document processing, website/account discovery and provider output need the separately configured operational deployment and migration 020.

This deployment used the authorized CLI. Read-only Vercel inspection still reports Git `link: null`, root `apps/preview`; the existing GitHub installation access requirement remains unresolved.
