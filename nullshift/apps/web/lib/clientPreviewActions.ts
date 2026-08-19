"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireStaff } from "@nullshift/auth/guards";
import { createServiceClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { PREVIEW_COOKIE } from "./clientPreview";

/** Cookie options shared by set + clear — a path-scoped cookie can only be
 *  cleared with the same path, and /portal scoping keeps preview state from
 *  ever touching admin or marketing requests. */
const COOKIE_OPTS = {
  path: "/portal",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

/** Staff only: open the client's portal as a read-only preview. */
export async function startClientPreview(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  if (!staff.ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  if (!tenantId) return;

  const service = createServiceClient();
  const { data: tenant } = await service
    .from("tenants")
    .select("id")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant) return;

  (await cookies()).set(PREVIEW_COOKIE, tenantId, {
    ...COOKIE_OPTS,
    maxAge: 60 * 60 * 2, // auto-expires — a forgotten preview never lingers
  });
  await logAudit({
    action: "client_preview.started",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: { staff: staff.email },
  });
  redirect("/portal");
}

/** Leave the preview and land back on the client's hub page. */
export async function exitClientPreview(): Promise<void> {
  const store = await cookies();
  const tenantId = store.get(PREVIEW_COOKIE)?.value;
  store.set(PREVIEW_COOKIE, "", { ...COOKIE_OPTS, maxAge: 0 });
  redirect(tenantId ? `/admin/clients/${tenantId}` : "/admin/clients");
}
