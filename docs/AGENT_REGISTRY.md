# Versioned specialist registry

The executable source of truth is `packages/agents/src/index.ts`. Definitions are version `1.0.0`; schema validation checks every registry entry. Catalog visibility, selection, preparation, scheduled work and external execution are distinct. No v13 source was available to validate persisted identifier mappings; these identifiers are new target-platform identifiers and require a legacy mapping before migration.

The standard entitlement is five distinct specialists. Shared company context, suppression, coordination, strategy, reporting and health use no slots. Aliases resolve to their canonical responsibility and cannot consume an additional slot. Manual selection is persisted and checked server-side. Planned capabilities can be selected to expose engineering prerequisites; selection never enables them. Tests exercise all nine preparation functions using separate five-slot-valid selections, without a client-controlled evaluation exemption.

| Category | Stable ID | Responsibility | Implemented mode / state |
| --- | --- | --- | --- |
| Find demand | account-intelligence | Account Intelligence | Preparation implemented |
| Find demand | buying-signal-scout | Buying Signal Scout | Planned |
| Find demand | outbound-email-sdr | Outbound Email SDR | Planned |
| Find demand | linkedin-outreach-assistant | LinkedIn Outreach Assistant | Preparation planned; human sending only |
| Find demand | partner-development | Partner Development | Planned |
| Find demand | rfp-opportunity-scout | RFP Opportunity Scout | Planned |
| Find demand | competitor-intelligence | Competitor Intelligence | Planned |
| Create demand | search-growth | Search Growth | Preparation implemented |
| Create demand | technical-seo-monitor | Technical SEO Monitor | Preparation implemented |
| Create demand | local-search-manager | Local Search Manager | Preparation implemented |
| Create demand | creative-performance | Creative Performance | Preparation implemented |
| Create demand | paid-campaign-operator | Paid Campaign Operator | Planned |
| Create demand | landing-page-optimizer | Landing Page Optimizer | Preparation implemented |
| Create demand | social-content-publisher | Social Content Publisher | Preparation implemented; publishing unavailable |
| Create demand | video-script-producer | Video Script Producer | Preparation implemented; rendering unavailable |
| Create demand | product-merchandiser | Product Merchandiser | Commerce only; planned |
| Convert demand | speed-to-lead-responder | Speed-to-Lead Responder | Planned |
| Convert demand | ai-receptionist | AI Receptionist | Planned |
| Convert demand | website-sales-concierge | Website Sales Concierge | Preparation implemented; live chat unavailable |
| Convert demand | appointment-coordinator | Appointment Coordinator | Monitored execution pilot implementation |
| Convert demand | lead-qualification | Lead Qualification | Planned |
| Close revenue | proposal-operations | Proposal Operations | Planned; no generated contracts |
| Close revenue | deal-follow-up | Deal Follow-up | Monitored execution pilot implementation |
| Close revenue | sales-call-coach | Sales Call Coach | Planned |
| Close revenue | estimate-recovery | Estimate Recovery | Home services only; planned |
| Close revenue | revenue-experiment-manager | Revenue Experiment Manager | Planned |
| Retain and expand | abandoned-cart-recovery | Abandoned Cart Recovery | Commerce only; planned |
| Retain and expand | lifecycle-email-manager | Lifecycle Email Manager | Planned |
| Retain and expand | customer-win-back | Customer Win-back | Planned |
| Retain and expand | expansion-opportunity-scout | Expansion Opportunity Scout | Planned |
| Retain and expand | renewal-and-retention | Renewal and Retention | Planned |
| Retain and expand | review-and-referral-manager | Review and Referral Manager | Planned |

Aliases: Account Prospector → `account-intelligence`; SEO Content Writer → `search-growth`; Ad Creative Studio → `creative-performance`; Proposal Builder → `proposal-operations`; Proposal Follow-up → `deal-follow-up`. Proposal Follow-up is the B2B-services playbook, not another slot. Estimate Recovery retains its named catalog slot for the later home-service workflow; shared domain primitives are reusable, but it does not claim tested live job completion.

