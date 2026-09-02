# Handoff — Direct Debits / portal access (2026-09-02)

Written for the session that continues this work (local memory does not travel to
cloud sessions). Read alongside `docs/OPERATIONS.md` → "Client portal access links",
"Direct Debits board", "GoCardless Direct Debit".

## State

- **main (production, 02409ba):** the reconciled tree — old GitHub main + the local ops
  Phases 2–4 (migrations renumbered 0040–0043) + the portal reset-link rework
  (`lib/portalLinks.ts`, `lib/portalAccess.ts`, `portal/reset/*`). Verified end to end
  locally with a throwaway user (invite + recovery links); the throwaway was deleted.
- **feat/direct-debits (2aa9b50, one commit ahead of main):** Phase 1 of the Direct Debits
  feature. tsc clean, 235 vitest tests green, `next build` succeeds. NOT yet deployed —
  Louis has to say "push". No migration in this phase.
- Supabase Auth URL config fixed by Louis 2026-09-02 (Site URL https, `https://nullshift.co.uk/**`).
- Vercel production still has **no GOCARDLESS\_\* env vars**. A GoCardless merchant account
  exists (louis@nullshift.co.uk, verified Jul 2026). Sandbox rehearsal, then live.

## What Phase 1 does (see commit 2aa9b50 message for detail)

- `CarePlan.nsiPlan` bridges subscriptions ids (hosting/hosting_api/build_3/build_10) to the
  pricing engine's ids (core/pro/max/enterprise). `contractedMrr()` used to compare the two
  directly and never matched — bands never reached billing.
- `lib/pricing/contractedPrice.ts` — pure price rule; `contracted.ts` — `contractedPrices()`.
- `lib/directDebit.ts` — the one Direct Debit starter (portal, client hub, board).
- `/admin/billing/direct-debits` — the board; tab strip on `/admin/billing`.
- Portal chooser: only the 3 sellable plans at the client's price; unscored → "being prepared";
  `quoted_pence` echoed and re-verified server-side.
- Webhook: 409 idempotency adoption, payments via `getPayment`, mandates.replaced, orphan
  mandate cancel, audit rows. `ensureClientWorkspace` first-login race compensation.

## Owner decisions already taken (do not re-open)

Unscored clients see no options until scored · bracket = NSI form on `/admin/clients/[id]/pricing`
· Enterprise never self-serve · Direct Debit link gated on signed proposal OR any paid invoice ·
area lives at `/admin/billing/direct-debits` · sandbox rehearsal before live · recipient defaults
to `tenants.contact_email` with an override field on the board.

## Remaining steps

1. Louis: "push" → fast-forward main to `feat/direct-debits`, Vercel deploys. Confirm the board
   renders (needs an admin login) and `/portal/plan` for a scored client.
2. Louis: score The Dance Exclusive (`/admin/clients/2e458eb1-2217-40d2-a52e-9bdfc32c797e/pricing`,
   enter £0 vendor cost if none, Save, "Set contracted rate"), then from the board "Send sign-in
   link" (she has never signed in; her account is hello@thedanceexclusive.co.uk — confirm she
   reads that inbox, she also uses essexdanceexclusive@gmail.com). Tell her: separate login from
   her Dance Exclusive admin, same email, different password, link valid one hour.
3. Louis: GoCardless sandbox token + sandbox webhook endpoint (`https://nullshift.co.uk/api/gocardless/webhook`)
   → Vercel `GOCARDLESS_ACCESS_TOKEN`, `GOCARDLESS_WEBHOOK_SECRET`; leave `GOCARDLESS_ENVIRONMENT`
   unset → board shows Sandbox. Rehearse: Send Direct Debit link on a test client, test bank
   20-00-00 / 55779911, first name "Successful" → row Active + `care_plan.dd_activated` audit row.
4. Go live: live token + live webhook secret, `GOCARDLESS_ENVIRONMENT=live`, redeploy.
5. Phase 2 (after live): `supabase/migrations/0044_care_plan_offers.sql` — price-offer snapshot
   (tenant, assessment id, pricing version, band, prices jsonb, status), `subscriptions.offer_id /
scale_assessment_id / pricing_version`; "Send plan options" snapshots an offer; the portal
   renders the open offer; choosePlan validates against it; webhook marks it fulfilled.
6. Loose ends: link Laura West's existing GoCardless customer (created 4 Aug outside the app) to
   New Future Therapy instead of minting a second mandate; record Amie's £1,015 Stripe payment
   (24 Aug, INV-0001, from essexdanceexclusive@gmail.com) against her final invoice; delete the
   untracked `apps/web/portal-setup-ollie.tmp.ts` (breaks local `next build`; not in git).

## Gotchas

- Husky lint-staged runs on commit; in a git worktree it fails — commit with
  `git -c core.hooksPath=/dev/null commit` and run prettier manually.
- Two Claude sessions diverged main for two weeks. Always `git fetch` and check
  `git status -sb` ahead/behind before trusting the local tree.
- Vercel Hobby keeps runtime logs 1h; Supabase `auth.audit_log_entries` is empty. The
  `audit_log` table is the reliable trail — write from server code via `logAuditAsService`
  when the caller has no cookie session (webhooks, an action that just created the session).
