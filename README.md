# DAVID Engine

DAVID Engine gives a company a team of five specialized AI agents, chosen from a catalog of 32. The company connects its systems once, and the selected agents reuse that context to perform work—with visible inputs, outputs, permissions, approvals and results.

**Connect your company → assemble your team → request work → review the results.**

The experience should work both independently and alongside a DAVID operator on a sales or setup call. Switching specialists should reuse the company's existing setup and show any additional requirements.

- **Live product:** [revengine.getdavid.ai](https://revengine.getdavid.ai)
- **Company connections:** [Open Connections](https://revengine.getdavid.ai/?view=connections)
- **Repository:** [DAVIDBUILDERS/revengine](https://github.com/DAVIDBUILDERS/revengine)
- **Synthetic preview:** [revengine-bay.vercel.app](https://revengine-bay.vercel.app) — illustrative data, separate from customer workspaces.

## Current state

As of **September 14, 2026**, the operational application is deployed on **Vercel with hosted Supabase**. It uses Next.js, shared TypeScript services, PostgreSQL and versioned Vercel workflows. No Docker or AWS dependencies are required.

The platform foundation is built; the 32 agents are at different stages of implementation.

| Area | Current implementation |
| --- | --- |
| Company workspaces | Authentication, workspace isolation, resumable saved setup, invitations, revision history and operator setup requests. |
| Shared sources | Firecrawl website capture and reviewed company facts; Google OAuth and selected Sheets, Gmail and Calendar resources; validated proposal CSV imports. Access and source checks remain explicit. |
| Team selection | All 32 catalog roles, standard five-specialist allowance, recommendations, manual selection and direct swaps. Configured internal allowances are supported. |
| Nine preparation capabilities | Bounded, source-backed preparation implementations. These do not imply full execution of each role, such as publishing content or managing ad campaigns. |
| Two execution pilots | Deal Follow-up and Appointment Coordinator have provider-adapter and approval/workflow implementations. Live operation requires their own verified sources, permissions and readiness checks. |
| Remaining 21 agents | Planned capabilities with explicit requirements and engineering gaps. Selecting one does not make it operational. |
| Work visibility | Agent workspaces, saved outputs, opportunities, decisions, customer history, approvals, operating limits and evidence. |

A connected account, imported file or selected agent is not proof of successful work. Fixtures are labeled, and missing integrations remain visible. See the [agent registry](docs/AGENT_REGISTRY.md) for the capability breakdown and [latest shared-setup release notes](docs/COMPANY_CONNECTION_SETUP.md) for verified behavior and limitations.

## Product experience

1. **Connect company systems once.** Set up the tools the company uses, select specific resources and identify their owners. Record unavailable systems or request administrator help. Source discovery and read checks can run before selecting agents.
2. **Choose the five specialists.** Inspect the full catalog, see which inputs are already available and identify additional access or implementation requirements. Shared company services do not consume specialist slots.
3. **Configure the work.** Review the selected agent's task, sources, approvals, capacity and budgets. Connecting systems does not automatically authorize sending, booking or other external actions.
4. **Review actual outputs and results.** Inspect what the agent used, what it produced, what needs approval and what was verified. Keep projections, generated work and recorded business outcomes distinct.
5. **Change the team when needed.** Saved company connections and unchanged source verification remain available. Changes to sources or operating rules require renewed checks; unfinished work still needs a controlled handoff.

The design direction is a polished, futuristic DAVID workspace with clear agent interactions and minimal repetitive form filling. Company setup should support the work, rather than become a questionnaire clients must repeatedly complete. Advanced setup and permissions remain available when needed.

**Scenarios** is an existing planning calculator inherited from the original brief. It models low/base/high cases from explicit assumptions. It is secondary to the core agent workflow; moving it out of the main navigation has been discussed but is not yet implemented.

## Next phase: one agent at a time

We are moving through the catalog **1/32 to 32/32**, completing and reviewing each agent's functionality and UI/UX before moving to the next.

**First planned review: Account Intelligence (1/32).** Existing implementation does not count as approval under this new review process. No agent is marked signed off here yet.

Use this checklist for every agent and retain its findings, evidence, unresolved items and approval in the repository:

- [ ] **Purpose:** define the responsibility and useful result.
- [ ] **Connections:** identify required systems, data, ownership and permissions; reuse company setup.
- [ ] **Functionality:** demonstrate real inputs producing usable work at the agent's implemented mode.
- [ ] **UI/UX:** review selection, configuration, requesting work, progress, output and approval flows.
- [ ] **Failure handling:** test missing or expired access, incomplete data, errors, retries and recovery.
- [ ] **Verification:** retain evidence of working behavior and clearly distinguish fixtures from live integrations.
- [ ] **Owner sign-off:** Jakob tries and approves both functionality and experience before we move to the next agent.

New direction from product review takes precedence over older implementation notes. The [original v3 brief](docs/BUILD_BRIEF_v3.md) remains useful background, but is not a claim that all its capabilities are finished.

## Start locally

Use Node **24.21.0** and pnpm **10.33.2**. `.nvmrc` pins Node; select that version before installing dependencies.

```sh
pnpm install --frozen-lockfile
pnpm fixture
```

Open [localhost:3000](http://localhost:3000). This is a **synthetic operational demonstrator**: no credentials are needed, and real credentials must stay out of fixture mode. Sessions persist through an opaque browser cookie and local `.fixture/` files. A fixed fixture clock makes stale-data cases repeatable; reset affects only that session/workspace.

Other local demo options:

```sh
pnpm demo       # http://localhost:3001 — separate sales demo
pnpm preview    # http://localhost:3002 — full UI with browser-only fixture state
```

Both demo apps are separate from operational customer data and use synthetic session state. They have no operational API or credentials granting real provider actions. [fixtures/proposals.csv](fixtures/proposals.csv) supplies sample records for import testing; an import never grants sending permission.

For real Supabase/provider setup, follow the [deployment runbook](docs/DEPLOYMENT_RUNBOOK.md) and [development without Docker](docs/DEVELOPMENT_WITHOUT_DOCKER.md). Keep secrets in the appropriate environment or approved secret store, never in committed files. Test and production use the same application source with separate credentials and data.

## Verification

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
pnpm run doctor
```

Unit tests run offline. Browser tests include explicit fixture flows. `pnpm build` builds all three apps and the Workflow entrypoints. `pnpm run doctor` reports **BLOCKED** when external setup is missing; use `pnpm run doctor`, because `pnpm doctor` is a different pnpm command.

Hosted database checks require an explicitly configured target and the environment bindings documented in the runbook:

```sh
pnpm db:preview
pnpm db:apply
pnpm test:db
pnpm test:db:concurrency
pnpm run doctor --remote
```

**Latest recorded shared-setup release:** 251 unit tests, 46 browser scenarios, 15 hosted SQL suites, lint, TypeScript and all three builds passed. Hosted testing covered two independent companies, saved inventory and administrator requests, team changes, isolation and access denial. Migrations 023 and 024 were applied to test and production. Uploaded application source hashes matched across both deployments.

Those results verify the tested flows; they do not establish live success for all 32 agents. Actual Google consent, provider actions and each agent's output quality need their own evidence. See [release verification](docs/COMPANY_CONNECTION_SETUP.md).

## Project map

| Location | Purpose |
| --- | --- |
| `apps/web` | Operational customer/operator UI, Supabase Auth, protected APIs, workflows and dispatch. |
| `apps/demo` | Separate anonymous sales demonstration. |
| `apps/preview` | Full product UI using browser-only synthetic state; no operational API. |
| `packages/contracts`, `domain`, `agents` | Schemas, business rules, agent catalog, preparations and fixture engine. |
| `packages/db`, `connectors`, `orchestration`, `ai` | Database access, provider adapters, checked actions, workflows and model boundary. |
| `packages/ui`, `observability` | Shared UI helpers, instrumentation and redaction. |
| `supabase/migrations`, `supabase/tests` | Database definitions, controlled mutations and hosted regression tests. |
| `tests` | Unit, integration-boundary and browser tests. |

## Documentation and continuation

Start with this README and the latest feature/release notes:

- [Shared company setup and release evidence](docs/COMPANY_CONNECTION_SETUP.md)
- [Agent registry and implemented modes](docs/AGENT_REGISTRY.md)
- [Team studio](docs/TEAM_STUDIO.md) and [workspace design](docs/WORKSPACE_STUDIO.md)
- [Google authorization handoff](docs/GOOGLE_HANDOFF.md) and [Firecrawl activation](docs/FIRECRAWL_ACTIVATION.md)
- [Architecture](docs/ARCHITECTURE.md), [security boundaries](docs/SECURITY_AND_THREAT_MODEL.md) and [privacy operations](docs/PRIVACY_OPERATIONS.md)
- [Deployment runbook](docs/DEPLOYMENT_RUNBOOK.md) and [provisioning records](docs/PROVISIONING_RECORDS.md)

Earlier [implementation status](docs/IMPLEMENTATION_STATUS.md), [test evidence](docs/TEST_EVIDENCE.md) and onboarding documents contain historical snapshots. Check their dates against the latest release notes and executable code; older “blocked” or “complete” statements may have been superseded. This platform has not established a verified legacy-system cutover; see [legacy migration](docs/LEGACY_MIGRATION.md).
