"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { buildAllOutstanding } from "@/lib/ops/buildAll";

/**
 * One click from the Issues and Bugs tile: compile every outstanding issue on
 * the chosen system into a fix batch and fire the system's routine.
 */
export async function buildEverything(formData: FormData) {
  const guard = await requireStaff();
  if (!guard.ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  if (!tenantId || !projectId) return;

  const supabase = await createClient();
  const result = await buildAllOutstanding({
    supabase,
    projectId,
    actor: guard.email,
  });

  revalidatePath(`/admin/clients/${tenantId}/issues`);
  revalidatePath("/admin/batches");
  revalidatePath("/admin/issues");

  const back = `/admin/clients/${tenantId}/issues?project=${projectId}`;
  if (!result.ok) redirect(`${back}&err=${encodeURIComponent(result.error)}`);
  const q = new URLSearchParams({
    built: result.batchId,
    n: String(result.built),
    promoted: String(result.promoted),
    skipped: String(result.skipped),
    fired: result.fired ? "1" : "0",
  });
  if (result.sessionUrl) q.set("session", result.sessionUrl);
  redirect(`${back}&${q.toString()}`);
}
