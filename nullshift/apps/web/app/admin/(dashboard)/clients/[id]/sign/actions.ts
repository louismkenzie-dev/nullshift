"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { isClientPreview } from "@/lib/clientPreview";
import { staffLabel } from "@/lib/legalReview";
import { parseDocumentSource } from "@/lib/signing/blocks";
import {
  commercialFromText,
  SIGNATURE_KINDS,
  type SignatureKind,
} from "@/lib/signing/model";
import { firstNameOf, templateById } from "@/lib/signing/templates";
import {
  countersignRequest,
  issueRequest,
  resendRequest,
  voidRequest,
} from "@/lib/signing/engine";
import { loadSignatureRequest, requestEvidence } from "@/lib/signing/data";

/**
 * Staff actions for e-signature requests (migration 0068). Each one: staff
 * guard → never under the client-preview cookie → the engine does the work →
 * back to the page with a notice. The engine owns the transitions; these
 * own the form parsing and the redirects.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

type Staff = { userId: string; email: string; name: string | null };

async function guard(): Promise<Staff | null> {
  const staff = await requireStaff();
  if (!staff.ok) return null;
  if (await isClientPreview()) return null;
  const label = await staffLabel(staff.userId);
  return { userId: staff.userId, email: staff.email, name: label || null };
}

const listPath = (tenantId: string) => `/admin/clients/${tenantId}/sign`;
const detailPath = (tenantId: string, id: string) => `/admin/clients/${tenantId}/sign/${id}`;
const withNotice = (path: string, kind: "notice" | "error", text: string) =>
  `${path}?${kind}=${encodeURIComponent(text)}`;

function revalidate(tenantId: string, id?: string) {
  revalidatePath(listPath(tenantId));
  if (id) revalidatePath(detailPath(tenantId, id));
  revalidatePath(`/admin/clients/${tenantId}/docs`);
  revalidatePath("/portal/legal");
}

/** New draft from a template, addressed to the client's contact. */
export async function createSignatureDraft(formData: FormData): Promise<void> {
  const staff = await guard();
  if (!staff) return;
  const tenantId = str(formData.get("tenant_id"));
  if (!UUID_RE.test(tenantId)) return;

  const db = createServiceClient();
  const [{ data: tenant }, { data: project }] = await Promise.all([
    db.from("tenants").select("id, name, contact_name, contact_email").eq("id", tenantId).maybeSingle(),
    db
      .from("projects")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!tenant) return;

  const template = templateById(str(formData.get("template_id"))) ?? templateById("blank")!;
  const ctx = {
    clientName: tenant.name as string,
    contactFirstName: firstNameOf(str(formData.get("signer_name")) || (tenant.contact_name as string | null)),
    projectName: (project?.name as string | undefined) ?? null,
  };
  const title = str(formData.get("title")) || template.title(ctx);
  const signerName = str(formData.get("signer_name")) || ((tenant.contact_name as string | null) ?? "");
  const signerEmail = (str(formData.get("signer_email")) || ((tenant.contact_email as string | null) ?? "")).toLowerCase();
  const signerRole = str(formData.get("signer_role")) || null;
  if (!signerName || !signerEmail) {
    redirect(withNotice(listPath(tenantId), "error", "Name the signer and give their email address."));
  }

  const { data: ref } = await db.rpc("next_signature_request_ref");
  const { commercial } = commercialFromText(template.commercialLines, { note: template.commercialNote });
  const source = template.source(ctx);

  const { data: created, error } = await db
    .from("signature_requests")
    .insert({
      tenant_id: tenantId,
      project_id: project?.id ?? null,
      reference: (ref as string | null) ?? `SR-${Date.now()}`,
      kind: template.kind,
      title,
      status: "draft",
      body_source: source,
      body_blocks: parseDocumentSource(source),
      commercial,
      signer_name: signerName,
      signer_email: signerEmail,
      signer_role: signerRole,
      created_by: staff.userId,
    })
    .select("id")
    .single();
  if (error || !created) {
    redirect(withNotice(listPath(tenantId), "error", `Could not create the draft: ${error?.message ?? "unknown"}`));
  }

  await logAudit({
    action: "signature_request.drafted",
    target: `signature_request:${created.id}`,
    tenantId,
    metadata: { template: template.id, title, signer_email: signerEmail },
  });
  revalidate(tenantId, created.id as string);
  redirect(detailPath(tenantId, created.id as string));
}

/** Save edits to a draft. Anything that has been issued is frozen (DB trigger too). */
export async function saveSignatureDraft(formData: FormData): Promise<void> {
  const staff = await guard();
  if (!staff) return;
  const id = str(formData.get("id"));
  const tenantId = str(formData.get("tenant_id"));
  if (!UUID_RE.test(id) || !UUID_RE.test(tenantId)) return;

  const kindRaw = str(formData.get("kind")) as SignatureKind;
  const kind: SignatureKind = (SIGNATURE_KINDS as readonly string[]).includes(kindRaw) ? kindRaw : "other";
  const source = String(formData.get("body_source") ?? "").replace(/\r\n?/g, "\n");
  const { commercial, problems } = commercialFromText(String(formData.get("commercial_lines") ?? ""), {
    note: str(formData.get("commercial_note")) || null,
  });

  const db = createServiceClient();
  const { data: updated, error } = await db
    .from("signature_requests")
    .update({
      kind,
      title: str(formData.get("title")),
      signer_name: str(formData.get("signer_name")),
      signer_email: str(formData.get("signer_email")).toLowerCase(),
      signer_role: str(formData.get("signer_role")) || null,
      body_source: source,
      body_blocks: parseDocumentSource(source),
      commercial,
    })
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  revalidate(tenantId, id);
  if (error) redirect(withNotice(detailPath(tenantId, id), "error", `Could not save: ${error.message}`));
  if (!updated) redirect(withNotice(detailPath(tenantId, id), "error", "This document is no longer a draft."));
  if (problems.length)
    redirect(withNotice(detailPath(tenantId, id), "error", `Saved, but check the costing: ${problems.join(" ")}`));
  redirect(withNotice(detailPath(tenantId, id), "notice", "Draft saved."));
}

export async function deleteSignatureDraft(formData: FormData): Promise<void> {
  const staff = await guard();
  if (!staff) return;
  const id = str(formData.get("id"));
  const tenantId = str(formData.get("tenant_id"));
  if (!UUID_RE.test(id) || !UUID_RE.test(tenantId)) return;
  const db = createServiceClient();
  const row = await loadSignatureRequest(db, id);
  if (!row || row.tenant_id !== tenantId || row.status !== "draft") return;
  await db.from("signature_requests").delete().eq("id", id).eq("status", "draft");
  await logAudit({
    action: "signature_request.draft_deleted",
    target: `signature_request:${id}`,
    tenantId,
    metadata: { reference: row.reference, title: row.title },
  });
  revalidate(tenantId);
  redirect(withNotice(listPath(tenantId), "notice", `Draft ${row.reference} deleted.`));
}

/** Freeze, hash, mint the link and email the signer. */
export async function issueSignatureRequest(formData: FormData): Promise<void> {
  const staff = await guard();
  if (!staff) return;
  const id = str(formData.get("id"));
  const tenantId = str(formData.get("tenant_id"));
  if (!UUID_RE.test(id) || !UUID_RE.test(tenantId)) return;
  const result = await issueRequest(createServiceClient(), {
    requestId: id,
    staff,
    message: str(formData.get("message")) || null,
  });
  revalidate(tenantId, id);
  redirect(
    result.ok
      ? withNotice(detailPath(tenantId, id), "notice", `${result.reference} sent for signature.`)
      : withNotice(detailPath(tenantId, id), "error", result.error)
  );
}

export async function resendSignatureLink(formData: FormData): Promise<void> {
  const staff = await guard();
  if (!staff) return;
  const id = str(formData.get("id"));
  const tenantId = str(formData.get("tenant_id"));
  if (!UUID_RE.test(id) || !UUID_RE.test(tenantId)) return;
  const result = await resendRequest(createServiceClient(), {
    requestId: id,
    staff,
    message: str(formData.get("message")) || null,
  });
  revalidate(tenantId, id);
  redirect(
    result.ok
      ? withNotice(detailPath(tenantId, id), "notice", "A fresh signing link has been emailed. The old one no longer works.")
      : withNotice(detailPath(tenantId, id), "error", result.error)
  );
}

export async function voidSignatureRequest(formData: FormData): Promise<void> {
  const staff = await guard();
  if (!staff) return;
  const id = str(formData.get("id"));
  const tenantId = str(formData.get("tenant_id"));
  if (!UUID_RE.test(id) || !UUID_RE.test(tenantId)) return;
  const result = await voidRequest(createServiceClient(), {
    requestId: id,
    staff,
    reason: str(formData.get("reason")) || null,
  });
  revalidate(tenantId, id);
  redirect(
    result.ok
      ? withNotice(detailPath(tenantId, id), "notice", "Voided. The signing link is dead and the signer has been told.")
      : withNotice(detailPath(tenantId, id), "error", result.error)
  );
}

/** Nullshift's signature, typed by the staff member countersigning. */
export async function countersignSignatureRequest(formData: FormData): Promise<void> {
  const staff = await guard();
  if (!staff) return;
  const id = str(formData.get("id"));
  const tenantId = str(formData.get("tenant_id"));
  if (!UUID_RE.test(id) || !UUID_RE.test(tenantId)) return;
  if (formData.get("confirm") !== "on") {
    redirect(withNotice(detailPath(tenantId, id), "error", "Tick the confirmation to countersign."));
  }
  const evidence = await requestEvidence();
  const result = await countersignRequest(createServiceClient(), {
    requestId: id,
    staff,
    name: str(formData.get("name")),
    role: str(formData.get("role")),
    ...evidence,
  });
  revalidate(tenantId, id);
  redirect(
    result.ok
      ? withNotice(detailPath(tenantId, id), "notice", "Countersigned. Both parties have been sent the completed copy.")
      : withNotice(detailPath(tenantId, id), "error", result.error)
  );
}
