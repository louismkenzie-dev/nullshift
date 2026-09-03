"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { currentPeriodStart } from "@/lib/carePlans";
import { draftImpactStatement } from "@/lib/ops/assistants";
import { dueAtFor, type IssueRow } from "@/lib/ops/issues";
import type {
  IssueBilling,
  IssueKind,
  IssueSeverity,
  IssueStatus,
} from "@/lib/ops/issues";
import { requiresChangeOrder, type WorkClassification } from "@nullshift/content/legal/work";
import {
  ALL_STATUSES,
  BILLINGS,
  BUILD_STATUSES,
  CLASSIFICATIONS,
  KINDS,
  SEVERITIES,
  SOURCES,
} from "@/lib/ops/issueForm";

/**
 * Issue bank actions — log, triage, queue, quote, close. Shared by the global
 * issue bank (/admin/issues) and every client's Issues and Bugs tile, so a
 * write from either surface is the same write with the same audit entry.
 */

/** The bank, the inbox and every client tile show the same rows. */
function revalidateIssues() {
  revalidatePath("/admin/issues");
  revalidatePath("/admin/inbox");
  revalidatePath("/admin/clients/[id]", "layout");
}

export async function createIssue(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const projectId = String(formData.get("project_id") || "");
  const title = String(formData.get("title") || "").trim();
  if (!projectId || !title) return;
  const description = String(formData.get("description") || "").trim() || null;
  const kindRaw = String(formData.get("kind") || "bug");
  const severityRaw = String(formData.get("severity") || "normal");
  const sourceRaw = String(formData.get("source") || "internal");
  const kind = (KINDS as string[]).includes(kindRaw) ? kindRaw : "bug";
  const severity = (SEVERITIES as string[]).includes(severityRaw)
    ? severityRaw
    : "normal";
  const source = (SOURCES as string[]).includes(sourceRaw) ? sourceRaw : "internal";
  const clientVisible = formData.get("client_visible") === "on";
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, tenant_id")
    .eq("id", projectId)
    .single();
  if (!project) return;
  const { data, error } = await supabase
    .from("issues")
    .insert({
      tenant_id: project.tenant_id,
      project_id: projectId,
      source,
      kind,
      severity,
      title,
      description,
      status: "new",
      client_visible: clientVisible,
    })
    .select("id")
    .single();
  if (!error && data) {
    await logAudit({
      action: "issue.created",
      target: `issue:${data.id}`,
      tenantId: project.tenant_id,
      metadata: { source, kind, severity },
    });
  }
  revalidateIssues();
}

