"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { GDPR_CONTROLS } from "@/lib/compliance/controls";

/**
 * Per-tenant GDPR controls (compliance_records). The two operational controls
 * — the data-processing register entry and the backup verification — are
 * recorded from the client's Scale and Risk tile. The DPA signature is NOT
 * recorded here: it has one write path, recordDpa on the Docs and Legal tile
 * (plus the portal's own acceptance), so the go-live gate cannot be satisfied
 * from three different buttons.
 */
const RECORDABLE = new Set(GDPR_CONTROLS.map((c) => c.kind));

export async function recordCompliance(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const kind = String(formData.get("kind") || "");
  if (!tenantId || !RECORDABLE.has(kind)) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("compliance_records")
    .insert({ tenant_id: tenantId, kind: kind as never, detail: { via: "admin" } });
  if (error) {
    console.error("recordCompliance:", error.message);
    return;
  }
  await logAudit({
    action: `compliance.${kind}`,
    target: `tenant:${tenantId}`,
    tenantId,
  });
  revalidatePath("/admin/compliance");
  revalidatePath(`/admin/clients/${tenantId}/pricing`);
  revalidatePath(`/admin/clients/${tenantId}`);
  revalidatePath("/admin/clients/[id]", "layout");
}
