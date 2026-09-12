# Conversational onboarding implementation

Branch: `codex/conversational-onboarding`. Delivery is a draft PR; no production merge or deployment is authorized.

## Plan

1. Add a typed, stable-step briefing model inside the existing workspace onboarding answers. Keep full profile compatibility, revisions, tenant isolation, and history. Add migration 022, never modify applied migrations.
2. Replace the default prepared setup presentation with a dedicated conversational journey. Keep detailed setup as an explicit editing destination. Reuse known company/account facts and deterministic source suggestions.
3. Autosave answers independently of explicit review and execution permission. Serialize saves, retain edits on failure, reject stale revisions, and resume from saved state across authentication and OAuth.
4. Capture websites in the background with request identity checks in the browser and under the database workspace lock. Manual context remains owner-supplied, never invented source evidence.
5. Recommend one implemented internal deliverable, based on the business objective and catalog. Ask only relevant follow-ups. Offer contextual access, spending and review, with truthful blocked/queued/output states and a personalized dashboard handoff.
6. Verify branching, autosave/recovery, role/tenant fences, old profiles, keyboard/mobile, build and SQL. Capture browser evidence and open a draft PR.

## Decisions

- Briefing progress is navigation metadata, not agent readiness. A finished briefing never activates an agent.
- Existing company creation retains the company name once; subsequent briefing reuses it. Business model and time zone remain editable later.
- No new inference service: public facts come from the existing explicit-wording extractor. Research failure has a manual route.
- Initial tasks use implemented website preparations. Proposal outreach remains a separate pilot that requires selected proposal/mail sources and explicit external permissions.
- No default spending authorization. Zero explicitly means no model spending; undecided remains null. Source confirmation, policy review and work requests are separate writes.
- Existing detailed profile remains available, including invitations, administrator queue and advanced operations.

## Operational boundaries

Current hosted production is shadow mode. Google OAuth app credentials, AI Gateway credentials/global model limits, broad signup SMTP, and Vercel GitHub repository installation access remain deployment prerequisites. This branch will not deploy to production. Synthetic previews must stay labeled and never request real accounts.

## Progress / verification

Implementation and local verification complete. Submitted for review on the feature branch; production remains unchanged.

## Implemented journey

Company creation now asks for its name once, then its business model; time zone is detected and editable later. Creation uses an actor-scoped request key so a lost response can be retried without creating another company. Returning login selects an assigned workspace (preferring the last briefing workspace); authentication callbacks return through workspace routing. Existing applied setups retain the detailed profile.

The dedicated briefing starts with welcome → website (or manual description) → missing name → objective → research review → only missing company facts → confirmation → objective-specific follow-up → one recommended task → necessary source permission → model budget only when needed → explicit preparation permission → personalized finish. Steps have stable IDs; URLs and OAuth callbacks no longer assume numeric positions.

Website requests run independently of answering the objective. A saved request UUID and workspace/URL checks fence the background result at the database write. Browser responses also check the current request and component lifetime. Refresh can adopt a capture completed after navigation. Failure and no-website routes retain owner-supplied information without representing it as captured evidence.

The business description and existing sources use deterministic explicit-wording extraction. Missing offer/customer facts are asked individually. A reviewed visitor action reaches landing-page preparation, and the objective/action participate in source signatures and artifact review checks. No new LLM routing dependency was introduced.

The default recommendation considers release status, applicability and model configuration. If model work is unavailable, the existing `technical-seo-monitor` can check captured titles, descriptions and readable text without model spending. Writing preparations can still be selected and saved for later. Proposal outreach is described as a separately gated pilot; the initial company brief never claims to read or send proposals.

## Persistence and authority

