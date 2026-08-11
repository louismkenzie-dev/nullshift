import { createServiceClient } from "@nullshift/db";
import { clientRef } from "@nullshift/ui/format";
import {
  isXeroConfigured,
  findOrCreateXeroContact,
  createXeroInvoice,
  recordXeroPayment,
} from "@nullshift/billing/xero";

type Service = ReturnType<typeof createServiceClient>;

/**
 * Push one of our invoices into Xero as an authorised ACCREC sales invoice
 * against the tenant's Xero contact (found or created by email/name, id cached
 * on the tenant). Idempotent: an invoice that already has xero_invoice_id is
 * left alone. If the invoice is already paid locally, the payment is recorded
 * in Xero too. ALWAYS best-effort — callers must never let a Xero hiccup break
 * a client-facing flow; errors are logged and swallowed here.
 */
export async function syncInvoiceToXero(
  service: Service,
  invoiceId: string
): Promise<{ ok: boolean; xeroInvoiceId?: string }> {
  if (!isXeroConfigured()) return { ok: false };
  try {
    const { data: inv } = await service
      .from("invoices")
      .select("id, tenant_id, project_id, type, amount, status, paid_at, created_at, xero_invoice_id")
      .eq("id", invoiceId)
      .maybeSingle();
    if (!inv) return { ok: false };
    if (inv.xero_invoice_id) return { ok: true, xeroInvoiceId: inv.xero_invoice_id };
    if (inv.status === "void" || inv.status === "draft") return { ok: false };

    const { data: tenant } = await service
      .from("tenants")
      .select("id, name, contact_email, xero_contact_id")
      .eq("id", inv.tenant_id)
      .maybeSingle();
    if (!tenant) return { ok: false };

    const contactId = await findOrCreateXeroContact({
      name: tenant.name,
      email: tenant.contact_email,
      existingContactId: tenant.xero_contact_id,
    });
    if (!contactId) return { ok: false };
    if (contactId !== tenant.xero_contact_id) {
      await service
        .from("tenants")
        .update({ xero_contact_id: contactId })
        .eq("id", tenant.id);
    }

    // Line items: the itemised invoice lines when we have them (build
    // invoices), else a single line described by the invoice type.
    const { data: lines } = await service
      .from("invoice_items")
      .select("name, amount, quantity")
      .eq("invoice_id", inv.id);
    const lineItems =
      lines && lines.length > 0
        ? (lines as { name: string; amount: number; quantity: number }[]).map((l) => ({
            description: l.name,
            amount: Number(l.amount) * (l.quantity || 1),
          }))
        : [
            {
              description:
                inv.type === "one_off"
                  ? "Deposit / one-off payment"
                  : inv.type === "build_milestone"
                    ? "System build"
                    : "Nullshift invoice",
              amount: Number(inv.amount),
            },
          ];

    const created = await createXeroInvoice({
      contactId,
      reference: `${clientRef(inv.tenant_id)} · ${String(inv.id).slice(0, 8)}`,
      dateISO: inv.created_at,
      dueDateISO: inv.created_at,
      lineItems,
    });
    if (!created) return { ok: false };

    await service
      .from("invoices")
      .update({ xero_invoice_id: created.invoiceId })
      .eq("id", inv.id)
      .is("xero_invoice_id", null);

    if (inv.status === "paid") {
      await recordXeroPayment({
        xeroInvoiceId: created.invoiceId,
        amount: Number(inv.amount),
        dateISO: inv.paid_at ?? undefined,
      });
    }
    return { ok: true, xeroInvoiceId: created.invoiceId };
  } catch (e) {
    console.error("syncInvoiceToXero:", e);
    return { ok: false };
  }
}

/**
 * Record a payment in Xero for one of our invoices that just got paid (Stripe
 * webhook or manual bank-transfer mark). If the invoice was never pushed, it's
 * pushed first (which also records the payment). Best-effort; never throws.
 */
export async function syncInvoicePaymentToXero(
  service: Service,
  invoiceId: string
): Promise<void> {
  if (!isXeroConfigured()) return;
  try {
    const { data: inv } = await service
      .from("invoices")
      .select("id, amount, paid_at, xero_invoice_id")
      .eq("id", invoiceId)
      .maybeSingle();
    if (!inv) return;
    if (!inv.xero_invoice_id) {
      await syncInvoiceToXero(service, invoiceId);
      return;
    }
    await recordXeroPayment({
      xeroInvoiceId: inv.xero_invoice_id,
      amount: Number(inv.amount),
      dateISO: inv.paid_at ?? undefined,
    });
  } catch (e) {
    console.error("syncInvoicePaymentToXero:", e);
  }
}
