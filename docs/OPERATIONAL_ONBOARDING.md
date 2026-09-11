# Operational onboarding deployment — September 11, 2026

Real company onboarding is now deployed at https://revengine-production.vercel.app/login. Create an account, confirm the email in the same browser, sign in and create a company workspace. Company website capture, selected text/Markdown briefs, prepared setup, explicit policy review and saved answers use real Supabase records. The original https://revengine-bay.vercel.app remains a separate synthetic preview.

This is an onboarding release with agent execution disabled, not a verified agent pilot. No production company or user was created on the client's behalf. The client enters their own details through the application.

## Provisioned targets

The user explicitly authorized two additional database projects after being told they may incur charges. Existing projects were checked before creation. Organization: **DAVID AI**, `qdxulrenxxdffyswjypb`. Both projects use Micro compute in `us-east-1`; no Docker or separately managed AWS service was introduced.

| Purpose | Supabase project | Vercel project | URL |
| --- | --- | --- | --- |
| Production onboarding | `zjdhsbzngfvoeqzhkssi` (`revengine-production`) | `prj_8M62jHiM3TiL1uqrAmxAddA1iVLB` | https://revengine-production.vercel.app |
| Isolated hosted testing | `wnuajhvzklxgdorlpkrt` (`revengine-test`) | `prj_8YVohVmQUfrvhAYff9qIsF8YTc5d` | https://revengine-test.vercel.app |
| Synthetic preview | None | `prj_V97fBIpAc8J5QeOPbNTqhCj8h0qN` (`revengine`) | https://revengine-bay.vercel.app |

Operational projects belong to Vercel team `davidai` / `team_1gapHJY0I4iOlFGiGKt9mdtz`, root `apps/web`, Node 24, application region `iad1`. The test project retains Vercel authentication, with a dedicated automation bypass for verification. Production login is publicly accessible; every workspace API requires Supabase authentication and membership. Only production-environment variables are populated; no production credentials are attached to preview environments.

Both runtimes have `DAVID_MODE=shadow` and `DAVID_LIVE_EXECUTION=false`. Their deployment classifications and Supabase/project bindings differ. Worker, dispatcher and OAuth use independent restricted LOGIN roles; actual TLS logins verified the expected role and absence of superuser, bypass-RLS, create-role, create-database and inherit attributes. Administrative/service-role credentials were not uploaded to Vercel. PostgreSQL SSL enforcement is enabled on both projects; clients verify Supabase's published CA.

Initial deployments: test `EjKKfVD4kYfzE1cVvX9vp9vBxCJo` (`revengine-test-li4rv2pfk-davidai.vercel.app`); production `EZMRsY7jahxBLZEKRrjASuaH1i66` (`revengine-production-e62rr28fh-davidai.vercel.app`). Both builds passed and their project aliases were assigned.

## Verified and unverified behavior

- All **12 hosted SQL suites** pass on the test project, including both workspaces, roles/RLS, OAuth state, actions, ingestion, model-budget SQL, readiness, mandates, privacy, onboarding, source discovery and prepared setup. These are database tests; they do not prove actual Google/model behavior.
- The independent-session concurrency harness passed duplicate-approval/outbox and worker budget/submission-fence races. Its own isolated fixtures were removed. No provider submission occurred.
- Deployed browser verification uses two administratively confirmed synthetic test Auth users, ordinary password login, company creation, actual HTTPS capture of `example.com`, selected brief upload, cited setup, saving/reloading answers, explicit approval and paused settings application. Cross-workspace reads/writes, cross-origin writes and signed-out access are denied. No customer data is used.
- Production `/login` and `/start` return 200; unauthenticated `/api/workspaces` and `/api/cron` return 401. The production database was checked for matching migrations and empty initial company/action records.
- Synthetic browser verification records remain in the isolated test project, clearly named `Hosted onboarding <test UUID>`. They are not business outcomes. No test records were seeded into production.

**Email is the immediate onboarding limitation.** No custom SMTP sender is configured. Supabase's default service only sends confirmation/recovery email to members of the Supabase organization, with restrictive rate limits. A DAVID AI organization member can try signup using that exact email. Delivery and the received confirmation link have not been tested by this session; no emails were sent by the agent. External clients require approved custom SMTP configuration and delivery verification. Email confirmation remains required; it was not disabled to make signup appear operational. See [Supabase SMTP requirements](https://supabase.com/docs/guides/auth/auth-smtp).

