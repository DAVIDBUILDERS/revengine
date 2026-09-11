# Source authority and outcome semantics

The source owner supplies and confirms proposal status, version, validity, factual scope and the selected contact channel. A sync timestamp means the source was read; `sourceVerifiedAt` means the business fact was last verified. The domain checks both independently. A new source status cannot be guessed into an eligible stage. `unknown`, accepted, declined, on-hold and expired proposals cannot be followed up. Missing financial sources do not stop useful preparation or an otherwise valid communication workflow.

Contacts are identified by stable source keys and conservatively normalized email addresses. A name match cannot merge people. Conflicting stable contact IDs/emails or changed proposal/contact/opportunity bindings fail CSV import. Multiple open proposals for the same contact require ownership review before contact. All current records and evidence carry a workspace ID; operation input is checked against the verified workspace context. SQL/RLS and real worker-role isolation are verified separately from these domain checks.

## CSV authority and repeatability

`packages/domain/src/csv.ts` validates an explicit field-mapping preview. The supported initial mapping is the documented canonical header set; arbitrary provider column mapping must be reviewed before conversion to it. The preview retains original cells and row errors before any write. Required columns are in `CSV_FIELDS`; required values include stable source IDs, known status, owner, contact email, version/reference, issuance, source verification and approved scope. `valid_until` may be blank when not applicable. `amount_minor` may be blank for unknown; numeric values are nonnegative integer minor units and require explicit currency and value kind.

Imports are capped at 1 MB/2,000 rows. Quoted commas, escaped quotes, CRLF and quoted multiline cells are parsed; malformed quoting, duplicate headers, missing fields, schema drift, conflicting identities and invalid UTC timestamps fail. Stable IDs derive from workspace/source/entity keys, not row position. Reordering or replaying the same version creates no duplicate. Changed facts require a newer source version. Previous proposal versions remain in `proposalHistory`; original cells remain in `sourceRows` and evidence records/timeline entries retain provenance. A partial export never deletes missing records or turns them into won deals.

Imported contacts start unenrolled. CSV is sufficient for internal analysis and draft preparation after appropriate source checks, but it does not grant sending permission. Real sending requires the approved fresh cohort/batch, current authoritative status, current relevant reply and suppression coverage, sender binding and live activation. Missing row data is not evidence of a win. The sample in `fixtures/proposals.csv` contains only synthetic records and must never be enrolled in a real sender.

## Coordination and authority

The proposal owner and commercial conversation owner must match. Contact-level claims cover pending work and uncertain provider writes across specialists. A checked appointment handoff replaces proposal chasing; a booked appointment stops further chasing. Human takeover persists until explicitly released. Global pause stops pending actions; a call already submitted may still finish and is reported honestly.

Suppression runs before prioritization. Opt-outs apply to both follow-up and booking; delivery failures suppress further contact pending review. Every initial-pilot reply stops follow-up, including bounces and automatic responses. Those automated responses do not count as human replies. Positive classification is a bounded handoff suggestion, never proof of a contract. Negotiation, legal changes, pricing changes and prompt-injection language are escalated as ambiguous.

Approvals bind exact content, recipient, proposal version, action type, material bounds and policy version. Changing any of these invalidates prior approval. Source documents and messages remain data and cannot modify policy, choose credentials, grant approvals or redirect recipients. The action service reserves contact and budget before provider submission. Gmail acceptance is retained as acceptance only. Timeout after a possible acceptance produces `uncertain`, retains ownership and prevents automatic resend. A definitive provider evidence match reconciles the existing action; absence or ambiguity requires operator review.

## Evidence stages and metric definitions

`calculateMetrics` is the shared deterministic read model used by fixture Today, journeys and saved briefs, and is exported for relational production snapshots. Fixture outcomes are excluded from live/shadow metrics; nonfixture observations are excluded from fixture demonstration totals.

