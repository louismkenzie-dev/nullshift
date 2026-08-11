-- 0018_xero_sync.sql
-- Xero accounting sync for invoices:
--   1) invoices.xero_invoice_id — the Xero ACCREC invoice mirroring this row,
--      written by lib/xeroSync when the invoice is generated (or pushed on
--      demand from the client hub). Payments recorded against it as rows flip
--      to paid (Stripe webhook / bank-transfer mark).
--   2) tenants.xero_contact_id — the client's Xero contact, found-or-created
--      by email/name on first sync and cached here.
-- Applied live via MCP on 2026-08-11. Apply AFTER 0017.

alter table public.invoices add column if not exists xero_invoice_id text;
alter table public.tenants add column if not exists xero_contact_id text;

create index if not exists invoices_xero_invoice_idx
  on public.invoices (xero_invoice_id) where xero_invoice_id is not null;
