# DAVID product experience

## Implementation and authority

The operational Next.js app lives in `apps/web`; the independent anonymous sales demonstration lives in `apps/demo`. No verified v13 source, font or official design tokens were available during the initial build. On September 11 the user supplied `/Users/jakob/Downloads/DAVIDENGINE.png` and requested a more deliberate business interface and transparent agent interaction. Its first house wordmark is now used in both apps and sign-in. The original image is preserved; CSS displays the first treatment and increases presentation contrast to blend its paper background. See [DESIGN_REVISION.md](DESIGN_REVISION.md). No legacy interface migration is claimed.

The operational browser reads `GET /api/state` and sends the shared validated `Command` contract to `POST /api/command`. A successful mutation replaces the view with the server's returned snapshot. Thirty-second reconciliation and manual Refresh retrieve authoritative state. A mutation epoch prevents a previously started read from overwriting a newer command result. No operational UI produces optimistic business outcomes. API failure displays the actual safe error and a retry/sign-in path; it never substitutes an invented dashboard.

Operational navigation is URL-backed (`?view=today`, `team`, `activation`, `opportunities`, `decisions`, `journey`, `scenarios`, `connections`, `operator`). Browser back/forward restores the current surface. Navigation moves focus to the main region without unexpectedly scrolling fixed navigation into view.

An explicit `?workspace=` selection is preserved through navigation and sent on every read and command. Hosted requests bind to the returned workspace UUID; local fixtures retain their synthetic workspace key. A browser test opens the `northstar` fixture, creates work, navigates and verifies that `david` remains unchanged. The desktop sidebar and mobile navigation offer an assigned-workspace picker backed by `GET /api/workspaces`. Hosted listing verifies claims, current memberships and operator MFA, then reads names through the request-scoped RLS client; no administrative key or synthetic fallback is used. Listing is capped at 100 assignments with an explicit coverage message. Switching preserves the current view and performs a full navigation, clearing the previous workspace state. Local fixture listing exposes only the two known synthetic keys.

## Shared visual system

Shared styles and tokens live in `packages/ui/src/theme.css`; pure money/label formatting lives in `packages/ui/src/index.ts`. Common operational Button, Badge, Empty, Drawer and Evidence primitives live in `apps/web/components/ui.tsx`. Tailwind v4 is configured for both apps; the named component classes make shared spacing, status and interaction decisions explicit.

| Token | Current implementation |
|---|---|
| Canvas | `#FFFFFF` |
| Surface | `#FFFFFF` |
| Primary text | `#18191C` |
| Secondary text | `#616463` |
| Border | `#E3E3E0` |
| Accent | `#C42B2F` |
| Navigation surface | `#F3F3F1` |
| Positive text / background | `#227354` / `#EDF6F0` |
| Warning text / background | `#87580B` / `#FCF6E9` |
| Information text / background | `#3C638C` / `#EFF4FA` |
| Spacing | 4, 8, 12, 16, 24, 32 px |

System sans-serif typography uses a 16px root, with 32–46px system-serif page titles echoing the supplied wordmark, 14–18px section titles and compact secondary/metadata text. Shared tokens remain in `packages/ui/src/theme.css`; operational composition is in `apps/web/app/product-design.css`, loaded after existing base styles. Numeric fields and metrics use tabular numerals. Red indicates primary decisions and controlled actions; it does not animate a claim of activity. All statuses carry words and icons, not color alone.

Calculated WCAG contrast ratios for the revision’s central text pairs: primary/white 17.58:1; secondary/white 5.98:1; navigation text/navigation surface 6.55:1; accent/white 5.62:1; fixture disclosure/background 5.92:1. These calculations cover the named token pairs; they are not a claim of a complete accessibility certification.

## Operational surfaces

