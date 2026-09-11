# Google access and verification record

Real Google HTTP adapters are implemented. Local tests inject synthetic HTTP responses and never contact Google. No OAuth client, account permissions, Gmail message, Calendar event, Google Sheet read or live outcome has been verified in this repository's build environment.

## Operations and grants

| Capability | Implemented adapter | Requested scope and scope boundary | Verification |
| --- | --- | --- | --- |
| Selected proposal Sheet | `readSheet()` requests the bound file and A1 range; response capped at 2 MB / 5,000 rows | `drive.file` for app-created/opened/shared selected files; an arbitrary pasted URL does not confer access. A separately approved `spreadsheets.readonly` grant has broader reach | HTTP fixture tested; actual Picker/file permission and endpoint acceptance blocked |
| Send follow-up | Internal action-service-only Gmail send; stable RFC Message-ID and retained Gmail ID | `gmail.send` | Synthetic accepted/timeout/header tests; no real message sent |
| Relevant replies | Gmail thread reads limited to enrolled thread IDs; history polling filters before message retrieval | `gmail.readonly`, a restricted mailbox-wide OAuth grant. App filtering reduces processing, not grant reach | Synthetic history pagination and expired-history recovery tested; Google/administrator approval blocked |
| Availability | `freeBusy()` for one bound calendar with explicit time zone | `calendar.freebusy` | Synthetic allowed/busy/error states tested; actual calendar ownership/access blocked |
| Booking | Availability rechecked immediately before insert; stable base32hex-compatible event ID | `calendar.events.owned` for owned calendars. Shared-calendar scope/resource combinations must be separately reviewed; alternative `calendar.events` grants have broader reach | Synthetic Calendar insertion/conflict tested; no real event created |
| Account identity | Code exchange followed by Google UserInfo with returned token; requires verified email and subject | `openid email` | Implementation present; real consent/account exchange blocked |

