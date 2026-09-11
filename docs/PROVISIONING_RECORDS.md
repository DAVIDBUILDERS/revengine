# Provisioning responsibilities

Routine client configuration now belongs in the six-section [onboarding flow](ONBOARDING_IMPLEMENTATION.md). The previous per-workspace SQL templates have been superseded by migration 018 and checked application commands.

Owners create workspaces, save company facts and sources, choose responsibilities, configure capacity and budgets, select allowed contacts, authorize a bounded template when needed, invite colleagues, assign a registered DAVID operator and apply reviewed settings in the product. Operators configure the workspace allowance and resolve the shared setup queue. Apply creates versioned policy/authority records and leaves work paused. Resume and dispatch still enforce runtime readiness.

Platform administration remains responsible for the first trusted operator and MFA, Supabase migrations and restricted database roles, Auth delivery and redirect allowlists, Google app registration, approved model/provider pricing and global limits, Vercel Workflow/Cron configuration, alert delivery and release/restore evidence. The independent live deployment gate is not a client onboarding toggle.

No setup migration or live provider verification is claimed as executed. Follow the exact missing-setup checklist in [ONBOARDING_IMPLEMENTATION.md](ONBOARDING_IMPLEMENTATION.md), then [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md). Never put migration credentials in Vercel runtime or ask clients to paste provider-app secrets into onboarding.
