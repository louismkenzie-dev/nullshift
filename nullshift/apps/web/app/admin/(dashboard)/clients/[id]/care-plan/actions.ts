"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { isClientPreview } from "@/lib/clientPreview";
import { enableMonthlyInvoicing, tickInvoicedPlans } from "@/lib/billing/invoicedPlansRun";
import { INVOICE_TERMS_DEFAULT_DAYS, suggestedInvoicedFrom } from "@/lib/billing/invoicedPlans";

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
