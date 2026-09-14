# Team-led workspace setup — September 13

The user changed the product direction to live, call-led setup starting on Your Team. Company creation and default entry for a new operational owner now land on Your Team. Existing explicit briefing URLs remain compatible; the questionnaire is not required to choose a team.

Recommend my five now uses the returned snapshot to select the recommended agents visibly and announces the next action. Saving a team gives a persistent in-page result. Setup links save pending selections first and abort navigation on failure. Review team readiness opens the detailed validation section instead of restarting the briefing. Company, sources, permissions, people and readiness sections are directly accessible in any order through the team page. Existing revision conflicts, approvals and engineering/readiness blockers still apply; team selection never activates missing capabilities.

Validation: 13 Chromium UI checks passed, including recommendation selection and direct settings navigation, plus type checking, lint/module boundaries and the web production build. Hosted test routing passed 12 checks with two isolated accounts, new/returning entry and tenant/origin/signout denials. This does not establish real agent execution.

Test deployment: BNGwvEKPjuee9eag8sFifoVKopaz. Production deployment: BhF4Ce1wtUUUeKtCjHTtX3MA6obP. Both use the same application source; configuration/data remain isolated. No database migration was needed.
