import { createElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient, createServiceClient } from "@nullshift/db";
import { isAdminEmail } from "@nullshift/auth/admin";
import { legalConfig } from "@nullshift/content/legal/config";
import { SignedDocumentPdf } from "@/lib/pdf/SignedDocumentPdf";
import { hashSigningToken, isTokenShaped, signingRecord } from "@/lib/signing/model";
import { contentOf, loadSignatureEvents, loadSignatureRequest, signaturesOf } from "@/lib/signing/data";

/**
 * GET /api/sign/{id}/certificate[?t=token] → the signed copy / completion
 * certificate as an A4 PDF, rendered from the frozen snapshot.
 *
 * Three ways in, checked in this order:
 *   1. `?t=` — the signing link's token (the signer's copy, no login needed);
 *   2. a staff session;
 *   3. a session belonging to a member of the request's tenant.
 * Anything else, and any draft, is a 404 — not a 403, so the route does not
 * confirm that a given id exists.
 */
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return new Response("Not found", { status: 404 });
  const service = createServiceClient();
  const row = await loadSignatureRequest(service, id);
  if (!row || row.status === "draft") return new Response("Not found", { status: 404 });

  const token = new URL(req.url).searchParams.get("t");
  let allowed = isTokenShaped(token) && !!row.token_hash && hashSigningToken(token) === row.token_hash;

  if (!allowed) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: isStaff } = await supabase.rpc("is_internal_staff");
      if (isStaff === true || (user.email && isAdminEmail(user.email))) allowed = true;
      else {
        const { data: membership } = await service
          .from("memberships")
          .select("id")
          .eq("user_id", user.id)
          .eq("tenant_id", row.tenant_id)
          .limit(1)
          .maybeSingle();
        allowed = !!membership;
      }
    }
  }
  if (!allowed) return new Response("Not found", { status: 404 });

  const content = contentOf(row);
  if (!content) return new Response("Document does not verify", { status: 409 });
  const events = await loadSignatureEvents(service, row.id);

  const doc = createElement(SignedDocumentPdf, {
    content,
    hash: row.document_hash,
    status: row.status,
    signatures: signaturesOf(events),
    record: signingRecord(events),
    nullshiftName: legalConfig.entity.legalName,
  }) as React.ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(doc);
  const filename = `nullshift-${row.reference}-${row.status}.pdf`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
