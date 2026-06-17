# @nullshift/clinic — Product B (HARD GATE: DO NOT BUILD YET)

This app is an **intentional empty scaffold**. It is the productised clinic core
(booking + deposits + reminders + records + invoicing) that Nullshift will sell
to clinics as a tenant-configurable module.

## The gate (brief §1, §11, §12)

Do **not** write feature code here until **three clinics confirm in discovery
calls** that they:

1. pay a **four-figure annual software bill**, and
2. **hate something specific** about their current software.

Until that gate clears, this stays empty. Building it early — before validated
demand — is one of the guardrail violations the brief explicitly calls out.

When the gate clears: build the configurable core for ~15h per-clinic onboarding,
reusing `packages/db` (multi-tenant, RLS), `packages/ui`, `packages/auth`,
`packages/billing`. One tenant_id per clinic; never a new Supabase project.
