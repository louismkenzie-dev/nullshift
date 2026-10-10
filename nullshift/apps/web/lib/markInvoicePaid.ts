import { getStripe } from "@nullshift/billing/stripe";
import { createServiceClient } from "@nullshift/db";
import { logAudit, logAuditAsService } from "@nullshift/db/audit";
import { syncInvoicePaymentToXero } from "./xeroSync";

/**
 * THE way to mark an invoice paid out-of-band (bank transfer / standing
 * order). One implementation with all three guarantees, shared by the client
 * hub, the billing cockpit and the bank-feed reconciler — the billing page
 * used to have a weaker copy that left the Stripe hosted invoice collectible
 * (a client could pay twice) and never mirrored the payment into Xero.
 *
 * 1. Stripe hosted invoice is settled out-of-band so the card link stops
 *    collecting (best-effort — the local row is the source of truth).
 * 2. Compare-and-set status flip (the Stripe round-trip leaves a window where
 *    another staff action could void the invoice).
 * 3. Payment mirrored into Xero (best-effort, logged + swallowed inside).
 */
export async function markInvoicePaidOutOfBand(opts: {
  tenantId: string;
  invoiceId: string;
  /** Audit detail: how the money arrived (default "bank_transfer"). */
  via?: string;
  /** No signed-in person (the bank-feed sync): audit via the service client. */
  asService?: boolean;
  /** Anything that proves it: a bank transaction id, a match id. */
  evidence?: Record<string, unknown>;
}): Promise<{ ok: boolean }> {
  const { tenantId, invoiceId } = opts;
  const service = createServiceClient();
  const { data: inv } = await service
    .from("invoices")
    .select("id, status, stripe_invoice_id")
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!inv || inv.status === "paid" || inv.status === "void") return { ok: false };

  const stripe = getStripe();
  if (stripe && inv.stripe_invoice_id) {
    try {
      await stripe.invoices.pay(inv.stripe_invoice_id, { paid_out_of_band: true });
    } catch (e) {
      console.error("markInvoicePaidOutOfBand: Stripe out-of-band pay failed", e);
    }
  }

  const { data: flipped } = await service
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("status", inv.status)
    .select("id");
  if (!flipped?.length) return { ok: false };

  const entry = {
    action: "invoice.marked_paid",
    target: `invoice:${invoiceId}`,
    tenantId,
    metadata: { via: opts.via ?? "bank_transfer", ...(opts.evidence ?? {}) },
  };
  if (opts.asService) await logAuditAsService(entry);
  else await logAudit(entry);

  await syncInvoicePaymentToXero(service, invoiceId);
  return { ok: true };
}
