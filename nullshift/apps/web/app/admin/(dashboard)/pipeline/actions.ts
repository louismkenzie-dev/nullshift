"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { escapeLike } from "@nullshift/db/leads";

/**
 * Open a lead as a client: reuse the existing client tenant if one already shares
 * the contact email, otherwise create a tenant (+ its build project) from the lead —
 * carrying the business name, contact and their description across. Then redirect to
 * the client block. Shared by the pipeline board and the Dashboard grid's
 * "Enquiries" row (moved verbatim from the pipeline page).
 */
export async function openLead(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, email, vertical, quiz_answers, plan")
    .eq("id", id)
    .maybeSingle();
  if (!lead) return;

  const email = (lead.email || "").trim();
  let tenantId: string | null = null;

  // 1) Reuse an existing client tenant with the same contact email.
  if (email) {
    const { data: existing } = await supabase
      .from("tenants")
      .select("id")
      .eq("type", "client")
      .ilike("contact_email", escapeLike(email))
      .limit(1);
    tenantId = existing?.[0]?.id ?? null;
  }

  // 2) Otherwise create the tenant + its build project from the lead.
  if (!tenantId) {
    const answers =
      (lead.quiz_answers as { answers?: Record<string, string> } | null)?.answers ?? {};
    const describe = answers.describe?.trim();
    const businessName =
      (lead.plan as { businessName?: string | null } | null)?.businessName ?? null;
    const name = businessName || lead.name || "Client";
    const notes =
      `Converted from ${lead.vertical ? `${lead.vertical} ` : ""}funnel lead.` +
      (describe ? `\n\nIn their words:\n"${describe}"` : "");

    const { data: created } = await supabase
      .from("tenants")
      .insert({
        name,
        type: "client",
        vertical: lead.vertical,
        contact_name: lead.name,
        contact_email: email || null,
        notes,
      })
      .select("id")
      .single();
    tenantId = created?.id ?? null;

    if (tenantId) {
      await supabase
        .from("projects")
        .insert({ tenant_id: tenantId, name: `${name} — build`, stage: "discovery" });
      await logAudit({
        action: "lead.opened_as_client",
        target: `lead:${id}`,
        tenantId,
        metadata: { name },
      });
      // A new client block now exists — refresh the grid and the board.
      revalidatePath("/admin");
      revalidatePath("/admin/pipeline");
    }
  }

  if (tenantId) redirect(`/admin/clients/${tenantId}`);
}