## Execution responsibilities

Deal Follow-up requires a selected installation, current verified open proposal, known contact identity, explicit cohort enrollment, matching conversation/source owner, approved sender, current Gmail reply/send coverage, confirmed policy and staffed operator. The generated follow-up is grounded in the approved scope. A current exact approval binds recipient, body, subject, proposal version, type, installation, expiry, reservation and policy version through SHA-256. Current source, suppression, takeover, pause and budget checks still run at dispatch. Any reply stops follow-up; automatic replies and bounces are distinct from human replies. Uncertain writes preserve the contact reservation and require provider reconciliation without a blind retry.

Appointment Coordinator receives a positive reviewed handoff and proposes an explicit UTC time plus IANA zone on the approved calendar. The action is separately approved and rechecks current availability, duration, working hours and capacity before submission. A confirmed Calendar booking ends chasing. It never implies attendance, signed terms, completed delivery or payment. Human takeover and suppression apply to both specialists.

The fixture's reviewed standing-mandate test uses the fixed `factual-followup.v1` template, exact approved scope, enrolled contact IDs, recipient domains, policy version, expiry, action/count limits and spending limit. Arbitrary model content cannot opt itself into that mandate. Production SQL017 binds a retained immutable standing mandate only to that exact factual template and current sender/cohort/contact/policy/scope/count/cost authority. It checks the grant again before reserve/submission; a new commitment or booking retains separate review. Mandate creation/administration requires a separately reviewed authorization path; no public client can grant itself a mandate. The SQL mandate suite is authored but has not run on hosted PostgreSQL.

## Nine bounded preparations

All nine use the same approved captured website snapshot and confirmed structured facts. The no-cloud implementation produces deterministic, source-grounded templates; it does not call or pretend to call a model. The production workflow uses the selected model adapter for eight preparations to choose among confirmed fact IDs and fixed framing; unsupported facts/copy cannot become an artifact. Technical page checks do not invoke a model. SQL008 reserves workspace/global/day budget before inference and retains unknown cost conservatively. This real-adapter code is covered through offline ports; no actual model request or hosted scheduled execution has been verified. Captured dates and source references are saved with each artifact. Unconfirmed facts fail before creation. Each installed preparation defaults to one saved artifact per day; repeated runs hit a meaningful limit, and workspace pause blocks new runs. Saved artifacts and last preparation dates survive subsequent commands. A preparation never imports a provider write operation.

| Specialist | Declared artifact | Scope boundary |
| --- | --- | --- |
| Account Intelligence | WebsiteProfile | Approved company/offer/audience facts and explicit hypotheses; not a prospect list |
| Technical SEO Monitor | CapturedPageAudit | Captured titles, descriptions and readable-text coverage; no complete crawl or indexing claim |
| Search Growth | ContentBrief | Outline and evidence needs; no invented search demand |
| Creative Performance | AdCopyConcepts | Copy and proposed angles; no image/video or campaign launch |
| Landing Page Optimizer | PageCopyHypothesis | Copy, hypothesis and missing baseline; no deployment or uplift claim |
| Social Content Publisher | SocialDraft | Outline/draft; no account publishing |
| Video Script Producer | VideoScript | Script, storyboard and shot list; no rendered video |
| Local Search Manager | LocationChecklist | Confirmed locations or explicit request for them; no listing changes |
| Website Sales Concierge | FaqDraft | Grounded FAQ and qualification questions; no deployed chat |

Definition metadata specifies capabilities, triggers, stop conditions, task/tool allowlists, output type, capacity, dependency, fallback, metrics and evaluation cases. Daily scheduling persists the installation next-due time and deduplicates an unchanged source signature before another model call; a green scheduler alone must not mark a preparation successful. Real website capture, model access where enabled, and deployed scheduled execution require their own validation.

Local evidence: `pnpm exec vitest run tests/domain.test.ts` includes all nine saved outputs, limits, no external writes, missing facts, pause, 32 unique identities, five slots, aliases, applicability and deduplicated prerequisites. These are fixture/unit checks, not Google or hosted scheduler verification.
