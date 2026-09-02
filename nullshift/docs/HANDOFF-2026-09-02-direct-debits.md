# Handoff — Direct Debits / portal access (2026-09-02)

Written for the session that continues this work (local memory does not travel to
cloud sessions). Read alongside `docs/OPERATIONS.md` → "Client portal access links",
"Direct Debits board", "GoCardless Direct Debit".

## State (updated 2026-09-02, afternoon)

- **main (production):** Phase 1 of Direct Debits is deployed (2aa9b50), plus
  auto-scoring (337f630 — `scale_evidence`, migration 0044 applied to Nullshift Ops)
  and Xero as the invoice rail (074a412). Every push to main deploys; the owner works
  on one branch and gives prompts — no fast-forward step any more.
- **GoCardless:** webhook endpoint created in the GoCardless dashboard;
  `GOCARDLESS_ACCESS_TOKEN` + `GOCARDLESS_WEBHOOK_SECRET` added to Vercel by Louis.
  `GOCARDLESS_ENVIRONMENT` unset → the board shows Sandbox until the live pair goes in.
- **Still to configure:** `SUPABASE_ACCESS_TOKEN` (auto-scoring reads client databases),
  `XERO_CLIENT_ID` / `XERO_CLIENT_SECRET` (Xero becomes the invoice rail; a payment
  service connected in Xero gives the online invoice a Pay-now button).
- Supabase Auth URL config fixed by Louis 2026-09-02 (Site URL https, `https://nullshift.co.uk/**`).
- Amie (The Dance Exclusive): account exists, never signed in, never reset — she was
  emailed a reference password on 19 Aug under the old flow. Fix = score her, then
  "Send sign-in link" from the board. The unscored state is now one click away:
  "Analyse the system" on her pricing page drafts the assessment from her repo + DB.

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

1. ~~Louis: "push" → fast-forward main~~ Done; deployed and verified live.
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
