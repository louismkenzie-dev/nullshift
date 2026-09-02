import { createServiceClient } from "@nullshift/db";
import { clientRef } from "@nullshift/ui/format";
import {
  isXeroConfigured,
  findOrCreateXeroContact,
  createXeroInvoice,
  recordXeroPayment,
  getXeroOnlineInvoiceUrl,
  getXeroInvoiceStatus,
} from "@nullshift/billing/xero";
import { logAuditAsService } from "@nullshift/db/audit";

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
  invoiceId: string,
  opts: {
    /** Where a payment is recorded — defaults to XERO_PAYMENT_ACCOUNT_CODE. */
    paymentAccountCode?: string;
  } = {}
): Promise<{ ok: boolean; xeroInvoiceId?: string; onlineUrl?: string | null }> {
  if (!isXeroConfigured()) return { ok: false };
  try {
    const { data: inv } = await service
      .from("invoices")
      .select(
        "id, tenant_id, project_id, type, amount, status, paid_at, created_at, due_at, xero_invoice_id"
      )
      .eq("id", invoiceId)
      .maybeSingle();
    if (!inv) return { ok: false };
    if (inv.xero_invoice_id) {
      // Already in Xero — hand back the online link too, in case a caller
      // wants to (re)send it.
      const onlineUrl = await getXeroOnlineInvoiceUrl(inv.xero_invoice_id).catch(
        () => null
      );
      return { ok: true, xeroInvoiceId: inv.xero_invoice_id, onlineUrl };
    }
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
                    : inv.type === "care_plan"
                      ? "Care plan"
                      : "Nullshift invoice",
              amount: Number(inv.amount),
            },
          ];

    const created = await createXeroInvoice({
      contactId,
      reference: `${clientRef(inv.tenant_id)} · ${String(inv.id).slice(0, 8)}`,
      dateISO: inv.created_at,
      // Mirror the real due date (falling back to the issue date only for
      // legacy rows that predate due_at being set at generation).
      dueDateISO: inv.due_at ?? inv.created_at,
      lineItems,
    });
    if (!created) return { ok: false };

    // Xero's online invoice — the client-facing document when Xero is the
    // rail. Only fills hosted_invoice_url when nothing (a Stripe link) is
    // there already.
    // An already-paid invoice (a care-plan collection) has nothing to pay
    // online — skip the extra round-trip.
    const onlineUrl =
      inv.status === "paid"
        ? null
        : await getXeroOnlineInvoiceUrl(created.invoiceId).catch((e) => {
            console.warn("Xero online invoice URL unavailable:", e);
            return null;
          });
    await service
      .from("invoices")
      .update({ xero_invoice_id: created.invoiceId })
      .eq("id", inv.id)
      .is("xero_invoice_id", null);
    if (onlineUrl) {
      await service
        .from("invoices")
        .update({ hosted_invoice_url: onlineUrl })
        .eq("id", inv.id)
        .is("hosted_invoice_url", null);
    }

    if (inv.status === "paid") {
      await recordXeroPayment({
        xeroInvoiceId: created.invoiceId,
        amount: Number(inv.amount),
        dateISO: inv.paid_at ?? undefined,
        accountCode: opts.paymentAccountCode,
      });
    }
    return { ok: true, xeroInvoiceId: created.invoiceId, onlineUrl };
  } catch (e) {
    console.error("syncInvoiceToXero:", e);
    return { ok: false };
  }
}

/**
 * Notice payments taken IN Xero (the client paid the online invoice through
 * the payment service connected to Xero, or the bookkeeper reconciled a bank
 * transfer there) and mirror them back: our open invoices with a Xero id are
 * checked and flipped to paid when Xero says PAID. Best-effort and bounded —
 * called on the billing pages' load, never from a client flow.
 */
export async function reconcileXeroInvoices(
  service: Service,
  opts: { tenantId?: string; limit?: number } = {}
): Promise<{ checked: number; paid: number }> {
  if (!isXeroConfigured()) return { checked: 0, paid: 0 };
  try {
    let q = service
      .from("invoices")
      .select("id, tenant_id, amount, xero_invoice_id")
      .eq("status", "open")
      .not("xero_invoice_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(opts.limit ?? 10);
    if (opts.tenantId) q = q.eq("tenant_id", opts.tenantId);
    const { data: open } = await q;
    const rows = (open ?? []) as {
      id: string;
      tenant_id: string;
      amount: number;
      xero_invoice_id: string;
    }[];
    if (rows.length === 0) return { checked: 0, paid: 0 };

    const deadline = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 8000)
    );
    let paid = 0;
    await Promise.all(
      rows.map(async (inv) => {
        const status = await Promise.race([
          getXeroInvoiceStatus(inv.xero_invoice_id).catch(() => null),
          deadline,
        ]);
        if (status?.status !== "PAID") return;
        const { data: flipped } = await service
          .from("invoices")
          .update({
            status: "paid",
            paid_at: status.fullyPaidOnDate ?? new Date().toISOString(),
          })
          .eq("id", inv.id)
          .eq("status", "open")
          .select("id");
        if (!flipped?.length) return;
        paid++;
        await logAuditAsService({
          action: "invoice.paid_via_xero",
          target: `invoice:${inv.id}`,
          tenantId: inv.tenant_id,
          metadata: {
            xeroInvoiceId: inv.xero_invoice_id,
            invoiceNumber: status.invoiceNumber,
            amount: Number(inv.amount),
          },
        });
      })
    );
    return { checked: rows.length, paid };
  } catch (e) {
    console.error("reconcileXeroInvoices:", e);
    return { checked: 0, paid: 0 };
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
