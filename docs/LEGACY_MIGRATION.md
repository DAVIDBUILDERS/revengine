# Legacy migration and scheduler transfer

The supplied brief reports v13, Sites and Netlify work. This repository was empty: no legacy source, Git remote/ref, database export, deployments, assets or test evidence was available. No legacy behavior, active service or consent has been independently verified. No service has been retired and no DNS has changed. The brief's historical approvals are not authority for a new cutover.

## Inventory before writing an importer

Obtain the actual repository/ref and build instructions, schema/data export, known status mappings, current Auth/provider applications, deployment/scheduler configuration, retained tests, brand assets and operational owners. Hash and record supplied exports privately. Record the provenance and source/ref of each reused component and rerun its behavioral checks. This build reuses no unverified v13 code.

| Legacy entity | DAVID target | Reconciliation requirement |
| --- | --- | --- |
| Customer/tenant | workspaces | Explicit legacy→new UUID mapping; no name-based tenant merge |
| Users/roles | Auth users + memberships | Supported account migration/reinvitation; preserve only verified role meaning and current assignment; operator MFA |
| Account/person | accounts/contacts | Stable source keys, normalized channel, identity conflicts reviewed; suppression preserved before any enrollment |
| Deal/proposal versions | opportunities/proposals/source bindings | Owner, status vocabulary, version, scope, price/value kind, currency, issued/valid dates and actual source verification time |
| Consent/cohort | contacts + live activations + mandates | Verify recipient, purpose, sender, authority, policy/expiry; absence or ambiguity means fresh authorization |
| Draft/approval | actions/approvals | Recompute exact recipient/content/source/policy hash; incompatible or expired approval becomes a new review, never silently approved |
| Conversation | conversations + private proposal thread metadata | Verify original account/thread ID, purpose, owner, reply/suppression state and booked status; no fuzzy identity matching |
| Jobs/waits | runs + outbox + wait registrations | Preserve logical work identity and evidence; legacy opaque SDK jobs are not replayed into new runs |
| Provider results | receipts + evidence + outcomes | Provider IDs and observation stage retained; acceptance ≠ delivery, booking ≠ attendance, signed ≠ paid |
| Uploaded files | private Storage + evidence manifests | Workspace paths, hash/size/type, quarantine, retained access rights, independent object backup |
| Reports/economics | immutable briefs + usage/outcomes | Match metric definitions/as-of periods, value kinds and corrections; unknown figures remain unknown |
| OAuth credentials | new supported account link | Do not copy an encrypted token to a different OAuth client or assume refresh-token portability |

The current CSV/Sheet importer is a proposal bootstrap, **not** a complete v13 migration tool. It preserves stable source IDs and versions, rejects identity conflicts and does not interpret missing rows as deletion. A source already owned by CSV cannot be silently reassigned to a Sheet. Implement the actual legacy mapping once the source schema is known; guessing its schema would create unsafe migration code.

## Rehearsal and comparison

1. Use a separate authorized nonproduction project; create a manifest of input hashes, mappings, row counts and rejection decisions.
2. Import representative records covering closed/suppressed/stale/duplicate/ambiguous states, ownership, exact approvals, pending/uncertain actions and corrected outcomes. Preserve all rejected rows for owner review.
3. Compare old/new source counts, tenant membership, suppression/cohort, latest proposal versions, contact ownership, receipt IDs and financial definitions. Explain differences individually, including unknown and manual evidence.
4. Run both read models in shadow mode. The new runtime must have outbound disabled and cannot claim customer outcomes from fixtures. Exercise pause, handoff, expired credentials and evidence downloads.
5. Rehearse restore and rollback, including object files, Auth settings, Vault access and already-submitted provider actions. Retain the report with a release owner and timestamp.

## One scheduler owns a cohort

Keep the existing customer experience available until the replacement gate passes. Before moving a cohort, the legacy owner pauses/fences its schedulers and integrations, drains or reconciles in-flight writes, and exports the final ownership/receipt ledger. Compare final provider IDs and contact ownership. Only then activate the new runtime for that cohort. A maintenance pause is required if the systems cannot share a reliable ownership fence. Never run two live schedulers against the same cohort to compare results.

Start with one explicitly approved cohort and bounded capacity under staffed supervision. Verify live source freshness, grants, exact receipts, replies and booking evidence; observe operator intervention and cost. Maintain a rollback decision point before expanding.

## Rollback and domain

Pause new dispatch first. Keep uncertain/submitting actions visible and reserved. Reconcile Gmail/Calendar evidence and copy confirmed new outcomes into the ownership ledger before resuming any legacy scheduler. Do not reset actions or replay a legacy queue to recover a UI. Retain v1 workflow entrypoints and compatible schema while existing waits finish. Restore the last compatible application only after schema/run compatibility is checked.

`engine.getdavid.ai` requires the actual DNS owner, current records, expected Vercel project/domain verification, certificate checks, TTL/revert plan and explicit session cutover authorization. A domain resolving successfully is no evidence of agent readiness. No DNS or legacy hosting action has been performed in this build.
