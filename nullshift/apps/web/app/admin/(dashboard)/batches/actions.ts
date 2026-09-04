"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { fireRoutine } from "@/lib/ops/routineDispatch";

const REDISPATCHABLE = ["compiled", "dispatched", "pr_open"];

/**
 * Redispatch — fire the system's routine again with the same work order as a
 * brand-new session. For when a run dies or cannot push (container reclaimed,
 * repo access missing, session lost): the batch and its issues stay as they
 * are, the new session link replaces the old one, and the old one is kept in
 * the audit trail. The prompt is prefixed so the fresh session starts from
 * the base branch rather than looking for a previous run's work.
 */
export async function redispatchBatch(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  const returnTo = String(formData.get("return_to") || `/admin/batches/${id}`);
  if (!id) return;
  const back = (q: string) => `${returnTo}${returnTo.includes("?") ? "&" : "?"}${q}`;

  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("fix_batches")
    .select("id, tenant_id, project_id, status, prompt, routine_session_url")
    .eq("id", id)
    .maybeSingle();
  if (!batch || !batch.prompt || !batch.project_id) {
    redirect(back("err=" + encodeURIComponent("Batch not found or has no work order.")));
  }
  if (!REDISPATCHABLE.includes(String(batch.status))) {
    redirect(
      back(
        "err=" +
          encodeURIComponent(
            "Only a compiled, dispatched or PR-open batch can be redispatched."
          )
      )
    );
  }
  const { data: profile } = await supabase
    .from("system_profiles")
    .select("routine_fire_url, routine_token")
    .eq("project_id", batch.project_id)
    .maybeSingle();
  const fireUrl = (profile?.routine_fire_url as string | null) ?? null;
  const token = (profile?.routine_token as string | null) ?? null;
  if (!fireUrl || !token) {
    redirect(
      back(
        "err=" +
          encodeURIComponent("No routine on this system's passport — nothing to fire.")
      )
    );
  }

  const text =
    `> Fresh start: this is a re-run of a work order whose previous session did not complete or could not push. ` +
    `Start from the base branch — do not look for or depend on a previous run's branch. If the branch named below already exists on the remote, use it with a "-2" suffix.\n\n` +
    batch.prompt;
  const result = await fireRoutine({ fireUrl, token, text });
  if (!result) {
    redirect(
      back(
        "err=" +
          encodeURIComponent(
            "The routine did not fire — check the fire URL and token on the passport."
          )
      )
    );
  }
  const now = new Date().toISOString();
  await supabase
    .from("fix_batches")
    .update({
      status: "dispatched",
      dispatched_at: now,
      routine_session_url: result.sessionUrl,
      routine_fired_at: now,
    })
    .eq("id", id);
  await logAudit({
    action: "batch.redispatched",
    target: `batch:${id}`,
    tenantId: batch.tenant_id,
    metadata: {
      previous_session_url: batch.routine_session_url,
      session_url: result.sessionUrl,
    },
  });
  revalidatePath(`/admin/batches/${id}`);
  revalidatePath("/admin/batches");
  revalidatePath("/admin/clients/[id]", "layout");
  redirect(back("redispatched=1"));
}
