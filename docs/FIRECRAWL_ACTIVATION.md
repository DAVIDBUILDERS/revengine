# Activation website research

The shared POST /api/context/capture endpoint uses Firecrawl v2 scrape for operational website research, including the conversational activation, guided activation, and source setup interfaces. API reference: https://docs.firecrawl.dev/api-reference/endpoint/scrape

Set FIRECRAWL_API_KEY as a server-only Vercel environment variable and redeploy. Never use a NEXT_PUBLIC prefix. Production has a sensitive key configured; test does not. Vercel does not return sensitive values on env pull, so an administrator must add a key separately to test. There is no silent direct-fetch fallback. Synthetic demo flows remain synthetic.

A capture requests markdown and links for the supplied HTTPS website, then up to two relevant same-origin pages. Requests use the fixed Firecrawl endpoint, no custom actions or PDF parsing, verified TLS, a 45-second total deadline, and a 1 MB per-response limit. Saved source text is capped at 30,000 characters per page. Public DNS validation precedes each submitted URL. Firecrawl controls its browser and redirect handling; this adapter does not claim DNS pinning inside the provider.

The existing workspace owner/operator authorization, quota, request revision, source hashing, evidence persistence and confirmation flow remain in place. Captures record provider=firecrawl. No source content is treated as instructions or verified facts. Missing credentials, provider rejection, unavailable pages and partial results are explicit. No captured text is executed as HTML.

Validation: deterministic adapter tests cover provider routing, page scope, missing keys, private addresses, provider failures, partial results and response bounds. Production key validity requires an authenticated capture in a workspace; local env pull cannot test a sensitive Vercel key. The existing direct website connector remains for its independent tests, but activation no longer invokes it.

Hosted verification passed 13 checks across two isolated test workspaces, including HTTP 503 FIRECRAWL_UNCONFIGURED from the authenticated capture endpoint and denied cross-workspace/cross-origin access. Production browser was signed out during this change, so a successful production Firecrawl capture is not yet verified.

## Findings-first review
Successful capture now goes directly to the business summary, even when audience or offer extraction is incomplete. The summary labels missing facts instead of promising all facts were found. Missing audience has explicit owner-choice buttons and a custom-answer option; these are not presented as website findings. Requested edits return to the summary. Failed/no-website capture retains the manual path. Extraction recognizes Markdown line boundaries and formatted structured labels. Seven briefing browser scenarios and fourteen domain tests passed; build/typecheck/lint passed.

## Finish-screen loop correction
The finish screen previously linked Continue setup back to the same briefing permission review; completing that review returned to finish. It now opens the full profile's readiness section (mode=profile, setup=5). Open my workspace / Save and exit opens Your Team and clears briefing-only routing parameters. Answers are flushed before navigation, preserving existing save-failure handling. A browser regression test verifies both destinations and refresh persistence. Typecheck and lint pass.

## Approval handoff
Successful apply_onboarding now exits directly to Your Team after the final saved permission, rather than returning to the briefing finish page. No preparation is automatically requested. Failure still throws through the existing feedback path and prevents navigation. A transport-fixture regression checks one approval request, direct team navigation and refresh persistence. This verifies UI routing, not live database authorization.
