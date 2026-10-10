# Nullshift Partner Rate Card

Effective 9 October 2026. Source of truth: `docs/partners/PROGRAMME-BRIEF-2026-10-09.md`.
All prices in GBP, exclusive of VAT. Partner price = list × 0.75, rounded up to the pound.

## 1. Monthly plans

Published "from" prices (pricing version NSI_v2_2026_09) apply to a Standard-band client. The
arithmetic:

| Plan | List (base) | × 0.75 | Partner price (base, rounded up) | Response target |
|---|---|---|---|---|
| Core | £149 / month | £111.75 | **£112 / month** | 2 UK business days |
| Pro | £249 / month | £186.75 | **£187 / month** | 1 UK business day |
| Max | £399 / month | £299.25 | **£300 / month** | 4 UK business hours |
| Enterprise | Quoted | — | Quoted × 0.75 | Contracted SLAs |

**Scale banding.** The base price is multiplied by the client's scale band, scored on audience,
commercial criticality, technical load, organisation reach and complexity, and rounded up to the
pound. The 25% comes off the banded figure, so the partner discount is the same percentage for
every client.

| Band | Multiplier | Core list → partner | Pro list → partner | Max list → partner |
|---|---|---|---|---|
| Standard | ×1.0 | £149 → £112 | £249 → £187 | £399 → £300 |
| Growth | ×1.5 | £224 → £168 | £374 → £281 | £599 → £450 |
| Established | ×2.5 | £373 → £280 | £623 → £468 | £998 → £749 |
| Scale | ×4.0 | £596 → £447 | £996 → £747 | £1,596 → £1,197 |
| Critical | ×5.5 | £820 → £615 | £1,370 → £1,028 | £2,195 → £1,647 |
| Enterprise | Reviewed | Quoted | Quoted | Quoted |

A margin floor on attributable vendor cost can lift the price above the banded figure for
unusually heavy usage; the estimator shows it when it applies.

## 2. Build fees — examples from the guided estimator

Fixed-price builds are quoted by the guided estimator from the client's size and feature list.
These three are representative outputs at the current working assumptions; quote the live tool
for any real client. "Guide" is the price put on the quote; the range is the low/high scenario.

| Example build | Guide price (list) | Range (list) | Partner price (25% off guide) |
|---|---|---|---|
| Website (5 pages) + CRM / lead capture · 3 staff, 1 site | £4,600 | £3,600 – £6,300 | **£3,450** |
| Online booking + payments + automated messaging · 4 staff, 1 site, ~300 customers/month | £6,200 | £4,800 – £8,100 | **£4,650** |
| Booking + payments + customer portal + staff dashboard (3 roles) + reporting, with accounting and calendar integrations · 12 staff, 2 sites, ~800 customers/month | £14,300 | £11,600 – £19,400 | **£10,725** |

Every build includes discovery and design, foundation (hosting, sign-in, database, deployment,
backups), testing, launch, training and handover notes, plus a 30-day defect warranty. Data
migration, further integrations, sensitive-data hardening and tight deadlines add to the price;
the estimator itemises each one.

## 3. Referral fees

10% of the build fee at list, paid pro-rata as each 50 / 25 / 25 milestone clears, within
14 days of each. No share of the monthly plan.

| Build fee (list) | Referral fee | Paid as milestones clear (50 / 25 / 25) |
|---|---|---|
| £3,000 | **£300** | £150 · £75 · £75 |
| £6,000 | **£600** | £300 · £150 · £150 |
| £12,000 | **£1,200** | £600 · £300 · £300 |

## 4. Payment terms

- **Builds (both models):** 50% on project commencement, 25% at the agreed build milestone,
  25% before production handover. Quotes valid 30 days.
- **Referral:** we invoice and collect from the client at list. Your 10% is paid pro-rata as
  each milestone clears — 5% of the build fee after the 50% milestone, 2.5% after each 25%
  milestone — within 14 days of each.
- **White-label:** we invoice you at partner price on the same milestone schedule; you invoice
  your client at your retail price. Monthly plans are invoiced to you monthly in advance; you
  bill your client however you choose.
- Prices are in GBP and exclude VAT. Payment-processor fees (for example Stripe) are the end
  client's and are never part of our price.

## 5. What the monthly plan includes

**Core — keep it live.** Managed hosting, deployment, domain/DNS and SSL · dedicated production
database (paid Supabase plan included) · routine maintenance, daily backups and service
monitoring · fault investigation and fixes against the signed-off scope · standard support queue
(2 UK business days) · guidance on using the system.

**Pro — run it properly.** Everything in Core · managed AI/API and transactional email
infrastructure within the normal usage band · enhanced monitoring of API failures, email
delivery and key integrations · priority support (1 UK business day) · configuration support for
existing features, workflows and integrations.

**Max — a technical partner.** Everything in Pro · a named technical owner · priority queue
(4 UK business hours) · quarterly roadmap review · monthly platform health review · feature
discovery and technical scoping included · priority scheduling for accepted feature projects.

No plan includes new development. New features are separately quoted fixed-price projects
(partner price applies).

## 6. Programme terms, in brief

Non-exclusive · no minimum volume · every client and piece of work subject to acceptance review ·
30 days' notice either side · live client systems are never switched off · the end client owns
their code, database and accounts.

Contact: louis@nullshift.co.uk · Apply: nullshift.co.uk/partners · Book: nullshift.co.uk/book/partner
