import { requireStaff } from "@nullshift/auth/guards";
import { createClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";

/**
 * Subject Access Request export (brief §9). Staff-only. Returns a tenant's full
 * data set as a downloadable JSON document via the export_tenant_data RPC.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const guard = await requireStaff();
  if (!guard.ok) return new Response("Forbidden", { status: 403 });

  const { tenantId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("export_tenant_data", { tid: tenantId });
  if (error) return new Response(error.message, { status: 500 });

  await logAudit({ action: "sar.exported", target: `tenant:${tenantId}`, tenantId });

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="nullshift-sar-${tenantId}.json"`,
    },
  });
}
