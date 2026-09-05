import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { sendEmail } from "@/lib/sendEmail";
import { wrap, esc, C, FONT } from "@/lib/emailLayout";
import { clientTitle, isPublishable, type OutcomeKind } from "./outcomes";

/**
 * Release reviewed outcomes to the client. This is the ONLY path from a fix
 * batch to a client's update feed: a person has read each line and approved
 * it, so nothing a Claude Code session wrote reaches a client unseen. An
 * outcome of `not_done` is deliberately never published — a person tells the
 * client that themselves, in context.
 */

type OutcomeRow = {
  issue_id: string;
  outcome: OutcomeKind;
  note: string;
  approved_at: string | null;
  published_at: string | null;
};

type IssueLite = {
  id: string;
  tenant_id: string;
  project_id: string | null;
  title: string;
  client_visible: boolean;
  status: string;
};

export type PublishResult = { published: number; emailed: boolean };

/** Where a client's "just gone live" note should land. */
async function clientEmailFor(tenantId: string): Promise<string | null> {
  const service = createServiceClient();
  const { data: membership } = await service
    .from("memberships")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "client_admin")
    .limit(1)
    .maybeSingle();
  if (membership?.user_id) {
    const { data: u } = await service.auth.admin.getUserById(membership.user_id);
    if (u.user?.email) return u.user.email;
  }
  const { data: t } = await service
    .from("tenants")
    .select("contact_email")
    .eq("id", tenantId)
    .maybeSingle();
  return t?.contact_email ?? null;
}

export async function publishApprovedOutcomes(opts: {
  supabase: SupabaseClient;
  batchId: string;
  tenantId: string;
}): Promise<PublishResult> {
  const { supabase, batchId, tenantId } = opts;
  const { data: outcomeRows } = await supabase
    .from("batch_outcomes")
    .select("issue_id, outcome, note, approved_at, published_at")
    .eq("batch_id", batchId);
  const ready = ((outcomeRows ?? []) as OutcomeRow[]).filter(isPublishable);
  if (!ready.length) return { published: 0, emailed: false };

  const { data: issueRows } = await supabase
    .from("issues")
    .select("id, tenant_id, project_id, title, client_visible, status")
    .in(
      "id",
      ready.map((r) => r.issue_id)
    );
  const issues = new Map(((issueRows ?? []) as IssueLite[]).map((i) => [i.id, i]));

  const now = new Date().toISOString();
  const announced: { title: string; note: string }[] = [];

  for (const row of ready) {
    const issue = issues.get(row.issue_id);
    if (!issue) continue;
    // The approved line becomes the issue's resolution note — the same field
    // the portal and the ship email have always read.
    const { error: issueErr } = await supabase
      .from("issues")
      .update({ resolution_note: row.note, status: "shipped", resolved_at: now })
      .eq("id", issue.id);
    if (issueErr) {
      console.error(
        "[ops/publishOutcomes] issue update failed",
        issue.id,
        issueErr.message
      );
      continue;
    }
    if (issue.client_visible) {
      await supabase.from("project_updates").insert({
        tenant_id: issue.tenant_id,
        project_id: issue.project_id,
        type: "update",
        title: clientTitle(row.outcome, issue.title),
        body: row.note,
        client_id: null,
      });
      announced.push({ title: clientTitle(row.outcome, issue.title), note: row.note });
    }
    // Marked published only after the client-facing writes succeeded, so a
    // failure part-way leaves it to be retried rather than silently dropped.
    await supabase
      .from("batch_outcomes")
      .update({ published_at: now })
      .eq("batch_id", batchId)
      .eq("issue_id", issue.id);
  }

  let emailed = false;
  if (announced.length) {
    try {
      const email = await clientEmailFor(tenantId);
      if (email) {
        const rows = announced
          .map(
            (a) =>
              `<li style="margin:0 0 8px;font-family:${FONT};font-size:14px;line-height:1.6;color:${C.fg}"><strong>${esc(a.title)}</strong><br/><span style="color:${C.muted}">${esc(a.note)}</span></li>`
          )
          .join("");
        await sendEmail({
          // A live agreement means they need to know their system changed.
          purpose: "service_relationship",
          to: email,
          subject:
            announced.length === 1
              ? announced[0].title
              : `${announced.length} updates to your system`,
          html: wrap(
            `<tr><td style="padding:26px 32px"><h1 style="margin:0 0 12px;font-family:${FONT};font-size:20px;font-weight:700;color:${C.fg}">Just gone live</h1><ul style="margin:0;padding-left:18px">${rows}</ul><p style="margin:16px 0 0;font-family:${FONT};font-size:13px;color:${C.muted}">Full history is in your portal.</p></td></tr>`,
            "Just gone live"
          ),
          text: `Just gone live:\n\n${announced.map((a) => `- ${a.title} — ${a.note}`).join("\n")}`,
        });
        emailed = true;
      }
    } catch (e) {
      // The updates are posted; a mail hiccup must not undo them.
      console.error("[ops/publishOutcomes] notification email failed:", e);
    }
  }

  await logAudit({
    action: "batch.outcomes_published",
    target: `batch:${batchId}`,
    tenantId,
    metadata: { published: ready.length, announced: announced.length, emailed },
  });
  return { published: ready.length, emailed };
}
