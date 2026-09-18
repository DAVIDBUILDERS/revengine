# Technical SEO — client connect

Technical SEO is catalog slot **#9** (`technical-seo-monitor`). It stays in **preparation**. Copy-out is complete delivery. DAVID does not write the CMS and does not use Search Console.

DataForSEO is DAVID-managed and invisible, the same way Instantly is for Outbound Email SDR. Customers never log in, paste a key, or see DataForSEO.

## What the client supplies

1. Company website in **Connections** (shared; not copied into this agent).
2. Confirmed company facts.
3. **1–20 keywords** unique to this specialist.
4. A **SERP location** (United States, United Kingdom, Canada, Australia, or Germany).

They do not bind a DataForSEO account.

## What DAVID supplies

- DataForSEO v3 Basic auth (`DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD`)
- Pingback HMAC (`DATAFORSEO_WEBHOOK_SECRET`, 32+ characters)
- On-Page crawl of the confirmed origin only (max 50 pages, JavaScript on, no subdomains)
- Google organic live/regular (desktop, depth 10) for tracked keywords
- Labs ranked keywords (25 inventory rows)
- Copy-out report in the specialist drawer

## Live runtime (operator)

Put the three secrets on the **production web runtime only**. Do not load them in fixture, preview, or demo.

Pingback URL DataForSEO will GET:

`{APP_ORIGIN}/api/webhooks/dataforseo?id=$id&tag={workspaceId}&token={hmac}`

`token` is `HMAC-SHA256(DATAFORSEO_WEBHOOK_SECRET, workspaceId)`.

Apply migration `202609160030_technical_seo.sql` before live use.

## Fixture

Local fixture records `FIXTURE_ONLY_dataforseo_*` pages and ranks. It must not claim a live fetch. Fixture mode rejects DataForSEO credentials.

## Out of scope

CMS write-back, Google Search Console, Lighthouse/CWV, Instant Pages, backlinks, Bing, YouTube, keyword ideas, and the next catalog agent.