| Surface | Behavior and review path |
|---|---|
| Today | Exact sections Results, Work underway, Decisions needed and Blockers. Four leading source-linked metrics; up to three priority decisions; named blocker owner and next action. Frozen brief is generated from the same server read model. |
| Your team | All 32 canonical specialists, five-slot selection, applicable business-model filters, goal recommendations, explicit release/mode labels, dependency details, separate preparation/business timestamps and saved artifacts. Server enforces entitlement and handoff safety. |
| Activation | Saved six-step sequence: confirm facts/goal, review specialists, deduplicated prerequisites, inspect representative source rows, review operating boundaries, verify first permitted workflow. Real readiness remains independent from wizard position. |
| Opportunities | Sales records and work findings are separate tabs. Proposal drawer contains current source, status, value basis, contact ownership, exact draft, immutable approval fingerprint, receipt and fixture-only reply injection. CSV preview precedes saving. |
| Decisions & initiatives | Observation, hypothesis, alternatives, baseline, target, owner, effort/cost and review date. Approval creates tracked initiative assignments; review records supported, unsupported or inconclusive results. |
| Customer journey | One proposal/contact timeline, source/DAVID/human actor labels, source drawers and separate reply/booked/attended/signed/completed/invoiced/paid evidence stages. Owner/operator confirmation form records actual timestamp and reference with manual/fixture quality. |
| Scenarios | Saved versioned shared funnel, editable cohort/volume/conversion ranges/capacity/currency/horizon/cost/counterfactual. Low/base/high cases are visibly illustrative. Schema-invalid inputs, unresolved overlap and unknown unit value stop calculation/save. |
| Connections | Resource binding, operations, scopes, owner, freshness and verification time. Three independent readiness dimensions. Authenticated hosted Google connection/reauthorization/disconnection calls use dedicated server routes. Fixture mode disables real account authorization. |
| Operator | Assigned operator gate in operational environments; explicitly local fixture access for evaluation. Component health, uncertain actions/reconciliation, effort categories, intervention log, setup/support/provider/infrastructure/R&D separation and incomplete economics. |

## First journey

Connections also includes an **Approved source setup** drawer for hosted workspace owners and assigned operators. Website setup posts an approved URL to `/api/context/capture`, displays captured page excerpts and evidence, and requires explicit company name, offers, customer types and optional locations before `/api/context/confirm` binds the confirmation to the returned context ID and source hash. Source text is rendered as text, never HTML or executable instructions. Recapture resets confirmation.

Google source setup posts a connected account ID, resource type (Sheet/calendar/mailbox), exact resource ID, Sheet tab/A1 range, responsible source owner and normalized-field-to-source-header mapping to `/api/google/bind`. Required proposal mappings use the source CSV fields; optional `gmail_thread_id` and `account_id` preserve enrolled-conversation and authoritative account identity when available. A saved binding queues a read-only capability check and does not grant permission or enable sending. Fixture mode shows a precise setup-unavailable explanation and disables all external source controls. The browser test asserts that no capture, confirmation or binding request occurs from that fixture UI.

1. In Opportunities, inspect synthetic proposal P-1001.
2. Prepare a follow-up; review the exact recipient, wording, proposal version and evidence.
3. Approve the exact action, then run the checked fixture action. Its receipt is provider acceptance, not proof of delivery.
4. Record a clearly positive synthetic reply. The domain service stops further follow-up and offers the explicit handoff.
5. Enter a confirmed future ISO timestamp with UTC offset and the calendar IANA time zone. No default guessed appointment is filled.
6. Prepare the appointment, review the precise start/end/calendar, approve and dispatch it.
7. Inspect the shared journey. Reply and booked evidence appear; attendance and financial stages remain unknown until separately recorded.

An accepted/declined/expired/on-hold/unknown/stale/suppressed record cannot be made eligible by a button. The server evaluates current state. Human takeover, workspace pause, current permissions and contact ownership are applied before dispatch. Owners can pause immediately; resume requests recheck readiness. A call already in flight remains a visible reconciliation problem.

## Loading, empty, stale, failed and success states

All surfaces inherit an explicit initial loading state, API failure with retry/sign-in, as-of timestamp, refresh control, mode badge and fixture banner where applicable. A failed refresh retains the prior visible snapshot with a stale warning rather than pretending it is current.

