import { headers } from "next/headers";
import type { createServiceClient } from "@nullshift/db";
import { siteUrl } from "@/lib/portalLinks";
import {
  hashSigningToken,
  isTokenShaped,
  signingContentFrom,
  type SignatureEventRow,
  type SignatureRequestRow,
  type SigningContent,
} from "./model";

/**
 * Server-side reads and the one write for signature requests. Shared by the
 * admin pages, the public signing page, the portal page and the certificate
 * route so they all resolve a request the same way.
 *
 * Everything reads through the SERVICE client: the public signing page has
 * no session at all (the link is the credential), and the evidence table has
 * no client RLS policy by design. Authorisation is therefore the caller's
 * job, and each caller does it explicitly before calling anything here —
 * the token hash, the staff guard, or the member check.
 */

type Service = ReturnType<typeof createServiceClient>;

export const REQUEST_COLUMNS =
  "id, tenant_id, project_id, reference, kind, title, status, body_source, body_blocks, commercial, document_snapshot, document_hash, incorporated_versions, signer_name, signer_email, signer_role, token_hash, issued_at, issued_by, expires_at, signed_at, countersigned_at, countersigned_by, completed_at, declined_at, decline_reason, voided_at, void_reason, change_order_id, created_by, created_at, updated_at";

export async function loadSignatureRequest(
  service: Service,
  id: string
): Promise<SignatureRequestRow | null> {
  const { data, error } = await service
    .from("signature_requests")
    .select(REQUEST_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`signature_requests read failed: ${error.message}`);
  return (data as unknown as SignatureRequestRow | null) ?? null;
}

/** The link's credential: the sha256 of the token in the URL. Wrong shape → null without a query. */
export async function loadSignatureRequestByToken(
  service: Service,
  token: unknown
): Promise<SignatureRequestRow | null> {
  if (!isTokenShaped(token)) return null;
  const { data, error } = await service
    .from("signature_requests")
    .select(REQUEST_COLUMNS)
    .eq("token_hash", hashSigningToken(token))
    .maybeSingle();
  if (error) throw new Error(`signature_requests read failed: ${error.message}`);
  return (data as unknown as SignatureRequestRow | null) ?? null;
}

export async function loadSignatureEvents(
  service: Service,
  requestId: string
): Promise<SignatureEventRow[]> {
  const { data, error } = await service
    .from("signature_events")
    .select("*")
    .eq("request_id", requestId)
    .order("at", { ascending: true });
  if (error) throw new Error(`signature_events read failed: ${error.message}`);
  return (data ?? []) as unknown as SignatureEventRow[];
}

export type SignatureEventInput = {
  requestId: string;
  tenantId: string;
  kind: SignatureEventRow["kind"];
  actorKind: SignatureEventRow["actor_kind"];
  actorUser?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  signatureText?: string | null;
  consent?: Record<string, boolean> | null;
  documentHash?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown>;
};

/**
 * Append one evidence row. The signature events are NOT best-effort: a
 * signature whose evidence failed to write must not be reported as recorded,
 * so this throws and the caller decides. (Receipts in document_events stay
 * best-effort — they are a convenience, this is the record.)
 */
export async function recordSignatureEvent(
  service: Service,
  input: SignatureEventInput
): Promise<void> {
  const { error } = await service.from("signature_events").insert({
    request_id: input.requestId,
    tenant_id: input.tenantId,
    kind: input.kind,
    actor_kind: input.actorKind,
    actor_user: input.actorUser ?? null,
    actor_name: input.actorName ?? null,
    actor_email: input.actorEmail ?? null,
    actor_role: input.actorRole ?? null,
    signature_text: input.signatureText ?? null,
    consent: input.consent ?? null,
    document_hash: input.documentHash ?? null,
    ip_address: input.ip ?? null,
    user_agent: input.userAgent ?? null,
    meta: input.meta ?? {},
  });
  if (error) throw new Error(`signature_events insert failed: ${error.message}`);
}

/** Has this (request, kind) already been recorded? For first-view ticks. */
export async function hasSignatureEvent(
  service: Service,
  requestId: string,
  kind: SignatureEventRow["kind"]
): Promise<boolean> {
  const { data } = await service
    .from("signature_events")
    .select("id")
    .eq("request_id", requestId)
    .eq("kind", kind)
    .limit(1);
  return !!data?.length;
}

/** IP and user agent of the current request, for the evidence row. */
export async function requestEvidence(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent"),
  };
}

export const signingUrl = (token: string) => `${siteUrl()}/sign/${token}`;
export const adminSigningUrl = (tenantId: string, requestId: string) =>
  `${siteUrl()}/admin/clients/${tenantId}/sign/${requestId}`;
/** The PDF. Staff and members get it by session; a signer by their link token. */
export const certificateUrl = (requestId: string, token?: string | null) =>
  `${siteUrl()}/api/sign/${requestId}/certificate${token ? `?t=${encodeURIComponent(token)}` : ""}`;

/** The signer-facing content, from the frozen snapshot — null when it does not verify. */
export const contentOf = (row: SignatureRequestRow): SigningContent | null =>
  signingContentFrom(row.document_snapshot, row.document_hash);

export type { SignatureBlock } from "./format";
export { dateGB, dateTimeGB } from "./format";

/** The two signatures, as recorded in the evidence (never from the request row alone). */
export function signaturesOf(events: SignatureEventRow[]): {
  client: import("./format").SignatureBlock;
  nullshift: import("./format").SignatureBlock;
} {
  const pick = (kind: "signed" | "countersigned"): import("./format").SignatureBlock => {
    const e = events.find((x) => x.kind === kind);
    return e
      ? {
          name: e.signature_text ?? e.actor_name ?? "",
          role: e.actor_role,
          email: e.actor_email,
          at: e.at,
        }
      : null;
  };
  return { client: pick("signed"), nullshift: pick("countersigned") };
}

