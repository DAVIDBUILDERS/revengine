# Demonstration and planning scenarios

The public sales demo belongs to the separate `apps/demo` Vercel project. It must receive no operational Supabase keys, Google credentials, workflow hook tokens or live API authority. Public demo state uses tab-scoped session storage, schema-validated on restore, with a manual reset. The implemented demo imports only contracts, pure catalog metadata and the scenario calculator; it has no operational routes or provider/auth imports. It includes separately labeled B2B-services and home-service preset journeys, the 32-entry catalog, manual five-specialist selection, goal recommendations and editable shared-funnel assumptions. Operational fixture state is an explicit local/test mode with deterministic domain services and must be visibly labeled. It is not a substitute for deployed Supabase authentication or Google verification.

`createFixtureState(workspaceKey)` creates stable synthetic IDs in an isolated workspace, a fixed clock, eight clearly labeled illustrative proposals and bound fixture provider capabilities. The first proposal (`P-1001`) is eligible. The other examples cover accepted, declined, expired, on-hold, suppressed, stale and unknown status. Tests add ownership conflicts and duplicate contacts. `reset` reinitializes only the current workspace/session; a separate state's records are not affected. Fixture receipts begin with `FIXTURE_ONLY_` and cannot be mistaken for Google IDs.

## Local walkthrough

1. Open Today and inspect the separate results, work, decisions and blockers. Financial return is unavailable; the fixture does not invent revenue.
2. Open eligible proposal P-1001, inspect the source and prepare a grounded follow-up. Review the exact recipient, factual body and proposal version.
3. Approve and dispatch. The retained receipt says provider accepted, not delivered. Retry the same action to demonstrate no second write.
4. Record the labeled fixture reply “Yes, let's meet to discuss the existing proposal.” Follow-up stops. Propose an explicit future appointment within approved working hours, approve it and dispatch.
5. Inspect the timeline and booking evidence. Booking count increases; attendance, signed value, payment and gross profit do not. An owner may separately record an explicitly labeled responsible-person confirmation with its reference and timestamp. Such a confirmation remains illustrative in this fixture and manually reported outside fixture mode.
6. Reset this fixture session and repeat with the timeout simulation. The action remains uncertain and the contact reserved until reconciliation finds the existing fixture provider evidence. There is no automatic resend.
7. Try a suppressed or stale proposal. The system blocks it with its actual reason. Pause also stops pending actions; a call already in flight remains visible.
8. Select one of the nine implemented preparation specialists, run it and inspect the saved artifact/source/limitation. Nine tests use distinct standard entitlement selections; they are not nine simultaneously included slots.
9. The rule-based opportunity inbox evaluates neglected eligible proposals, delayed replies, missing next appointments, meeting capacity and unresolved/stale statuses. Approve a work finding to create an initiative with assignment, baseline, owner, target and review date. A review without sufficient evidence stays inconclusive.
10. Edit/save a planning scenario, inspect low/base/high cases and generate an immutable as-of brief. Scenarios never modify observed totals.

CSV preview/import can use `fixtures/proposals.csv`. Preview first; imports retain stable source identities and do not enroll contacts for sending. A partial reimport leaves other records intact. The sample is synthetic and intended only for local/nonproduction use.

## Scenario model

`ForecastScenario` stores version, business model, currency, horizon, one cohort, overlap resolution, starting volume, ordered conversion ranges, business capacity, unit value, spend, baseline, counterfactual and assumptions. `forecastCases` multiplies a single shared funnel, counts the same cohort once, and caps final wins at capacity. It does not sum agent-specific lead estimates. Low/base/high are planning cases, not confidence intervals.

- B2B services: reachable contacts/inquiries or existing proposals → qualified conversations → bookings → held meetings → wins.
- Home services: inquiries or existing estimates → appointments → accepted jobs → completed work → collection. This is illustrative scenario support; the live home-service job/payment integration is not verified.
- Commerce remains catalog/planning support until implemented source and action integrations are evaluated.

Each scenario is either new demand or recovery. Unresolved overlap rejects calculation/save. Combining scenarios with overlapping cohorts requires explicit de-duplication outside the current single-cohort calculator; no aggregate tool silently adds them. Conversions must satisfy `0 ≤ low ≤ base ≤ high ≤ 1`. Currency and value units are kept explicit. Zero volume produces zero scenario counts; zero or missing spend produces unavailable ROI. Unknown unit value leaves monetary forecast and ROI unavailable while the funnel counts remain usable.

Incremental ROI is available only with an explicit baseline, nonblank counterfactual and positive spend basis. The result is `(scenario wins − baseline wins) × unit value − spend`, divided by spend. It is an assumption-based scenario, never measured causal lift. Saved versions retain prior scenarios in `scenarioHistory`; observed comparisons report variance from the base case without retroactively changing assumptions or the observed record.

## Source and URL boundary

The domain's preparation service consumes approved `WebsiteContext` snapshots; it never fetches arbitrary URLs. The implemented public demo explicitly reports URL retrieval as unavailable and offers a labeled preset; it has no URL retrieval endpoint. Any future public URL capture/profile generation must be a separate restricted adapter with DNS/redirect/SSRF validation, byte/page/time caps, session quota and a global budget. If unavailable, the UI must use an explicitly labeled preset and cannot claim to have observed the entered website. A profile is preliminary until its important company facts are confirmed.

No source page can instruct a preparation to submit a lead form, send mail, publish, select secrets or execute tools. Saved template preparations explicitly distinguish proposal copy from deployment, script from rendered video, FAQ from live chat, and captured-page checks from indexing/ranking analysis. Public deployment and any real retrieval/model use require the authorized target and budget, even though the demonstration contains synthetic results.

## Local verification evidence

`tests/domain.test.ts` covers the permitted journey and business failure cases, all nine preparation outputs, 32 unique definitions, five slots and aliases, tenant mismatch, opt-out/takeover/pause, uncertain writes, duplicate approval/dispatch, CSV reordering and partial exports, immutable brief metrics, inconclusive strategy review, capacity/overlap/zero denominator and partial delivery cost. These tests run without a database or provider credentials and do not establish SQL/RLS, hosted durable-workflow, OAuth or Google integration correctness. Hosted and real-provider checks remain separate release gates.
