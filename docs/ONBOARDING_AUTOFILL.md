# Prepared onboarding: implementation plan and handoff

September 11, 2026. User approved reducing manual intake to website/objective, selected account access, review, and first work.

## Plan

1. Collect public website + objective together. Read useful public pages and structured company metadata with the existing bounded SSRF-safe capture. Allow explicitly selected text/Markdown company briefs; preserve source excerpts.
2. Build a saved workspace setup proposal from source evidence, existing answers, authenticated owner identity, current connections and authoritative metrics. Never infer permissions, spending or contact consent from source text. Preserve human answers and surface conflicts.
3. Replace the default wizard with four stages. Review summary cards; expand only missing answers or corrections. Reuse the existing complete profile for advanced controls. Suggest account/resource identities and column mappings without widening grants silently.
4. Record source versions, setup revision, proposal generation and acceptance. Reject stale acceptance; preserve accepted answers in the existing revision history. Keep synthetic samples separate from operational sources.
5. Make requirements specific to each agent. Missing future capabilities or revenue measurement must not block source-backed internal preparations. Keep actual runtime, budget and provider checks intact.
6. Test source extraction, conflicting/saved answers, unknown/authoritative baselines, stale proposals, cross-workspace access, denied/expired connections, progressive questions and the complete preview journey. Publish to the existing Vercel preview, push GitHub, record unresolved hosted setup.

## Release boundary

The existing public app is a browser-only synthetic preview. Operational discovery uses the authenticated Supabase app; missing hosted credentials remain explicit. Text extraction is deterministic and source-cited, with no model spend during onboarding. It is not semantic model inference. PDF/Word parsing and unsupported business-system connectors must not be advertised as available.

Implementation and final verification will be recorded below as work progresses.

## Implemented

- Four stages: **Start → Accounts → Review setup → First work**. Website and objective are collected together. Initial proposal construction fills company facts, selected goal/success definition, proposed team, website source inventory, known owner responsibilities and measurement placeholders/evidence. Review cards replace mandatory text-entry fields. Corrections and advanced controls remain available.
- Website capture prioritizes useful About/Services/Solutions pages within its existing three-page/public-HTTPS/DNS-pinned limits. Bounded JSON-LD Organization/Service/Product metadata and explicit offer/audience wording supply cited candidates; scripts and page instructions never execute.
- Owners may explicitly select up to five `.txt`/`.md` briefs, each at most 30,000 characters. Exact statements and line references supply setup facts. PDF, Word, OCR and Google Docs ingestion are not implemented by this change. The public preview exposes sample briefs only.
- Authenticated owner identity pre-fills proposed approver/escalation/measurement responsibility. No invitations or role grants occur from inference. Owners review these responsibilities and choose a model spending limit. Capacity is proposed visibly; policy acknowledgement is always reset on new discovery. Contact consent, outbound budgets and standing authority are never extracted from documents.
- Already authorized Google spreadsheet lists load automatically for a single available account. A single tab can be inspected without another selection; multiple tabs still require a choice. Existing strict header mapping remains reviewable. Connection/account errors retain explicit permission or reauthorization messages. Selected resources and source ownership use the same saved intake and existing binding/check workflow.
- Baselines use authoritative workspace metric totals only when every referenced evidence ID is present in matching-stage, independently verified outcome records. Missing evidence, unsupported outcomes and absent connectors stay unknown, including missing-source zeroes. These are recorded-cohort baselines, not claims of whole-company coverage or incremental impact. Existing baseline answers are preserved.
- Implemented internal preparations need confirmed company facts, an approver, reviewed limits, capacity and retained output evidence. Missing revenue measurement, future connectors and unimplemented agents do not become preparation prerequisites. Existing runtime resume, source, budget and external-action gates still apply.

## Persistence, races and permissions

`packages/contracts/src/setup.ts` defines selected documents and prepared proposals. `packages/domain/src/prepared-setup.ts` performs deterministic discovery, preserves saved answers, records source conflicts and validates acceptance. The new UI is `apps/web/components/prepared-onboarding.tsx`; the complete existing profile is still `?view=activation&mode=profile`.

Migration **020**, after 019, adds `setup_document` and `prepared_setup` kinds to the existing tenant-scoped product record table. There is one current prepared proposal per workspace. No new table bypasses the existing privacy export/deletion registry. Checked owner/operator RPCs enforce workspace membership, source limits, generation/revision conflicts and explicit policy acceptance. Source documents are immutable/deduplicated until removed. Removing a document cited by the accepted proposal pauses execution and invalidates company confirmation.

A database source fingerprint binds the captured record versions, selected documents, connections, resource bindings and full metric read model. Generation begins with a fingerprint read; save and acceptance compare it again under the workspace lock. The client/domain also checks a deterministic snapshot signature. Changing sources, connection health, metrics or saved answers invalidates unaccepted proposals. Accepted answers use the existing immutable onboarding revision history; acceptance audits retain the original proposal and citations so edits remain attributable. Acceptance alone does not start work. Company source confirmation and settings application stay separate checked operations, with explicit retry if either fails.

Raw document content remains workspace data. Citations may retain bounded excerpts after a document is removed; removal is not presented as complete privacy erasure. Tenant export/deletion covers the underlying product records and audit records. The public preview continues to use bounded sessionStorage command replay with synthetic data and no operational API calls.

## Verification and remaining setup

Unit tests exercise source extraction, document instructions, preserved answers/conflicts, owner identity suggestions, explicit budget/approval, stale generation/source/connection checks, cross-workspace denial and unknown versus evidence-backed baselines. Browser tests cover a low-input journey to reviewed output, selected briefs, source mapping, administrator assistance, corrections, reload and all four mobile stages. SQL suite `010_prepared_setup.sql` covers tenant/role access, source fingerprints, stale acceptance, unapproved policies, source selection, direct-write denial and privacy registry membership.

Apply migration **020** to the authorized operational hosted Supabase project and run all hosted SQL suites. Configure the existing Auth, Google, model budget/provider and workflow deployment before claiming real onboarding-to-output execution. Hosted database/provider evidence is still unavailable without those credentials. Successful syntax parsing and fixture/browser tests do not establish hosted RLS or provider execution.

Final local checks: 203 unit tests in 23 files, lint, TypeScript, all three production builds; full 16-test browser regression plus both affected prepared-setup flows after the final guards. SQL and PL/pgSQL syntax pass. Hosted tests are blocked by missing `TEST_SUPABASE_PROJECT_ID`, `PRODUCTION_SUPABASE_PROJECT_ID` and `TEST_DATABASE_URL`.

Vercel inspection still reports project `revengine`, root `apps/preview`, Git link `null`. The existing GitHub installation access request remains unresolved; deployments continue via the authorized CLI to the same project. No alternate identity was used to bypass the GitHub access denial.