| Surface state | Meaningful next step |
|---|---|
| No sales records / timeline | Import a source CSV with stable IDs and current facts. |
| No team / no matching catalog item | Choose specialists, clear search or change category. |
| Planned or inapplicable specialist | Inspect its declared dependency/engineering gap; selecting does not enable execution. |
| No prepared artifact | Select/save its installation and run bounded preparation; missing source/model becomes a blocker. |
| No decisions / initiatives | Wait for a supported observation or approve a recommendation; no invented work is displayed. |
| Unverified/expired/stale connection | Named owner supplies access, verifies fresh data or reauthorizes the selected capability. |
| Uncertain provider action | Reconcile source evidence; no resend control is offered as a shortcut. |
| Unknown finance / scenario comparison | Display Unavailable and the missing evidence; unknown never becomes zero. |
| Invalid scenario | Edit conversions, explicit value, capacity and overlap before save. |
| Invalid CSV | Row-level errors plus original values; saving remains disabled. |
| Successful command | Persisted server response appears as an announced status. When a modal is open, feedback appears inside the accessible modal subtree. |
| Rejected command | The safe server explanation appears as an alert with the controls preserved for correction. |

## Accessibility and responsive behavior

Semantic navigation, headings, form labels, table headings and native controls support keyboard use. The skip link becomes visible on focus. Focus rings use a contrasting blue outline. Radix modal dialogs supply focus containment, accessible title/description, Escape handling, background inertness and explicit return to the opening control. Inline modal feedback avoids placing critical errors in an aria-hidden background toast.

Evidence without a direct source URL offers **Retrieve private attachment** in authenticated operational workspaces. The browser calls `/api/evidence/{id}?workspace={selectedWorkspace}` and displays only the authorized short-lived HTTPS download URL returned by the server. Metadata-only records say that no private attachment is retained. Permission, expiration or retention errors are visible; no fixture attachment request or fabricated link is used. Hosted Storage verification is still a separate access-dependent test.

At narrow widths, navigation becomes a labeled toggle, the main content is single-column, metadata wraps and wide data tables scroll inside their own containers. The operator navigation stays usable with vertical sidebar scrolling at short viewport heights. The system honors reduced motion; interface movement never implies unobserved work.

## Public demo boundary

The public app only imports pure shared contracts, specialist metadata, scenario arithmetic and visual utilities. It has no operational API, credentials, memberships, auth routes, action service imports or provider client. Schema-validated `sessionStorage` retains one tab's synthetic state; in-memory use remains possible if browser storage is blocked. Reset affects only that session. B2B and home-service presets explicitly label sample sources, people, interactions and outcomes. The home-service journey is labeled as a later live release.

Public URL analysis is unavailable, with a clear explanation and useful preset fallback. There is no URL retrieval endpoint to reach private networks or consume uncontrolled model resources. Enabling this later requires the dedicated restricted retrieval/profile capability, SSRF defenses and application/session/global quotas described in the build brief.

## Verification

`pnpm typecheck` and targeted frontend ESLint ran successfully during implementation. The Playwright suite in `tests/e2e/frontend.spec.ts` exercises the full proposal-to-booking journey, terminal/takeover/pause gates, saved scenario versions, catalog coverage, evidence keyboard focus, mobile operator controls and public-session reset/isolation. Refer to the final `docs/TEST_EVIDENCE.md` for the authoritative final run and environment. Screenshots are written to `test-results/screenshots` and remain local generated artifacts.

Remaining hosted verification: actual Supabase roles/Auth/MFA, Google consent/account binding and operations, Vercel durable workflows and private evidence downloads. UI availability and local browser tests do not establish those integrations as live-ready.

## September 11 revision

Today retains the four required Results, Work underway, Decisions needed and Blockers sections, with decisions first. At most three priority items appear in the queue; remaining items link to the complete decisions surface. Exact-action previews retain recipient, subject, full body and appointment timing. The review control passes the proposal ID in the URL and opens that customer record. Recommendations remain proposals, with source evidence and explicit owner/commitment. Outcome rows use the existing shared metric read model; unavailable figures remain labeled. Blockers expand to all recorded owners and next steps.

Installed-agent rows on Today and Your team open the same `AgentWorkspace`. Three views expose work and handoffs, inputs and access, and rules and limits. Content derives from catalog definitions, current installations, saved artifacts, findings, actions and receipts. Declared capabilities/tools never masquerade as proof of granted access or executed tool calls. Actual preparation and whole-workspace pause use the existing command service. Customer controls link to the original exact-approval and takeover flows. This is not a conversational agent chat, complete historical audit export or display of model-internal reasoning.

Mobile navigation becomes inert and aria-hidden while closed. The mobile header retains the supplied wordmark. The new browser tests verify output provenance, pause behavior, workspace switching and exact-proposal navigation. Original provider, hosted readiness and fixture boundaries remain unchanged.
