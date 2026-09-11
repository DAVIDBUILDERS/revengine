# DAVID Engine Vercel and Supabase master build prompt

Version 3 for the DAVID AI implementation team using Astra

Implement DAVID Engine with Next.js on Vercel and managed Supabase. This is a complete, standalone specification. It replaces the earlier AWS stack and requires no Docker, local containers or self-hosted services in development, testing or deployment. Preserve the five-specialist product experience while building a reliable shared foundation and the first verified customer workflow. Start with DAVID AI and Google Workspace.

Deliver working code and evidence of what has been tested, then complete the product coverage and migration requirements before replacing any existing experience. This specification distinguishes an internal demonstrator, a bounded live pilot, and a release with verified product coverage. The approximate ten-working-day target applies to the demonstrator and bounded pilot; it does not promise full migration or 32 autonomous integrations in that period. No earlier prompt or conversation is required to implement this document.

## 1 Your assignment and working behavior

Act as the accountable principal engineer implementing DAVID Engine. Build the product in the available repository, including application code, database migrations, integrations, versioned platform configuration, automated checks, and operating documentation. Continue through the implementation sequence; a plan, mockup, collection of interfaces, or infrastructure diagram alone does not complete the assignment.

Inspect the intended repository and its applicable instructions before editing. Preserve unrelated work. First inventory any supplied v13 source, database migrations, tests, runtime configuration and design assets. The CEO conversation reports a Sites dashboard and a Netlify runtime named david-ai-runtime, nine scheduled preparation agents, and a v13 release. Those are reported capabilities to verify; a chat statement that tests passed is not reusable test evidence.

The historical bmdoyle/ads PR and dashboard URL do not establish source access. If the current source is unavailable, record the exact handoff needed and build the Vercel and Supabase foundation in an isolated project. Do not claim a migration or feature-equivalence review has been completed. If the source is available, reuse verified domain logic, schemas, components and tests where appropriate. Follow the relevant hosting/repository instructions when handling a Sites-managed project. Do not overwrite the existing deployment or silently discard useful behavior.

Use current official documentation for the SDKs and services actually selected. Pin compatible stable dependencies and a supported Node LTS release in the repository and lockfile. Record material choices in short architecture decision records. Resolve routine implementation details yourself within these requirements. Surface contradictions or missing capabilities precisely rather than silently weakening the specification.

Proceed with reversible code changes, local development, tests, and deployment configuration. Use existing session authorization for subsequent actions. Before a cloud deployment, establish the actual Vercel team/project, Supabase organization/project, regions, environment, spending authorization and deployment authority. If these are unavailable, finish the code, deployment plan, cost assumptions, and commands that can be reviewed. Do not fabricate credentials, deploy into an unrelated account, or substitute another hosting stack.

Real outbound communication requires an explicitly enrolled cohort, approved sender, current permissions, and the product's live activation record. Access to a mailbox is not blanket permission to contact every person in it. Do not send messages or create real appointments merely to make a demonstration look complete.

Maintain docs/IMPLEMENTATION_STATUS.md as durable project context: decisions, completed components, commands run, evidence, unresolved dependencies, and the next executable step. Also maintain docs/PRODUCT_ALIGNMENT.md with each required behavior, its reported legacy state, verified source/test evidence, target-platform implementation status, owner and release milestone. If context is exhausted, resume from these records. Report implementation, local verification, Vercel/Supabase verification, Google verification, live business use and migration readiness separately.

## 2 Product objective and release scope

DAVID Engine is a managed business execution platform. The current product is five specialist responsibilities selected from a 32-specialist catalog for $5,000 per month, with shared company context, coordination, permissions, reporting and strategy included. The early six-agent package and Pulse plans are historical and outside this implementation. Clients choose outcomes, grant access, approve meaningful boundaries and inspect results; DAVID handles configuration and operational follow-through.

An agent is a versioned responsibility implemented through bounded workflows and shared tools. A customer installation binds that definition to sources, policies, capacities and an outcome model. Each capability has a declared mode: preparation, monitored execution or bounded autonomous execution. Catalog visibility, scheduler health, source access and verified business execution are different facts.

The product experience must support goal-based five-specialist recommendations with manual selection, guided activation, an executive homepage, a shared customer timeline, opportunity and strategy decisions, saved forecast scenarios, delivery economics and an isolated public sales demonstration. Section 14 makes these requirements concrete. The 32 entries do not imply 32 implemented integrations.

The first live customer is DAVID AI. Implement Proposal Follow-up as the B2B-services playbook of Deal Follow-up, plus an Appointment Coordinator handoff. Reuse the same primitives for later home-service Estimate Recovery. Do not create an extra commercial slot because a responsibility has a different vertical playbook. Keep organization IDs, offers, stages and contact rules out of shared execution code.

The first journey begins with an eligible open proposal, prepares approved follow-up, recognizes replies, coordinates a sales conversation and records observed outcomes. It cannot change pricing, scope, terms, discounts or delivery commitments without specific approval. The pilot follows existing proposals and does not generate contracts. Bookings are verified through Calendar; held-meeting status requires separate attendance evidence or an explicitly labeled confirmation from the responsible person. A home-service estimate-to-completed-job journey belongs in the demo and a later live release with the required job records.

Preserve or implement the nine bounded preparation capabilities in section 9 as part of target-platform product coverage. They can prepare work from approved website information without ad, CRM or publishing credentials; they cannot perform external account actions until those specific capabilities are implemented and verified. Port validated existing implementations; otherwise implement their narrow preparation versions and test them. They are additional to the two execution responsibilities, not a substitute for their working end-to-end journey.

The initial provider is Google Workspace. Permission status, the actual proposal source, payment source and operator assignment remain unknown. No existing Vercel or Supabase project is assumed available; verify ownership and configuration before use. Build the demonstrator and bounded live pilot first, targeting approximately ten working days subject to staffing and access. Continue through the remaining product coverage work. Full replacement of the existing dashboard requires the separate migration gate in section 21; defer a deadline claim until source and access assessment.

## 3 Vercel and Supabase boundary and concrete stack

Use Vercel for the application, HTTP endpoints, durable workflow execution and scheduled dispatch. Use hosted Supabase for PostgreSQL, application authentication, private files and protected connection secrets. Google Workspace remains an external customer system requiring its own API/OAuth configuration. Model inference uses a configured provider through Vercel AI Gateway. Vercel and Supabase do not replace the model provider or grant Google access.

Do not create Dockerfiles, Compose files, container-based CI services, an ECS worker, a local Supabase stack or an AWS account dependency. Provider-managed internal infrastructure is outside this restriction; DAVID's engineers should not operate it. Existing Sites/Netlify work is a potential reuse and migration source, not the target hosting requirement. Preserve any active installation until an authorized cutover.

| Responsibility | Selected implementation | Initial boundary |
|---|---|---|
| Web application and API | TypeScript, Next.js App Router on Vercel using the Node runtime | One modular app; route handlers and server actions call shared domain services |
| User interface | React, Tailwind CSS, accessible shadcn/ui primitives and shared DAVID theme tokens | Follow section 14; preserve verified brand assets and useful existing components |
| Durable agent execution | Vercel Workflows with the compatible pinned Workflow SDK | Short steps, durable waits, authenticated resumptions and bounded retries |
| Schedules and dispatch | Vercel Cron invoking a protected dispatcher; transactional outbox and due-work records in Supabase | One scheduling owner; catch up after missed ticks and deduplicate repeated starts |
| Relational data | Managed Supabase PostgreSQL with versioned SQL migrations | RLS, tenant-aware constraints and explicit atomic operations |
| User identity | Supabase Auth with its supported Next.js SSR integration | Invite-based membership, application-owned roles and operator MFA |
| Files and artifacts | Private Supabase Storage buckets | Authorized uploads/downloads, evidence references and retention rules |
| Provider tokens | Supabase Vault behind restricted database functions | Connection-bound reads, revocation and refresh coordination; never browser-readable |
| Model access | Server-side AI SDK adapter through Vercel AI Gateway | Explicit model/provider configuration, semantic validation and cost caps |
| Live dashboard updates | Supabase Realtime where useful, with authenticated read policies | UI notification only; database reconciliation remains authoritative |
| Build and delivery | pnpm, Vercel Git deployments, vercel.json, Supabase SQL migrations and Node-based CI | No container tooling; explicit migration-before-promotion sequence |
| Monitoring | Vercel runtime/workflow observability, Supabase logs and DAVID's persisted audit/usage records | Provider logs assist debugging; retained business history lives in DAVID tables |

