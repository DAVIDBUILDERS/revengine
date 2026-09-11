# Guided onboarding

September 11, 2026. Requested follow-up to repeatable onboarding: use the information already available, propose a profile and ask the client to review decisions. The complete onboarding document remains the source of truth.

## Implementation plan and decisions

1. Reuse the protected public website capture and saved company context. Extract bounded, cited candidates without model spending or external write authority.
2. Make a five-stage guided experience the default. Preserve the complete six-section profile for advanced configuration and exceptions.
3. Recommend responsibilities from the chosen objective, business model and configured allowance. Keep unsupported capabilities visibly blocked.
4. Add authorized Google spreadsheet discovery, tab/header inspection and conservative mapping suggestions. Preserve server-only tokens and explicit resource selection.
5. Ask for approver, escalation owner, budgets and measurement sources; require explicit policy review. Never infer contact consent or spending limits from a website.
6. Reuse checked settings application, source validation, runtime resume and output/action evidence. Verify local behavior, publish the synthetic preview and verify the GitHub/Vercel link separately.

Steps 1–5 and the application portion of step 6 are implemented. Hosted provider/database evidence requires the configuration listed below. Git integration status is tracked in HOSTED_PREVIEW.md; a pushed repository alone does not establish a Vercel connection.

## User experience

`/?view=activation` opens guided setup. Five stages cover website, objectives, systems, permissions and first useful work. `?view=activation&mode=profile` opens the complete existing workspace profile. Both edit the same revision-controlled Supabase document. Guided location is retained with `guide=0..4`; visiting stages never completes requirements.

Website capture retains source pages server-side. `suggestCompany` extracts explicit offer/audience phrases and a title-based name candidate. These are conservative rule-based suggestions, not a claimed LLM integration. Every candidate retains its source URL, wording and basis. Missing facts stay blank; owner answers are preserved when refilling unanswered fields. Suggestions do not confirm themselves. Confirmation saves reviewed answers and calls the existing source-confirmation path. On reload, the latest saved capture is available for review. Unsaved edits are labeled and can be saved with Save progress.

Objective selection previews the recommended agents and their actual release status. Accepting writes the goal/team and unknown baseline to the shared record and selects applicable implemented installations while paused. Optional details remain editable in the complete profile.

Source selection offers existing authorized Sheets, tab selection and a row-one header read. The matching routine accepts unique exact/known header aliases. Ambiguous identities and unconverted monetary amounts remain unresolved. A client can review every mapping with ordinary dropdowns. Source descriptions are saved before binding/queuing verification, so the check runs after the reviewed intent. The existing ingest path still validates up to 500 rows, stable identities, source timestamps and amount semantics; a suggested mapping does not waive validation.

Mailbox and primary calendar identifiers are suggested from the connected identity and labeled as unverified candidates. Calendar-list discovery is not implemented and is not advertised. Real mailbox reads remain restricted to enrolled conversations in processing; a Google grant itself may be broader. Administrator assistance records a workspace source blocker and a task in the same setup queue; no email is automatically sent.

Permission review asks only for needed account identifiers for the chosen agents, plus approver/escalation ownership, explicit budget/capacity and outcome sources. No spending amount is guessed. Sharing remains private by default. Contact selection and increased automation remain explicit in the complete profile. Applying reviewed settings stays paused; resuming and verifying the first output/actions uses existing safeguards. All 32 agents retain their full readiness requirements.

The public browser demo uses a clearly labeled sample website and sample spreadsheet headers. It never fetches customer sites or Google APIs. An explicit synthetic confirmation updates the fixture company context so its example output uses the reviewed company facts. No fixture can mark live account access verified.

## Google access choices

Provider tokens remain in Vault and server memory, never in a browser or Workflow payload. The standard file-specific grant is preserved. New **optional**, unchecked spreadsheet discovery requests `drive.metadata.readonly` and `spreadsheets.readonly`; the UI explains that this grant permits Drive metadata and reading all spreadsheets, while DAVID lists spreadsheet names and reads only the client-selected header/reviewed rows. The server uses GET requests and bounded responses/pagination. File-specific access can see only files already opened/shared with the app; a pasted ID does not create permission.

This design avoids a browser-token-dependent Picker implementation. Clients choose broader read-only discovery explicitly or retain file-specific access and select an already authorized file. The Google app administrator must review/register the added scopes and any applicable Google verification before publishing the operational integration.

Official references: [Drive files.list](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list), [Drive scope guidance](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Sheets spreadsheets.get](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/get).

## Backend and boundaries

- `packages/domain/src/onboarding-assist.ts`: candidate extraction, goal/team proposals and mapping suggestions.
- `apps/web/components/guided-onboarding.tsx`: progressive review flow and saved-profile link.
- `apps/web/components/onboarding-discovery.tsx`: bounded metadata discovery, source owner and mapping review.
- `apps/web/app/api/google/discover/route.ts`: authenticated owner/operator API; workspace-bound resource grant, quotas, typed input and safe provider error messages.
- `packages/connectors/src/google.ts`: bounded Drive listing and Sheets metadata/header reads through the existing Vault/refresh transport.
- Migration **019**: checked discovery run creation/finalization, tenant-scoped audit evidence, and preservation of unchanged company facts when objectives/hours change. No new secret-readable API or table grant.

Discovery can run while a workspace is paused. It neither marks connections healthy nor activates agents. Interrupted metadata discovery is marked blocked on a later discovery attempt after two minutes. Existing provider validation remains the authority. OAuth callback returns to the same workspace's guided Systems stage; an OAuth grant does not complete onboarding.

## Verification and remaining setup

Local verification passed 193 unit tests across 22 files, 15 Chromium tests, lint, TypeScript and all three builds. Migration 019 and SQL suite 009 passed SQL/PL/pgSQL syntax parsing; they were not executed against a hosted database. Unit coverage includes cited candidates, untrusted source instructions, missing facts, ambiguous headers/money, sample isolation, bounded file listing, exact header ranges, permission denial and expired grants. Browser coverage walks the guided sample journey through explicit review and retained output, reload, two workspaces and all five mobile stages; the complete-profile tests remain separate. SQL suite `009_onboarding_discovery.sql` covers owner/viewer, cross-tenant and expired-connection denial, paused work and non-verification.

Apply migration **019 after 018** to the authorized hosted project, then run all hosted SQL tests. Register the optional discovery scopes on the operational OAuth app, test consent denial and revocation with real test accounts, and verify Drive/Sheets reads plus source-check workflow receipts. Existing Supabase/Auth/model/workflow configuration remains required as described in ONBOARDING_IMPLEMENTATION.md. These provider and hosted SQL tests are not claimed as executed without credentials.
