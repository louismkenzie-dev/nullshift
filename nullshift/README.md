# Nullshift — marketing site + Operations Hub

One pnpm + Turborepo monorepo, one deployable Next.js app (`apps/web`), three surfaces
on one domain:

| Surface              | Path               | What it is                                                             |
| -------------------- | ------------------ | ---------------------------------------------------------------------- |
| Marketing site       | `nullshift.co.uk/` | Public pages, /start lead funnel, /plan Agent Consultation, /legal     |
| Staff Operations Hub | `/admin`           | Pipeline, client hubs, issue bank, fix batches, billing, compliance    |
| Client portal        | `/portal`          | Proposal signing + DPA, project view, requests, payments, deliverables |

`apps/clinic` is a gated Product-B scaffold (see its README) and is not deployed.

## Setup

```bash
corepack pnpm install
corepack pnpm dev:web        # http://localhost:3000
```

- Node ≥ 20, pnpm via corepack (`packageManager` is pinned).
- Env: copy the variable list in [DEPLOY.md](DEPLOY.md) into `apps/web/.env.local`.
  Minimum to boot: the two `NEXT_PUBLIC_SUPABASE_*` vars + `SUPABASE_SERVICE_ROLE_KEY`
  - `ADMIN_EMAILS` (gates `/admin`). Stripe/GoCardless/Xero/Resend/Anthropic degrade
    gracefully when unset.
- Database: Supabase. **Read [supabase/README.md](supabase/README.md) before touching
  SQL** — two migration series exist and both must be applied in the documented order.

## Checks

```bash
corepack pnpm --filter @nullshift/web typecheck
corepack pnpm --filter @nullshift/web lint
corepack pnpm --filter @nullshift/web test   # vitest — pure workflow logic
corepack pnpm --filter @nullshift/db test    # cross-tenant RLS isolation (needs SUPABASE_DB_URL)
```

## The agency workflow the Hub encodes

Lead → discovery → proposal → acceptance + deposit → onboarding → build → review →
launch prep → live → care → complete.

1. **Lead**: /start funnel or /book → `leads` row (deduped by email; phone/UTM kept)
   → Agent Consultation drafts a research brief + plan on `/plan/[token]` →
   `/admin/pipeline` board (Won/Lost/Delete with typed confirm).
2. **Client**: opening a lead creates/reuses the tenant + build project →
   `/admin/clients/[id]` is the client hub — ownership + next action, discovery
   evidence, proposal modules (locked once signed), DPA state, stage control,
   invoices, notes, portal access.
3. **Proposal → money**: DPA-gated send → portal typed-signature acceptance →
   stage moves to **onboarding**, the itemised invoice (due in 14 days) goes out via
   Stripe + email + Xero mirror. **Build is gated on a paid invoice** (or a staff
   override with a recorded reason). Going **live** is DB-gated on a signed DPA.
4. **Delivery**: client requests land in the issue bank (`/portal/requests` →
   `/admin/issues`, AI-triaged, human-confirmed); WhatsApp/Zoom/email get pasted into
   `/admin/inbox` and split into draft issues a human confirms. Confirmed, classified
   work compiles into fix batches (`/admin/batches`) dispatched to Claude Code —
   unclassified or out-of-scope (unapproved billable) work is never batchable.
5. **Visibility**: `/admin` mission control shows fix-first issues, blocked-on-client,
   promises, batches, change requests, payments due/overdue, and recent audit
   activity; `/admin/systems` shows per-system computed delivery health with its
   evidence. The Friday pulse cron emails a per-client digest for human review.

## Integrations

| Integration | Used for                                                         | Key env                                               |
| ----------- | ---------------------------------------------------------------- | ----------------------------------------------------- |
| Supabase    | DB + auth + RLS + storage                                        | `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY` |
| Stripe      | Build invoices (hosted), care-plan subscriptions, webhook → paid | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`          |
| GoCardless  | Care-plan Direct Debits (Bacs)                                   | `GOCARDLESS_*`                                        |
| Xero        | Mirror of invoices + payments                                    | `XERO_CLIENT_ID/SECRET`                               |
| Resend      | All outbound email                                               | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`                 |
| Anthropic   | Agent Consultation, inbox ingest, issue triage, batch dispatch   | `ANTHROPIC_API_KEY`                                   |
| Vercel cron | Friday pulse digest                                              | `CRON_SECRET`                                         |

## Where things are

- `apps/web/app/(marketing)` — public site; `app/admin` — staff hub; `app/portal` — client portal.
- `packages/` — `db` (clients, leads, audit), `auth` (guards, signup/verify), `billing`
  (Stripe/GoCardless/Xero/MRR), `agents` (consultation), `ui`, `content`, `config`.
- `supabase/` — schema + BOTH migration series (apply order in its README).
- `docs/OPS-HUB-AUDIT-2026-08-18.md` — current-state audit, phased backlog, and the
  open product decisions. `docs/OPERATIONS.md` — the operating playbook.
- [DEPLOY.md](DEPLOY.md) — Vercel setup + full env reference.
