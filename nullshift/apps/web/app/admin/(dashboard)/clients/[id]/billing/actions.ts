"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { syncInvoiceToXero } from "@/lib/xeroSync";

/**
 * Server actions owned by the Billing and Payment tile
 * (/admin/clients/[id]/billing). The generate / regenerate / mark-paid /
 * push-to-Xero actions stay in ../actions.ts (they are shared with other
 * tiles); this file holds what only this tile does.
 */

function revalidateBilling(tenantId: string) {
  revalidatePath(`/admin/clients/${tenantId}`);
  revalidatePath("/admin/clients/[id]", "layout");
  // The money cockpit lists the same invoice rows.
  revalidatePath("/admin/billing");
}

/**
 * Raise a plain invoice by hand against THIS client — a build milestone or a
 * one-off, GBP, due in 14 days. The money cockpit's issueInvoice with the
 * client fixed (hidden tenant_id, no client picker): same row shape, same
 * `invoice.issued` audit entry, then the row is mirrored to Xero the way every
 * other invoice on the tile is (a no-op when Xero is not configured, so the
 * "→ Xero" button on the row remains the backfill path).
 */
export async function issueInvoice(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "") || null;
  const typeRaw = String(formData.get("type") || "build_milestone");
  const type = typeRaw === "one_off" ? "one_off" : "build_milestone";
  const amount = Math.round(Number(formData.get("amount") || 0));
  if (!tenantId || !Number.isFinite(amount) || amount <= 0) return;

  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from("invoices")
    .insert({
      tenant_id: tenantId,
      project_id: projectId,
      type,
      amount,
      status: "open",
      due_at: new Date(Date.now() + 14 * 864e5).toISOString(),
    })
    .select("id")
    .single();
  if (error || !inserted) {
    console.error("issueInvoice:", error?.message ?? "insert returned no row");
    return;
  }
  const invoiceId = String(inserted.id);

  await logAudit({
    action: "invoice.issued",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: { type, amount, project_id: projectId, invoice_id: invoiceId, via: "tile" },
  });

  // Mirror to Xero (same path as the on-demand "→ Xero" button).
  const xero = await syncInvoiceToXero(createServiceClient(), invoiceId);
  if (xero.ok)
    await logAudit({
      action: "invoice.xero_synced",
      target: `invoice:${invoiceId}`,
      tenantId,
      metadata: { xeroInvoiceId: xero.xeroInvoiceId },
    });

  revalidateBilling(tenantId);
}
