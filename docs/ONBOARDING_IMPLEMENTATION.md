# Repeatable onboarding and activation

Implemented September 11, 2026. This replaces the earlier activation checklist and per-customer provisioning instructions. The product collects the client's decisions; an engineer does not need answers from a chat transcript.

## Product flow

Open `/?view=activation`. In the operational app, `/login` supports registration, sign-in and password recovery, `/start` creates a paused shadow workspace, and `/join#token=…` accepts a named recipient's invitation. Account confirmation and recovery use `/auth/callback`. These Auth paths are intentionally absent from the static browser demo.

1. Company: name, business model, website, time zone, offers, customers, priorities, success definition, brand guidance and prohibited claims.
2. Team: all 32 responsibilities, applicability, intended systems and currently implemented capabilities. Standard allowance is five. An assigned MFA operator can configure an internal allowance up to 32 in the operator console. Selecting an unfinished agent records the requirement without installing pretend capabilities.
3. Systems: inventory, exact resources, account connections, source owner and mapping notes. Each source can be available, unavailable or awaiting an administrator. Existing website capture and Google Sheets/Gmail/Calendar setup are reused. Mapping notes are descriptive; validated provider bindings remain the authority.
4. Operating permissions: approval mode, exact optional follow-up template authorization, sender, calendar, explicit allowed contacts, restrictions, working days/hours, meeting duration/buffer, capacity, action budget, AI budget and escalation owner. Free-text restrictions are instructions for the person selecting the allowed contacts, not an automatic exclusion engine. An owner can assign an already registered DAVID operator by email; clients cannot promote themselves into that role.
5. People and measurement: responsibilities, member/viewer/owner invitations, measurement owner, authoritative outcome sources, baseline values/dates/provenance and permission to share results. Unknown baselines stay unknown. Approvers need Owner access. Invitations generate private seven-day links for the owner to share; the application does not claim it sent an invitation email. Registration/recovery emails use Supabase Auth delivery.
6. Validation: apply current settings, explicitly resume through runtime checks, produce and review an implemented preparation, and inspect actual provider receipts for execution capabilities. Every catalog agent has explicit requirements and a readiness state.

Saved answers remain editable. Section navigation is independent of completion. A saved revision and retained successful evidence control progress. Save before leaving; the interface marks unsaved changes. Browser refresh restores the saved workspace and selected section. A conflicting revision rejects the write and offers an explicit reload of current answers. The Team screen edits this same intake; applying settings installs the selected applicable implemented agents.

## Ownership and persistence

Migration `202609110018_onboarding.sql` adds:

- `public.onboarding_documents`: one current validated document per workspace.
- `private.onboarding_revisions`: immutable revision snapshots, actor, date and reason.
- `public.onboarding_tasks`: operator queue with ownership, status, notes and related revision.
- `private.workspace_invitations`: hashed, expiring, one-use invitation grants. Raw tokens are returned once and never stored in database records or URL query parameters.

Normal authenticated clients can read only their workspace records. Mutations use checked security-definer RPCs. Owners and assigned MFA operators can configure setup; only operators can expand allowance or resolve setup tasks. Invitation acceptance requires the confirmed invited email, current grantor authority and no existing membership; it cannot silently escalate/reactivate membership. Invite requests are bounded and rate-limited. Existing trusted operators can be assigned to a new workspace through the application, while the first trusted operator requires one-time platform provisioning.

Onboarding records, revisions and tasks are registered in the existing tenant export/deletion inventory. Invitation hashes are excluded from exports and included in deletion. A resolved operator task is never proof of a functioning integration.

## Authorization and readiness

`packages/contracts/src/onboarding.ts` defines the shared validation schema. `packages/domain/src/onboarding.ts` derives readiness from saved answers and retained evidence. `apps/web/components/onboarding.tsx` renders the customer flow and operator queue. `apps/web/lib/operational.ts` routes commands to Supabase; the domain fixture executor provides explicitly synthetic equivalents.

Applying settings creates a versioned policy, selected installations/capacity and workspace model limits. It enrolls only explicitly selected, nonsuppressed contacts without human takeover. With a verified sender and assigned operator, it records bounded live activation configuration. Owner-authorized automatic follow-up additionally creates immutable seven-day mandates for the displayed factual template and current proposal scope. Bookings remain individually approved. None of these operations changes the deployment live flag or resumes work.

