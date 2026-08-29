# Security baseline

The §19 minimums from the legal implementation specification, with what was
actually checked and when. Items marked ⬜ need a person to verify something
outside this repository — they are not code problems and code cannot close them.

Last verified: **20 August 2026**, against the live Nullshift Ops project
(`cweftpoaojwzllzficgt`) and this repository at commit time.

| # | Minimum | State | Evidence |
|---|---|---|---|
| 1 | MFA on production cloud / source control / admin | ⚠ partial | Staff TOTP enrolment + aal2 step-up is enforced for `/admin` (`app/admin/security`, and the `(dashboard)` layout redirects to it). **Supabase, Vercel and GitHub account MFA are not verifiable from here** — confirm on each provider. |
| 2 | Secrets outside public bundles and repositories | ✅ | Only `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are exposed client-side; both are publishable by design. `SUPABASE_SERVICE_ROLE_KEY` is read only in `packages/db/src/server.ts` and `env.ts`, both server-only. The repo tracks `.env.example` and no `.env`. |
| 3 | TLS/HTTPS enforced | ✅ | Vercel terminates TLS and redirects HTTP for all deployments; Supabase rejects non-TLS connections. |
| 4 | Role-based / least-privilege production access | ✅ | RLS is enabled on **all 46 tables** in `public` — verified both by scanning every migration and by querying `pg_class.relrowsecurity` on the live database (0 tables without it). Client access flows only through `memberships`; staff cross-tenant read goes through `is_internal_staff()`. |
| 5 | Production database backup policy enabled and documented | ⬜ | Supabase plan-level backups apply, but the retention and restore-test evidence is **not recorded**. Confirm the schedule, then record a backup policy id and reference it from Order Forms (`technical.backupPolicyId`) — an order storing personal data without one is blocked by `orderFormBlockers()`. |
| 6 | Logs avoid secrets and payment-card data | ✅ | AI tool logs redact by key name and by value shape before the insert (`lib/ai/impact.ts`, tested in `tests/ai-gates.test.ts`). No card data is ever received: payment details go to Stripe/GoCardless hosted components, and no PAN/CVV column exists in the schema. |
| 7 | Dependency vulnerability process | ⚠ partial | Dependabot/`pnpm audit` is not wired into CI. Until it is, this is a manual `pnpm audit` before each release. |
| 8 | Access offboarding process | ⬜ | No documented checklist for removing a departing person from Supabase, Vercel, GitHub, Resend, Stripe and the admin allowlist. Write one. |
| 9 | Incident escalation contacts configured | ⚠ partial | `NEXT_PUBLIC_LEGAL_EMAIL` and `NEXT_PUBLIC_PRIVACY_EMAIL` are set; **`NEXT_PUBLIC_SUPPORT_EMAIL` and `NEXT_PUBLIC_BILLING_EMAIL` are deliberately unset** (an unmonitored address is worse than none). Set them once monitored. |
| 10 | Data-breach notification runbook | ⚠ partial | `docs/runbook-compliance.md` exists. Review it against the current schema and subprocessor list. |
| 11 | Subprocessor inventory matches actual vendors | ⚠ partial | 7 providers are listed in `legal/subprocessors.ts`, **all unverified**: legal name, processing country and transfer mechanism are placeholders pending confirmation. |
| 12 | Leaked-password protection | ⬜ | Supabase Auth's HaveIBeenPwned check is **disabled**. Enable it in the Supabase dashboard (Authentication → Passwords) — it is a settings toggle, not a migration. |

## Database linter findings, and what was done

Run `get_advisors(type: "security")` against the project to reproduce.

**Fixed** in `0036_function_hardening.sql`:

- `marketing_allowed(text)` was executable by `anon`. That is an email-
  enumeration oracle — anyone could ask the public API whether a given address
  is on our marketing list. EXECUTE revoked from PUBLIC (revoking from `anon`
  and `authenticated` alone does nothing: both inherit from PUBLIC), leaving
  only `service_role`.
- The five `next_*_ref()` allocators were executable by `anon`, leaking how
  many Order Forms, Change Orders, complaints and terminations exist this year.
  Same fix.
- `enforce_change_order_before_build()`, `freeze_confirmed_termination()`,
  `enforce_subprocessor_notice_period()` and `set_updated_at()` had a mutable
  `search_path`. Pinned to `public`.

**Deliberately not changed:**

- `is_internal_staff()`, `is_member_of()`, `is_tenant_admin()` remain callable.
  Every RLS policy in the schema calls them and a policy expression runs as the
  invoking role, so revoking EXECUTE would take the database offline for every
  client. They answer only about the caller's own memberships and leak nothing.
- `export_tenant_data(uuid)` and `tenant_footprint()` are callable by signed-in
  users but both begin with an `is_internal_staff()` check and return nothing
  otherwise. Verified by reading the deployed function definitions.
- `rls_enabled_no_policy` on `email_verifications`, `ops_settings`,
  `rate_limits` and `stripe_events`: RLS enabled with no policy is
  **default-deny**, which is correct for tables only the service role touches.

## Still to do

The ⬜ and ⚠ rows above, in rough priority order: enable leaked-password
protection (one toggle), record the backup policy, verify the subprocessor
register, write the offboarding checklist, wire dependency scanning into CI.
