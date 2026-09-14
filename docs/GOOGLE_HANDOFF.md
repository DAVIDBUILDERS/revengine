# DAVID Google handoff and return

## Product experience

The Connections screen now hands off through a dedicated DAVID studio surface: charcoal stage, paired DAVID/Google endpoints, quiet sage detail, and a numbered path showing the actual phase. It begins immediately when the owner requests Google authorization, without another confirmation step or an artificial waiting period. Google continues to render its own account chooser and consent screen.

On return, the workspace shows the recorded account identity, source owner, verification state, actual permission breadth and missing/partial grants. Direct actions open approved source setup with that account and the selected Sheet, sender or calendar type. The source drawer follows the same visual treatment. Choosing a source does not save a binding or authorize execution; its existing explicit save queues a real source check.

Account authorization and source verification remain separate. New OAuth connections are `unconfigured`, so resource selection accepts that state as well as `healthy`. Revoked, expired, failed, unrelated-workspace or missing accounts cannot offer usable source actions. Actual scopes, supported operations and owner/operator role must all allow the selected resource. A complete Google grant with missing DAVID operations is shown as granted but requires support review.

## Navigation and trust boundaries

- Successful callbacks return `/?view=connections&workspace=<resolved workspace>&google=review&connection=<saved connection UUID>`.
- A valid cancellation consumes the same actor-bound one-time state and returns `google=cancelled`. Malformed, replayed or unverifiable state returns `google=expired`; sanitized exchange/persistence failure returns `google=failed`.
- Workspace context is retained only after the authenticated state resolves. Canonical callback mismatch still fails with 403. Callback responses are private/no-store and no-referrer. Provider error descriptions, tokens and codes never enter the return URL.
- Query parameters are display hints. Identity, permissions, health and operation support come from the current authorized workspace snapshot. A forged hint cannot grant account access or mark an agent ready.
- Only capability choices and their timestamp are saved in workspace-scoped session storage for one hour. No token, authorization URL, code or verifier is persisted in the browser. Storage is optional; OAuth does not depend on it.
- Abandoning a handoff aborts its client request and cancels pending navigation. Back, refresh and BFCache recovery require a new explicit attempt instead of restarting authorization automatically. Sidebar/workspace navigation removes stale return hints. Old source launch requests cannot reopen a drawer after another handoff.
- Preparation has a 30-second client timeout and explicit retry. External navigation is limited to HTTPS `accounts.google.com`. Phase changes focus the heading; all actions have keyboard focus indicators and motion respects reduced-motion preferences.

## Verification and remaining boundaries

`tests/google-oauth-handoff.test.ts` exercises 17 synthetic route cases including success, denial, replay/wrong actor, code-exchange failure, canonical callback checks and missing application configuration. The existing 16 Google connector HTTP-fixture tests also pass.

Browser regressions are in `tests/e2e/google-connection-experience.spec.ts` and `tests/e2e/google-connection-navigation.spec.ts`. They use explicitly synthetic workspace snapshots and intercept Google navigation; they do not impersonate a real consent response. Coverage includes selected-capability requests, late response cancellation, actual recorded grants, partial permissions, missing/revoked accounts, workspace boundaries, source preselection, denied roles, retry, Back/refresh and mobile layout. Screenshots are saved to ignored `artifacts/google-*.png`.

No schema migration, new dependency or new business-action permission is required. Real Google consent, file access, sender/reply and calendar verification still require the account owner's interaction and provider evidence. The separate test deployment retains its own provider configuration; production credentials are not copied into it. Source entry still requires an actual permitted resource ID/range/owner; this release does not introduce a Google file picker or pretend that typing an ID grants access.

Local validation passed: TypeScript, full ESLint/module-boundary checks, 33 Google route/connector tests, 8 new Google browser journeys, 12 existing frontend journeys and 2 existing studio-page journeys. Desktop and 390px mobile screenshots were inspected. Phase entry now scrolls the new surface into view; the direct resource action lets the drawer manage focus. Release results are appended after deployment verification.
