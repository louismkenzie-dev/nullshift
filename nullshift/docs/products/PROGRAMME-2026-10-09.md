# Nullshift Products — self-serve SaaS programme

Owner decision 2026-10-09: widen the ICP from bespoke-only (larger firms with
budget for a custom build) to include cheaper, off-the-shelf monthly products
sold under the Nullshift brand. Five products, one shared foundation, all
living inside the existing `apps/web` deployment at `nullshift.co.uk`.

## Products

| Slug     | Name             | Buyer                          | Price  | What it is                                                                                                                            |
| -------- | ---------------- | ------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `quote`  | Nullshift Quote  | Tradespeople                   | £29/mo | Embeddable "price in 60 seconds" widget. Rate card + questions → ballpark; leads land in a dashboard and an email.                    |
| `legal`  | Nullshift Legal  | Any UK SMB with a website      | £12/mo | Answer a short form → hosted Privacy Notice, Cookie Policy and Website Terms at `/l/<slug>/…`, kept current.                          |
| `watch`  | Nullshift Watch  | Agencies, freelancers, owners  | £19/mo | Uptime, SSL expiry, broken links and PageSpeed checks on up to 10 sites; monthly client-ready report email.                           |
| `plans`  | Nullshift Plans  | Consultants and agencies       | £49/mo | Embeddable AI "systems plan" lead magnet. Visitor answers questions, Claude writes a branded plan, lead + plan land in the dashboard. |
| `studio` | Nullshift Studio | Small agencies and freelancers | £39/mo | White-label client portal: proposals with line items, e-acceptance with a hashed snapshot, invoices, notes, client-facing link.       |

All products: 14-day free trial, card via Stripe Checkout, cancel any month.
Entitlement = `product_subscriptions.status in ('trialing','active','past_due')`.

## Foundation (shared)

- **Catalogue**: `packages/content/src/products.ts` — single source for names, prices, copy, limits.
- **Workspace**: a self-serve user gets a `tenants` row (`self_serve = true`) and a
  `client_admin` membership on first landing at `/app` (`apps/web/lib/products/workspace.ts`).
  Same RLS helpers as the bespoke portal (`is_member_of`).
- **Billing**: `product_subscriptions` (migration 0072). Stripe Checkout in
  subscription mode with `subscription_data.metadata = { product, tenant_id }`;
  the existing webhook at `/api/stripe/webhook` keys on `metadata.product` so
  product rows never collide with bespoke care-plan `subscriptions`.
- **App shell**: `/app` (dashboard, billing), `/app/login`, `/app/signup` share the
  portal's auth forms (`components/auth/*`). `/app/<slug>` is each product's console.
- **Public surfaces**: `/w/<key>` quote widget, `/l/<slug>/<doc>` legal pages,
  `/p/<key>` plan generator, `/c/<token>` studio client view. All `noindex`
  except legal pages (which the customer wants indexed).
- **Marketing**: `/products` and `/products/<slug>`; "Products" in the nav.
- **Admin**: `/admin/products` — every self-serve workspace, product, status, MRR.

## Migrations

| #    | Contents                                                                |
| ---- | ----------------------------------------------------------------------- |
| 0072 | `tenants.self_serve`, `product_subscriptions`                           |
| 0073 | `quote_widgets`, `widget_leads`                                         |
| 0074 | `legal_sites`                                                           |
| 0075 | `monitored_sites`, `site_checks`                                        |
| 0076 | `plan_embeds`, `plan_leads`                                             |
| 0077 | `studio_clients`, `studio_proposals`, `studio_invoices`, `studio_notes` |

All additive. Nothing touches bespoke client tables, billing obligations or delivery.

## Out of scope for v1

- Direct Debit on any product (no GoCardless env on Vercel).
- Mockup generation in Plans (40k-token streams; plan text only at launch).
- Lighthouse beyond the PageSpeed Insights API (optional `PAGESPEED_API_KEY`).
- Custom domains for hosted legal pages / studio links (subdomain-less paths for now).

## Release

Built on `feat/admin-redesign`. Self-serve billing is new authority over live
Stripe: the owner applies migrations 0072–0077 and confirms the Stripe webhook
before this goes to production. See the handoff at the end of this file.