Vercel Workflows provides durable execution and external-event waits through functions and managed persistence. Individual steps still have function runtime limits. Verify the SDK release, Next.js integration, account availability, plan limits and actual deployment behavior before the live pilot. Use a supported stable release where it meets the requirements; do not silently adopt a prerelease for an unnecessary feature. [Vercel Workflows](https://vercel.com/docs/workflows) [Workflow limits](https://vercel.com/docs/workflows/pricing)

Do not add Inngest, Trigger.dev, Temporal, Redis, a separate queue vendor or a continuously running worker by default. Supabase Edge Functions are not the durable runtime for this release. A function's background-task API is not permission to run an agent indefinitely. If a verified platform limitation blocks a required workflow, keep the code runnable, document the precise limitation and complete the remaining work before proposing an architecture change.

Choose a Vercel plan suitable for commercial operation and the required scheduling frequency. Select a Supabase plan with appropriate availability, backup and capacity settings. Do not claim free-tier limits meet the live pilot. Record actual regions for app compute, workflow state, database, files and model processing; they are not automatically identical. Place compute near the database where supported without misrepresenting data residency.

Astra is the implementation assistant. Select the production model separately through configuration and verify its actual availability. Subscription billing is outside this pilot; record entitlements internally. Prospect follow-up uses the authorized Gmail account. Product/authentication emails require a configured supported delivery provider when that login or notification method is enabled; Supabase's default email service is not a commercial delivery commitment. No custom model training or vector database is required.

## 4 Implementation boundaries and repository organization

Use a modular monolith with Vercel-hosted workflow entrypoints and steps. Domain rules must not depend on Next.js request objects, Google SDK shapes, Supabase client objects or workflow-hook payloads. Keep those details inside adapters. Share runtime validation schemas across API, workflow steps, fixtures and UI.

Recommended directories are apps/web, apps/demo, packages/contracts, packages/domain, packages/db, packages/connectors, packages/agents, packages/orchestration, packages/ai, packages/ui, packages/observability, supabase/migrations, supabase/tests, scripts, tests and docs. Put workflow entrypoints in the location required by the pinned Next.js/Workflow integration. apps/demo is a separate Vercel project with no operational routes or credentials. The packages are logical modules rather than separate deployed services. Use pnpm workspaces and Zod schemas.

Implement one shared action service as the only path to external writes. Enforce the module boundary through dependency rules and tests. API routes, models and agent definitions cannot import a raw send/book method. Read adapters may retrieve authorized evidence. Only the action service obtains the provider operation needed for a checked action.

Keep the database schema in SQL migrations and generate compatible TypeScript types. Do not mix unrelated ORM schemas with conflicting definitions. Use database transactions or narrowly scoped SQL functions for atomic multi-record operations; a series of independent supabase-js requests is not one transaction.

Avoid a general-purpose visual workflow builder and arbitrary user-provided code. Support versioned definitions checked into source control and validated workspace configuration in PostgreSQL. The pilot should remain understandable to an engineer tracing one proposal.

## 5 Shared contracts that must exist before parallel implementation

Create executable schemas, example payloads, and semantic documentation for the following records. Use stable UUIDs, UTC timestamps, IANA time zones, explicit currency, and integers representing minor currency units with safe serialization. Distinguish unknown values from zero. Store relevant source values alongside normalized values.

| Contract | Required meaning |
|---|---|
| WorkspaceContext | Verified actor, membership, role, selected workspace, environment, and permitted operations |
| ConnectionCapability | Provider identity, authorized resource, scopes, available operations, health, freshness and source ownership |
| OpportunityRecord | Stable opportunity/contact/account IDs, business-model type, owner and stage with provenance |
| ProposalRecord | Linked opportunity, version, date, validity, amount/currency, approved scope summary, source link and authoritative status |
| AgentDefinition | Versioned responsibility, capabilities, triggers, output schemas, bounds, fallback, metrics and evaluated applicability |
| AgentInstallation | Workspace binding, definition version, source mappings, policy references, capacities and readiness |
| SourceEvent | Verified connection binding, source/event/entity IDs, occurred/received times, version, correlation and evidence reference |
| ReadinessResult | Separate integration, action and measurement readiness, individual blockers, freshness and fallback |
| ActionProposal | Stable action ID, installation/run, recipient/target, type, immutable payload hash, evidence, approval and cost reservation |
| ActionReceipt | Not attempted, submitting, provider accepted, confirmed where supported, failed or uncertain; provider IDs and reconciliation status |
| OutcomeObservation | Metric definition/version, stage, source, period, value type and evidence quality |
| BriefSnapshot | Immutable as-of metrics, evidence, limitations, decisions, commitments and narrative version |
| TeamRecommendation | Goal, business archetype, candidate specialists, rationale, dependencies, applicability and implementation mode |
| ActivationPlan | Selected team, deduplicated prerequisites, provider/owner, capability unlocked, validation evidence and next step |
| WorkOpportunity | Observed condition, affected business IDs, evidence, hypothesis, proposed assignment, effort/cost, owner and evaluation rule |
| PreparedArtifact | Type, source snapshot, factual inputs, generated content, review state and capability/run version |
| ForecastScenario | Versioned funnel, assumptions, currency, capacity, time horizon, base/low/high cases and comparison period |
| RuntimeHealth | Component health, observed time, last successful business action, last preparation result and actual coverage |

An ActionReceipt must not equate email API acceptance with recipient delivery. Outcome stages such as booked, attended, signed, completed, invoiced and paid are different. Proposal value may mean a one-time fee, recurring monthly value, or total contract value; identify it before aggregating. Never sum different currencies or recurring and one-time values without an explicit conversion/normalization policy.

Define Opportunity stage, Proposal status, Run status, Action status, Approval status and Installation status separately. Examples of proposal statuses are open, accepted, declined, on_hold, expired and unknown. Unknown is not eligible. Keep provider-specific raw stages and validated mappings. A new source-specific status must trigger review, not a guessed mapping.

An event triggers retrieval and evaluation; its text does not grant authority. Use schema versions and compatibility checks. Validate all queue/API/model inputs at the boundary. Reject invalid enums, malformed IDs, unsupported action types and unknown versions with explicit errors.

## 6 Supabase data access and tenant isolation

Implement only tables needed for the working release, while documenting extension points. Core groups include workspaces and memberships; connections and source bindings; source/entity mappings; contacts, accounts, opportunities and proposal versions; policies and installations; team recommendations and activation prerequisites; work opportunities, initiatives and assignments; runs, actions, approvals and receipts; conversations and appointments; prepared artifacts, evidence and outcomes; forecast scenarios, usage, interventions and brief snapshots; outbox, inbox deduplication, dispatch leases and wait registrations. WorkOpportunity is a finding, not another deal to add to pipeline totals.

All tenant-owned records carry workspace_id. Use tenant-aware foreign keys and uniqueness constraints so a record cannot reference another workspace's contact, source, approval or evidence. Normalize contact identities conservatively; names and similar email addresses alone cannot establish identity.

For user-facing queries, use a request-scoped Supabase client carrying the verified user's access token. RLS must check current membership and allowed operations, not trust a workspace ID from the request or user-editable metadata. Enable RLS on all exposed tenant tables, restrict grants by operation and protect views as well as tables. Roles and grants belong in migrations. Customer-facing credentials must not directly update approvals, entitlements, audit records, action receipts or dispatch state. Expose only the checked mutation path. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

Use SQL functions for atomic user mutations such as an approval plus its outbox event. Prefer security-invoker functions. Where a narrowly scoped security-definer function is necessary, fix search_path, qualify objects, revoke default public execution, validate auth.uid(), current membership and role, and grant only the required operation. Do not expose generic SQL execution or a privileged function that accepts an arbitrary workspace and trusts it.

Background steps use a restricted custom PostgreSQL role through a server-side database adapter. It must not own tenant tables or have BYPASSRLS. Bind workspace and run context from verified routing records, set the checked context transaction-locally and finish the transaction before releasing the connection. A dispatcher may read narrow routing metadata through a separate role or function; it does not need all customer content. Do not place the migration/admin database credential in the normal web or workflow runtime.

Use the Supabase transaction pooler for suitable short-lived serverless SQL connections, with a small bounded client pool, connection timeouts, verified TLS and compatible query settings. Do not rely on session-persistent tenant settings or named prepared statements in transaction mode. Use the supported direct or session connection for migrations when required. Copy actual connection details from the project; do not derive hosts from a region name. [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres)

Supabase secret keys and legacy service_role keys can bypass RLS. Keep any necessary admin client isolated to explicit server-only tasks such as authorized invitation management; it is not the default tenant query client. Every such task requires application authorization and audit. Test both the normal RLS path and privileged wrappers. A successful test performed only as an admin does not establish tenant isolation.

Keep tokens, outbox internals and private operational tables outside browser-exposed schemas. Authorize every evidence download and use private Storage buckets with policies that match workspace membership. A folder prefix alone is not authorization. Issue short-lived download URLs only after checking access; do not share authenticated responses through CDN caches. [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)

Use Realtime only for authorized updates to customer-visible read models. Do not stream tokens, raw outbox messages or operator-private notes to clients. A reconnect refetches authoritative state; a missed Realtime event cannot cause a missed business action. Start with ordinary polling if it makes the first workflow simpler.

Parameterize queries. Models cannot generate executable SQL or choose secret references. Use append-only audit records with restricted mutation privileges, correction events and explicit retention/deletion procedures. Current-state tables plus auditable history are sufficient; full event sourcing of every entity is unnecessary.

## 7 Identity and application authorization

Use Supabase Auth and its supported @supabase/ssr browser/server clients for Next.js. Validate identity server-side using the documented verified-claims path; use an up-to-date Auth user lookup when needed for a sensitive action. Do not authorize based only on getSession(), a decoded but unverified JWT, or client-supplied role metadata. Check current database membership for the selected workspace. Keep authenticated content out of shared caches. [Supabase SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client)

Use the SSR library's supported cookie refresh behavior. Configure secure cookies, appropriate SameSite behavior, CSRF/origin checks and strict redirect allowlists. Do not invent an HttpOnly-only session design while also expecting a browser Supabase client to refresh the same session. Customer Google integration tokens are different credentials and remain server-only; never put them in client cookies, localStorage, public environment variables or workflow payloads.

Start with workspace_owner, workspace_member, workspace_viewer and david_operator roles. Operators receive explicit workspace assignments, not access to every customer. Record role changes and elevated access. Enforce MFA assurance for operator actions in deployed use, including checks that cannot be bypassed by a direct API request. An email domain match alone cannot provision privileged membership. Keep invitations controlled for the pilot.

DAVID login and Google Workspace integration authorization are separate flows even if the customer signs in with Google. Connect a Google account through a dedicated server-side OAuth route bound to a signed-in authorized actor, workspace and one-time state record. Verify redirect URI, state, expiry, PKCE where supported and returned Google identity. The callback cannot select a workspace from an unchecked query parameter. Supabase login-provider tokens are not a substitute for the integration connection lifecycle.

Use Supabase Vault for per-connection refresh/access tokens. Store only the Vault reference and connection metadata in ordinary tables. Revoke broad access to decrypted-secret views and expose a narrowly scoped server-only function that checks the current workspace/connection binding and allowed operation before returning one secret. The generic database query layer cannot enumerate secrets. Serialize refresh operations with a lease, retain updated tokens atomically and implement disconnect, revocation and reauthorization. [Supabase Vault](https://supabase.com/docs/guides/database/vault)

Application credentials belong in environment-scoped Vercel secrets. Keep Supabase administration and deployment credentials separate from runtime roles. Do not return credentials from workflow steps: workflow inputs, outputs and errors may be retained in platform logs. Retrieve and use a token inside a bounded connector operation, returning only safe IDs or status.

A fixture identity is allowed only in explicit local/test mode with no real accounts. Startup rejects it in cloud operational deployments. Customer workspaces and staff controls use real Supabase Auth in deployed environments. The public sales demo may use anonymous synthetic sessions in its separate project; those sessions cannot assume an operational membership or receive production credentials.

## 8 Google integration and source ingestion

Implement real Google adapters and a distinct fixture adapter. Report which operations have been tested against Google. The absence of credentials must not stop local implementation, but a fixture result cannot mark a real connection healthy.

Read a selected Google Sheet through validated resource binding. Prefer per-file authorization using Google Picker and drive.file when the required operations support it. Do not assume pasting a URL grants access to an arbitrary file. If a different scope is required, explain its actual reach and obtain the appropriate grant. Bind selected file ID, tab/range, mapping version and source owner. Preserve customer-owned columns and the original file.

Google describes drive.file as access to files created or opened/shared with the application. This is narrower than general Drive access, but still requires correct selection and endpoint verification. [Google Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)

For Gmail, store drafts in DAVID first. Use the minimum scopes needed for send and relevant reply retrieval; verify gmail.send and gmail.readonly against the implemented operations. Reading Gmail is restricted access, and app-side filtering does not turn a mailbox-wide OAuth grant into a per-thread grant. Process and retain only the enrolled conversations and relevant history. Do not index entire employee mailboxes by default. [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)

For Calendar, bind the approved calendar, meeting types, duration, working hours, buffers and time zone. Choose scopes for the exact availability and event operations; reject unsupported shared-calendar permission combinations. Recheck availability immediately before booking. Use a stable provider-compatible event ID or reconciliation key where supported. Never claim protection against conflicts on unconnected calendars.

Start with Vercel Cron scheduling bounded source-reconciliation workflows. Gmail native push requires Google Cloud Pub/Sub, so use polling initially without adding that infrastructure. Implement history/cursor handling, pagination, rate-limit backoff, expired-history recovery and checkpoint persistence. Polling frequency is configurable and bounded by actual quotas; before sending, refresh relevant message and proposal state. Do not promise instantaneous reply detection. [Gmail push requirements](https://developers.google.com/workspace/gmail/api/guides/push)

The Google access spike must determine organization ownership, internal versus external audience, enabled APIs, scopes, consent configuration and administrator approval. An internal-only DAVID app may qualify for Google's documented exception; customer organizations require a separate readiness assessment. External Testing-mode refresh tokens have a limited lifetime for the required non-basic scopes. Implement reauthorization state and avoid treating test-mode access as a durable commercial setup. [Google verification requirements](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) [Google OAuth token behavior](https://developers.google.com/identity/protocols/oauth2)

Provide CSV bootstrap with a field-mapping preview and row-level validation. Required fields include stable IDs, current status, owner, selected contact channel, proposal version/reference, validity where applicable, and approved factual scope. Reject unknown statuses and identity conflicts; preserve raw values and import provenance. Support repeat imports without duplication. A missing row in an incomplete export is not a deletion or a win.

Use a local fixture clock to test stale data. Distinguish time of synchronization from time a human last verified the business fact. A CSV can power analysis and drafts; sending requires an approved fresh batch plus current reply, suppression and status coverage. Schema drift or stale critical fields must block affected actions while leaving unrelated safe work available.

Where proposal documents are needed, support explicitly selected accessible documents or an approved factual scope summary in the source record. A link alone is not evidence that its contents were read. Keep document parsing bounded. Do not expand the sprint into a universal crawler or arbitrary file-execution system.

## 9 Company context policies and agent registry

Store structured company facts and their sources separately from instructions, inferences and approved decisions. Initial context includes business model, offers, customer types, sales cycle, time zone, operating constraints, approved wording and forbidden claims. Website-derived suggestions remain unverified until confirmed. Only retrieve context relevant to the current authorized task.

Store reviewed agent definitions and playbook schemas in source control. Store workspace installations and configuration in PostgreSQL. Generate catalog descriptions, readiness requirements and controls from the same definitions to reduce drift between promises and implementation.

Every agent definition must specify its responsibility, version, supported archetypes, required input capabilities, triggers, allowed tasks, tool names, output schemas, action prerequisites, stop conditions, capacity units, dependencies, failure modes, escalation route, outcome definitions and evaluation cases. Prompt text alone is not an agent definition.

Effective authorization is the intersection of platform restrictions, organization policy, installation permissions, initiative bounds and the applicable approval or standing mandate. A more permissive prompt cannot override a prohibition. Evaluate hard eligibility before prioritizing work. Source documents, email bodies and model responses cannot modify policy or enable capabilities.

A standing mandate is a reviewed, versioned authorization for a defined action class, eligible cohort, channels, templates/content constraints, capacities, budget and time period. Record its grantor and revocation state. It can permit routine actions without another per-message approval only when all current conditions pass. Start live pilot communication with per-action review unless a bounded mandate is explicitly granted. New terms, recipients outside the cohort or broader spending require new authority.

Implement configurable working hours, follow-up spacing, eligible stages, source freshness, contact frequency, sender, spending ceilings, action approval and escalation ownership. Use explicit units and validation. Live settings require confirmation; fixture examples may have illustrative defaults that never silently become live authority. Policy changes create a version and an audit record. Broadening permissions requires an authorized approver.

Create real definitions for the Proposal Follow-up playbook and Appointment Coordinator, then preserve or implement the nine preparation capabilities below. Generate the full 32-entry catalog from versioned metadata with explicit capability and release status. Preparation and execution may share a specialist ID but must have distinct prerequisites, permissions, evidence and operating modes. Do not activate unavailable actions merely because a user selected a card.

Use these 32 catalog responsibilities from the agreed product discussion, matching stable identifiers to verified existing code where available:

- Find demand, 7: Account Intelligence, Buying Signal Scout, Outbound Email SDR, LinkedIn Outreach Assistant, Partner Development, RFP Opportunity Scout, Competitor Intelligence.
- Create demand, 9: Search Growth, Technical SEO Monitor, Local Search Manager, Creative Performance, Paid Campaign Operator, Landing Page Optimizer, Social Content Publisher, Video Script Producer, Product Merchandiser.
- Convert demand, 5: Speed-to-Lead Responder, AI Receptionist, Website Sales Concierge, Appointment Coordinator, Lead Qualification.
- Close revenue, 5: Proposal Operations, Deal Follow-up, Sales Call Coach, Estimate Recovery, Revenue Experiment Manager.
- Retain and expand, 6: Abandoned Cart Recovery, Lifecycle Email Manager, Customer Win-back, Expansion Opportunity Scout, Renewal and Retention, Review and Referral Manager.

Maintain aliases for earlier names: Account Prospector to Account Intelligence; SEO Content Writer to Search Growth; Ad Creative Studio to Creative Performance; Proposal Builder to Proposal Operations. Proposal Follow-up is a Deal Follow-up playbook. Do not break persisted IDs or create duplicate slots during renaming. Validate actual legacy mappings before importing installations. LinkedIn remains preparation with human sending. Commerce specialists are not applicable to DAVID unless a real commerce workflow exists.

The CEO conversation reports these nine preparation modes. Treat the descriptions as bounded requirements and verify actual existing behavior before reuse:

| Specialist | Preparation capability | Boundary before connected execution |
|---|---|---|
| Account Intelligence | Extract offer and positioning facts from approved website pages with source links | Website profiling is shared context; this alone is not a sourced prospect list |
| Technical SEO Monitor | Check captured pages for titles, descriptions and readable content | Report crawl coverage; do not claim complete indexing or ranking analysis |
| Search Growth | Prepare content briefs grounded in the business and captured sources | Search demand figures require actual search data; publishing needs a CMS capability |
| Creative Performance | Prepare ad-copy concepts and test angles | Copy is not a generated image, video or launched campaign |
| Landing Page Optimizer | Prepare page copy and a proposed hypothesis | Deployment and measured uplift require publishing and measurement capabilities |
| Social Content Publisher | Prepare post outlines and drafts | Account publishing remains a distinct permission and implemented operation |
| Video Script Producer | Prepare scripts, storyboards and shot lists | Do not label scripts as rendered video |
| Local Search Manager | Prepare a location setup checklist from confirmed business facts | Listing changes require verified locations and supported account access |
| Website Sales Concierge | Prepare FAQs and qualification questions | A draft FAQ is not a deployed live chat or automatic sales handoff |

Use a bounded shared website capture and factual extraction service. Reuse source snapshots across these preparations, record fetched pages and dates, require confirmation of important company facts and avoid repeated crawling on every agent run. Do not submit lead forms, impersonate buyers, contact competitors or execute page-provided instructions. Implement URL validation, redirect/DNS checks, crawl limits, parser limits and clear inaccessible-source states.

Scheduled preparation uses the same budgeted job, artifact, approval and audit infrastructure as other internal work. Provide real saved outputs, retries, daily limits, pause/run controls and last successful result. Define a meaningful cadence and avoid generating nine repetitive documents merely to animate the dashboard. Missing source data or model access produces a blocker. Source artifacts, model generation and business outcomes stay visibly distinct.

## 10 Proposal Follow up and Appointment Coordinator

Proposal Follow-up consumes an existing proposal linked to an opportunity and contact. It retrieves current status, owner, communication history, approved scope, policies, source freshness and remaining capacity. It identifies eligible work, drafts a factual follow-up, requests approval as configured, submits through the action service, watches for changes, and ends or hands off appropriately.

Stop on any reply for the initial pilot, then classify it for the next permitted step. Opt-out, acceptance, decline, expiry, on-hold status, complaint, human takeover, stale critical information, pause and exhausted capacity prevent subsequent automated follow-up. A positive reply is an opportunity for a checked handoff; it is not proof of a signed contract.

Identify delivery failures and automatic replies separately from human responses. A bounce or out-of-office message is not a positive conversation. A delivery failure blocks further contact to the affected address until reviewed; an automatic reply follows the pilot's conservative stop-and-review behavior rather than launching a scheduling exchange.

Escalate ambiguous replies, negotiations, legal terms, unusual requests and conflicting source evidence. No fabricated urgency, invented testimonial, discount or commitment. If several proposals target the same person, resolve ownership and the appropriate proposal before contact. Include pending and recent human actions in the contact check where coverage exists.

Appointment Coordinator receives a structured authorized assignment with purpose, contact, owner, allowed calendar and source conversation. It offers valid times or processes a clear requested time, obtains required confirmation, books, and records the provider result. Confirmations, cancellations and rescheduling must remain under the same ownership and suppression rules. Technician dispatch and delivery scheduling are outside this pilot.

A calendar event proves a booking. Attendance, proposal acceptance, delivery completion and payment require their own evidence. If booking access is missing, prepare a human handoff and show the limitation. Where an uncertain time could lead to a wrong booking, request clarification instead of guessing.

## 11 Durable execution and external actions

Use Vercel Workflows as the production durable workflow engine. Keep orchestration replay-safe; perform database, model and provider I/O inside bounded steps. Use the pinned SDK's supported durable sleep and hook primitives for delays and approvals. Do not hold an HTTP request open, run an infinite loop, or depend on setTimeout, after(), waitUntil or an unawaited promise for multi-hour work. Built-in step retries do not make external sends exactly once. [Workflow concepts](https://vercel.com/docs/workflows/concepts)

Persist a domain Run with its workflow-definition version, environment and installation before dispatch. Supabase stores business facts, approvals, action state and durable audit records. Vercel stores workflow execution state. Persist the association between the two, including the deployed code/SDK version. Provider observability retention is not the customer record-retention policy. Keep workflow inputs and outputs small: IDs, versions and protected references, not full documents or secrets.

Record a business change and its outbox event in the same database transaction. A protected dispatcher claims committed outbox entries with leases, starts or resumes the matching workflow, and records progress. Handle the crash between starting a workflow and saving its provider run ID: use a stable business-run key, and let the first step atomically claim ownership. Any duplicate workflow must exit or reconcile before a business effect. Do not assume the provider offers a start-idempotency option without verifying its API.

Use one authenticated Vercel Cron sweep to dispatch due work, retry pending outbox entries and reconcile abandoned leases in bounded batches. Keep per-workspace next_due_at and cursor state in PostgreSQL rather than creating a cron job for every customer. Vercel Cron is a wake-up signal, not the durable workflow: missed, duplicate or overlapping ticks must be harmless, and failed invocations need catch-up on later sweeps. Enforce concurrency in PostgreSQL; do not add Redis for locks. Verify schedule frequency and deployment behavior on the selected plan. [Vercel Cron operations](https://vercel.com/docs/cron-jobs/manage-cron-jobs)

For an approval, retain the pending business record before exposing its decision controls. An authenticated route validates the decision and commits it with an outbox event; a server-side adapter resumes the correct registered hook. The resumed step reloads the authoritative decision. Hook tokens are credentials, not a customer-facing approval mechanism. Support decisions received before hook registration, duplicate delivery, expired waits and recovery after a crash. A missing registration cannot discard a saved approval. A timeout becomes an operator-visible state.

Record workflow definition, SDK and deployment identities. Verify the selected SDK's supported deployment/version behavior and keep compatible handlers for in-flight work. Do not assume a redeploy, rollback or SDK upgrade migrates old runs. Keep waits bounded by business policy and document what happens if an old deployment becomes unavailable. Run a deployment-transition test before live use.

Split large synchronizations into checkpointed pages and bounded batches. Apply timeouts below each function's actual duration limit and per-workspace concurrency/cost caps. No expensive full crawl, large media render or indefinite provider stream belongs in one step. If interrupted before a checkpoint, replay the page idempotently. A workflow that was accepted or scheduled is not yet a completed customer action.

The action service must perform this sequence:

1. Authenticate the actor or internal command, bind workspace and installation, and validate action schema and entitlement.
2. Load current policies, source status, conversation ownership, suppression, relevant history and unresolved actions.
3. Check the applicable authority. When per-action approval is required, bind it to exact recipient, content hash, proposal version, action type, bounds and expiration. For routine work allowed by a standing mandate, record its version and validate every action against its current cohort, content constraints, capacity and expiry. A model cannot choose which approval regime applies.
4. Atomically claim the contact/action and reserve applicable capacity or spending. Concurrent invocations cannot independently claim the same permitted send.
5. Refresh required source information and recheck policy/pause immediately before committing dispatch. Record the transition to submitting before the network call.
6. Execute only the validated provider operation through its bound credentials.
7. Store the receipt and costs, settle reservations, publish the outcome event and reconcile any uncertainty.

Approval does not bypass fresh status or suppression checks. Avoid database locks held across slow network calls; use persisted action states, conditional updates and fenced ownership. Define when an action becomes in-flight. A pause prevents new dispatch and cancels pending follow-ups; a provider call already underway may complete. Expose and reconcile that fact.

Gmail sending does not provide an application-wide exactly-once guarantee. Use a stable message identity and retained provider IDs for reconciliation. If a timeout could have occurred after acceptance, mark the action uncertain and inspect the sent-message evidence before considering another send. If evidence remains ambiguous, escalate. Do not put a blind automatic retry around every external write.

Make read retries, model retries and potentially non-idempotent write retries different policies. Add bounded attempts, timeouts, backoff, dead-letter recovery and an operator-visible reason. Duplicate starts, step restarts, workflow retries and hook-resume retries must not independently create another business action.

## 12 Coordination and human takeover

Maintain shared conversation ownership and a contact-level coordination rule for the pilot. All DAVID agents and confirmation routines use it. The owner is recorded alongside purpose, run, pending actions, lease/fencing information and takeover state. A second agent requests a structured assignment instead of independently deciding to contact the same person.

Human takeover persists until explicitly released. Incoming replies cancel obsolete timers. A confirmed booking ends appointment chasing; an active sales conversation blocks an unrelated reactivation sequence. Accepted or declined proposals stop their recovery work. A scheduling handoff changes responsibility deliberately; it does not leave both agents following up simultaneously.

Evaluate global pause and applicable suppression first, then human takeover, current conversation ownership and bounded workflow priority. An opt-out applies across the relevant commercial contact workflows. Necessary service communications require their own explicit policy; agents cannot relabel promotion as transactional mail to bypass suppression. Record the rule that allowed, stopped or handed off each action.

During onboarding, record other people, mailboxes and tools that contact the pilot cohort. Integrate their relevant activity, suspend their overlapping campaigns, or segment the cohort. DAVID cannot coordinate activity it cannot observe or control. Show the actual coverage and block enrollment where a critical conflict is unresolved.

An unknown operator is a live activation blocker, not a coding blocker. The pilot may operate outbound only during agreed staffed hours. Replies outside those hours still stop pending follow-up and queue for the assigned person. Do not promise 24/7 human response without staffed coverage.

## 13 Evidence outcomes and customer value

Use database queries over typed records for metrics. Models may explain calculations but cannot manufacture totals or financial outcomes. Every material metric links to a definition, source records, period, freshness and evidence quality.

Distinguish opportunity identified, action completed, business outcome observed, customer-reported outcome, attributed revenue and measured incremental contribution. Do not sum pipeline, signed proposals and payments as separate revenue. Store corrections, cancellations and refunds with the appropriate links.

If financial data is unavailable, show verified replies and bookings and label financial return unavailable. A person can confirm a proposal or payment with a reference and timestamp; display that as manually reported until independently reconciled. Missing payment data need not block an otherwise valid follow-up. Missing current proposal status, contact permission or reply handling can block it.

Record a baseline from available historical proposals, response timing, outcomes and staff effort. If the sample is small, say so. Do not infer universal win rates or claim causal lift from a before/after comparison. The first pilot demonstrates operational value and collection of evidence; external paid customers must later validate commercial value.

Track per-workspace and per-agent vendor cost, model usage, infrastructure allocation and recorded human time. Separate one-time setup from recurring delivery, and engineering R&D from customer support. Founder time is not free. Recovered staff minutes are capacity, not automatic payroll savings.

Use the same outcome read model for Today, the agent page, initiative detail and weekly brief. A result must not change meaning between screens. Use explicit metric stages and timestamps rather than decorative ROI counters.

Show pipeline, won business, collected revenue and gross profit as separate measures with their own sources. The customer value view includes the configured subscription fee, advertising spend, usage and relevant fulfillment costs once known. DAVID's internal delivery margin is a different view: subscription revenue less recorded delivery costs, with setup, recurring support and R&D separated. Missing inputs produce unavailable or partial results with visible coverage, never zero-cost assumptions disguised as profit.

Track activation duration, human intervention by reason, support time, successful outcomes versus attempts, reusable configuration and customer-specific engineering. Capture time with low-effort operator controls and allow corrections with a record of who changed them. This evidence informs whether a workflow stays in the repeatable subscription or needs separately scoped transformation work.

Implement saved planning scenarios for the product-coverage milestone. Use one shared funnel and count each person, opportunity or order once. B2B scenarios progress from reachable contacts/inquiries to qualified conversations, bookings, held meetings and wins. Home-service scenarios progress from inquiries or existing estimates to appointments, accepted jobs, completed work and collection. Separate new demand from recovery cohorts and resolve overlap before combining them.

Store editable assumptions, volume, conversion ranges, currency, spend, available business capacity and time horizon. Do not sum agent-specific lead estimates. Compare base/low/high cases against a stated baseline and later against observed outcomes; call them scenarios rather than statistical confidence intervals. Enforce conversion bounds, explicit zero-denominator handling and capacity constraints. A website alone supplies a preliminary profile, not a credible forecast. Any incremental ROI scenario needs an explicit counterfactual and cost basis; otherwise show observed or attributed measures without a causal claim.

## 14 Product experience guided activation and demo

Preserve useful verified v13 interaction patterns and design assets while implementing these requirements on Vercel and Supabase. The executive experience answers four questions in approximately 30 seconds: what improved, what is underway, what decision is needed and what is blocked. All important claims open their evidence or a specific next step.

Use DAVID's white, charcoal and restrained red direction. Put visual tokens in one shared theme. If verified brand tokens are unavailable, use these implementation defaults: canvas #F5F6F8, surface #FFFFFF, primary text #18191C, secondary text #626873, border #E0E4EB and primary accent #C42B2F. They are proposed defaults, not a claim about official brand specifications. Confirm contrast for each actual text/background pair; statuses also need text and icons. Use the supplied brand font when available, otherwise a system sans-serif stack with body text near 16 px, a clear type scale and tabular numeric metrics.

Use a consistent spacing scale of 4, 8, 12, 16, 24 and 32 px. Keep the desktop navigation compact, make the executive view single-column on small screens and reveal detailed evidence in a page or accessible drawer. Centralize button, field, card, badge, modal and table styles. Support keyboard navigation, focus management, reduced motion and readable errors. Define loading, empty, blocked, stale, failed and success states for every principal surface. Motion represents a real transition, not invented productive activity. Preserve confirmed brand decisions if they differ from the defaults above.

Guided activation follows this sequence:

1. Choose the business goal and confirm the business model, company facts and operating constraints. A URL can suggest a profile; the person confirms it.
2. Recommend a coherent five-specialist team using goal, source availability, capacity and applicability. Explain each role and the shared journey. Preserve manual selection and show dependencies, unavailable modes and coverage gaps. DAVID's first live pilot can activate fewer than five validated specialists without pretending the rest are implemented.
3. Generate a deduplicated prerequisite list for the selected capabilities: connection, required data, responsible person, capability unlocked and verification state. Reuse one authorized connection where applicable. Distinguish owner inputs from missing engineering integrations.
4. Let the DAVID operator map sources, inspect representative records and confirm current state. The customer supplies access and business decisions without constructing an automation graph.
5. Confirm sender, calendars, eligible cohort, operating rules, limits, approval authority and exception owner. Preview representative work and its evidence.
6. Complete and verify the first workflow at its allowed mode. Show whether that milestone was a preparation artifact, an authorized test action or a live business outcome. Activate additional execution only after its own readiness checks pass.

Integration readiness, action readiness and measurement readiness remain separate. Critical prerequisites are pass/fail gates; a weighted readiness score cannot overrule a missing permission. Preserve partially completed onboarding and identify who can resolve each blocker.

Implement these surfaces:

- Today: four sections named Results, Work underway, Decisions needed and Blockers. Show up to three priority decisions, current data coverage and source-linked outcomes. Every blocker has an owner and next step.
- Your team: the 32-specialist catalog, goal-based recommended five, manually selected team, dependencies, capability modes and real work status. Selected, installed and allowed to execute are different states.
- Activation: the prerequisite checklist, source validation, ownership, first-workflow milestone and resume path. Connected accounts alone do not mark unfinished capabilities ready.
- Opportunities: separate sales records from the opportunity inbox of work worth doing. A work finding carries affected records, observed condition, evidence, proposed action, responsible specialist, effort/cost, a justified impact range if available and a success rule. Old records are not automatically lost revenue.
- Decisions and initiatives: recommendation, alternatives, evidence, resource commitment, baseline, target, owner and review date. Approval creates tracked assignments; review compares actual outcomes with the original hypothesis.
- Customer journey: a shared timeline from source through relevant interactions, confirmed appointments, sales status and payment evidence. Identify DAVID actions, human actions and unknown stages. Clicking any result opens this view; several contributing specialists do not multiply the opportunity value.
- Scenarios: saved shared-funnel assumptions, capacity constraints, forecast cases and observed comparisons. Keep illustrative projections visually distinct from recorded outcomes.
- Connections: bound accounts/resources, capability checks, last sync, freshness, reauthorization and source owner.
- Operator console: assigned workspaces, runtime and provider health, mapping issues, uncertain writes, unhandled replies, intervention reasons/time, activation duration and delivery costs. It is an operational workspace as well as a failure queue.

For agent status, distinguish monitoring, scheduled, processing, awaiting approval, waiting for input/reply, connection expired, blocked, failed and paused. Show the last completed preparation and the last successful business action separately. A healthy scheduler does not mean agents produced outcomes. Monitor web, workflow steps, dispatch, Supabase, provider synchronization and model access independently. During transition, include legacy Sites and Netlify health only where an actual authorized probe exists; absent probes show unverified.

Owners can pause immediately and reduce limits. Resuming requires readiness. Increasing authority, changing sources/sender or swapping a specialist triggers validation and a controlled handoff, preserving context and unfinished work. A swap must not abandon a reply or restart an old campaign. Enforce five-slot entitlements and controls on the server. Shared context, strategy, reporting, suppression, health and coordination consume no slots. Preparation-only availability does not imply a full $1,000-per-specialist value claim has been proven.

Nine available preparation capabilities do not mean nine included commercial slots. Exercise all nine through separate tests or an explicitly provisioned internal evaluation entitlement. If verified legacy DAVID evaluation workspaces already exceed five installations, map that entitlement deliberately with an audit record; do not silently change the standard package or let a client grant itself an internal exception.

Build the sales demo as a separate Vercel project with synthetic scenarios, no operational routes and no credentials that authorize access to customer data or execution. If server-persisted demo state is needed, use a separate Supabase demo project; otherwise keep the illustrative scenario session-local. Do not give this deployment the production Supabase keys, Google tokens or workflow-resume authority. Anonymous demo sessions may explore the catalog, confirm a preliminary URL-derived profile, select a recommended five, adjust assumptions and reset. Keep all sample people, interactions and results clearly illustrative. Use isolated per-session state; resetting one session cannot affect another session or an operating workspace. Staff administration remains authenticated.

URL analysis in the demo is bounded public-web retrieval, not customer-system access. Apply SSRF protections, source and model quotas, per-session limits, short retention and a global application usage ceiling. Permit only the restricted demo profile-generation operation; it cannot invoke arbitrary tools. If retrieval or generation is unavailable, explain it and offer a labeled preset scenario. Never manufacture a supposedly observed customer result or convert a sample contact into a live recipient. Public deployment still requires the normal target/environment authorization.

## 15 Strategy and weekly briefing

Include a small strategy lifecycle in the foundation: observation, hypothesis, recommendation, approval, initiative, execution and review. A recommendation must reference evidence and explain the next decision, expected effect under explicit assumptions, required commitment, owner and evaluation date. It must be able to say that required information is missing.

The first strategy implementation uses reviewed rules for this workflow: neglected eligible proposals, delayed responses, missing next actions, overloaded meeting capacity and unresolved status updates. Evaluate eligibility first, then prioritize findings using the workspace goal, business model, relevant volume, capacity, effort and evidence quality. Keep scoring criteria and rule versions explainable. Universal ranking weights across all industries are not required.

A work finding can become a recommendation; an approved recommendation becomes an initiative with bounded assignments. Routine actions already covered by a current mandate can proceed within that authority. A new price, offer, commitment or budget increase beyond it requires an explicit decision. Record alternatives including waiting, required resources, baseline, target, owner and review date. At review, record what changed and whether the hypothesis was supported. Insufficient volume or missing results remain inconclusive.

An LLM can articulate the finding and alternatives. Do not implement open-ended autonomous consulting, fabricate industry benchmarks or infer delivery margin from email activity. Capacity or margin strategy requires the corresponding operational data. The opportunity inbox must be useful when information is incomplete by asking for a specific missing observation, not by inventing urgency.

Generate a weekly BriefSnapshot after reconciliation. It contains verified results, incomplete or failed work, the current constraint, up to three decisions, and the next commitments. Urgent opt-outs and failures are handled when detected, not deferred to the weekly run. Narrative claims reference the frozen metrics used to produce them.

Video is optional after the core pilot works. First ship the concise visual weekly brief from a saved BriefSnapshot. If HeyGen or another media API is later selected, use an asynchronous request plus authenticated callback/reconciliation workflow and store the authorized final asset in Supabase Storage. Do not run a long FFmpeg/container render inside a Vercel request or invent a video output when only a script was generated. Provider choice and media costs are a later decision; video cannot delay the core release.

## 16 Model boundary and evaluation

Use one server-side AI SDK adapter through Vercel AI Gateway, with a configured model ID, bounded tokens, timeout and usage logging. Verify model access and structured-output support for the selected model. Record allowed providers, routing, processing-region requirements and retention settings; do not let automatic fallback silently change these boundaries. Schema-constrained output is preferred where supported, but semantic validation and policy checks remain required. Schema-valid output can still be factually wrong. [Vercel AI Gateway](https://vercel.com/docs/ai-gateway)

Allowed model jobs are mapping suggestions, bounded reply interpretation, factual follow-up drafts, the declared preparation artifacts in section 9, source-grounded explanations and brief narrative. Numeric metrics, status transitions, permission checks, ownership and spending decisions are deterministic application operations. Models propose typed action requests and never receive Vercel, Supabase or Google credentials.

Treat imported documents, cell content and emails as untrusted data. A message saying to ignore policy, change tenants, reveal credentials or approve itself cannot alter instructions or permissions. Restrict retrieval to authorized source references and limited context. Reject unexpected tool names, unsupported recipients, invented facts and schema violations.

Return concise user-facing rationale with evidence references. Do not expose hidden chain-of-thought or store unrestricted model reasoning as an activity log. Version prompts, model configuration, output schemas and evaluation datasets. Record which version produced a draft or classification.

Use deterministic fixtures for CI and a separately enabled real-model evaluation suite. Expected labels should come from representative operator-reviewed examples when available. Synthetic edge cases supplement those examples; they do not establish real-world performance. A model outage should preserve work and expose a blocker, not trigger an unrelated fallback provider or skip checks.

## 17 Deployment security and operational requirements

Keep Vercel configuration, environment schemas, SQL migrations, Auth/Storage policy setup and deployment instructions under version control. Use the supported Vercel Git build flow and a Node-based CI job for checks and guarded migrations. Pin Node and package versions. Do not require Docker, image registries or a container runner in CI. Never run an uncontrolled schema migration on every preview build.

Use separate hosted Supabase development/test and production projects with different credentials and OAuth redirect configuration. Isolate the public demo as specified in section 14. Bind every Vercel environment to an explicit expected Supabase project ID. Preview builds must use synthetic/nonproduction data, never inherit production secrets, and keep live outbound disabled. Supabase branches may be used when available, but do not assume a paid branching feature exists or is required. Do not seed production data merely to make a preview useful.

Vercel Cron targets a project's production deployment. Validate automatic scheduling in a dedicated nonproduction Vercel project whose production target is explicitly bound to the test Supabase project, or invoke the protected test dispatcher manually. A preview deployment alone does not verify automatic scheduling. Keep DAVID's live-execution flag independent of VERCEL_ENV so a test project's production deployment cannot enable real customer actions. [Vercel Cron deployment behavior](https://vercel.com/docs/cron-jobs)

Use HTTPS, verified database TLS, least-privilege roles, private Storage, scoped secrets and appropriate Vercel deployment protection/firewall controls. Protect cron and provider callback routes separately from customer session routes. Validate webhook signatures, account binding, timestamps and replay IDs where the provider supplies them. Vercel's managed networking does not imply a private network between the app and Supabase. If database IP restrictions are needed, verify a supported stable-egress option first; do not break serverless connectivity with a guessed IP list.

Select supported backup/PITR and restore capabilities for the actual Supabase plan. Retain SQL migrations and schema version history. Back up Storage objects separately: a database backup is not a copy of uploaded files. Document Auth, Vault, object and database restoration together, including resetting custom-role credentials where required, and test recovery in an authorized nonproduction project before claiming it works. Record RPO/RTO targets and owners. [Supabase backups](https://supabase.com/docs/guides/platform/backups)

Use additive, backward-compatible migrations before promoting code that needs them. Serialize migration jobs and verify the target project before writes. Rollback must account for schema compatibility, scheduled work and already-submitted provider actions; reverting the frontend alone is not an application rollback. Protect production project deletion and destructive commands through platform permissions and deployment procedures.

Keep browser public environment variables limited to intended public configuration such as the Supabase URL and publishable key. Secret/service-role keys, worker database passwords, Vault access, OAuth credentials, cron secrets and AI Gateway credentials remain server-only. Restrict production secrets and deployments to approved operators; untrusted pull-request code cannot access them. Redact logs, connection strings, cookie values, tokens and sensitive request bodies.

Authorize private Storage uploads and downloads against workspace membership. Validate size/type and quarantine imports before parsing. Use short-lived signed links and reject uploads/paths that cross workspaces. Sanitize exports, rendered HTML and model output. Prevent SSRF when retrieving user URLs, including redirects and DNS resolution to private/metadata destinations. Apply resource limits, secure headers, CSRF/origin checks and meaningful application rate limits.

Persist correlation IDs and cost/usage records in DAVID tables; use Vercel and Supabase logs to investigate execution. The operator console should surface dispatch backlog, missing cron ticks, expired leases, failed workflows, connection freshness, uncertain sends, unhandled replies and overdue human work. Configure an actual alert destination and verify delivery before unattended live operation. Do not treat a green platform status page as evidence that a customer's agents succeeded.

Set per-workspace and global application budgets, concurrent-run limits and provider caps. Estimate actual subscription, compute, workflow, model, database, Storage, egress, Auth email and backup costs before deployment. Provider plan limits, credits and spend alerts are not a substitute for per-customer limits. Configure only the required infrastructure and report the cost assumptions; do not invent a fixed hosting bill without sizing.

## 18 Development and startup without Docker

Develop the Next.js application with Node and pnpm. Connect integrated development and database tests to a dedicated hosted Supabase development project. Do not use supabase start, local Supabase services, Docker Compose, container-based test databases or CI service containers. No Docker installation should be needed to follow the README.

Maintain SQL migration files and use a supported remote migration path, such as the pinned Supabase CLI's linked-project push after checking its preview/dry-run behavior. Do not assume every CLI subcommand is container-free: avoid commands that create a local shadow database or launch containers. Use Node or native psql tests against the hosted test database for RLS, SQL functions and concurrency. Never use production as the test database. [Supabase migration CLI](https://supabase.com/docs/reference/cli/supabase-db-push)

Provide a no-cloud fixture mode for domain tests and the local UI, using the real domain services with deterministic provider/database adapters and a fixture clock. It must be visibly labeled and cannot receive real sender credentials. It does not prove SQL/RLS or hosted workflow behavior. Run actual database tests in the hosted development project and actual durable-workflow tests in an authorized Vercel nonproduction deployment. The SDK's local development mode may be used if the pinned version runs without containers, with its limitations documented.

Provide a doctor command that checks environment schemas and, when authorized access exists, validates the actual Vercel project, Supabase project/database role, Auth configuration, private Storage, migration version, workflow availability, AI Gateway and Google capabilities. Return precise missing-capability information without exposing secrets. A wrong project binding must stop migrations, seeds and deployments.

Use fixture, shadow and live modes explicitly. Shadow mode reads authorized real sources and prepares internal artifacts without external customer actions. Live mode requires an environment setting and a workspace release record naming cohort, sender, current policies, operator and review date. Deployed operational workspaces cannot use fixture authentication. Public demo sessions are separate synthetic sessions, not operational memberships.

Scheduled preparation may run in shadow mode with approved public sources, model access, an owner and usage limits; it does not require Gmail, a sending cohort or an ad account. Missing outbound access must not disable useful preparation. Seed representative open, accepted, declined, expired, duplicate, stale, suppressed and ambiguous proposals in nonproduction, including at least two workspaces. Retain expected results and exclude them from real customer totals.

Expose implemented commands for install, dev, fixture demo, lint, typecheck, unit tests, hosted database tests, end-to-end tests, build, migration preview/apply, nonproduction seed, dispatcher tick and doctor. Document exactly which commands need remote credentials and which run offline. Serialize tests that alter shared schema and scope record cleanup to the test run. Node-based CI must not secretly start a container through a helper. Missing hosted access is a verification blocker, not a reason to stop implementing the runnable fixture mode.

## 19 Required acceptance tests

Test business failure modes and integration boundaries. Do not inflate coverage with assertions that only restate implementation. Publish a readable scenario matrix containing input, expected action or block, observed result and environment.

Required cases include:

1. A valid proposal produces a grounded draft, checked approval, provider operation, retained receipt and correct outcome display.
2. Accepted, declined, expired, suppressed, on-hold and unknown proposals cannot be enrolled or contacted improperly.
3. A newly received reply or changed source status cancels the next follow-up. Replay cannot reactivate obsolete work. Bounces and automatic replies are classified separately and cannot inflate qualified-response metrics.
4. Human takeover and pause prevent new dispatch, with an in-flight call accurately reported and reconciled.
5. Duplicate source events, repeated queue deliveries and concurrent invocations do not create another intended send.
6. A provider timeout after accepting a send results in uncertainty/reconciliation, never an automatic duplicate.
7. A function crash during approval registration or callback delivery preserves the decision and resumes correctly.
8. Changing recipient, content, proposal version or material bounds invalidates the prior approval.
9. Two agents trying to contact the same enrolled person result in one owner or an explicit handoff.
10. A stale sheet, expired token, removed field, invalid mapping or revoked permission blocks affected work and explains why.
11. CSV reimports and reordered rows preserve identity. Missing rows in partial exports do not become wins or deletions.
12. Every API, background operation, evidence download and callback rejects cross-workspace access; pooled connections cannot retain another tenant's context.
13. A forged or replayed OAuth state cannot connect credentials to the wrong actor or workspace.
14. An email or spreadsheet containing prompt injection cannot change policy, select another secret, send to a new recipient or expose private data.
15. Ambiguous reply or scheduling time goes to review; a confirmed booking uses the correct calendar and time zone.
16. A booked meeting does not become attendance, accepted revenue or payment. Missing financial evidence remains unknown.
17. Dashboard, agent detail and weekly brief agree on the same metrics and evidence stage; fixture data cannot enter live totals.
18. Duplicate approval, budget reservation and callback requests preserve correct state under concurrency.
19. A version-two release changes new work without restarting an old conversation or altering its approved message.
20. A model error, malformed response or unavailable configured model leaves work recoverable and blocks invalid output.
21. Source account disconnection stops further access; deletion/export operations respect authorization and the documented retention policy.
22. Local fixture mode, internal demonstrator and public demo cannot use live sender credentials or enroll sample records as real recipients.
23. The registry contains the 32 agreed specialist identities without duplicate aliases; recommendations honor applicability, dependencies, available modes and the five-slot entitlement.
24. Goal-based onboarding deduplicates shared prerequisites, names input owners, preserves progress and ends in a verified first-workflow milestone.
25. Each of the nine preparation capabilities produces its declared artifact with source references, saved status, limits and pause behavior; drafts cannot trigger publishing or be reported as business outcomes.
26. A booking stops appointment chasing; active conversations block unrelated win-back work; cross-workflow opt-out and human takeover apply before prioritization.
27. Opportunity inbox approval produces an initiative with assignments, baseline, target, owner and review; a failed or inconclusive test is retained accurately.
28. Shared-funnel scenarios reject invalid conversions, apply capacity limits, preserve currency/time horizon and avoid overlap between new-demand and recovery cohorts. Scenarios remain separate from observed totals.
29. Public demo reset is session-isolated; anonymous users cannot access operational APIs, provider credentials, other sessions or customer records. URL requests cannot reach private/metadata endpoints or exceed application caps.
30. Core onboarding, decision, evidence and pause flows work with keyboard navigation and at desktop/mobile widths; stale, empty, error and unavailable states have a meaningful next action.
31. Runtime health distinguishes a working scheduler from failed source/model/business operations, including an unverified legacy runtime.
32. Delivery economics separates subscription revenue, setup, recurring support, provider costs and R&D; unknown customer fulfillment costs do not become a fabricated gross-profit result.
33. Migration rehearsal preserves stable IDs, approvals, ownership and outcome history; legacy and Vercel schedulers cannot both own live actions. Rollback reconciles already-submitted actions before enabling the old runtime.
34. An action inside a current standing mandate can proceed without redundant per-message review; an expired, revoked or exceeded mandate blocks it, and a broader commitment requires explicit approval.

35. A missed cron tick is recovered from stored due-work state; duplicate or overlapping ticks and an uncertain workflow start do not create another customer action.
36. Direct browser/PostgREST requests cannot forge approvals, update receipts, grant entitlements or retrieve Vault secrets. RLS denies cross-workspace access for every relevant operation, including Realtime and Storage paths.
37. Preview, development and public-demo projects cannot access production credentials or enable real outbound; wrong-project migrations and seeds fail before changing data.
38. A developer can install, run the fixture demo and execute unit checks without Docker. Hosted database tests clearly report missing credentials instead of falsely passing against mocks.
39. Restore testing covers database records, private files and necessary credential/Auth configuration; deployment rollback reconciles in-flight workflows and external actions.
40. A large source page or model task respects its function time/resource limits, checkpoints safely and resumes without duplicating records or exposing secret step outputs.

Run database integration tests against the hosted nonproduction Supabase project and its actual roles. Test client RLS and restricted worker-role behavior, not only an admin client. Exercise durable waits, resumption and deployment transition on Vercel before claiming hosted workflow verification passed. Test real Google operations only with supplied permission and test recipients/calendars or the approved pilot cohort. Label checks as passed, failed, skipped or blocked with evidence; skipped cloud checks cannot establish live readiness.

## 20 Build order ownership and checkpoints

Use the following sequence. Maintain one integrated product throughout. The workstreams can be owned by separate humans or handled sequentially by Astra. If parallel assistants are available and authorized, establish shared contracts before delegating bounded ownership; do not require parallel assistants to complete the build.

| Checkpoint | Work to complete | Evidence required |
|---|---|---|
| Foundation and access | Legacy source inventory, product alignment matrix, selected versions, contracts, tenant schema, fixture data and Google/Vercel/Supabase capability report | Two isolated workspaces, verified reuse candidates and explicit access blockers |
| First integrated journey | Import, current-state evaluation, draft, approval, checked fixture send, activity and outcomes | One working UI-to-workflow-to-database trace |
| Durable coordination | Vercel workflows, protected cron sweep, Supabase outbox/inbox, hooks, ownership, stop and takeover | Recovery/concurrency tests and verified platform configuration |
| Real integration | Authorized Google reads, monitored test communication, scheduling, fresh-state checks | Real provider receipts, documented scopes and coverage |
| Pilot readiness | Operator console, verified brief, isolation/failure tests, restore and release assessment | Named demonstrator/live-pilot tier and remaining blockers |
| Product coverage | Verified reuse or bounded implementation of nine preparations, full catalog, guided teams, opportunity inbox, customer journeys, saved scenarios and public demo | Requirement-to-test evidence, capability labels and complete customer/operator flows |
| Platform replacement | Source/data mapping, credential and identity transition, shadow comparison, scheduler ownership transfer and rollback rehearsal | Authorized cutover with no duplicate execution and preserved evidence |

For a five-engineer team, ownership is platform/contracts, integrations, workflow/action service, product experience, and platform delivery/reliability. The product owner resolves product decisions; the principal engineer owns shared architecture and integration. An assigned solutions/operator owner confirms the real data, live rules and escalations. Do not assume that person has already been assigned.

The first two days should resolve source availability, access feasibility, shared contracts and reuse opportunities. Target the first complete local journey by day five. Use the remaining initial period for coordination, provider validation and a bounded pilot. Estimate the product-coverage and migration milestones after this assessment. Reusing verified v13 components may reduce work, but chat-reported implementation does not establish a shorter schedule.

Complete the foundations and the first execution journey before expanding integrations. Continue with product coverage and the nine preparation modes, reusing verified code where available. The two-agent pilot is an intermediate milestone, not permission to delete the CEO's product requirements or report full completion. Keep the existing experience available until the replacement gate passes.

## 21 Release criteria and definition of done

Engineering completion requires a runnable local product, real adapter implementations, repeatable migrations, deployment definitions, passing meaningful local checks, a usable customer/operator interface, and documentation sufficient for another engineer to continue. A broad TODO list with disconnected components is incomplete.

The internal demonstrator must show one complete permitted journey and at least one meaningful blocked journey using labeled fixture or authorized test data. It must display accurate work states, decisions, outcomes and evidence. A fixture demonstrator is useful; it is not a live pilot.

A live pilot requires current source status, verified sender/reply/calendar capabilities, an explicitly enrolled cohort, confirmed operating rules, operator assignment, reliable pause/takeover, critical test results, monitored exceptions and an agreed outcome-evidence path. Payment integration is optional if financial claims remain unavailable. Contact/status uncertainty cannot be waved through to hit the date.

If external dependencies are unavailable, deliver all completed software and clearly identify the blocked live checks, responsible owner, exact configuration/access needed and verification procedure. Do not end early at the first missing key when useful implementation can continue. Do not mark deployment, customer readiness or business ROI as proven by code generation.

The Vercel/Supabase product-coverage milestone requires the 32-entry catalog, honest capability modes, nine verified preparation functions, the two tested execution responsibilities, guided activation, executive sections, shared journeys, opportunity and decision tracking, saved scenarios, delivery economics and an isolated sales demo. Automated external operation is enabled only for validated capabilities, selected installations and authorized cohorts. A passing preparation test cannot mark an execution integration complete.

Before replacing v13, inspect and map actual source data, users, stable IDs, approvals, suppression, conversation ownership, pending jobs and evidence. Existing consent or approval records migrate only when their meaning and validity are preserved; obtain fresh authorization where necessary. Use supported credential/account-linking paths rather than assuming tokens or identity records can be copied to a new Supabase Auth project or another OAuth client unchanged.

Rehearse the import and compare representative metrics and workflows in shadow mode. Pause or fence legacy schedulers before transferring a cohort's execution ownership, drain/reconcile in-flight actions, and enable the new Vercel runtime only after that boundary is verified. If the runtimes cannot share a reliable action-ownership mechanism, use a controlled pause and reconciliation window. Do not run both systems against the same live cohort to compare results. Rollback must reconcile actions already submitted by the new runtime before resuming the old system.

Treat engine.getdavid.ai as a branded-domain task requiring the actual DNS owner and target validation. Its setup is not evidence of agent readiness. Do not change DNS, retire the current system or reuse a quoted deployment approval from the CEO conversation as authority for a new cutover. Produce the plan and evidence first, then use the applicable session deployment authority.

After internal use, validate repeatable onboarding with an external B2B-services customer, then a deliberately different home-service workflow with proposal/job/payment records and a process owner. Keep ecommerce and other industries as catalog/scenario support until real integrations and evaluation support them. The architecture extends through configuration, adapters and versioned definitions; the first release does not claim validated execution for every industry.

## 22 Required handoff artifacts and final response

Create the implementation and these maintained documents in the repository:

- README.md with the exact setup and run path.
- docs/ARCHITECTURE.md with module boundaries, deployment topology and the end-to-end workflow.
- docs/CONTRACTS.md and executable shared schemas with examples.
- docs/AGENT_REGISTRY.md with the 32-entry catalog, alias mappings, capability modes, two execution responsibilities and nine preparation capabilities.
- docs/PRODUCT_ALIGNMENT.md with the CEO requirement matrix, legacy evidence, migration mappings, status and release milestones.
- docs/FRONTEND_SPEC.md with theme tokens, layouts, activation flows, accessibility and all UI states.
- docs/DEMO_AND_SCENARIOS.md with synthetic-data boundaries, scenario definitions, URL-analysis limits and reset behavior.
- docs/GOOGLE_ACCESS.md with tested scopes, account/resource binding, sync behavior and external-customer requirements.
- docs/DATA_OWNERSHIP.md with source authority, manual confirmations, freshness and outcome definitions.
- docs/SECURITY_AND_THREAT_MODEL.md covering identity, tenancy, credentials, untrusted content, external actions and retained data.
- docs/ONBOARDING_AND_OPERATIONS.md with readiness, operator responsibilities, takeover and exception handling.
- docs/DEPLOYMENT_RUNBOOK.md with project checks, environment configuration review, migrations, rollout, rollback, restore and costs.
- docs/LEGACY_MIGRATION.md with source inventory, data/identity/credential mapping, shadow validation, scheduler ownership, DNS and cutover/rollback procedures.
- docs/TEST_EVIDENCE.md with scenarios, commands, environment and provider evidence.
- docs/RELEASE_READINESS.md with demo/live criteria and unresolved blockers.
- docs/DEVELOPMENT_WITHOUT_DOCKER.md with fixture setup, hosted development/database tests, migration commands and environment isolation.
- docs/IMPLEMENTATION_STATUS.md and short architecture decision records.

Keep unresolved items specific. Initially they include current v13 source and deployment/schema access, any referenced brand or best-practice assets, intended Vercel team/projects and Supabase organization/projects/regions, Google permission state, actual DAVID proposal source and status owner, calendar/sender, operator coverage, live cohort, AI Gateway/model access, DNS ownership and deployment budget. These are fields to verify; they are not excuses to omit the working local implementation.

At completion, report the implemented behavior first. Provide launch commands and a short demo walkthrough. Summarize checks that actually ran, deployment state, real integration state, material limits, operating costs under stated assumptions and the exact remaining steps for live activation. Identify changed files and preserve the working branch according to repository conventions.

## 23 Alignment decisions and source status

This complete revision incorporates the CEO product requirements and the latest explicit stack decision: Vercel plus Supabase with no Docker. Earlier AWS instructions are superseded. The earlier versions were not applied by the user; do not assume an AWS deployment or database exists to migrate. It is self-contained; the source transcript is background, not an executable instruction stream. Its references to an earlier uploaded best-practices asset and the v13 source are not copies of those assets. Record them as missing until provided or found in the authorized repository.

| Topic | Resolution for this build |
|---|---|
| Product package | Five specialists from 32; the six-agent package and Pulse are historical |
| Existing v13 work | Inventory and verify it, reuse useful components, and preserve the existing experience until a tested Vercel/Supabase replacement |
| Hosting | Vercel and hosted Supabase are the target; preserve any verified active legacy deployment until controlled cutover |
| Development | Node and pnpm with a hosted Supabase development project; no Docker or local containers |
| Runtime | Vercel Workflows for durable steps and waits; Cron dispatches persisted due work |
| Nine website agents | Preserve or implement their bounded preparation modes; separate drafts and technical checks from connected execution |
| First live journey | DAVID AI proposal follow-up to booked conversation, with held status captured separately; home-service completion is a later live workflow |
| Executive UX | Goal-based teams, guided activation, Results/Work underway/Decisions needed/Blockers, source-linked journeys and opportunity decisions |
| Forecasts and economics | Shared-funnel scenarios, observed outcomes and DAVID delivery margin remain distinct and source-aware |
| Public demo | Separate anonymous synthetic sessions; operational workspaces and staff controls stay authenticated |
| Autonomy | Routine work within a valid mandate may execute; new strategic commitments outside it require a decision |
| Timeline | Ten working days remains a conditional pilot target; full feature coverage and migration have their own completion evidence |

The product requirements remain compatible with the new stack; implementation-specific AWS services have been replaced throughout this specification. Remaining release inputs are operational: the actual v13 handoff, accountable source/exception owners, verified permissions, cloud budget and cutover authority. Do not assume those have been supplied. There is no claim here that v13's live state or tests were independently verified.

Begin by inspecting the repository and legacy handoff, recording the alignment matrix and implementation plan, and establishing the shared contracts. Then implement and verify the foundation, pilot, product coverage and migration preparation in the sequence above.
