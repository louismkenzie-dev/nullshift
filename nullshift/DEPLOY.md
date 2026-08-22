# Deploying the Nullshift monorepo to Vercel

The repo is a **pnpm + Turborepo monorepo**, but it deploys as **one Vercel
project / one domain**. The git repo root is the **parent** of `nullshift/`, and
the single deployable app is the consolidated web app:

| Surface        | URL path                 | Served by             |
| -------------- | ------------------------ | --------------------- |
| Marketing site | `nullshift.co.uk/`       | `nullshift/apps/web`  |
| Staff OPS hub  | `nullshift.co.uk/admin`  | same app, `/admin/*`  |
| Client portal  | `nullshift.co.uk/portal` | same app, `/portal/*` |

> **One app, three areas.** `apps/admin` and `apps/portal` were merged into
> `apps/web` under the `/admin` and `/portal` route prefixes. Public marketing
> pages live in the `app/(marketing)/` route group (so smooth-scroll + the cookie
> banner never wrap the internal tools). `apps/clinic` remains a gated Phase-6
> scaffold and is **not** deployed.

## The single Vercel project → `nullshift.co.uk`

Vercel → project **`nullshift`** → **Settings → General**:

- **Root Directory:** `nullshift/apps/web` — and tick **“Include files outside the
  Root Directory in the Build Step”** (so the workspace `packages/*` resolve).
- **Framework Preset:** Next.js
- **Build / Install / Output:** leave as the Next.js defaults (auto).
- **Settings → Environment Variables:** ensure every var below is present.
- **Deployments →** redeploy the latest `main` (uncheck “use existing build cache”).

That's it — `/admin/login` and `/portal/login` are served by the same deployment,
so there are **no admin/portal subdomains, no extra projects, and no extra DNS** to
manage. If the old `nullshift-admin` / `nullshift-portal` projects and the
`admin.` / `portal.` subdomains still exist, they can be **deleted** (optional
cleanup — they point at the removed `apps/admin` / `apps/portal`).

## Environment variables (one project now needs the full set)

Because the one project runs marketing **and** the staff hub **and** the portal,
it needs the union of all the env that used to be split across three projects.
Set `NEXT_PUBLIC_SITE_URL=https://nullshift.co.uk`. Secrets are pasted by you
(never commit them).

**Public:**
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_CAL_LINK`

**Server / secret:**
`SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
`RESEND_AUDIENCE_ID`, `ENQUIRY_NOTIFY_EMAIL`, `ENQUIRY_FROM_EMAIL`,
`FUNNEL_RESOURCE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

**AI (Agent Consultation on /plan, inbox ingest, issue triage, fix-batch dispatch):**
`ANTHROPIC_API_KEY` — without it the funnel falls back to the templated plan and
the ops AI features degrade to manual. Optional: `ANTHROPIC_WORKSPACE_SLUG`
(Managed Agent links), `GITHUB_DISPATCH_TOKEN` (fix-batch → GitHub @claude issues).

**GoCardless Direct Debit (care plans):**
`GOCARDLESS_ACCESS_TOKEN`, `GOCARDLESS_WEBHOOK_SECRET`,
`GOCARDLESS_ENVIRONMENT` (`live` or unset for sandbox)

**Xero mirror sync (invoices):**
`XERO_CLIENT_ID`, `XERO_CLIENT_SECRET` — optional tuning:
`XERO_SALES_ACCOUNT_CODE`, `XERO_PAYMENT_ACCOUNT_CODE`, `XERO_TAX_TYPE`

**Cron:**
`CRON_SECRET` — gates `/api/cron/weekly-pulse` (the Friday client-pulse digest).
Unset, the cron 403s forever with no visible signal — set it or the ritual
silently stops.

`VERCEL_DEPLOY_HOOK_SECRET` — verifies the team-wide Vercel webhook
(`deployment.succeeded` → `/api/vercel/deploy-hook`) that mirrors every
production deployment into the SOC 2 change register (`/admin/soc2/changes`).
Create the webhook under Vercel → Team Settings → Webhooks, paste its secret
here. Unset, the route answers 503 and deployments are not mirrored.

> `STRIPE_CONNECT_CLIENT_ID` (previously listed here) belongs to the dormant
> Stripe Connect clinic scaffold — not needed until that feature ships.

> **`ADMIN_EMAILS` gates `/admin`.** It must contain the email you log in with
> (e.g. `louis@nullshift.co.uk`); without it the ops hub returns "NOT AUTHORISED".

## Notes

- The repo root holds leftover files (`index.html`, `Hero.txt`, `pricing-ui.txt`,
  `nullshift-intro.html`, root `package.json`/`package-lock.json`). With the Root
  Directory set to `nullshift/apps/web`, these are ignored and can be removed in a
  follow-up commit.
- Production builds from `main`. CI (`.github/workflows/ci.yml`) runs typecheck ·
  lint · build on every push/PR.
