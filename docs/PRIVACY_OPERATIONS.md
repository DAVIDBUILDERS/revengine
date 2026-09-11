# Authorized workspace export and erasure

`scripts/privacy.ts` is an isolated operator CLI, backed by migration `202609110014_privacy_operations.sql`. It has **not been executed against hosted data**. Its 12 offline tests verify request/target guards, complete pagination, tenant-bound outputs, safe serialization, destructive sequencing and failure behavior; `supabase/tests/007_privacy.sql` is authored for a rollback-only nonproduction database test. Storage HTTP behavior, actual database permissions and complete erasure still require hosted verification.

No privacy operation is exposed to the browser, service role, worker, dispatcher or OAuth broker. Database functions use invoker security and also require the actual `postgres` session/current user. Use a protected administrator shell with the approved project-specific direct or session-pooler connection. Never put this credential or the Storage administration key into the web/runtime environment.

## Reviewable request and target binding

The operator must obtain an authorized privacy request and the applicable retention decision first. The request file deliberately contains opaque references, not free-text identities, credentials or source material. The `workspace_membership` authority verifies an active membership in the exact target workspace: owner/member can export, only owner can request erasure. The alternative `privileged_operator` authority is an explicit approved-request reference asserted by the authenticated database administrator; it is **not** an independently verified ticket signature. Its authorization must exist in the operator's protected request system. An arbitrary JSON file is not permission to use the administrator credential.

Prepare a protected JSON request, replacing every example identifier with the reviewed target and approved references:

```json
{
  "version": 1,
  "requestId": "30000000-0000-4000-8000-000000000003",
  "projectId": "abcdefghijklmnopqrst",
  "workspaceId": "10000000-0000-4000-8000-000000000001",
  "operation": "export",
  "authority": {
    "kind": "workspace_membership",
    "actorId": "40000000-0000-4000-8000-000000000004"
  },
  "retention": {
    "policy": "approved_expiry_or_erasure",
    "policyReference": "50000000-0000-4000-8000-000000000005",
    "released": false
  }
}
```

For approved operator authority, replace `authority` with `{"kind":"privileged_operator","authorizationReference":"APPROVED-REQUEST-UUID"}` using an actual UUID. Erasure requires a new reviewed request with `operation: "delete"` and a released retention decision; changing the text alone does not authorize erasure. The retention policy reference must account for contractual/legal holds, customer source ownership, the export recipient and local export retention. No jurisdiction or retention period is invented by the software.

In a protected `.env.tools.local` (gitignored), set:

```dotenv
PRIVACY_SUPABASE_PROJECT_ID=THE_REVIEWED_20_CHARACTER_PROJECT_ID
CONFIRMED_PRIVACY_PROJECT_ID=THE_SAME_PROJECT_ID
PRIVACY_WORKSPACE_ID=THE_EXACT_WORKSPACE_UUID
PRIVACY_DATABASE_URL=THE_APPROVED_POSTGRES_ADMIN_DIRECT_OR_SESSION_CONNECTION
DATABASE_CA_CERT=THE_APPROVED_CA_CERTIFICATE_OR_PATH_IF_NEEDED
# Required for erasure when any evidence/quarantine objects exist:
PRIVACY_STORAGE_SERVICE_KEY=THE_SAME_PROJECT_STORAGE_ADMIN_KEY
```

The CLI checks both declared project IDs, the request project/workspace and connection host/admin username/database. Transaction-pooler port 6543, runtime worker logins, unverified TLS and Vercel execution are rejected. The CLI verifies the server's actual session/current role after connecting. Storage goes only to the bound project's `david-evidence` bucket. Legacy Storage JWTs must declare that project's `service_role`; opaque `sb_secret_` keys are authenticated by the bound Storage endpoint. No key is printed.

## Export

```sh
pnpm exec tsx scripts/privacy.ts export /protected/approved-export-request.json /protected/david-export-unique-directory
```

The output directory must not already exist. It is created with mode 0700 and files with mode 0600. The database reads use one repeatable-read, read-only transaction; pages of 500 are read until exhausted and checked against snapshot counts. Records from another workspace fail before serialization. Each exportable public/private business table gets a JSONL file, with all versions/history in that table. Source/import rows, outcomes, approvals, receipts, usages and evidence links are included. A complete `evidence_objects.jsonl` covers every path under the workspace's evidence prefix, including quarantine and unreferenced objects. `manifest.json` is written only on completion; a failed partial directory without that manifest is not a completed export.

