import type { SupabaseClient } from "@supabase/supabase-js";
import { requiresChangeOrder } from "@nullshift/content/legal/work";
import { logAudit } from "@nullshift/db/audit";
import {
  QUEUEABLE_STATUSES,
  isBatchable,
  isUnreviewedDraft,
  type IssueRow,
} from "./issues";
import { compileBatchPrompt, type SystemProfileRow } from "./batchCompiler";
import { fireRoutine } from "./routineDispatch";

/**
 * "Build everything outstanding" — the one-click path from a client's Issues
 * and Bugs tile: every open, human-confirmed issue on a system is compiled
 * into a single fix batch and the system's Claude Code routine is fired at
 * once. The owner is choosing to build the lot under the plan, so issues
 * still sitting at `unclassified` billing are marked `covered` on the way
 * through (audited per issue). The two hard gates survive untouched:
 *
 *  - §8: additional development / mixed work without an ACCEPTED Change
 *    Order is left out (the database trigger would refuse it anyway);
 *  - billable (out_of_scope) work without the client's quote acceptance is
 *    left out.
 *
 * Skipped issues are reported back so the operator sees exactly what did not
 * go and why, instead of a silently smaller batch.
 */

export type SkipReason = "change_order" | "quote" | "in_batch";

export type Partition = {
  /** Batchable as-is. */
  ready: IssueRow[];
  /** Unclassified → will be marked covered, then built. */
  promote: IssueRow[];
  /** Left out, with the gate that held them. */
  blocked: { issue: IssueRow; reason: SkipReason }[];
};

const ACCEPTED_CO = new Set(["accepted", "in_build", "delivered", "accepted_complete"]);

/** Pure: split a project's issues into build now / promote then build / leave out. */
export function partitionOutstanding(
  issues: IssueRow[],
  changeOrderStatus: Map<string, string> = new Map()
): Partition {
  const out: Partition = { ready: [], promote: [], blocked: [] };
  for (const i of issues) {
    if (!QUEUEABLE_STATUSES.includes(i.status)) continue;
    if (isUnreviewedDraft(i)) continue;
    if (i.batch_id) {
      out.blocked.push({ issue: i, reason: "in_batch" });
      continue;
    }
    if (requiresChangeOrder(i.classification)) {
      const st = i.change_order_id ? changeOrderStatus.get(i.change_order_id) : undefined;
      if (!st || !ACCEPTED_CO.has(st)) {
        out.blocked.push({ issue: i, reason: "change_order" });
        continue;
      }
    }
    if (i.billing === "unclassified") {
      out.promote.push(i);
      continue;
    }
    if (isBatchable(i)) out.ready.push(i);
    else out.blocked.push({ issue: i, reason: "quote" });
  }
  return out;
}

export const SKIP_LABEL: Record<SkipReason, string> = {
  change_order: "needs an accepted Change Order",
  quote: "quote not accepted by the client",
  in_batch: "already in a batch",
};

const SEVERITY_RANK: Record<IssueRow["severity"], number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export type BuildAllResult =
  | {
      ok: true;
      batchId: string;
      built: number;
      promoted: number;
      skipped: number;
      fired: boolean;
      sessionUrl: string | null;
    }
  | { ok: false; error: string; skipped?: number };

/**
 * Compile and fire. `supabase` is the staff-scoped client (RLS applies —
 * the caller has already passed requireStaff).
 */