export async function triageIssue(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("issues")
    .select("*")
    .eq("id", id)
    .single();
  if (!existing) return;
  const cur = existing as IssueRow;

  const kindRaw = String(formData.get("kind") || cur.kind);
  const severityRaw = String(formData.get("severity") || cur.severity);
  const billingRaw = String(formData.get("billing") || cur.billing);
  const statusRaw = String(formData.get("status") || cur.status);
  const kind = ((KINDS as string[]).includes(kindRaw) ? kindRaw : cur.kind) as IssueKind;
  const severity = (
    (SEVERITIES as string[]).includes(severityRaw) ? severityRaw : cur.severity
  ) as IssueSeverity;
  const billing = (
    (BILLINGS as string[]).includes(billingRaw) ? billingRaw : cur.billing
  ) as IssueBilling;
  let status = (
    (ALL_STATUSES as string[]).includes(statusRaw) ? statusRaw : cur.status
  ) as IssueStatus;

  // §8. Restore/configure an existing agreed capability = support. Create or
  // materially change one = additional development, and that must not be built
  // off a support entitlement.
  const classRaw = String(formData.get("classification") || "");
  const classification = ((CLASSIFICATIONS as string[]).includes(classRaw)
    ? classRaw
    : (cur.classification ?? null)) as WorkClassification | null;

  let buildBlocked = false;
  if (requiresChangeOrder(classification) && BUILD_STATUSES.includes(status)) {
    // The database enforces this too. Checking here as well means the admin
    // sees the ticket refuse to move, rather than a save that silently no-ops.
    let accepted = false;
    if (cur.change_order_id) {
      const { data: co } = await supabase
        .from("change_orders")
        .select("status")
        .eq("id", cur.change_order_id)
        .maybeSingle();
      accepted = ["accepted", "in_build", "delivered", "accepted_complete"].includes(
        String(co?.status)
      );
    }
    if (!accepted) {
      buildBlocked = true;
      status = cur.status;
    }
  }

  const buildItemsRaw = String(formData.get("build_items") || "").trim();
  const buildItems = buildItemsRaw ? Number(buildItemsRaw) : null;
  const quotedRaw = String(formData.get("quoted_price") || "").trim();
  const dueRaw = String(formData.get("due_at") || "").trim();
  const promised = formData.get("promised") === "on";
  const now = new Date().toISOString();

  // Due date: explicit input wins; else keep the existing one; else derive it
  // from severity when the severity has just changed.
  let dueAt = dueRaw ? new Date(dueRaw).toISOString() : cur.due_at;
  if (!dueAt && severity !== cur.severity) dueAt = dueAtFor(severity);

  const update: Record<string, unknown> = {
    kind,
    severity,
    billing,
    status,
    classification,
    classification_note:
      String(formData.get("classification_note") || "").trim() || null,
    build_items: buildItems,
    quoted_price: quotedRaw ? Number(quotedRaw) : null,
    due_at: dueAt,
    promised_at: promised ? (cur.promised_at ?? now) : null,
    promised_note: String(formData.get("promised_note") || "").trim() || null,
    client_visible: formData.get("client_visible") === "on",
    resolution_note: String(formData.get("resolution_note") || "").trim() || null,
    quote_note: String(formData.get("quote_note") || "").trim() || null,
    assignee: String(formData.get("assignee") || "").trim() || null,
  };
  if (status === "fixed" || status === "shipped" || status === "closed") {
    update.resolved_at = cur.resolved_at ?? now;
  }
  if (classification && classification !== cur.classification) {
    update.classified_at = now;
    update.classified_by = (await supabase.auth.getUser()).data.user?.id ?? null;
  }
  await supabase.from("issues").update(update).eq("id", id);

  if (buildBlocked)
    await logAudit({
      action: "issue.build_blocked_no_change_order",
      target: `issue:${id}`,
      tenantId: cur.tenant_id,
      metadata: { classification, attempted: statusRaw },
    });

  // A shipped build_item consumes a build credit — exactly once per issue.
  // Deliberately NOT gated on the transition into "shipped": billing is often
  // classified after the fact, and the debit must still land. The partial
  // unique index build_credit_events_one_debit_per_issue (migration 0016)
  // makes the once-per-issue guarantee hold even under concurrent saves.
  if (billing === "build_item" && (status === "shipped" || status === "fixed")) {
    const { data: prior } = await supabase
      .from("build_credit_events")
      .select("id")
      .eq("issue_id", id)
      .lt("delta", 0)
      .limit(1);
    if (!prior?.length) {
      await supabase.from("build_credit_events").insert({
        tenant_id: cur.tenant_id,
        project_id: cur.project_id,
        issue_id: id,
        period: currentPeriodStart(),
        delta: -Number(buildItems ?? cur.build_items ?? 1),
        reason: cur.title,
      });
    }
  }

  await logAudit({
    action: "issue.triaged",
    target: `issue:${id}`,
    tenantId: cur.tenant_id,
    metadata: { kind, severity, billing, status, classification },
  });
  revalidateIssues();
}

