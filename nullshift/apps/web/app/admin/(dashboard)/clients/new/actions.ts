"use server";

import { revalidatePath } from "next/cache";
import { escapeLike } from "@nullshift/db/leads";
import { logAudit } from "@nullshift/db/audit";
import { clientCreationEnabled, operationsSession } from "@/lib/next/live-data";
import {
  draftNotes,
  readDraftNotes,
  validateNewClient,
  type NewClientInput,
  type NewClientResult,
} from "@/lib/next/live-model";

/** Record creation only. No account invite, contract, invoice or provider call. */
export async function createWorkspace(raw: NewClientInput): Promise<NewClientResult> {
  if (!clientCreationEnabled())
    return { ok: false, error: "Client creation is disabled in this environment." };
  const { db, staff } = await operationsSession();
  // Runtime callers are untrusted even when TypeScript describes the form.
  if (
    !raw ||
    Object.values(raw).some((v) => typeof v !== "string") ||
    [
      "draftId",
      "projectId",
      "businessName",
      "contactName",
      "email",
      "phone",
      "projectName",
      "brief",
      "owner",
      "serviceRoute",
    ].some((k) => typeof raw[k as keyof NewClientInput] !== "string")
  )
    return { ok: false, error: "Please check the form and try again." };
  const input = {
    ...raw,
    businessName: raw.businessName.trim(),
    contactName: raw.contactName.trim(),
    email: raw.email.trim().toLowerCase(),
    projectName: raw.projectName.trim(),
    brief: raw.brief.trim(),
    owner: raw.owner.trim(),
    phone: raw.phone.trim(),
  };
  const validation = validateNewClient(input);
  if (validation) return { ok: false, error: validation };

  // A stable draft UUID makes retries/double-clicks idempotent without repricing
  // or overwriting an existing client. Unrelated UUIDs are never upserted.
  const { data: prior, error: priorError } = await db
    .from("tenants")
    .select("id,notes")
    .eq("id", input.draftId)
    .maybeSingle();
  if (priorError)
    return { ok: false, error: "Could not check this draft. Nothing has been changed." };
  if (prior) {
    const draft = readDraftNotes(prior.notes);
    if (draft?.actor !== staff.userId || draft.projectId !== input.projectId)
      return {
        ok: false,
        error: "This client already exists. Open its workspace instead.",
        duplicateId: prior.id,
      };
  } else {
    const { data: duplicates, error: duplicateError } = await db
      .from("tenants")
      .select("id,name,contact_email")
      .eq("type", "client")
      .ilike("contact_email", escapeLike(input.email))
      .limit(1);
    if (duplicateError)
      return {
        ok: false,
        error: "Could not check for an existing client. Please try again.",
      };
    if (duplicates?.[0])
      return {
        ok: false,
        error:
          "A client already uses this contact email. Check their workspace before creating another.",
        duplicateId: duplicates[0].id,
      };
    const { error } = await db.from("tenants").insert({
      id: input.draftId,
      name: input.businessName,
      type: "client",
      status: "active",
      contact_name: input.contactName,
      contact_email: input.email,
      contact_phone: input.phone || null,
      notes: draftNotes(input, staff.userId),
    });
    if (error) {
      // Another request may have saved this exact draft. A retry checks ownership.
      return {
        ok: false,
        error:
          error.code === "23505"
            ? "This draft may already have been saved. Try once more to open it safely."
            : "The client could not be saved. Your entries are still here.",
      };
    }
    await logAudit({
      action: "tenant.created_manual",
      target: `tenant:${input.draftId}`,
      tenantId: input.draftId,
      metadata: {
        via: "operations_onboarding",
        servicePreference: input.serviceRoute,
        noExternalActions: true,
      },
    });
  }
  const { data: existing, error: checkError } = await db
    .from("projects")
    .select("id,tenant_id")
    .eq("id", input.projectId)
    .maybeSingle();
  if (checkError || (existing && existing.tenant_id !== input.draftId))
    return { ok: true, clientId: input.draftId, projectPending: true };
  if (!existing) {
    // Recover from an interrupted save using the original recorded draft, never
    // a changed retry payload. A partial save is shown honestly in the UI.
    const recorded = prior ? readDraftNotes(prior.notes) : null;
    const { error } = await db.from("projects").insert({
      id: input.projectId,
      tenant_id: input.draftId,
      name: recorded?.projectName ?? input.projectName,
      overview: recorded?.brief ?? input.brief,
      account_owner: (recorded ? recorded.owner : input.owner) || null,
      stage: "discovery",
      next_action: "Confirm the brief and prepare a scoped quote",
      next_action_owner: (recorded ? recorded.owner : input.owner) || null,
    });
    if (error) {
      if (error.code !== "23505")
        return { ok: true, clientId: input.draftId, projectPending: true };
      const { data: concurrent, error: concurrentError } = await db
        .from("projects")
        .select("tenant_id")
        .eq("id", input.projectId)
        .maybeSingle();
      if (concurrentError || concurrent?.tenant_id !== input.draftId)
        return { ok: true, clientId: input.draftId, projectPending: true };
    } else {
      await logAudit({
        action: "project.created_manual",
        target: `project:${input.projectId}`,
        tenantId: input.draftId,
        metadata: { via: "operations_onboarding", noExternalActions: true },
      });
    }
  }
  revalidatePath("/admin/next", "layout");
  revalidatePath("/admin/clients");
  return { ok: true, clientId: input.draftId };
}