Configuration changes pause execution, invalidate unsubmitted decisions, revoke standing authority and require fresh checks. Submitted and uncertain provider actions retain their original evidence. Company changes invalidate source confirmation. Confirmation is serialized with onboarding changes and bound to the current revision and approved facts. Brand guidance and prohibited claims enter preparation inputs and its source signature. Artifact review checks the current captured source hash and approved factual inputs. Changed settings require review at the new revision, including when an unchanged-source artifact is reused. Readiness also requires the current settings to have been applied.

Readiness distinguishes missing business information, administrator/account access, missing engineering, verification still required, paused work, inapplicability and demo-only evidence. A fresh account check must match the selected connection/resource; OAuth success alone is insufficient. Nine implemented agents currently prepare from approved website snapshots. Their broader intended systems are shown as future requirements, without claiming Drive/ads/social ingestion. Two execution agents require actual Google receipts and runtime execution checks. The other 21 remain engineering requirements. Synthetic work never completes live activation.

Baseline entries and sharing permissions are recorded decisions. They do not create payment integrations, independent revenue evidence, automated publishing, or attribution claims.

## One-time platform setup still missing

The public `revengine-bay.vercel.app` project is a **static synthetic preview**, not the operational deployment. Do not enter customer information there. Its saved records are browser-tab sessionStorage, scoped by workspace. The operational app persists the same records in Supabase after configuration.

No hosted Supabase onboarding migration, Auth round-trip, RLS execution test, Google authorization, provider write or model inference was run during this change. Required external setup:

1. Create/bind the separate operational Vercel and hosted Supabase projects using `DEPLOYMENT_RUNBOOK.md`. Configure the exact `.env.example` variables, restricted worker/dispatcher/OAuth database roles and CA certificate; never expose migration or service-role credentials in the client.
2. Apply migrations through **018** with the existing reviewed migration tooling. Set `TEST_SUPABASE_PROJECT_ID`, `PRODUCTION_SUPABASE_PROJECT_ID` and `TEST_DATABASE_URL` for hosted rollback tests. `pnpm test:db` currently exits BLOCKED because these values are unavailable.
3. Configure Supabase Auth site/redirect allowlists for the operational origin and `/auth/callback` (including the recovery return), email confirmation, delivery/SMTP and rate limits. Verify registration, recovery, named invite acceptance, revocation and expiration using two real test accounts.
4. Provision the first trusted DAVID operator membership and MFA through platform administration. Thereafter owners assign registered operators in onboarding; no per-customer membership SQL is required by this flow. Configure DAVID's expanded allowance from the operator console.
5. Register the Google OAuth app, consent audience, scopes and exact operational callback. Each client authorizes its own account, binds its selected Sheet/mailbox/calendar and runs actual read checks in the software.
6. Configure the approved model/provider, pricing basis and global ceilings, workflow/Cron deployment, monitoring/alert delivery and restore evidence. Workspace budgets and business rules belong in onboarding, not infrastructure secrets.
7. Run hosted SQL suites including `008_onboarding.sql`, concurrent action tests and deployed Auth/Storage/workflow/provider checks. Prove two independent companies before a live release. The live deployment gate remains a platform release decision; no setup checkbox overrides it.

Unsupported integrations and missing agent implementations remain the broader product backlog. Operator assignment does not supply alert delivery or automatically staff an unattended pilot.

## Verification and continuation

Local tests cover revision conflicts, two workspaces, owner/member/viewer boundaries, allowance escalation denial, explicit automation acknowledgement, incomplete sources, expired access, failed output review, changed settings, operator tasks and synthetic invitations. Browser coverage walks all six sections, saves/resumes, requests assistance, reviews a fixture output, verifies isolation and checks all sections at mobile width. Screenshots are retained under Playwright's ignored `test-results` directory.

The hosted SQL suite adds tenant read/write isolation, direct-write denial, stale revisions, entitlement restrictions, wrong-recipient/expired/revoked/replayed invitations, applied capacity and privacy-registry checks. Its execution remains blocked by missing hosted test credentials; successful SQL parsing is not PostgreSQL execution evidence.

Continue with the platform setup above, run the hosted tests, and fix any SQL/runtime failures before claiming production readiness. Keep preview fixtures separate throughout. See `TEST_EVIDENCE.md` for final local test results and `HOSTED_PREVIEW.md` for the public deployment procedure.