export async function queueIssue(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!id) return;
  const supabase = await createClient();

  // §8 again: queueing IS approving for build, so the same gate applies here
  // as in triage. The database trigger would reject it anyway; refusing here
  // keeps the failure legible instead of a silent no-op.
  const { data: cur } = await supabase
    .from("issues")
    .select("classification, change_order_id")
    .eq("id", id)
    .maybeSingle();
  if (requiresChangeOrder(cur?.classification as WorkClassification | null)) {
    const { data: co } = cur?.change_order_id
      ? await supabase
          .from("change_orders")
          .select("status")
          .eq("id", cur.change_order_id)
          .maybeSingle()
      : { data: null };
    const accepted = ["accepted", "in_build", "delivered", "accepted_complete"].includes(
      String(co?.status)
    );
    if (!accepted) {
      await logAudit({
        action: "issue.build_blocked_no_change_order",
        target: `issue:${id}`,
        tenantId,
        metadata: { classification: cur?.classification, attempted: "queued" },
      });
      revalidateIssues();
      return;
    }
  }

  await supabase.from("issues").update({ status: "queued" }).eq("id", id);
  await logAudit({ action: "issue.queued", target: `issue:${id}`, tenantId });
  revalidateIssues();
}

/**
 * Change-request assistant (audit 4.2): drafts the plain-English impact
 * statement into the editable quote_note field and stashes clarifying
 * questions on the issue's ai record. A DRAFT only — nothing reaches the
 * client until staff review it and click "Send quote".
 */
export async function draftImpact(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!id) return;
  const supabase = await createClient();
  const { data: issue } = await supabase
    .from("issues")
    .select("id, title, description, project_id, quoted_price, quote_accepted_at, ai")
    .eq("id", id)
    .maybeSingle();
  if (!issue || issue.quote_accepted_at) return; // accepted quotes are settled
  const { data: proj } = issue.project_id
    ? await supabase
        .from("projects")
        .select("name")
        .eq("id", issue.project_id)
        .maybeSingle()
    : { data: null };
  const draft = await draftImpactStatement({
    title: issue.title,
    description: issue.description,
    projectName: proj?.name ?? "their system",
    quotedPrice: issue.quoted_price ? Number(issue.quoted_price) : null,
  });
  if (draft) {
    await supabase
      .from("issues")
      .update({
        quote_note: draft.impact_statement,
        ai: {
          ...((issue.ai ?? {}) as Record<string, unknown>),
          cr_questions: draft.clarifying_questions,
        },
      })
      .eq("id", id);
    await logAudit({
      action: "ai.impact_statement_drafted",
      target: `issue:${id}`,
      tenantId,
    });
  }
  revalidateIssues();
}

/**
 * Put an out-of-scope quote in front of the client: price + the plain-English
 * impact statement, visible on /portal/requests with Accept / Decline. Saves
 * the triage row first (the button sits inside the triage form), then flips
 * the issue to awaiting_client. Any previous decision is cleared — re-sending
 * a revised quote restarts the approval.
 */
export async function sendQuote(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!id) return;
  const supabase = await createClient();
  const price = Number(String(formData.get("quoted_price") || "").trim());
  const note = String(formData.get("quote_note") || "").trim();
  if (!(price > 0) || !note) return; // a quote is a price AND its explanation
  await supabase
    .from("issues")
    .update({
      billing: "out_of_scope",
      quoted_price: price,
      quote_note: note,
      quote_accepted_at: null,
      quote_declined_at: null,
      status: "awaiting_client",
      client_visible: true,
    })
    .eq("id", id);
  await logAudit({
    action: "issue.quote_sent",
    target: `issue:${id}`,
    tenantId,
    metadata: { quoted_price: price },
  });
  revalidateIssues();
  revalidatePath("/portal/requests");
}

export async function closeIssue(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("issues")
    .update({ status: "closed", resolved_at: new Date().toISOString() })
    .eq("id", id);
  await logAudit({ action: "issue.closed", target: `issue:${id}`, tenantId });
  revalidateIssues();
}