- `OnboardingAnswers.briefing` is additive and optional; old documents continue to parse. It stores stable step, known name, objective, branch-specific answers, website input/request identity, reviewed fact signature, selected task and briefing completion.
- Existing `save_onboarding` retains owner/MFA checks, workspace row locks, expected revisions, revision history, source/contact tenant checks and execution invalidation. Navigation metadata is excluded from critical-configuration comparison; business/source changes are not.
- The serialized autosave hook keeps failed edits visible. A newer revision blocks writes and offers a full reload. An unsaved navigation guard and save-before-exit/OAuth behavior prevent silent losses. Autosave never sets policy acknowledgment.
- Source confirmation, explicit preparation permission, applying settings, requesting work and reviewing output remain separate actions. The permission screen discloses the workspace-wide limit and removal of automatic contact authority. No invitations or external sends happen automatically.
- A briefing finish is not operational readiness. The dashboard carries the selected objective, current context, task and next step. Runs display retained server status; source/fact-matching artifacts can be reused and reviewed for the current revision instead of regenerated unnecessarily.
- Detailed settings, invitations, source mapping, operator setup queue and all 32 agent readiness definitions remain available through Complete profile and the existing dashboard.

## Verification evidence

Local checks: **214 unit tests across 24 files**, **22 Chromium journeys**, lint/module boundaries, TypeScript, and production builds of web/demo/preview passed. Browser coverage includes desktop and 390px mobile layouts, keyboard choice shortcuts, Enter, multiline input, autosave/retry, conflicting revision reload, manual/failed research, late responses, branch follow-ups, refresh, known identity reuse, source and spending decisions, output review, workspace separation and existing profile editing.

**13 real hosted PostgreSQL suites passed** against the isolated test project with migration 022 injected inside each suite's original rollback transaction. This includes the existing actual-role/MFA/RLS/secret/budget/privacy suites plus briefing persistence, cross-workspace denials, stale revisions, abandoned request fencing, source/goal confirmation, and retry-safe company creation. The runner preserves pooled-session test transaction boundaries. Neither test nor production retains migration 022 from this verification.

Commands:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
# Explicit nonproduction database environment from DEPLOYMENT_RUNBOOK.md:
pnpm exec tsx scripts/verify-briefing-migration.ts
```

The browser HTTP-failure fixtures are labeled test doubles. They do not prove a Google authorization exchange or live model execution. The opt-in deployed harness (`scripts/verify-hosted-onboarding.ts`) has been updated for the new journey but was **not run against a newly deployed release**, because this task does not deploy the branch. A release engineer should run it against the isolated test app after applying the migration there.

## Release prerequisites and handoff

1. Review this draft PR. Migration `202609110022_conversational_briefing.sql` must precede the new operational code; no applied migration file was modified. Use the existing guarded migration workflow, starting with the isolated test project, then exercise the deployed onboarding harness.
2. The locally recorded test and production configurations still lack `AI_GATEWAY_API_KEY`, `AI_MODEL_ID`, `AI_ALLOWED_PROVIDER`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (presence-only check; no secrets printed). Model work also requires validated `AI_MAX_JOB_COST_MINOR` / output limits and authorized application/workspace budgets. The page-check alternative does not need a model.
3. Google app registration, exact redirect allowlist and account authorization remain required for the existing Google pilot workflows. The first page preparation requests no Google access.
4. General signup still needs configured Auth SMTP beyond the previously verified limited default sender. Keep email confirmation enabled. Vercel's GitHub installation still needs repository access for automatic Git deployments; this PR does not bypass that boundary.
5. Real agent/output availability still depends on the deployment's protected dispatcher/workflow execution and retained results. No deployed provider run, customer outcome, automatic outreach or all-agent activation is claimed by this feature.

No production migration, merge, deployment, account change or external message was performed for this redesign.

## Built preview screenshots

These screenshots show the explicitly synthetic preview, not live integrations. The built preview was exercised at desktop 1440×1000 and mobile 390×844 with no horizontal overflow or page errors.

- [Welcome](evidence/conversational-welcome-desktop.png)
- [Objective, desktop](evidence/conversational-goal-desktop.png) · [mobile](evidence/conversational-goal-mobile.png)
- [Reviewed company summary](evidence/conversational-summary-desktop.png)
- [Recommended first task](evidence/conversational-task-desktop.png)
- [Finish, desktop](evidence/conversational-finish-desktop.png) · [mobile](evidence/conversational-finish-mobile.png)

Run the preview using the repository preview command, or serve `apps/preview/out` after building. The local review session uses `http://localhost:3002/?view=activation`.