export async function buildAllOutstanding(opts: {
  supabase: SupabaseClient;
  projectId: string;
  actor: string;
}): Promise<BuildAllResult> {
  const { supabase, projectId } = opts;
  const { data: project } = await supabase
    .from("projects")
    .select("id, tenant_id, name, live_url")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { ok: false, error: "System not found." };

  const { data: issueRows } = await supabase
    .from("issues")
    .select("*")
    .eq("project_id", projectId)
    .in("status", QUEUEABLE_STATUSES);
  const all = (issueRows ?? []) as IssueRow[];
  const coIds = [
    ...new Set(all.map((i) => i.change_order_id).filter(Boolean)),
  ] as string[];
  const coStatus = new Map<string, string>();
  if (coIds.length) {
    const { data: cos } = await supabase
      .from("change_orders")
      .select("id, status")
      .in("id", coIds);
    for (const c of (cos ?? []) as { id: string; status: string }[])
      coStatus.set(c.id, c.status);
  }
  const part = partitionOutstanding(all, coStatus);
  const toBuild = [...part.ready, ...part.promote].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      a.created_at.localeCompare(b.created_at)
  );
  if (toBuild.length === 0) {
    return {
      ok: false,
      error: part.blocked.length
        ? "Nothing can be built yet — every outstanding issue is held by a gate (see the list)."
        : "Nothing outstanding on this system.",
      skipped: part.blocked.length,
    };
  }

  // The owner's decision: unclassified work is built under the plan.
  if (part.promote.length) {
    const ids = part.promote.map((i) => i.id);
    const { error } = await supabase
      .from("issues")
      .update({ billing: "covered" })
      .in("id", ids);
    if (error)
      return { ok: false, error: `Could not mark issues as covered: ${error.message}` };
    for (const i of part.promote) {
      await logAudit({
        action: "issue.bulk_covered",
        target: `issue:${i.id}`,
        tenantId: project.tenant_id,
        metadata: { by: opts.actor, from: i.billing, via: "build_all" },
      });
    }
  }

  const [{ data: profileRow }, { data: tenant }] = await Promise.all([
    supabase
      .from("system_profiles")
      .select(
        "project_id, repo_full_name, default_branch, vercel_project, supabase_ref, stack, runbook, quirks, routine_fire_url, routine_token"
      )
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("tenants")
      .select("id, name, type")
      .eq("id", project.tenant_id)
      .single(),
  ]);
  const profile =
    (profileRow as
      | (SystemProfileRow & {
          routine_fire_url: string | null;
          routine_token: string | null;
        })
      | null) ?? null;

  const date = new Date().toISOString().slice(0, 10);
  const title = `Everything outstanding — ${date}`;
  const built = toBuild.map((i) =>
    i.billing === "unclassified" ? { ...i, billing: "covered" as const } : i
  );
  const prompt = compileBatchPrompt({
    tenantName: tenant?.name ?? "the client",
    projectName: project.name,
    liveUrl: project.live_url ?? null,
    profile,
    issues: built,
    batchTitle: title,
    tenantType: tenant?.type === "internal" ? "internal" : "client",
  });

  const { data: batch, error: batchErr } = await supabase
    .from("fix_batches")
    .insert({
      tenant_id: project.tenant_id,
      project_id: projectId,
      title,
      status: "compiled",
      prompt,
    })
    .select("id")
    .single();
  if (batchErr || !batch)
    return { ok: false, error: batchErr?.message ?? "Could not create the batch." };

  const { error: attachErr } = await supabase
    .from("issues")
    .update({ batch_id: batch.id, status: "batched" })
    .in(
      "id",
      built.map((i) => i.id)
    );
  if (attachErr) {
    // The §8 trigger or RLS refused — don't leave an empty batch behind.
    await supabase.from("fix_batches").delete().eq("id", batch.id);
    return { ok: false, error: `Could not queue the issues: ${attachErr.message}` };
  }
  await logAudit({
    action: "batch.compiled",
    target: `batch:${batch.id}`,
    tenantId: project.tenant_id,
    metadata: {
      title,
      issues: built.length,
      via: "build_all",
      skipped: part.blocked.length,
    },
  });

  // Fire the routine straight away when the passport has one.
  let fired = false;
  let sessionUrl: string | null = null;
  if (profile?.routine_fire_url && profile?.routine_token) {
    const { data: claimed } = await supabase
      .from("fix_batches")
      .update({ status: "dispatched", dispatched_at: new Date().toISOString() })
      .eq("id", batch.id)
      .eq("status", "compiled")
      .select("id");
    if (claimed?.length) {
      const result = await fireRoutine({
        fireUrl: profile.routine_fire_url,
        token: profile.routine_token,
        text: prompt,
      });
      if (result) {
        fired = true;
        sessionUrl = result.sessionUrl;
        await supabase
          .from("fix_batches")
          .update({
            routine_session_url: result.sessionUrl,
            routine_fired_at: new Date().toISOString(),
          })
          .eq("id", batch.id);
        await logAudit({
          action: "batch.routine_fired",
          target: `batch:${batch.id}`,
          tenantId: project.tenant_id,
          metadata: { session_url: result.sessionUrl, via: "build_all" },
        });
      } else {
        await supabase
          .from("fix_batches")
          .update({ status: "compiled", dispatched_at: null })
          .eq("id", batch.id)
          .eq("status", "dispatched");
      }
    }
  }

  return {
    ok: true,
    batchId: batch.id,
    built: built.length,
    promoted: part.promote.length,
    skipped: part.blocked.length,
    fired,
    sessionUrl,
  };
}
