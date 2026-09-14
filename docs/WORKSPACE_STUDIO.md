# Workspace studio design

## Scope and direction
Extend the established Your Team studio across Today, Connections, Opportunities, Decisions, Customer Journey, Scenarios, full workspace setup and the operator console. Shared navigation, account entry and inspection drawers follow the same materials and typography. Preserve the DAVID logo and red primary actions; use charcoal work surfaces, quiet sage accents and warm white work products. Avoid fabricated activity, inferred readiness or simulated provider access.

## Implementation
- Connections: source overview, account tiles, explicit capability selection and focused connection inspection.
- Today: review desk with an actual work-product preview, installed team and recorded outcomes.
- Opportunities: proposal-status filters and real record counts above the proposal workbench.
- Decisions: actionable review overview, proposed/approved filters and evidence-first decision cards.
- Journey: relationship panel and independently evidenced milestones; recorded stages remain separate from each other.
- Scenarios: live low/base/high comparison precedes assumptions; all values remain labeled projections.
- Full setup: numbered section navigation, saved-answer state, focused editing and readiness overview.
- Operator: workspace control overview, component health cards and reconciliation tools.
- Shared shell/account pages: consistent typography, controls, spacing, focus and reduced-motion behavior.

All command authorization, revision checks, source requirements, explicit permissions, budgets and activation gates remain server-enforced. CSS is split into scoped studio stylesheets. The operational Supabase and synthetic preview remain separate.

## Verification
- 17 Chromium journeys passed across frontend, onboarding, team setup, team studio and studio-page regression suites.
- Reviewed desktop and 390px mobile fixture screenshots; all primary pages fit without horizontal document overflow.
- New regression covers actual proposal filtering and connection failure status taking precedence over stale data; connection inspection supports Escape and restores focus.
- Existing checks cover saved setup and revisions, independent workspaces, source setup, precise action approval, pause/takeover, distinct outcome stages, CSV review and separate synthetic sessions.
- TypeScript, ESLint/module boundaries and the operational web production build passed.

These browser scenarios use explicitly synthetic fixtures. They verify presentation and existing workflow behavior, not new live provider capabilities. No database migration or new execution permission is required for this release.

## Hosted release verification
Test deployment `gNVTKC3GyCuDw5WHxApxfrf94CYF` passed 20 checks using two isolated Auth accounts and private Supabase workspaces. Checks include login/create/return routing, tenant read/write isolation, cross-origin rejection, signed-out denial, an explicit missing-Firecrawl-key response, and all seven owner-facing studio pages on desktop/mobile. The optional `--studio-pages` flag in `scripts/verify-hosted-onboarding.ts` retains these hosted checks. Published CSS ordering and empty Connections/Today states were visually inspected.

Implementation commit: `ffc38cc`. The hosted accounts are explicitly labeled test actors in the separate test project; no customer account or execution permission was altered.

Production deployment `CCEKnpsL7poWX9Q1xRjy4PtdPoqM` is ready and aliased to `https://revengine.getdavid.ai`. Test and production contain the same application changes. Custom-domain login/start returned 200, unauthenticated workspaces returned 401, the failed callback returned to the canonical login origin, and invalid login input was rejected by validation. No production account or business data was used for these release checks.
