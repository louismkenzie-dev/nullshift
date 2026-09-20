# Operations admin release — 17 September 2026

## What is live-ready

- `/admin` opens the real-record Operations workspace. Client details, existing agreement and billing screens retain their underlying behaviour but use the same navigation and shell.
- **Sales & quotes → Build a quote** supports an existing client or a prospect, explicit scope/exclusions/acceptance, editable line items, VAT, payment milestones, warranty, optional transaction fee and managed/independent service route.
- The internal calculator uses manually entered delivery/external costs, contingency, warranty reserve and target gross margin. Suggested build price = risk-adjusted cost / (1 − margin), rounded up to whole pounds. These are quote-specific assumptions, not an approved company price policy. It never overwrites a quoted selling price or existing client plan.
- Independent handover starts at £600, editable per quote. Managed monthly amount and start date can remain undecided. Saving does not activate either route.
- Save, reopen and edit real drafts; client preview and browser print / Save as PDF. The client document excludes internal costs, margin, approval internals and provider credentials.
- Drafts remain clearly marked for discussion. This release does **not** email proposals, approve/accept them, convert them to contracts, raise invoices or collect money. Existing Order Form and billing actions remain deliberate actions inside this workspace.
- Saves use a stable draft ID, one database transaction, a staff-scoped client, audit events and optimistic concurrency. A stale tab is refused, not silently overwritten. Approved/issued versions cannot be edited by this flow.

## Data cleanup

Only the two user-confirmed test workspaces (l invest and the Test Consult version of NewFuture Therapy) and their two unaccepted discovery projects were deleted. The real New Future Therapy workspace, project, invoice and membership were verified intact. Existing audit and lead history and authentication accounts were retained. There is no in-app undo for the deleted test records.

No existing pricing, subscriptions, signed terms or provider billing settings were changed. A temporary, unassociated verification quote is used for browser save/reopen testing and removed after verification. User-created practice clients are not part of this cleanup.

## Database changes

Applied individually to Nullshift Ops; do not run a blanket migration push:

1. `0057_opportunities_quotes.sql`: additive staff-only opportunity, quote, version and approval tables.
2. `20260917182552_operations_quote_builder.sql`: atomic draft-save function, explicit API grants and foreign-key indexes. Security invoker; anonymous execute is revoked.
3. `20260917184037_operations_quote_privileges.sql`: removes inherited TRUNCATE, TRIGGER and REFERENCES grants from authenticated users. All four new tables have RLS.

The unrelated 0058–0065 migration files from the Fable branch remain unapplied. The live Supabase ledger assigns its own timestamp versions; consult migration names before any future reconciliation.

## Release switches

Server-only production variables: `OPS_REAL_DATA=true`, `OPS_CLIENT_CREATE=true`, `OPS_QUOTES=true`, `OPS_ADMIN_MAIN=true`.

`OPS_V2_FLAGS` remains unset (all financial v2 flags off). GoCardless's existing webhook path and current billing/plan gates are preserved. The new ops-worker handler exits without work while its flag is off. No new financial-provider credentials were added.

To revert just the new main entry point, set `OPS_ADMIN_MAIN=false` and redeploy. To disable draft writes, set `OPS_QUOTES=false` and redeploy; keep the new tables and quote data. Do not drop populated tables as a rollback.

## Verification

- 941 tests pass, including 41 new validation/calculation/action-boundary cases.
- Typecheck and production build pass. Lint: 0 errors, 87 pre-existing warnings.
- Signed-in browser: main entry, real client choices, quote creation, update, reload and client preview verified. A £5,000 build plus £600 independent handover persists correctly. Internal cost/margin values are absent from the client document.
- Mobile 390px: editor and preview stay within the viewport; no input or button overflow.
- Anonymous browser is redirected to login. SQL assertions confirm an unauthenticated authenticated-role session sees no quote rows and cannot call the save function; anonymous function privilege is revoked.
- Local Next.js preview required `allowedDevOrigins: ["127.0.0.1"]` for working hydration/HMR in the in-app review browser. This is loopback-only, development-only.
- Browser print handoff invoked; the native print dialog is outside the available app-control permissions, so a rendered PDF file has not been separately inspected.

## File groups changed for this release

- `.env.example`, `.gitignore`: independent release switches and ignore CLI-local cache.
- `apps/web/next.config.ts`: permit the loopback review origin in development.
- `app/admin/(dashboard)/page.tsx`, `layout.tsx`, `AdminFrame.tsx`: main entry and shared admin shell.
- `next/OperationsShell.tsx`, `layout.tsx`, `Rail.tsx`, `next.module.css`: unified navigation, record labels, print layout and disabled-button contrast.
- `next/LiveViews.tsx`: real quote access, client journey entry, integrated detailed tools.
- `next/quotes/QuoteBuilder.tsx`, `builder.module.css`: responsive five-step editor and client-only printable document.
- `next/quotes/LiveQuotes.tsx`, `page.tsx`, `[id]/page.tsx`, `new/page.tsx`: real quote listing, creation and reopening; no fixture fallback in enabled quote mode.
- `next/quotes/builder-actions.ts`: server-validated, staff/MFA-checked, preview-blocked atomic saving and revalidation.
- `lib/next/quote-builder.ts`, `quote-data.ts`: strict whitelisted types/validation, pence calculations and staff-scoped persistence reads.
- `tests/operations-quote-builder.test.ts`, `operations-quote-actions.test.ts`: regression and authority-boundary checks.
- The two timestamped migrations above and this release note. The prior UI polish is documented separately in `admin-ui-live-data-handoff.md`.

Paths beginning `app/`, `next/`, `lib/` or `tests/` above are relative to `apps/web` (with `next/` under `app/admin/(dashboard)`).
