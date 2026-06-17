# Nullshift — Compliance & Security Runbook (SOP store)

The operational SOPs that keep Nullshift a trustworthy data processor for clinic
clients (brief §5 runbook/SOP store + §9 compliance). Keep this current.

## Data-protection model

Nullshift is a **data processor**; each clinic is the **controller**. One Supabase
project serves all tenants; isolation is enforced by Row-Level Security on
`tenant_id` (the `is_member_of` / `is_internal_staff` policies). The automated
cross-tenant RLS test (`packages/db` → `pnpm test`) is part of the compliance
evidence — a Tenant-A client cannot read Tenant-B data.

## Controls already enforced in code

- **DPA before go-live** — DB trigger `enforce_dpa_before_live` blocks a project
  reaching `stage='live'` until a `dpa_signed` compliance record exists for the
  tenant. Verified.
- **SAR export** — `export_tenant_data(tenant_id)` (staff-only) + the admin route
  `/api/sar/<tenantId>` produce a tenant's full data set as JSON. Logged.
- **Right to erasure / retention** — Compliance centre "Erase tenant" hard-deletes
  a tenant; FK `on delete cascade` removes all its rows. The erasure is
  audit-logged _before_ the cascade (the audit row survives via
  `audit_log.tenant_id on delete set null`).
- **Audit log** — append-only `audit_log`; the `stamp_audit_row` trigger binds
  `actor`/`created_at` for end-users so entries can't be forged. `logAudit`
  (`@nullshift/db/audit`) is called on every staff action and client-data write.
- **Change-request guard** — clients can only approve/reject an `awaiting_approval`
  request and never edit the staff-set price (DB trigger).

## Staff 2FA (TOTP) — TO ENABLE

Supabase Auth supports TOTP MFA. To require it for staff:

1. In the Supabase dashboard → Authentication → enable MFA (TOTP).
2. Build the enrolment step (`supabase.auth.mfa.enroll({ factorType: 'totp' })`)
   into the admin account screen; staff scan the QR in an authenticator app and
   verify a code (`mfa.challenge` + `mfa.verify`).
3. Enforce at the admin boundary: in the admin `(dashboard)/layout`, require
   `currentLevel === 'aal2'` (from `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`),
   redirecting un-stepped sessions to an MFA challenge.
   _Do not enforce before at least one staff factor is enrolled, or it locks out._

## Per-tenant usage instrumentation (cost guardrail) — APPROACH

Hosting cost attributable to a client must stay a small fraction of its recurring
fee (brief §8). Wire:

1. **Storage** — sum `documents` object sizes per tenant (extend `documents` with a
   `bytes` column on upload) + Supabase Storage API per-bucket usage.
2. **Egress / function calls** — Supabase usage API (project-level) apportioned by
   tenant activity, or a per-tenant request counter in the proxy.
3. **Alert** — if a tenant's monthly attributable cost approaches a meaningful
   share of its MRR, flag it on the billing page as a _pricing trigger_ (raise the
   plan), never absorb it. The `audit_log` already records `connect.application_fee`
   volume for the transaction line.

## Breach protocol (72-hour awareness)

1. Contain: rotate keys (Supabase service role, Stripe), revoke sessions.
2. Record a `breach` compliance record with scope + affected tenants.
3. Assess controller-notification duty; notify affected clinic(s) without undue
   delay so they can meet their 72-hour ICO obligation.
4. Post-incident: write up root cause here; add a regression test.

## Security baseline

- Secrets in env only; service-role key server-side only. `.env.example` is the
  only committed template.
- Dependency scanning: Dependabot (`.github/dependabot.yml`), weekly.
- HTTPS everywhere (Vercel); encryption at rest (Supabase).
- Least privilege: client roles `client_admin`/`client_member`; staff
  `owner`/`staff` on the internal tenant.
