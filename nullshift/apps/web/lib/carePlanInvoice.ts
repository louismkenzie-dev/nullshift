import { createServiceClient } from "@nullshift/db";
import { logAuditAsService } from "@nullshift/db/audit";
import { carePlan } from "./carePlans";
import { syncInvoiceToXero } from "./xeroSync";

type Service = ReturnType<typeof createServiceClient>;

/**
 * Recurring revenue, reconciled. A confirmed GoCardless collection for a care
 * plan becomes a PAID invoice here (type care_plan, keyed on the GoCardless
 * payment id so retries and the later paid_out event can't double it) and is
 * mirrored into Xero as an authorised invoice with the payment recorded
 * against the GoCardless clearing account — so the payout that later lands in
 * the bank feed reconciles as a transfer, not a mystery credit.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "Pro care plan — September 2026" — the line the client and the books see. */
export function carePlanInvoiceLine(
  planId: string | null,
  chargeDate: string | null
): string {
  const label = carePlan(planId)?.label ?? "Care";
  const d = chargeDate ? new Date(chargeDate) : new Date();
  const when = Number.isNaN(d.getTime()) ? new Date() : d;
  return `${label} care plan — ${MONTHS[when.getUTCMonth()]} ${when.getUTCFullYear()}`;
}

/** The Xero account GoCardless money is recorded against (a clearing account). */
export function gocardlessXeroAccountCode(): string | undefined {
  return (
    process.env.XERO_GOCARDLESS_ACCOUNT_CODE ||
    process.env.XERO_PAYMENT_ACCOUNT_CODE ||
    undefined
  );
}

export async function recordCarePlanPayment(
  service: Service,
  opts: {
    tenantId: string;
    subscriptionId: string;
    plan: string | null;
    paymentId: string;
    amountPence: number;
    chargeDate: string | null;
  }
): Promise<{ ok: boolean; invoiceId?: string; created: boolean }> {
  const amount = Math.round(opts.amountPence) / 100;
  if (!(amount > 0)) return { ok: false, created: false };
  const paidAt = opts.chargeDate
    ? new Date(opts.chargeDate).toISOString()
    : new Date().toISOString();

  const { data: inserted, error } = await service
    .from("invoices")
    .insert({
      tenant_id: opts.tenantId,
      project_id: null,
      type: "care_plan",
      amount,
      status: "paid",
      due_at: paidAt,
      paid_at: paidAt,
      project_item_count: 1,
      gc_payment_id: opts.paymentId,
    })
    .select("id")
    .single();

  let invoiceId = inserted?.id ?? null;
  if (error || !invoiceId) {
    // Already recorded (unique index on gc_payment_id) — the paid_out event
    // after confirmed, or a webhook retry. Reuse it.
    const { data: existing } = await service
      .from("invoices")
      .select("id")
      .eq("gc_payment_id", opts.paymentId)
      .maybeSingle();
    if (!existing) {
      console.error("recordCarePlanPayment insert failed:", error?.message);
      return { ok: false, created: false };
    }
    invoiceId = existing.id;
    // Still push to Xero if an earlier attempt failed there (idempotent).
    await syncInvoiceToXero(service, invoiceId, {
      paymentAccountCode: gocardlessXeroAccountCode(),
    });
    return { ok: true, invoiceId, created: false };
  }

  await service.from("invoice_items").insert({
    invoice_id: invoiceId,
    tenant_id: opts.tenantId,
    name: carePlanInvoiceLine(opts.plan, opts.chargeDate),
    amount,
    quantity: 1,
  });

  const xero = await syncInvoiceToXero(service, invoiceId, {
    paymentAccountCode: gocardlessXeroAccountCode(),
  });
  await logAuditAsService({
    action: "care_plan.payment_invoiced",
    target: `invoice:${invoiceId}`,
    tenantId: opts.tenantId,
    metadata: {
      subscription: opts.subscriptionId,
      paymentId: opts.paymentId,
      amount,
      chargeDate: opts.chargeDate,
      xero: xero.ok ? (xero.xeroInvoiceId ?? true) : false,
    },
  });
  return { ok: true, invoiceId, created: true };
}
