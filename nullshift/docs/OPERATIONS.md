# NullShift Operations Playbook

How the agency runs on the ops system built into `/admin` and `/portal`. Written so a new
team member (or a Claude Code session) can operate the agency cold.

## The model

```
Client channels (portal, WhatsApp, Zoom, email)
        │
        ▼
   ISSUE BANK (issues table) ── AI triage classifies kind/severity/billing
        │
        ▼  admin queues issues per system
   FIX BATCH (fix_batches) ── compiler assembles a context-complete work order
        │
        ▼  one click
   CLAUDE CODE ── GitHub issue with @claude → claude-code-action → PR
        │
        ▼  review + merge + "Mark shipped"
   CLIENT FEED (project_updates) + ALLOWANCE LEDGER (build_credit_events)
```

Everything the client asks for lands in **one place** (the issue bank), gets fixed in
**batches** (one compiled prompt, one PR), and flows back out as **client-visible updates**
and **billing events** automatically.

## Retainer tiers (single source of truth: `apps/web/lib/carePlans.ts`)

| Plan id       | Label         | £/mo | Includes |
|---------------|---------------|------|----------|
| `hosting`     | Hosting       | 40   | Hosting, paid Supabase, backups, security patches, bug fixes |
| `hosting_api` | Hosting + API | 80   | + Resend + OpenAI usage included |
| `build_3`     | Build 3       | 120  | + 3 build items per month |
| `build_10`    | Build 10      | 180  | + 10 build items per month |

**Build allowance:** plans with build items get a monthly meter. Consumption is recorded in
`build_credit_events` (negative delta) automatically when a `build_item` issue ships; top-ups
are positive deltas granted from `/admin/billing`. Remaining = plan allowance + sum of the
month's deltas. Clients see their meter in `/portal/plan`.

**Billing classification of every issue** (AI-suggested at intake, confirmed at triage):
- `covered` — bug fixes on anything we built, and questions. Always free.
- `build_item` — new/changed functionality up to ~a day's work. Consumes allowance.
- `out_of_scope` — bigger than a build item, or not something we built. Needs a quote
  (`quoted_price` on the issue).

## Daily loop

1. **`/admin`** (Mission Control) — the one screen: critical/overdue issues, batches in
   flight, promises coming due, items blocked on clients.
2. **`/admin/inbox`** — paste any WhatsApp export / call transcript. Claude splits it into
   draft issues (deduped against open ones) and flags promises you made. Confirm or discard
   each draft.
3. **`/admin/issues`** — triage: confirm kind/severity/billing, queue what's next.
4. **`/admin/batches`** — pick a system, "Compile batch". Review the work order, then either
   **Dispatch to Claude** (creates the @claude GitHub issue) or **Copy** it into a Claude
   Code cloud session. When the PR is merged and deployed, **Mark shipped** — issues close,
   the client's feed gets a plain-English entry per fix, allowance is decremented.

## Weekly loop

- **Friday pulse** — a Vercel cron (`/api/cron/weekly-pulse`, Fridays 08:00 UTC) emails a
  per-client digest (shipped / up next / blocked-on-you) to the agency inbox for review and
  forwarding. Requires `CRON_SECRET` set in Vercel.

## System passports (`/admin/systems`)

One page per client system = the team-handoff surface. It holds: repo / Vercel / Supabase
refs, stack, the **feature checklist** (built / in progress / planned — what's actually done),
the runbook, known footguns, provisioning checklist, open issues and batch history. Rule:
**if you learned something operating a system, it goes in the passport**, not in your head.

## Template bank (`/admin/templates`)

Proven system skeletons (e.g. "Bookings + Stripe Connect" extracted from The Dance
Exclusive). "Stamp a new system" creates the tenant, project and passport pre-filled with
the template's features and a provisioning checklist. v1 provisioning is checklist-guided
(create repo from the GitHub template, Supabase project, Vercel project); API-automated
provisioning (Supabase Management API / Vercel API / GitHub repo-from-template) is the
planned upgrade.

## Claude Code dispatch — setup per client repo

The "Dispatch to Claude" button posts the compiled work order as a GitHub issue mentioning
`@claude`. For that to become a PR automatically, each client repo needs:

1. `anthropics/claude-code-action@v1` installed as a workflow (`.github/workflows/claude.yml`).
2. `ANTHROPIC_API_KEY` in the repo's Actions secrets.
3. This app's `GITHUB_DISPATCH_TOKEN` env var: a GitHub token with `issues:write` on the
   client repos (fine-grained PAT recommended).

Without the token, the button hides and you copy-paste the work order into a Claude Code
session instead — same prompt, manual transport.

Alternative transports (verified available, not yet wired): Claude Code **Routines** expose a
per-routine HTTP fire endpoint; the **Managed Agents API** (beta) can run Anthropic-hosted
sessions against a mounted repo. Both can replace the GitHub hop later without changing the
compiler.

## Intake rules (how WhatsApp dies)

- Clients are steered to `/portal/requests` — three friendly buttons (broken / change /
  question), optional screenshot. Their requests get honest statuses ("Queued for the next
  fix batch", "Waiting on you") and expected-by dates, which kills "any update?" pings.
- Anything that still arrives via WhatsApp/voice/Zoom goes through `/admin/inbox` the same
  day. The issue bank is only trustworthy if it's complete.
- Promises you make in chat ("I'll sort that by Friday") are extracted into the promise
  ledger and surface on Mission Control before they're late.

## Environment variables (ops additions)

| Var | Purpose |
|-----|---------|
| `ANTHROPIC_API_KEY` | Intake triage classifier + inbox ingest parsing (`claude-opus-5`) |
| `GITHUB_DISPATCH_TOKEN` | "Dispatch to Claude" GitHub issue creation |
| `CRON_SECRET` | Protects `/api/cron/*`; Vercel sends it as a Bearer token |

All are optional — every AI/automation feature degrades to a manual path when unset.

## Data model quick reference (migration `supabase/migrations/0014_operations_core.sql`)

- `issues` — the bank. Status flow: `new → triaged → queued → batched → in_progress →
  fixed → shipped` (+ `awaiting_client`, `closed`). Client-visible rows appear in the portal.
- `fix_batches` — compiled work orders: `draft → compiled → dispatched → pr_open → shipped`.
- `system_profiles` — one per project: the passport.
- `system_templates` — the template bank.
- `build_credit_events` — allowance ledger, keyed by `(tenant, period)`.
- `subscriptions.plan` — text: `hosting | hosting_api | build_3 | build_10`.

## Team access

Admin access = a `staff` membership on the internal tenant (preferred) **or** an entry in
`ADMIN_EMAILS` (transitional). Every admin mutation is audit-logged (`audit_log`).
