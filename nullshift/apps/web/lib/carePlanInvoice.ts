import { createServiceClient } from "@nullshift/db";
import { logAuditAsService } from "@nullshift/db/audit";
import { carePlan } from "./carePlans";
import { syncInvoiceToXero } from "./xeroSync";
import { classifyCollection } from "./billing/directDebit";
import { planSubscriptionFromRow, recordUnexpectedCollection } from "./billing/directDebitRun";

type Service = ReturnType<typeof createServiceClient>;

/**
 * Recurring revenue, reconciled. A confirmed GoCardless collection for a care
 * plan becomes a PAID invoice here (type care_plan, keyed on the GoCardless
 * payment id so retries and the later paid_out event can't double it) and is
 * mirrored into Xero as an authorised invoice with the payment recorded
 * against the GoCardless clearing account — so the payout that later lands in
 * the bank feed reconciles as a transfer, not a mystery credit.
 *
 * Guard rail (every caller, every path): the collection is booked as the plan
 * ONLY if it is the plan — the subscription's contracted amount and, when the
 * caller knows them, the plan's own GoCardless subscription and mandate.
 * Anything else is recorded as an unexpected collection (urgent exception,
 * staff alert) and NO invoice is raised here or in Xero. A £850 one-off on a
 * £180 plan is never "Max care plan — October" again.
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
    /** The payment's own links, when the caller has read the payment. */
    paymentSubscriptionId?: string | null;
    paymentMandateId?: string | null;
    paymentStatus?: string | null;
    paymentDescription?: string | null;
    source?: string;
  }
): Promise<{ ok: boolean; invoiceId?: string; created: boolean; offPlan?: boolean }> {
  const amount = Math.round(opts.amountPence) / 100;
  if (!(amount > 0)) return { ok: false, created: false };

  // Already booked (a retry, or paid_out after confirmed)? Then it passed the
  // guard the first time; skip straight to the Xero catch-up below.
  const { data: already } = await service
    .from("invoices")
    .select("id")
    .eq("gc_payment_id", opts.paymentId)
    .maybeSingle();
  if (!already) {
    const { data: subRow } = await service
      .from("subscriptions")
      .select("id, tenant_id, plan, mrr, status, gc_subscription_id, gc_mandate_id, tenants(name)")
      .eq("id", opts.subscriptionId)
      .maybeSingle();
    if (!subRow) {
      console.error("recordCarePlanPayment: no subscription row", opts.subscriptionId);
      return { ok: false, created: false };
    }
    const sub = planSubscriptionFromRow(subRow);
    const verdict = classifyCollection(
      {
        id: opts.paymentId,
        status: opts.paymentStatus ?? "confirmed",
        amountPence: Math.round(opts.amountPence),
        chargeDate: opts.chargeDate,
        description: opts.paymentDescription ?? null,
        // Links the caller did not read are taken as the plan's own: only the
        // amount can be checked then — still enough to stop a wrong amount.
        subscriptionId: opts.paymentSubscriptionId === undefined ? sub.gcSubscriptionId : opts.paymentSubscriptionId,
        mandateId: opts.paymentMandateId === undefined ? sub.gcMandateId : opts.paymentMandateId,
      },
      sub
    );
    if (verdict.kind === "off_plan") {
      const t = Array.isArray(subRow.tenants) ? subRow.tenants[0] : subRow.tenants;
      await recordUnexpectedCollection(service, {
        sub,
        tenantName: (t as { name: string | null } | null)?.name ?? "Client",
        payment: {
          id: opts.paymentId,
          status: opts.paymentStatus ?? "confirmed",
          amountPence: Math.round(opts.amountPence),
          chargeDate: opts.chargeDate,
          description: opts.paymentDescription ?? null,
          subscriptionId: opts.paymentSubscriptionId ?? null,
          mandateId: opts.paymentMandateId ?? null,
        },
        verdict,
        source: opts.source ?? "recordCarePlanPayment",
      });
      return { ok: false, created: false, offPlan: true };
    }
  }

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
