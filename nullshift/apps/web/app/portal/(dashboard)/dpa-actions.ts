"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@nullshift/db";

/**
 * The client declares their Data Processing Agreement details: business type,
 * the personal data they'll collect, special-category use, and (for limited
 * companies) their legal company name, number and registered office. These port
 * onto the DPA. Allowed any time before the proposal is signed/declined. Shared
 * by the mandatory portal gate (on landing) and the proposal page. Stamps
 * dpa_client_submitted_at so the admin sees the client has provided their info.
 */
export async function setEntityType(formData: FormData) {
  const projectId = String(formData.get("project_id") || "");
  const entityType = String(formData.get("entity_type") || "");
  if (!projectId || (entityType !== "limited" && entityType !== "sole_trader")) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { data: project } = await supabase
    .from("projects")
    .select("id, proposal_status")
    .eq("id", projectId)
    .maybeSingle();
  // The client can fill / update their details any time before the proposal is
  // signed or declined.
  if (
    !project ||
    project.proposal_status === "accepted" ||
    project.proposal_status === "declined"
  )
    return;

  const str = (k: string) => String(formData.get(k) || "").trim() || null;
  const patch: Record<string, unknown> = {
    client_entity_type: entityType,
    dpa_personal_data: str("personal_data"),
    dpa_special_category: formData.get("special_category") === "yes",
    dpa_special_category_detail: str("special_category_detail"),
    dpa_client_submitted_at: new Date().toISOString(),
  };
  if (entityType === "limited") {
    patch.dpa_client_company_name = str("company_name");
    patch.dpa_client_company_number = str("company_number");
    patch.dpa_client_registered_address = str("registered_address");
    patch.dpa_client_country = str("country") ?? "United Kingdom";
  } else {
    // Sole trader / other — no company identity; clear any limited-only fields.
    patch.dpa_client_company_name = null;
    patch.dpa_client_company_number = null;
    patch.dpa_client_registered_address = null;
  }
  // projects are staff-write under RLS — use the service client after the
  // membership-scoped read above confirmed the caller owns this project.
  const service = createServiceClient();
  await service.from("projects").update(patch).eq("id", projectId);
  revalidatePath("/portal/proposal");
  revalidatePath("/portal", "layout");
}