| Measure | Meaning / source | Missing-data behavior |
| --- | --- | --- |
| Human replies | One relevant human-response observation per opportunity | Bounces and automatic replies excluded; no qualified-conversation claim |
| Verified bookings | Distinct confirmed provider calendar booking observation | Does not imply attendance |
| Held meetings | Separate attendance evidence or responsible-person confirmation | Unavailable until observed |
| Open proposal value | Open proposal amounts grouped by currency and one-time/monthly/total-contract value kind | Unknown amount/kind excluded; groups never summed together |
| Won business | Explicit signed-stage financial observation | Unavailable without the separate financial evidence |
| Collected revenue | Explicit paid-stage financial observation | Unavailable without payment evidence; pipeline and signed value are not added |
| Customer gross profit | Collection and relevant fulfillment-cost evidence | Unavailable; no zero-cost assumption |
| Provider-accepted actions | Saved accepted/confirmed action receipt | Email delivery is not asserted |
| Prepared artifacts | Saved internal output | Not a business outcome or publishing claim |

Every displayed metric has a stage, source evidence IDs and a visible limitation where relevant. Pipeline uses the highest proposal version per stable opportunity/reference. Stage observations are current snapshots per opportunity: the greatest `periodEnd` supersedes earlier snapshots, and conflicting equally-current values remain unavailable. A canceled booking can be represented by a later count-zero snapshot. Financial source adapters must reconcile raw payments/refunds into a cumulative corrected stage snapshot before using this read model; they must not pass individual transactions as independently additive opportunity values. Observations later than the requested as-of time are excluded. Missing currency, unknown evidence quality, fractional minor units, unsafe integer totals or ambiguous current proposal value kinds cannot establish a financial total. Unknown count/money values stay null. The fixture clock is fixed to `2026-09-10T16:00:00.000Z`, with examples in `America/Denver`. Tests deliberately move verification timestamps to prove that synchronization does not repair stale business facts. The fixture clock is never live authorization.

Owners and assigned operators can use `record_outcome` to retain a responsible-person confirmation with an immutable reference and observation time. Attendance/completion uses a 0/1 stage count; signed/invoiced/paid confirmations use a cumulative integer minor-unit amount and explicit currency. Invalid/future values are rejected. Replaying an identical reference is idempotent; changing it requires a new correction reference/time and preserves the earlier evidence. Outside fixture mode these observations remain `manually_reported`, even for a paid value; they do not become provider verification. Reporting signed terms stops pending follow-up and assigns human takeover until authoritative status is reconciled. A manual confirmation does not imply any other stage.

`BriefSnapshot` freezes metrics, evidence, as-of time, limitations, up to three decisions and next commitments. A later change cannot rewrite the saved `briefHistory`. Current corrections belong in new records/reconciliation and the next snapshot. Real source corrections, refunds and provider cancellation evidence must be retained with their applicable references before they can alter production financial reporting.

## Delivery economics

Usage separates setup, recurring support, provider, infrastructure and research. Human minutes are recorded even when the cost rate is unknown; unknown cost stays null. DAVID recurring margin is subscription revenue less known recurring delivery categories, and remains unavailable while any required category is missing/unknown. Setup and R&D are shown separately. Customer profit, recovered staff capacity and DAVID delivery margin are different measures. A minute recovered is not automatic payroll savings.

Live handoff requires the actual proposal system, authoritative status owner, enrollment policy, sender/calendar binding, overlapping-contact coverage, staffed operator and outcome-evidence owner. None is established by synthetic data or unit tests.

## Workspace privacy and retention

[PRIVACY_OPERATIONS.md](PRIVACY_OPERATIONS.md) documents the isolated administrator CLI for full paginated business records and evidence/quarantine-object manifests, with credential/routing exclusions and safe JSON serialization. Erasure defaults to a non-mutating preview, then requires exact project/workspace confirmation, approved retention release, paused/reconciled work, committed access/Vault quarantine, actual Storage object removal, and foreign-key-order tenant erasure. Shared Auth users, external provider copies and backups are outside workspace erasure scope. Minimal completion counts remain without tenant/person identifiers. Offline boundary/failure tests pass; hosted export, erasure, external consent revocation and restore remain unverified.
