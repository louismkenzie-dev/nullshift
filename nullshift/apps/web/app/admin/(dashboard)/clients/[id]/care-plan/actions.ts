"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { isClientPreview } from "@/lib/clientPreview";
import { logAuditAsService } from "@nullshift/db/audit";
import { cancelPayment, getPayment } from "@nullshift/billing/gocardless";
import { enableMonthlyInvoicing, tickInvoicedPlans } from "@/lib/billing/invoicedPlansRun";
import { INVOICE_TERMS_DEFAULT_DAYS, suggestedInvoicedFrom } from "@/lib/billing/invoicedPlans";
import { classifyCollection, gbpPence, isCancellable } from "@/lib/billing/directDebit";
import { auditDirectDebits, planSubscriptionFromRow } from "@/lib/billing/directDebitRun";
import { resolveExceptionsAsService } from "@/lib/billing/exceptionsService";

/**
 * Staff actions for the monthly-invoice route (migration 0072). Staff guard →
 * never under the client-preview cookie → the run does the work → back to
 * the care-plan page with a notice.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

const pagePath = (tenantId: string) => `/admin/clients/${tenantId}/care-plan`;
const withNotice = (tenantId: string, kind: "notice" | "error", text: string) =>
  `${pagePath(tenantId)}?${kind}=${encodeURIComponent(text)}`;

function revalidate(tenantId: string) {
  revalidatePath(pagePath(tenantId));
  revalidatePath(`/admin/clients/${tenantId}`);
  revalidatePath(`/admin/clients/${tenantId}/billing`);
  revalidatePath("/admin");
  revalidatePath("/portal/plan");
}

/** Switch the client's care plan to a monthly invoice instead of a Direct Debit. */
export async function switchToMonthlyInvoicing(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  if (!staff.ok) return;
  if (await isClientPreview()) return;
  const tenantId = str(formData.get("tenant_id"));
  if (!UUID_RE.test(tenantId)) return;

  const planId = str(formData.get("plan"));
  const mrr = Number(str(formData.get("mrr")).replace(/[£,\s]/g, ""));
  const invoicedFrom = str(formData.get("invoiced_from")) || suggestedInvoicedFrom();
  const termsRaw = Number(str(formData.get("terms_days")));
  const termsDays = Number.isFinite(termsRaw) ? termsRaw : INVOICE_TERMS_DEFAULT_DAYS;
  const note = str(formData.get("note")) || null;

  const result = await enableMonthlyInvoicing(createServiceClient(), {
    tenantId,
    planId,
    mrr,
    invoicedFrom,
    termsDays,
    note,
    actorEmail: staff.email,
  });
  revalidate(tenantId);
  if (!result.ok) redirect(withNotice(tenantId, "error", result.error));
  const t = result.tick;
  redirect(
    withNotice(
      tenantId,
      "notice",
      t.raised
        ? `Monthly invoicing is on. ${t.raised} invoice${t.raised === 1 ? "" : "s"} raised and emailed just now.`
        : "Monthly invoicing is on. The first invoice goes out on the first period start."
    )
  );
}

/** Run the monthly-invoice tick for this client now: raise, reconcile, chase. */
export async function runCarePlanInvoicingNow(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  if (!staff.ok) return;
  if (await isClientPreview()) return;
  const tenantId = str(formData.get("tenant_id"));
  if (!UUID_RE.test(tenantId)) return;
  const t = await tickInvoicedPlans(createServiceClient(), { tenantId });
  revalidate(tenantId);
  const bits = [
    t.raised ? `${t.raised} raised` : null,
    t.reconciled ? `${t.reconciled} marked paid from Xero` : null,
    t.reminded ? `${t.reminded} reminder${t.reminded === 1 ? "" : "s"} sent` : null,
    t.statusChanges ? "plan status updated" : null,
  ].filter(Boolean);
  redirect(
    t.errors.length
      ? withNotice(tenantId, "error", `Run finished with a problem: ${t.errors[0]}`)
      : withNotice(tenantId, "notice", bits.length ? `Checked: ${bits.join(", ")}.` : "Checked: nothing to raise, reconcile or chase.")
  );
}

/* ── Direct Debit guard rails ────────────────────────────────────────────── */

const GC_PAYMENT_RE = /^PM[0-9A-Z]{10,}$/;