Google application credentials, model gateway access and approved global model budgets are still absent. No account connection, generated model output, sending or booking is claimed. OAuth buttons surface configuration blockers. Staff operator assignment/MFA, DAVID's expanded allowance, alerts, backups/restore, and the broader release checks remain separate setup work. Do not promote this onboarding release as all 32 agents operating.

## Hosted compatibility fixes

The first attempted foundation transaction failed and rolled back because managed Supabase's `postgres` role cannot issue `ALTER ROLE ... NOSUPERUSER`. Migrations 001 and 003 were corrected **before either had been successfully applied anywhere**: new roles default to nonsuperuser, ordinary role restrictions are applied, and an explicit catalog assertion fails on privileged roles. Those successful checksums are now immutable.

Additive migration **021** fixes two failures found by actual SQL execution: the erasure function's `secrets` variable conflicted with Vault's table identifier, and JSONB company-field subtraction required parentheses around the extracted object. Original applied migrations 014 and 019 remain unchanged. All **21 migrations** are applied to both projects.

On PostgreSQL 17, role creation did not automatically give the test administrator SET permission. For the test harness only, the authorized administrator granted `david_worker`, `david_dispatcher` and `david_oauth` to `postgres WITH SET TRUE`. This does not grant privileges to application roles. Production did not receive this test-harness grant.

## Repeat the verification

Administrative credentials stay in a protected shell, never application configuration. Use `.env.tools.example` to set the test/prod refs, verified-CA session database URLs, restricted test role URLs, `TEST_APP_ORIGIN=https://revengine-test.vercel.app` and `TEST_VERCEL_BYPASS_SECRET`. Supabase CLI must be authenticated to the authorized organization. The browser harness retrieves the **test-only** service-role key internally to create labeled, confirmed test users; it never sends confirmation email or prints that key.

```sh
pnpm test:db
pnpm test:db:concurrency
pnpm test:hosted-onboarding
```

The hosted browser harness refuses the production origin/ref. It writes a redacted result to `artifacts/hosted-onboarding-evidence.json`, a screenshot to `artifacts/hosted-onboarding.png`, and the current synthetic test credentials to ignored, mode-0600 `.env.hosted-test-actors.local`. The fixture accounts/workspaces remain in the test database for inspection; use the workspace privacy/erasure process when no longer needed.

Local provisioning records are mode-0600 and Git/deployment-ignored: `.env.provisioning.local` (new project metadata/admin passwords), `.env.revengine-test.local` and `.env.revengine-production.local` (runtime JSON), `.env.vercel-operational.local` (target IDs), `.env.vercel-bypass.local` (test automation secret). They are not ordinary dotenv files. Local helper scripts and certificate are in ignored `artifacts/`; copy required individual settings into the approved secret manager/admin environment for future operators. Vercel has only the scoped runtime values. Do not print or commit these files.

## Deploy the operational app again

The repository's default `.vercel/project.json` intentionally still targets the synthetic preview. Always supply the operational project explicitly:

```sh
VERCEL_PROJECT_ID=prj_8YVohVmQUfrvhAYff9qIsF8YTc5d VERCEL_ORG_ID=team_1gapHJY0I4iOlFGiGKt9mdtz vercel deploy --prod --yes --scope davidai --local-config apps/web/vercel.json
VERCEL_PROJECT_ID=prj_8M62jHiM3TiL1uqrAmxAddA1iVLB VERCEL_ORG_ID=team_1gapHJY0I4iOlFGiGKt9mdtz vercel deploy --prod --yes --scope davidai --local-config apps/web/vercel.json
```

Apply/check migrations through the checksum-ledger tool before code that requires them; never rerun test suites against production. Do not deploy operational configuration to `revengine-bay`.

Vercel Git links remain null. Repo push and CLI deployment are independent. The pre-existing Vercel GitHub installation still needs an organization owner to grant `DAVIDBUILDERS/revengine`; see [HOSTED_PREVIEW.md](HOSTED_PREVIEW.md). No alternate identity was used to bypass the earlier GitHub permission denial.
