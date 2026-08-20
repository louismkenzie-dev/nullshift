import { createServiceClient } from "@nullshift/db";
import { requireSoc2 } from "@/lib/soc2/guard";
import { logSoc2Event } from "@/lib/soc2/events";
import { signedPackUrl } from "@/lib/soc2/pack";

/**
 * Signed audit-pack download. Packs live in the private soc2-evidence bucket
 * and are never served directly: this handler re-checks the programme guard
 * (route handlers bypass the section layout), mints a five-minute signed URL,
 * records the download on the pack's trail, and redirects. Every hand-over of
 * a pack is therefore an audited, named act.
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
  const { data: pack } = await db
    .from("soc2_audit_packs")
    .select("id, file_path")
    .eq("id", id)
    .maybeSingle();
  if (!pack?.file_path) return new Response("Not found", { status: 404 });

  const url = await signedPackUrl(pack.file_path, 300);
  if (!url) return new Response("File unavailable", { status: 404 });

  await logSoc2Event({
    recordType: "audit_pack",
    recordId: pack.id,
    type: "downloaded",
    summary: `Pack downloaded by ${guard.email}`,
    actor: guard.email,
    asService: true,
  });

  return Response.redirect(url);
}