Google documents `drive.file` as scoped to files opened/shared with the app; selection still needs endpoint verification. [Drive scope guidance](https://developers.google.com/workspace/drive/api/guides/api-specific-auth). Gmail readonly remains a restricted scope even when DAVID processes only enrolled conversations. [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes). Custom Calendar event IDs use its supported alphabet; event collision recovery must still verify the actual event. [Calendar insert](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert).

DAVID login and integration authorization are separate. The user initiates connection as a current workspace owner or assigned MFA operator. `createOAuthRequest` creates 256-bit random state and a PKCE S256 challenge. The database stores the state hash, initiating actor, workspace, exact allowlisted redirect, expiration and a Vault-protected verifier. The callback consumes state once for the same current actor and redirect, exchanges the code server-side, verifies returned Google identity, and passes the result to the restricted `david_oauth` broker. The broker cannot enumerate customer data or decrypted secrets. Connection health stays `unconfigured` until capability/resource checks succeed. Replay, wrong-actor and wrong-workspace behavior has an authored hosted SQL suite; that suite is blocked until test-project access exists.

## Synchronization and recovery

Use one scheduled bounded reconciliation workflow. Gmail native push requires a Pub/Sub setup that is outside this release; polling is intentional. [Gmail push](https://developers.google.com/workspace/gmail/api/guides/push).

`pollHistory` processes one provider page at a time, retaining the original start history ID while `nextPageToken` exists. After successfully ingesting the page and inbox IDs, save its checkpoint in the same database transaction. Only advance the final history ID once that result has been processed. Events are deduplicated by connection and provider event ID. There is no mailbox-wide content indexing.

A missing/expired history ID captures a fresh mailbox history baseline before fetching enrolled threads in batches of ten. The baseline and reconciliation offset are persisted so subsequent history captures changes arriving during that rescan. Old history returning 404 never causes enrollment of unrelated threads. A very large relevant page or a thread exceeding 100 messages becomes an explicit review/engineering blocker rather than silent truncation. [Gmail synchronization](https://developers.google.com/workspace/gmail/api/guides/sync).

For first enrollment, obtain and verify the original Gmail thread association; names/similar email addresses cannot establish it. Persist the approved sender and selected resource IDs with their source owner. Gmail message/header content is untrusted evidence. Automatic replies, bounces and human replies remain separate classifications in the domain layer. Any detected reply stops the initial follow-up pilot before classification.

Read operations retry only bounded 429/5xx responses, at most three attempts with a maximum two-second backoff and ten-second HTTP timeouts. A network failure during a Gmail/Calendar write is uncertain and is never blindly retried. A Google 2xx response with an invalid receipt is also uncertain. Reconcile sends using the stable Message-ID in the Sent mailbox. No match may reflect indexing delay and is not authority to resend. An ambiguous result needs operator review. Gmail acceptance is not recipient delivery.

Calendar booking uses only the selected calendar. It does not detect conflicts on unconnected calendars. Attendee notifications (`sendUpdates=all`) are outbound communication and require the same live activation, cohort and approval controls as the booking. A confirmed event establishes booked status only.

## Token lifecycle

`createVaultSecretStore(database, runId)` reads only the connection attached to that checked run and only a declared permitted operation. Secrets are retrieved and consumed inside a bounded connector step, never returned from durable workflow steps. Secret storage is not exposed to authenticated browser clients. [Supabase Vault](https://supabase.com/docs/guides/database/vault).

Access-token expiration triggers a 45-second persisted refresh lease. A second refresh receives `refresh_in_progress` and must schedule a later bounded retry. The new access token and any rotated refresh token are stored atomically using that lease. An invalid grant/authorization response marks the connection expired. Removing the connection marks it revoked, empties its operation list, deletes its stored Vault token and blocks affected runs. Users should also revoke access at their Google Account permissions page when disconnecting; provider-side revocation delivery is an additional operating step, not claimed by the local deletion.

External Testing-mode refresh-token lifetimes and production verification need an account-specific assessment. An internal DAVID audience is not evidence of external customer approval. [Google OAuth token behavior](https://developers.google.com/identity/protocols/oauth2), [restricted-scope readiness](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).

## Exact activation inputs and verification procedure

The owner must provide the Google Cloud organization/project and consent audience, enabled Sheets/Gmail/Calendar APIs, approved scopes and administrator decision, OAuth client ID/secret, exact HTTPS callback, selected file/tab/mapping/version/status owner, authorized sender, enrolled Gmail thread IDs, owned calendar, meeting rules, assigned operator/coverage and test recipient/calendar permissions. Configure the exact redirect in `private.allowed_oauth_redirects` via the guarded admin setup. Provide distinct OAuth clients/redirects for nonproduction and production.

1. Apply migrations to the bound hosted nonproduction project, provision the three restricted runtime logins and test Auth/RLS/Vault lifecycle.
2. Connect a supplied test account; verify UserInfo subject/email, actual granted scopes, refresh/rotation and an explicit reauthorization cycle. Record consent mode/expiry.
3. Select the test Sheet through an authorized per-file selection, check file ownership, current mapped status/owner/contact IDs and drift behavior. Do not edit customer columns.
4. Enroll only approved test conversation IDs. Verify multi-page history, reply/automatic-reply/bounce handling, missed polls and forced stale cursor recovery.
5. With explicit test-send authorization and reviewed content, submit once, retain provider ID, trigger an uncertain response/reconciliation case and verify no duplicate.
6. With approved test calendar and recipient, verify free/busy, correct time zone, a conflict, one stable event, rescheduling policy and handoff. Record booking separately from attendance.
7. Disconnect and verify further reads/writes fail, remove provider authorization, then reconnect through a new one-time state.
8. Repeat on the permitted pilot cohort only after every live activation input and hosted workflow/deployment gate is satisfied. Record provider IDs/evidence privately; never put customer tokens or message bodies in this document.

The final freshness guard compares all material Sheet columns against an immutable action source snapshot, including edits that failed to increment the source version. Required mapped canonical columns are `proposal_id`, `status`, `version`, `source_verified_at`, `email`, `owner`, `scope_summary`, `valid_until`, `currency`, `amount_minor`, `value_kind`, and `issued_at`. Dates must have explicit ISO timestamps and amounts must be integer minor units; ambiguous human-formatted money/dates need mapping/owner review. Two fresh reads bracket reservation, followed by the final transactional pause/policy check. An inbound message after proposal issuance stops follow-up even when it arrived before the draft. Gmail system-labeled sent messages and drafts are not counted as inbound; an untrusted From header cannot suppress a received reply.

The source-check workflow can import normalized selected-Sheet rows through `private.ingest_sheet_rows`; this shares the validated CSV ingestion core. Bound ranges must contain at most 500 data rows (larger sources need checkpointed range partitioning before activation). Optional `gmail_thread_id` establishes the original proposal-thread metadata used by the first action draft. The contact remains unenrolled until the reviewed live activation. Missing thread metadata leaves reply coverage explicitly blocked. Reimport preserves IDs and does not delete omitted records. A proposal already owned by CSV requires an explicit reviewed source-authority mapping before moving to Sheet authority.
