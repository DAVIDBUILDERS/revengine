# September 11 product design revision

User direction: use the supplied DAVIDENGINE picture as the logo; make the product feel like credible business software, with transparent agent interaction.

## Implementation plan

1. Preserve the supplied image and display its first house wordmark in the operational shell, sign-in and public demo. Use a CSS viewport onto the original artwork, without redrawing the lettering.
2. Rebuild Today around a decision queue, exact prepared work, compact outcome ledger and directly inspectable agent roster. Preserve empty, blocked, paused, fixture and unavailable states.
3. Give every catalog agent a shared workspace showing current installation, recorded work, sources, triggers, declared tools, permissions, stop conditions and human handoffs. Do not invent chat, hidden reasoning, runtime activity or new permissions.
4. Carry the restrained typography, navigation, borders and spacing through the operational screens. Preserve all source, approval and fixture boundaries.
5. Verify desktop/mobile layouts, keyboard access, agent preparation and exact proposal review, then run the existing browser journeys, typecheck, lint and production builds. Record results and remaining limitations here.

## Decisions

- Artwork: `/Users/jakob/Downloads/DAVIDENGINE.png`, first treatment, “01 / HOUSE WORDMARK.” The original file includes three treatments and remains intact.
- The serif wordmark anchors the identity. Page titles use a local system serif; operational controls and records remain system sans-serif. No remote font dependency.
- Transparency means inspectable source evidence, saved outputs, declared rules, actual receipts and explicit human controls. It does not imply access to model-internal reasoning or an implemented conversational agent interface.
- Existing action authorization and server validation remain authoritative. All external setup blockers from RELEASE_READINESS still apply.

## Progress

- Located and visually inspected the exact supplied artwork. Read current frontend contracts, agent capabilities, screen implementations, tests and local Next.js guides.
- Implemented the supplied wordmark in the operational sidebar, mobile header, loading state, sign-in and independent public demo. Both asset copies match the source SHA-256: `c84511e8efec906811785790667762a0a642243b8b870f75d7cd999c22d1a663`.
- Rebuilt Today with at most three priority decisions, exact prepared messages, owner/commitment previews, compact shared metrics, an inspectable agent roster and expandable blockers. Required section names remain intact.
- Added shared agent workspaces to Today and the full catalog. Work & handoffs, Inputs & access, and Rules & limits expose actual saved artifacts, factual inputs, evidence, action/approval/receipt records, declared tools, prerequisites, triggers, stop conditions, capacity and fallback. Preparation and pause call the existing server commands.
- Preserved URL-backed workspace isolation; exact-action links additionally carry the proposal ID. Desktop workspace switching now appears once in the sidebar. Closed mobile navigation is inert and hidden from assistive technology.
- Production visual checks found a pre-existing overflow from an absolutely positioned screen-reader table heading whose containing block escaped the scroll container. Making `.table-wrap` positioned contained it correctly; wide tables retain their own horizontal scrolling. Mobile card headers now wrap. Dialog feedback stays inside the active dialog.
- Final verification recorded below.


## Verification — 2026-09-11

- `pnpm test:unit`: 170 tests passed across 19 files.
- `pnpm typecheck`: passed. `pnpm lint`: passed; 75 source files in the external-write boundary audit.
- `pnpm build`: both production applications passed, with 17 workflow steps and 4 workflows retained.
- `pnpm test:e2e`: **12 Chromium tests passed in 7.8s against the production-built local servers**. Three additions verify exact-customer review from Today, agent evidence/limits/preparation/pause plus mobile switching, and all nine operational screens at 390px.
- Final production layout sweep at `2026-09-11T13:51:11.901Z`: no page overflow across nine mobile screens and no uncaught browser errors. [Machine-readable record](evidence/design-revision/visual-check.json).
- Original logo and both public copies have matching SHA-256 hashes. No new runtime/component library was introduced. Prettier was invoked as a temporary formatting tool; the dependency lockfile is unchanged.

Visually reviewed captures: [Today desktop](evidence/design-revision/today-desktop.png), [Today with a prepared action](evidence/design-revision/today-prepared-action.png), [Today mobile](evidence/design-revision/today-mobile.png), [agent work](evidence/design-revision/agent-work.png), [agent access](evidence/design-revision/agent-access.png), [agent mobile](evidence/design-revision/agent-mobile.png), [mobile proposals](evidence/design-revision/opportunities-mobile.png), [sign-in](evidence/design-revision/sign-in.png) and [public demo](evidence/design-revision/public-demo.png). All operational capture data is synthetic, in separate local test sessions.

## Continuation

The running local app is at `http://localhost:3000/?view=today`; the independent public demo is at `http://localhost:3001`. Rebuild/restart after source edits when using `pnpm --filter @david/web start`; `pnpm fixture` provides development refresh instead.

Start future interface changes in `components/today.tsx`, `components/agent-workspace.tsx` and `app/product-design.css` under `apps/web`. Shared palette and primitives remain in `packages/ui/src/theme.css`. Keep exact approvals, current evidence, unknown figures and declared-versus-observed capability distinctions intact. Agent conversations are not implemented; current interactions are explicit supported commands. Complete historical audits and real cloud/Google/model execution still require the documented hosted setup and verification. This design revision does not change release readiness or claim a live integration.
