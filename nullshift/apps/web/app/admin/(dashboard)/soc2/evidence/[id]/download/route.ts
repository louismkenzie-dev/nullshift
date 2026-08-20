import { createServiceClient } from "@nullshift/db";
import { requireSoc2 } from "@/lib/soc2/guard";
import { logSoc2Event } from "@/lib/soc2/events";

/**
 * Signed evidence download. Evidence files live in the private soc2-evidence
 * bucket and are never served directly: this handler re-checks the programme
 * guard (route handlers bypass the section layout), mints a 60-second signed
 * URL, records the download on the evidence item's trail, and redirects. Every
 * access to an evidence file is therefore an audited, named act.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireSoc2();
  if (!guard.ok) return new Response("Forbidden", { status: 403 });

  const { id } = await params;
  const db = createServiceClient();
  const { data: item } = await db
    .from("soc2_evidence_items")
    .select("id, title, file_path, classification")
    .eq("id", id)
    .maybeSingle();
  if (!item?.file_path) return new Response("Not found", { status: 404 });

  // Auditor access is read-only over SELECTED evidence: restricted-
  // classification files stay inside the team — an auditor works from the
  // pack's evidence index and asks, rather than pulling restricted files.
  const auditorOnly = guard.roles.length > 0 && guard.roles.every((r) => r === "auditor");
  if (auditorOnly && item.classification === "restricted") {
    return new Response("Restricted evidence is not available to auditor access", { status: 403 });
  }

  const { data: signed, error } = await db.storage
    .from("soc2-evidence")
    .createSignedUrl(item.file_path, 60);
  if (error || !signed?.signedUrl) {
    return new Response("File unavailable", { status: 404 });
  }

  await logSoc2Event({
    recordType: "evidence",
    recordId: item.id,
    type: "downloaded",
    summary: `Evidence file downloaded: "${item.title.slice(0, 120)}" by ${guard.email}`,
    actor: guard.email,
    asService: true,
  });

  return Response.redirect(signed.signedUrl);
}
