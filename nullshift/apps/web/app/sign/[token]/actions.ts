"use server";

import { createClient, createServiceClient } from "@nullshift/db";
import { isClientPreview } from "@/lib/clientPreview";
import { declineRequest, signRequest } from "@/lib/signing/engine";
import { loadSignatureRequestByToken, requestEvidence } from "@/lib/signing/data";
import type { SignResult } from "@/components/signing/SignForm";

/**
 * The public signing page's actions. The credential is the single-use link
 * token — possession of it is the signer's authority to act, exactly as with
 * an emailed DocuSign envelope. If the visitor also happens to be signed in
 * to the portal we record who, which only strengthens the evidence.
 */

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

async function sessionActor(): Promise<{ userId: string | null; email: string | null }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return { userId: user?.id ?? null, email: user?.email ?? null };
  } catch {
    return { userId: null, email: null };
  }
}

export async function signByToken(_prev: SignResult | null, formData: FormData): Promise<SignResult> {
  if (await isClientPreview()) return { ok: false, error: "Preview is view-only — nothing was signed." };
  const token = str(formData.get("token"));
  const service = createServiceClient();
  const row = await loadSignatureRequestByToken(service, token);
  if (!row) return { ok: false, error: "This signing link is not valid." };

  const actor = await sessionActor();
  const evidence = await requestEvidence();
  const result = await signRequest(service, {
    row,
    name: str(formData.get("signer_name")),
    role: str(formData.get("signer_role")),
    consents: {
      authority: formData.get("consent_authority") === "on",
      read: formData.get("consent_read") === "on",
      esign: formData.get("consent_esign") === "on",
      bound: formData.get("consent_bound") === "on",
    },
    actorUser: actor.userId,
    // The link was addressed to the signer; a logged-in email is extra, not a substitute.
    actorEmail: actor.email,
    credentialToken: token,
    ...evidence,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, certificateUrl: result.certificateUrl };
}

export async function declineByToken(_prev: SignResult | null, formData: FormData): Promise<SignResult> {
  if (await isClientPreview()) return { ok: false, error: "Preview is view-only." };
  const token = str(formData.get("token"));
  const service = createServiceClient();
  const row = await loadSignatureRequestByToken(service, token);
  if (!row) return { ok: false, error: "This signing link is not valid." };
  const actor = await sessionActor();
  const evidence = await requestEvidence();
  const result = await declineRequest(service, {
    row,
    reason: str(formData.get("reason")) || null,
    actorUser: actor.userId,
    actorEmail: actor.email,
    ...evidence,
  });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
