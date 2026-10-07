"use server";

import { createClient, createServiceClient } from "@nullshift/db";
import { isClientPreview } from "@/lib/clientPreview";
import { declineRequest, signRequest } from "@/lib/signing/engine";
import { loadSignatureRequest, requestEvidence } from "@/lib/signing/data";
import type { SignResult } from "@/components/signing/SignForm";

/**
 * Signing from inside the portal. The credential is the session: the signed-in
 * user must be a signatory (client_admin / owner) of the request's tenant,
 * resolved with the service client AFTER the tenant is known from the row —
 * never from the caller.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNATORY_ROLES = ["owner", "client_admin"];
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

async function resolve(requestId: string) {
  if (!UUID_RE.test(requestId)) return { error: "Not found." } as const;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." } as const;
  const service = createServiceClient();
  const row = await loadSignatureRequest(service, requestId);
  if (!row || row.status === "draft") return { error: "Not found." } as const;
  const { data: membership } = await service
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", row.tenant_id)
    .maybeSingle();
  if (!membership || !SIGNATORY_ROLES.includes(membership.role as string))
    return { error: "Only an account owner or admin can sign for your organisation." } as const;
  return { service, row, user } as const;
}

export async function signInPortal(_prev: SignResult | null, formData: FormData): Promise<SignResult> {
  if (await isClientPreview()) return { ok: false, error: "Preview is view-only — nothing was signed." };
  const r = await resolve(str(formData.get("request_id")));
  if ("error" in r) return { ok: false, error: r.error };
  const evidence = await requestEvidence();
  const result = await signRequest(r.service, {
    row: r.row,
    name: str(formData.get("signer_name")),
    role: str(formData.get("signer_role")),
    consents: {
      authority: formData.get("consent_authority") === "on",
      read: formData.get("consent_read") === "on",
      esign: formData.get("consent_esign") === "on",
      bound: formData.get("consent_bound") === "on",
    },
    actorUser: r.user.id,
    actorEmail: r.user.email ?? null,
    credentialToken: null,
    ...evidence,
  });
  if (!result.ok) return { ok: false, error: result.error };
  // In the portal the copy is reached by session, not by link.
  return { ok: true, certificateUrl: `/api/sign/${r.row.id}/certificate` };
}

export async function declineInPortal(_prev: SignResult | null, formData: FormData): Promise<SignResult> {
  if (await isClientPreview()) return { ok: false, error: "Preview is view-only." };
  const r = await resolve(str(formData.get("request_id")));
  if ("error" in r) return { ok: false, error: r.error };
  const evidence = await requestEvidence();
  const result = await declineRequest(r.service, {
    row: r.row,
    reason: str(formData.get("reason")) || null,
    actorUser: r.user.id,
    actorEmail: r.user.email ?? null,
    ...evidence,
  });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
