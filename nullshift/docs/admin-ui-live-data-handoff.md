# Operations preview: UI polish and existing-record onboarding

17 September 2026. Based on Fable's `feat/admin-redesign` at `68296dc`.
Working branch: `codex/admin-ui-live-data`.

## What is ready to try

- Local preview: http://127.0.0.1:3114/admin/next (normal staff sign-in and MFA).
- Quieter Halo-brand shell, compact navigation, readable tables/cards, mobile bottom navigation and account controls.
- Today, Clients, client workspaces, Sales, Delivery, Finance and Agreements read existing Nullshift records through the signed-in user's database session.
- Tools & settings and Automations show the actual environment gates, not invented integration health.
- Add client: Company → Project → After launch → Review.
- Practice walkthrough fills fictional example details and completes entirely in browser memory. It never calls the creation action.
- Real creation writes a client, one discovery project and best-effort audit entries only. It does not invite a user, issue a contract/invoice, choose a monthly tier, or call a payment/email provider.
- Existing detailed pricing, contracts and billing remain in the original admin tools. These links do not prefetch, avoiding legacy page-load side effects.

## Data and commercial boundaries

No existing records, agreements, prices or provider IDs were edited. No migrations were applied. Similar client names are deliberately left separate.

The new managed/handover preference is an internal note, not accepted terms. Managed packages are selected after build acceptance; recurring billing requires the agreed contractual date. The £600 handover amount is guidance requiring agreed scope and tax treatment, not an automatic charge.

Fable's Quote Studio and other unconnected deep-link screens still use explicitly labelled fictional data. New-model financial storage, billing activation and integration workers are not enabled by this work. This is not a completed live integration with Revolut, Xero, Stripe or GoCardless.

Financial views show stored GBP amounts, not live bank balances or reconciled revenue. Monthly totals use active recorded subscriptions, preserving their original amounts. Missing or incomplete money datasets do not become zero totals. Queries cap at 1,000 records and visibly disclose truncation.

## Configuration

The local server uses `OPS_REAL_DATA=true` and `OPS_CLIENT_CREATE=true`. Both default off elsewhere. They are separate from `OPS_V2_FLAGS`, which remains empty in this preview.

Use the existing Supabase URL, public key, authenticated staff session and normal admin allowlist/membership. Never commit credentials. The new data loader and creation action do not use a service-role client. The unchanged parent layout retains its existing transitional staff-membership provisioning behaviour.

## Safe persistence and remaining limits

- Server action rechecks staff identity, MFA assurance, input shape and lengths.
- Stable client/project UUIDs make retries of the same draft idempotent.
- Existing contact-email matches return a link instead of overwriting records.
- Two independently opened drafts can still race on the same email: there is no new database unique constraint. Review existing clients before creating a second workspace.
- Without a new database function/migration, client and project creation are two writes. A partial save is reported explicitly, with a same-draft retry that uses the original stored brief.
- Reloading a draft discards unsaved form input; no client information is put in local storage.
- Production records were not created merely to test this flow. Automated save tests use mocks; the user can make the first genuine save after reviewing the form.

## Verification

- Production build and legal guard passed.
- Typecheck passed.
- 900 automated tests passed, including 46 new tests covering validation, real-data projections, auth/MFA, duplicate protection, retries and partial saves.
- Full lint: zero errors; existing repository warnings remain. Changed files have no new warnings.
- Authenticated browser checks: all seven main views, real client search/detail, required-field validation, forward/back form persistence, service-route choice, review confirmation and practice completion.
- Responsive checks at 390px, 847px and 1440px; no horizontal overflow in tested new views.
- No live save, email, invoice, payment, provider sync or production deployment performed for verification.

## Files changed

| Area                             | Files                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configuration                    | `.env.example`                                                                                                                                                                                                                                                                                                                        |
| Legacy/new shell separation      | `apps/web/app/admin/(dashboard)/layout.tsx`, `AdminFrame.tsx`                                                                                                                                                                                                                                                                         |
| New shell and responsive styling | `apps/web/app/admin/(dashboard)/next/layout.tsx`, `Rail.tsx`, `next.module.css`                                                                                                                                                                                                                                                       |
| Real-record views                | `next/LiveViews.tsx`, `next/page.tsx`, `next/clients/page.tsx`, `next/clients/[id]/page.tsx`, `next/sales/page.tsx`, `next/delivery/page.tsx`, `next/finance/page.tsx`, `next/finance/layout.tsx`, `next/agreements/page.tsx`, `next/settings/page.tsx`, `next/automations/page.tsx` (all beneath the same admin dashboard directory) |
| Onboarding                       | `next/clients/new/page.tsx`, `NewClientWizard.tsx`, `actions.ts`                                                                                                                                                                                                                                                                      |
| Loading/recovery                 | `next/loading.tsx`, `next/error.tsx`                                                                                                                                                                                                                                                                                                  |
| Data and validation              | `apps/web/lib/next/live-data.ts`, `live-model.ts`                                                                                                                                                                                                                                                                                     |
| Tests                            | `apps/web/tests/operations-live-model.test.ts`, `operations-live-data.test.ts`, `operations-create-workspace.test.ts`                                                                                                                                                                                                                 |
| Handoff                          | This document                                                                                                                                                                                                                                                                                                                         |

## Next release gate

Review the interface and use a genuine client for the first real save. Separately review Fable's pending migrations and provider workflows, resolve pricing/tax decisions and test their sandbox behaviour before enabling them. Do not promote this branch wholesale just because the UI build passes.

Skill guidance used: Next.js server/client boundaries, Supabase cookie-scoped access, React server-action authentication and request-scoped caching, and browser verification. The redesign keeps secrets and record loading on the server and uses a small interactive client component for onboarding.
