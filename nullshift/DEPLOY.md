# Deploying the Nullshift monorepo to Vercel

The repo is a **pnpm + Turborepo monorepo**. The git repo root is the **parent**
of `nullshift/`, and the three deployable apps live at:

| App            | Path (Vercel "Root Directory") | Domain                   |
| -------------- | ------------------------------ | ------------------------ |
| Marketing site | `nullshift/apps/web`           | `nullshift.co.uk`        |
| Staff OPS hub  | `nullshift/apps/admin`         | `admin.nullshift.co.uk`  |
| Client portal  | `nullshift/apps/portal`        | `portal.nullshift.co.uk` |

> **Why the live site was stale:** the existing `nullshift` Vercel project's
> **Root Directory was the repo root**, so Vercel served a leftover static
> `index.html` and ignored the whole Next monorepo. Fixing the Root Directory
> (below) is the actual fix — no code change deploys the app until this is set.

Each app is a separate Vercel **Project** pointing at the **same GitHub repo**
with a different Root Directory. Vercel auto-detects the pnpm workspace and builds
only that app.

## 1. Marketing site → `nullshift.co.uk` (fix the existing project)

Vercel → project **`nullshift`** → **Settings → General**:

- **Root Directory:** `nullshift/apps/web` — and tick **“Include files outside the
  Root Directory in the Build Step”** (needed so the workspace packages resolve).
- **Framework Preset:** Next.js
- **Build / Install / Output:** leave as the Next.js defaults (auto).
- **Settings → Environment Variables:** ensure the vars below are present.
- **Deployments →** redeploy the latest `main` (uncheck “use existing build cache”).

## 2. Staff hub → `admin.nullshift.co.uk` (new project)

Vercel → **Add New… → Project** → import the same `nullshift` GitHub repo:

- **Root Directory:** `nullshift/apps/admin` (+ “Include files outside…”)
- **Framework:** Next.js
- Add the env vars below (admin needs the **server** secrets).
- **Settings → Domains →** add `admin.nullshift.co.uk` → Vercel shows a **CNAME**
  → add it at your DNS registrar (e.g. `admin` → `cname.vercel-dns.com`).

## 3. Client portal → `portal.nullshift.co.uk` (new project)

Same as admin, with **Root Directory:** `nullshift/apps/portal` and domain
`portal.nullshift.co.uk`.

## Environment variables

Set `NEXT_PUBLIC_SITE_URL` per project to that app's own URL. Secrets are pasted
by you (never commit them).

**Public (all apps):**
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_CAL_LINK`

**Server / secret (admin, portal, and web for its API routes):**
`SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
`RESEND_AUDIENCE_ID`, `ENQUIRY_NOTIFY_EMAIL`, `ENQUIRY_FROM_EMAIL`,
`FUNNEL_RESOURCE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_CONNECT_CLIENT_ID`

## Notes

- The repo root holds leftover files (`index.html`, `Hero.txt`, `pricing-ui.txt`,
  `nullshift-intro.html`, root `package.json`/`package-lock.json`). Once every
  project's Root Directory points at an app, these are ignored. They can be
  removed in a follow-up commit (don't remove them while any project still builds
  from the repo root, or that project will 404).
- Production builds from `main`. CI (`.github/workflows/ci.yml`) runs typecheck ·
  lint · build on every push/PR.