Credential, OAuth verifier, route, wait-hook, transaction-capability and privacy-control tables are omitted, with counts/reasons in the manifest. Known nested secret fields and credential strings are redacted. JSON serialization escapes markup and terminal controls; render exported strings as plain text, never execute source text or import it as a spreadsheet formula. Raw binary objects are **not downloaded**: the manifest provides object IDs, paths, timestamps and metadata for an authorized separate delivery process. The tool does not mint public or signed URLs. Protect the export as personal/business data and delete it according to the approved local retention decision.

The inventory is explicit. If a later migration introduces an unregistered tenant table, both export and erasure fail with `PRIVACY_SCHEMA_CHANGED_REVIEW_REQUIRED`; an engineer must update the reviewed inventory instead of silently omitting it.

## Erasure preview and execution

Always retain and review the preview for the exact approved request:

```sh
pnpm exec tsx scripts/privacy.ts delete /protected/approved-erasure-request.json
```

This default command enumerates only that workspace's row/object counts and blockers. It does not pause, revoke, quarantine or delete anything. Before apply, pause the workspace through the normal owner/operator controls, stop processing jobs, and reconcile every `submitting`/`uncertain` action. Each `provider_accepted`/`confirmed` action needs a matching latest receipt with provider ID and resolved/not-required reconciliation. A reserved model attempt must also finish or be reconciled. Accepted email is still not delivery, and a confirmed booking is still not attendance.

After an authorized operator has reviewed that concrete preview and released retention, the executable command is:

```sh
pnpm exec tsx scripts/privacy.ts delete /protected/approved-erasure-request.json --apply --confirm-workspace THE_EXACT_WORKSPACE_UUID
```

No erasure command was executed during this build. Apply rechecks the request, exact confirmation, retention release, paused state, run/action evidence and object paths. If objects exist but the Storage administration key is missing, apply exits before quarantine. The explicit operator must supply approved access; a missing key never triggers raw `storage.objects` deletion.

Execution has two phases:

1. **Committed quarantine.** Under a workspace lock, deactivate tenant memberships, revoke local connections/scopes/operations, revoke live activation/mandates, invalidate pending approvals, cancel/fence runs and conversation ownership, remove tenant OAuth states and Vault secrets, then save a request-hash-bound job. Source/evidence rows remain intact. Shared Vault references to another workspace cause failure before revocation.
2. **Objects, then database erasure.** Remove actual objects through Supabase Storage in batches of at most 100, repeatedly reading offset zero so deletion never skips a page. Recheck emptiness under a Storage table lock before deleting tenant rows in foreign-key order. Persist a minimal completion receipt outside the workspace containing time, counts and fixed policy code, without workspace/contact/actor/source/request identifiers.

A Storage/network/permission failure after quarantine leaves the workspace paused and inaccessible with its rows retained. Re-run the **same approved request file and exact apply command** after resolving the error; its canonical hash binds the resumable quarantine job. Do not re-enable memberships or an old scheduler to bypass incomplete erasure. A no-progress response stops instead of looping or claiming success. Failure in final database deletion rolls back that transaction; the earlier quarantine remains in effect. The actual Storage-role privileges and `storage.objects` lock must be proven in nonproduction before relying on this path.

## Boundaries and remaining verification

The operation removes DAVID's local provider access and Vault copies; it does not revoke the customer's Google OAuth consent at Google, delete provider-side messages/calendar events/source Sheets, erase shared `auth.users`, erase Vercel retained workflow history/logs or rewrite backups. Shared Auth sessions cannot access an erased workspace because its memberships are deactivated/deleted. Account-wide identity deletion requires a separately authorized scope to avoid damaging other workspaces. Provider grant revocation and any retained external copies must follow the approved privacy request and provider controls.

Global model/action usage aggregates are retained without tenant identifiers. Conservative global cost reservations are not released merely because tenant erasure removed detailed evidence. Backups/PITR and external provider retention follow the approved retention policy; document their expiry and prevent restoration from reactivating an erased workspace. No automatic claim of complete deletion from every backup or external processor is made.

Before production use, execute the authored hosted test with real restricted roles, then an authorized synthetic Storage upload/export/quarantine/remove/retry trace; verify signed/private object access after quarantine, concurrent in-flight upload behavior, database/Object/Vault permissions, restore handling, and the protected request/export audit process. These are open verification tasks, not completed credential setup.