/** Re-read the client's Direct Debit from GoCardless and compare it with the plan. */
export async function checkDirectDebitNow(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  if (!staff.ok) return;
  if (await isClientPreview()) return;
  const tenantId = str(formData.get("tenant_id"));
  if (!UUID_RE.test(tenantId)) return;
  const a = await auditDirectDebits(createServiceClient(), { tenantId, source: `care-plan page (${staff.email})` });
  revalidate(tenantId);
  const findings = a.results.reduce((n, r) => n + r.findings.length, 0);
  if (!a.configured) redirect(withNotice(tenantId, "error", "GoCardless is not configured on this deployment."));
  if (a.errors.length) redirect(withNotice(tenantId, "error", `GoCardless check hit a problem: ${a.errors[0]}`));
  redirect(
    withNotice(
      tenantId,
      findings ? "error" : "notice",
      findings
        ? `GoCardless checked: ${findings} thing${findings === 1 ? "" : "s"} to look at below.`
        : "GoCardless checked: the Direct Debit matches the plan."
    )
  );
}

/**
 * Stop an off-plan collection before it reaches the bank. Re-reads the
 * payment from GoCardless and refuses unless it is (a) not the plan and (b)
 * still cancellable — a plan payment or a submitted one is never cancelled
 * from here.
 */
export async function cancelOffPlanCollection(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  if (!staff.ok) return;
  if (await isClientPreview()) return;
  const tenantId = str(formData.get("tenant_id"));
  const paymentId = str(formData.get("payment_id"));
  if (!UUID_RE.test(tenantId) || !GC_PAYMENT_RE.test(paymentId)) return;
  const service = createServiceClient();

  const { data: subRow } = await service
    .from("subscriptions")
    .select("id, tenant_id, plan, mrr, status, gc_subscription_id, gc_mandate_id")
    .eq("tenant_id", tenantId)
    .eq("provider", "gocardless")
    .in("status", ["active", "trialing", "past_due"])
    .limit(1)
    .maybeSingle();
  if (!subRow) redirect(withNotice(tenantId, "error", "No live Direct Debit plan for this client."));
  const sub = planSubscriptionFromRow(subRow);
  const payment = await getPayment(paymentId);
  if (!payment) redirect(withNotice(tenantId, "error", "GoCardless did not return that payment."));
  if (payment.mandateId && sub.gcMandateId && payment.mandateId !== sub.gcMandateId)
    redirect(withNotice(tenantId, "error", "That payment is not under this client's mandate."));
  const verdict = classifyCollection(payment, sub);
  if (verdict.kind === "plan")
    redirect(withNotice(tenantId, "error", "That payment IS the plan — cancel the plan instead if that is what you mean."));
  if (!isCancellable(payment.status))
    redirect(
      withNotice(
        tenantId,
        "error",
        `Too late to cancel: GoCardless reports it as ${payment.status.replace(/_/g, " ")}. Refund it from GoCardless once it clears.`
      )
    );

  let cancelled = false;
  try {
    cancelled = await cancelPayment(paymentId);
  } catch (e) {
    redirect(withNotice(tenantId, "error", `GoCardless refused the cancel: ${e instanceof Error ? e.message : String(e)}`));
  }
  await logAuditAsService({
    action: "care_plan.collection_cancelled",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: { paymentId, amountPence: payment.amountPence, expectedPence: verdict.expectedPence, reason: verdict.reason, by: staff.email, cancelled },
  });
  if (cancelled)
    await resolveExceptionsAsService(service, {
      kind: "unexpected_collection",
      externalRef: paymentId,
      evidence: { kind: "payment_cancelled", ref: paymentId, by: staff.email, note: `Cancelled in GoCardless before submission (${gbpPence(payment.amountPence)}).` },
    });
  revalidate(tenantId);
  redirect(
    cancelled
      ? withNotice(tenantId, "notice", `Cancelled: ${gbpPence(payment.amountPence)} will not be collected.`)
      : withNotice(tenantId, "error", "GoCardless did not confirm the cancel — check the dashboard.")
  );
}

/**
 * Close an off-plan collection's exception once it has been dealt with
 * outside the system (refunded from GoCardless, or invoiced for what it was).
 */
export async function markCollectionHandled(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  if (!staff.ok) return;
  if (await isClientPreview()) return;
  const tenantId = str(formData.get("tenant_id"));
  const paymentId = str(formData.get("payment_id"));
  const note = str(formData.get("note"));
  if (!UUID_RE.test(tenantId) || !GC_PAYMENT_RE.test(paymentId)) return;
  const service = createServiceClient();
  const n = await resolveExceptionsAsService(service, {
    kind: "unexpected_collection",
    externalRef: paymentId,
    evidence: { kind: "staff_note", ref: paymentId, by: staff.email, note: note || "Handled outside the system." },
  });
  await logAuditAsService({
    action: "care_plan.collection_handled",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: { paymentId, note: note || null, by: staff.email, resolved: n },
  });
  revalidate(tenantId);
  redirect(withNotice(tenantId, "notice", n ? "Marked as handled." : "Nothing open to mark — it may already be resolved."));
}
