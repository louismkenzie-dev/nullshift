"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { fireRoutine } from "@/lib/ops/routineDispatch";
import { fetchPullRequestBody } from "@/lib/ops/githubDispatch";
import { parseOutcomes } from "@/lib/ops/outcomes";
import { publishApprovedOutcomes } from "@/lib/ops/publishOutcomes";
import type { IssueRow } from "@/lib/ops/issues";

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

/* ── Outcome review ──────────────────────────────────────────────
 * What the session did for each issue, drafted from the PR, reviewed by a
 * person, then released to the client as "Fixed" or "Answered". Drafts live
 * in batch_outcomes (staff-only) so nothing unapproved is readable by the
 * client it is about.
 */

/** Every issue on the batch gets a row — blank ones are for a human to write. */
export async function draftOutcomes(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  const returnTo = String(formData.get("return_to") || `/admin/batches/${id}`);
  const pasted = String(formData.get("pr_body") || "");
  if (!id) return;
  const back = (q: string) => `${returnTo}${returnTo.includes("?") ? "&" : "?"}${q}`;

  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("fix_batches")
    .select("id, tenant_id, pr_url")
    .eq("id", id)
    .maybeSingle();
  if (!batch) redirect(back("err=" + encodeURIComponent("Batch not found.")));

  const { data: issueRows } = await supabase
    .from("issues")
    .select("*")
    .eq("batch_id", id)
    .order("created_at");
  const issues = (issueRows ?? []) as IssueRow[];
  if (!issues.length) {
    redirect(back("err=" + encodeURIComponent("This batch has no issues to review.")));
  }

  // Prefer what the operator pasted; otherwise read the PR we have on file.
  let body = pasted.trim();
  let source: "pr" | "manual" = body ? "manual" : "pr";
  if (!body && batch.pr_url) body = (await fetchPullRequestBody(batch.pr_url)) ?? "";
  if (!body) {
    source = "manual";
    console.warn("[batches] no PR body available — seeding blank outcome drafts");
  }

  const drafts = parseOutcomes(body, issues);
  // Never overwrite a note a person already approved.
  const { data: existing } = await supabase
    .from("batch_outcomes")
    .select("issue_id, approved_at")
    .eq("batch_id", id);
  const locked = new Set(
    ((existing ?? []) as { issue_id: string; approved_at: string | null }[])
      .filter((r) => r.approved_at)
      .map((r) => r.issue_id)
  );

  const rows = drafts
    .filter((d) => !locked.has(d.issueId))
    .map((d) => ({
      batch_id: id,
      issue_id: d.issueId,
      tenant_id: batch.tenant_id,
      outcome: d.outcome,
      note: d.note,
      source,
    }));
  if (rows.length) {
    const { error } = await supabase
      .from("batch_outcomes")
      .upsert(rows, { onConflict: "batch_id,issue_id" });
    if (error) redirect(back("err=" + encodeURIComponent(error.message)));
  }
  await logAudit({
    action: "batch.outcomes_drafted",
    target: `batch:${id}`,
    tenantId: batch.tenant_id,
    metadata: { drafted: rows.length, source, kept_approved: locked.size },
  });
  revalidatePath(`/admin/batches/${id}`);
  revalidatePath("/admin/clients/[id]", "layout");
  redirect(back(`drafted=${rows.length}`));
}

/** Save one reviewed outcome; "approve" both saves and approves it. */
export async function saveOutcome(formData: FormData) {
  const guard = await requireStaff();
  if (!guard.ok) return;
  const batchId = String(formData.get("batch_id") || "");
  const issueId = String(formData.get("issue_id") || "");
  const outcome = String(formData.get("outcome") || "");
  const note = String(formData.get("note") || "").trim();
  const approve = String(formData.get("approve") || "") === "1";
  const returnTo = String(formData.get("return_to") || `/admin/batches/${batchId}`);
  if (!batchId || !issueId) return;
  const back = (q: string) => `${returnTo}${returnTo.includes("?") ? "&" : "?"}${q}`;
  if (!["fixed", "answered", "not_done"].includes(outcome)) {
    redirect(back("err=" + encodeURIComponent("Pick Fixed, Answered or Not done.")));
  }
  // An approved outcome is what the client reads — it must say something.
  if (approve && outcome !== "not_done" && !note) {
    redirect(
      back(
        "err=" +
          encodeURIComponent("Write the line the client will read before approving.")
      )
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("batch_outcomes")
    .update({
      outcome,
      note,
      approved_at: approve ? new Date().toISOString() : null,
      approved_by: approve ? guard.email : null,
    })
    .eq("batch_id", batchId)
    .eq("issue_id", issueId)
    .is("published_at", null);
  if (error) redirect(back("err=" + encodeURIComponent(error.message)));
  await logAudit({
    action: approve ? "batch.outcome_approved" : "batch.outcome_saved",
    target: `issue:${issueId}`,
    metadata: { batch_id: batchId, outcome },
  });
  revalidatePath(`/admin/batches/${batchId}`);
  revalidatePath("/admin/clients/[id]", "layout");
  redirect(back(approve ? "approved=1" : "saved=1"));
}

/** Release every approved outcome to the client's feed (and one email). */
export async function releaseOutcomes(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const batchId = String(formData.get("id") || "");
  const returnTo = String(formData.get("return_to") || `/admin/batches/${batchId}`);
  if (!batchId) return;
  const back = (q: string) => `${returnTo}${returnTo.includes("?") ? "&" : "?"}${q}`;

  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("fix_batches")
    .select("id, tenant_id")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) redirect(back("err=" + encodeURIComponent("Batch not found.")));

  const result = await publishApprovedOutcomes({
    supabase,
    batchId,
    tenantId: batch.tenant_id,
  });
  revalidatePath(`/admin/batches/${batchId}`);
  revalidatePath("/admin/clients/[id]", "layout");
  revalidatePath("/admin/issues");
  if (result.published === 0) {
    redirect(
      back(
        "err=" + encodeURIComponent("Nothing approved yet — approve an outcome first.")
      )
    );
  }
  redirect(back(`released=${result.published}&emailed=${result.emailed ? 1 : 0}`));
}
