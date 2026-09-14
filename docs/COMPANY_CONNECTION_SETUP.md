# Company connections and a flexible five-agent team

## Direction

Connect the company's systems once for the full 32-specialist roster, then choose the five specialists to use. Changing the lineup reuses saved company context, account grants, selected resources and source ownership. It must not restart the questionnaire or imply that every catalog capability is implemented.

## Implementation plan

1. Expose shared system coverage for all 32 responsibilities, separate from the currently selected team and operational readiness. Show implemented access, missing access, unavailable tools and missing engineering distinctly.
2. Make new-company entry lead to Connections. Offer supported website, Google and CSV setup and a saved inventory for the other systems the company owns. Keep choosing the team available without trapping the user behind integrations they do not have.
3. Decouple read-only source checks/discovery from specialist selection. Permit tightly constrained setup runs without an installation; preserve account, tenant, read-operation, budget and action boundaries.
4. Preserve verification lineage on team-only changes. Keep explicit business-action authorization separate; new or changed sources/rules must still invalidate relevant readiness.
5. Let a full five-agent lineup replace one specialist directly, showing reused sources and remaining requirements before saving. Preserve shared answers and bindings, and leave unfinished work subject to controlled handoff.
6. Verify independent workspaces, no selected agents, expired/denied accounts, partial sources, swapping teams, and actual configuration changes. Apply additive migration to test first, then production, and deploy the same application code.

## Boundaries

Supported source setup currently includes captured public websites, Google Sheets/Gmail/Calendar and validated CSV imports. Nine preparation capabilities reuse approved website/company evidence; two execution pilots have separate operating requirements. Other provider integrations remain visible engineering work. A saved inventory row, OAuth account or selected specialist cannot establish live execution readiness.

The existing product stores company answers, connections, bindings and artifacts at workspace level. This change removes selected-team dependencies in discovery and presentation rather than creating 32 independent copies of company setup. Standard customers retain five slots; a DAVID operator's configured allowance is honored.

Progress, verification and release evidence will be recorded here as implementation completes.

## Implementation progress — September 14, 2026

- Added shared coverage for all 32 catalog roles, including current implemented inputs and future role dependencies. Canonical connection bindings now expose resource type, owner, range and verification timestamps to the workspace snapshot.
- Added the Connections source map, company system inventory and operator help requests. Unimplemented tools remain inventory entries with engineering gaps. Website capture, Google authorization/resource setup and CSV import are directly accessible before team selection.
- New companies enter Connections. Team selection remains optional during source setup, and a full lineup can replace a specialist without rebuilding company answers. Draft conflicts require an explicit reload.
- Migration 023 decouples checked read-only setup jobs from specialist installations, retaining tenant and token/action boundaries. It also adds stable material-configuration stamps and a versioned onboarding reader. Applied to the hosted test project; all 14 hosted SQL suites passed, including new source-setup security and lifecycle cases.
- Browser checks passed for company inventory persistence, help requests, direct source entry, company-wide Google scope selection, CSV entry, saved/failed team swaps and mobile layout. Google handoff/return and briefing recovery remain covered. The first full unit pass was 247 tests.
- Found a fresh-company edge during review: no persisted onboarding baseline existed before the first answer save. Additive migration 024 will establish an empty, permission-free revision-0 baseline so the first team selection also preserves checks made earlier.

The browser/SQL fixtures are labeled test data. These checks do not claim a real Google consent grant, mail delivery, booking or finished implementation of planned agents.
