# Launch agent stack

Product decisions for the remaining launch agents. Catalog size stays **32**. Outbound voice is a named vendor, not a 33rd agent.

## 1. Outbound Email SDR — Instantly (pilot)

DAVID is the customer-facing agent. Instantly is the invisible send, warmup, Unibox, reply-agent, and Calendly booking engine.

| DAVID owns | Instantly owns (invisible) |
| --- | --- |
| CSV mapping, HubSpot ingest later, sequence copy from confirmed facts, ready gates, pause, Pipeline replies | Sending accounts, domain warmup, campaign send, Unibox, bounce/unsubscribe, AI Reply Autopilot, Calendly auto-book |

This agent **does not find leads**. Instantly SuperSearch, Lead Finder, and AI Sales Agent prospecting stay off. Leads come from a customer CSV (email required) or, later, HubSpot. Send starts automatically when ready gates pass — no per-email approval. Fixture campaigns use `FIXTURE_ONLY_instantly_*` and must not claim a live mailbox send.

Operational prerequisites: Instantly Hypergrowth (webhooks), Instantly Credits (Reply Agent), paid Calendly (auto-book), `INSTANTLY_API_KEY` + `INSTANTLY_WEBHOOK_SECRET` on the live web runtime only.

### Instantly parent tenancy (operator)

DAVID is the Instantly parent. Customers never log in or paste a key. Isolation is **one Instantly sub-workspace per DAVID workspace**.

Do not put a real Instantly key in git, chat, demo, or preview.

1. Create a DAVID Instantly login. Keep a paid **admin** workspace (`DAVID Ops`) with **no customer campaigns**. Create the v2 API key there.
2. For each DAVID customer: Instantly **My Organization → Create Workspace**, subscribe Hypergrowth, add it to **Workspace Group** under DAVID Ops. Copy the Instantly workspace UUID (Account → Workspace & members).
3. In DAVID, **Bind Instantly workspace** with that UUID. Live send refuses to start without it.
4. Every Instantly API call uses `Authorization: Bearer <admin key>` and `x-as-workspace: <that UUID>`. Calls without the header hit the admin workspace — do not send from admin.
5. Create the webhook **on the sub-workspace** (same `x-as-workspace` header) to `{APP_ORIGIN}/api/webhooks/instantly`. Custom header: `x-instantly-secret` or `Authorization: Bearer` = `INSTANTLY_WEBHOOK_SECRET` (32+ characters). Events: `reply_received`, `email_sent`, `email_bounced`, `lead_unsubscribed`, `lead_meeting_booked`.
6. Webhooks route by Instantly `organization` / workspace UUID onto the bound DAVID workspace. They do **not** fall back to matching email across tenants.
7. Sending accounts stay in that sub-workspace. Move DFY inboxes with `POST /api/v2/accounts/move` (admin key; both workspaces in the group). One mailbox cannot serve two clients.
8. Instantly has no create-workspace API. Provisioning is operator + bind until they ship one.

Each Instantly workspace bills its own Email Outreach plan. Workspace groups can share Hyper Credits and Inbox Placement, not outreach seats.

## 2. LinkedIn outreach — HeyReach

| DAVID owns | HeyReach owns |
| --- | --- |
| Source-grounded note drafts from confirmed company facts, review, copy-out | LinkedIn send, inbox, rotation, and reply handling |

LinkedIn Outreach Assistant stays **preparation / planned**. There is no live LinkedIn OAuth send. Copy approved notes into HeyReach; DAVID does not send LinkedIn today.

## 3. Technical SEO — DataForSEO crawl and SERP (pilot)

DAVID is the customer-facing specialist. DataForSEO is the invisible crawl and Google organic/Labs reader.

| DAVID owns | DataForSEO owns (invisible) |
| --- | --- |
| Keywords (1–20), SERP location, copy-out report, pause | On-Page crawl of the confirmed origin (max 50 pages, JS on, depth via page cap), Google organic live/regular (desktop, depth 10), Labs ranked keywords (25) |

Copy-out is complete delivery. DAVID does **not** write the CMS. Search Console, Lighthouse/CWV, Instant Pages, backlinks, Bing, and keyword ideation stay off. Fixture crawls use `FIXTURE_ONLY_dataforseo_*` and must not claim a live fetch.

Operational prerequisites: DataForSEO v3 login/password (Basic auth), `DATAFORSEO_WEBHOOK_SECRET` (32+ characters) on the live web runtime only. Customers never see or paste a DataForSEO key.

Pingback: `{APP_ORIGIN}/api/webhooks/dataforseo?id=$id&tag={workspaceId}&token={hmac}`. HMAC is `HMAC-SHA256(DATAFORSEO_WEBHOOK_SECRET, workspaceId)`.

Do not put a real DataForSEO password in git, chat, demo, preview, or fixture `.env`. Keep credentials in Vercel production env (or a gitignored operational file that fixture mode never loads).

## 4. Outbound voice SDR — Bland, not in catalog

The intended dialer for a later outbound voice SDR is **Bland**. It does **not** enter the 32-agent catalog. AI Receptionist remains the planned inbound/reception slot and is not this outbound voice job.

## 5. Extra easy-to-launch agent — Search Growth

Search Growth is already **implemented preparation** (ContentBrief). It is the extra easy-to-launch specialist: confirmed website facts in, copy-out brief out, no publishing.

## 6. Website Sales Concierge — DAVID-hosted embed

Live chat is a **DAVID-hosted embed**. It is **not deployed** on the public site. Concierge remains the always-on included agent and produces FaqDraft preparation only until the embed ships.
