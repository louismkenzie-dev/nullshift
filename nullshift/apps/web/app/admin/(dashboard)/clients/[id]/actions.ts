"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { findUserByEmail } from "@nullshift/auth/confirmation-email";
import { escapeLike } from "@nullshift/db/leads";
import { markInvoicePaidOutOfBand } from "@/lib/markInvoicePaid";
import { wrap, button, esc, C, FONT } from "@/lib/emailLayout";
import { draftClientUpdate, draftDiscoveryBrief } from "@/lib/ops/assistants";
import { canEnterBuild } from "@/lib/stageGates";
import { recordDocumentEvent } from "@/lib/documentEvents";
import { logAudit } from "@nullshift/db/audit";
import { uploadDeliverable } from "@nullshift/db/documents";
import { CARE_PLAN_MRR, carePlan } from "@/lib/carePlans";
import { startDirectDebitForTenant } from "@/lib/directDebit";
import { generateProjectInvoice } from "@/lib/projectInvoice";
import { sendCareSubscriptionSignup } from "@/lib/careSubscription";
import { ensurePortalAccess, issuePortalLink, portalReplyTo } from "@/lib/portalAccess";
import { getStripe, voidStripeInvoice } from "@nullshift/billing/stripe";
import { cancelGoCardlessSubscription } from "@nullshift/billing/gocardless";
import { syncInvoiceToXero } from "@/lib/xeroSync";
import { runAutoScore } from "@/lib/scoring/autoScore";
import { sendEmail } from "@/lib/sendEmail";
import {
  portalInviteEmail,
  documentsReadyEmail,
  portalAccessEmail,
  passwordResetEmail,
} from "@/lib/clientEmails";
import { assertSendable } from "@/lib/legalReview";
import { dpaReadyToSend } from "@/lib/dpa";
import { STAGES, CR_NEXT } from "./_shared";

/**
 * Server actions for the per-client tile pages (/admin/clients/[id]/*). Moved
 * verbatim from the old single-page client hub: same names, same behaviour,
 * same audit entries. Each action refreshes the block page and every tile
 * page beneath it, so a write on one tile is visible on the next.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://nullshift.co.uk").replace(
  /\/$/,
  ""
);

function revalidateClient(tenantId: string) {
  revalidatePath(`/admin/clients/${tenantId}`);
  revalidatePath("/admin/clients/[id]", "layout");
}

const TASK_NEXT: Record<string, string> = {
  backlog: "scoped",
  scoped: "approved",
  approved: "in_progress",
  in_progress: "review",
  review: "shipped",
};

// ── server actions ─────────────────────────────────────────────
export async function ensureProject(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") || "");
  const name = String(formData.get("name") || "Build").trim() || "Build";
  if (!tenantId) return;
  const supabase = await createClient();
  await supabase
    .from("projects")
    .insert({ tenant_id: tenantId, name, stage: "discovery" });
  await logAudit({ action: "project.created", target: `tenant:${tenantId}`, tenantId });
  revalidateClient(tenantId);
}

/**
 * The signed scope is a legal record: once a proposal is accepted its
 * project_items are the contract baseline (the "signed" PDF re-renders from
 * these rows), so module edits are refused after acceptance. Changes from that
 * point go through change requests, not silent baseline edits.
 */
async function scopeIsLocked(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("projects")
    .select("proposal_status")
    .eq("id", projectId)
    .maybeSingle();
  return data?.proposal_status === "accepted";
}

/**
 * Review gate (migration 0049): any change to a DRAFT proposal makes the
 * editor its author and voids an earlier approval — a second staff member
 * must approve what actually goes out, not an earlier version of it.
 */
async function touchProposalDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  userId: string
) {
  await supabase
    .from("projects")
    .update({
      proposal_drafted_by: userId,
      proposal_reviewed_by: null,
      proposal_reviewed_at: null,
    })
    .eq("id", projectId)
    .eq("proposal_status", "draft");
}

export async function addItem(formData: FormData) {
  const staff = await requireStaff();
  if (!staff.ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  const name = String(formData.get("name") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  if (!projectId || !name) return;
  const supabase = await createClient();
  if (await scopeIsLocked(supabase, projectId)) return;
  await supabase
    .from("project_items")
    .insert({ project_id: projectId, tenant_id: tenantId, name, amount });
  await touchProposalDraft(supabase, projectId, staff.userId);
  await logAudit({
    action: "proposal.item_added",
    target: `project:${projectId}`,
    tenantId,
    metadata: { name, amount },
  });
  revalidateClient(tenantId);
}

export async function removeItem(formData: FormData) {
  const staff = await requireStaff();
  if (!staff.ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("project_items")
    .select("id, project_id, name, amount")
    .eq("id", id)
    .maybeSingle();
  if (!item) return;
  if (await scopeIsLocked(supabase, item.project_id)) return;
  await supabase.from("project_items").delete().eq("id", id);
  await touchProposalDraft(supabase, item.project_id, staff.userId);
  await logAudit({
    action: "proposal.item_removed",
    target: `project:${item.project_id}`,
    tenantId,
    metadata: { name: item.name, amount: item.amount },
  });
  revalidateClient(tenantId);
}

/**
 * Save the proposal document + DPA detail fields. When the proposal is still a
 * draft AND everything required is complete (modules, care plan, overview,
 * payment terms, DPA processing details), also mark it sent + email the client
 * that their documents are ready to review and sign in the portal. Editing the
 * fields again after sending just saves (it won't re-send).
 *
 * Review gate (migration 0049): the form posts `intent` = "save" | "send".
 * Editing a draft stamps proposal_drafted_by and voids any approval; a send
 * is refused (redirect ?blocked=review) unless a staff member other than the
 * author has approved the draft as it stands.
 */
export async function saveDocsAndSend(formData: FormData) {
  const staff = await requireStaff();
  if (!staff.ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  if (!projectId) return;
  const str = (k: string) => String(formData.get(k) || "").trim() || null;
  const intent = String(formData.get("intent") || "send");
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("projects")
    .select(
      "name, proposal_status, overview, payment_terms, proposal_drafted_by, proposal_reviewed_by, proposal_reviewed_at"
    )
    .eq("id", projectId)
    .maybeSingle();
  if (!before) return;
  const isDraft = before.proposal_status === "draft";
  const changed =
    (before.overview ?? null) !== str("overview") ||
    (before.payment_terms ?? null) !== str("payment_terms");

  // Save only the proposal doc. ALL DPA fields — company identity, data types,
  // special category — are owned by the client (their portal declaration); we
  // never write them here, or a stale admin page could clobber what they entered.
  await supabase
    .from("projects")
    .update({
      overview: str("overview"),
      payment_terms: str("payment_terms"),
      // Authorship follows the last real edit of the draft; an unchanged save
      // by the reviewer must not make them the author.
      ...(isDraft && (changed || !before.proposal_drafted_by)
        ? { proposal_drafted_by: staff.userId }
        : {}),
      ...(isDraft && changed
        ? { proposal_reviewed_by: null, proposal_reviewed_at: null }
        : {}),
    })
    .eq("id", projectId);

  if (intent !== "send" || !isDraft) {
    revalidateClient(tenantId);
    return;
  }

  // Re-check completeness from the saved row (don't trust the client), then send
  // only out of a draft — and only once the client has submitted their DPA.
  const [{ data: project }, { data: items }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "proposal_status, proposed_plan, overview, payment_terms, client_entity_type, dpa_client_company_name, dpa_client_company_number, dpa_client_registered_address, dpa_personal_data, dpa_special_category, dpa_special_category_detail, dpa_client_submitted_at, proposal_drafted_by, proposal_reviewed_by, proposal_reviewed_at"
      )
      .eq("id", projectId)
      .maybeSingle(),
    supabase.from("project_items").select("id").eq("project_id", projectId).limit(1),
  ]);
  // The care plan is OPTIONAL — a proposal can be sent with or without one.
  const complete =
    !!project &&
    (items?.length ?? 0) > 0 &&
    !!project.overview &&
    !!project.payment_terms &&
    dpaReadyToSend(project);

  if (project?.proposal_status === "draft" && complete) {
    // Second-person review: refuses (and redirects back) unless approved by
    // someone other than the author.
    await assertSendable({
      kind: "proposal",
      id: projectId,
      tenantId,
      reference: before.name ?? "Proposal",
      review: {
        author: project.proposal_drafted_by,
        reviewedBy: project.proposal_reviewed_by,
        reviewedAt: project.proposal_reviewed_at,
      },
    });
    await supabase
      .from("projects")
      .update({ proposal_status: "sent", proposal_sent_at: new Date().toISOString() })
      .eq("id", projectId);
    await logAudit({ action: "proposal.sent", target: `project:${projectId}`, tenantId });

    // Email the client their documents are ready to sign (best-effort).
    const service = createServiceClient();
    // Read receipts: the proposal and its DPA are sent together.
    for (const documentType of ["proposal", "dpa"] as const)
      await recordDocumentEvent(service, {
        tenantId,
        documentType,
        documentId: projectId,
        event: "sent",
        actor: staff.userId,
        actorKind: "staff",
      });
    const { data: tenant } = await service
      .from("tenants")
      .select("contact_name, contact_email")
      .eq("id", tenantId)
      .maybeSingle();
    let to = tenant?.contact_email ?? null;
    const { data: membership } = await service
      .from("memberships")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("role", "client_admin")
      .limit(1)
      .maybeSingle();
    if (membership?.user_id) {
      const { data: u } = await service.auth.admin.getUserById(membership.user_id);
      to = u.user?.email ?? to;
    }
    if (to) {
      const mail = documentsReadyEmail({
        name: tenant?.contact_name ?? "there",
        portalUrl: `${SITE_URL}/portal`,
      });
      await sendEmail({
        purpose: "service_relationship",
        to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
    }
  }
  revalidateClient(tenantId);
}

export async function setLiveUrl(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  const url = String(formData.get("live_url") || "").trim();
  if (!projectId) return;
  const supabase = await createClient();
  await supabase
    .from("projects")
    .update({ live_url: url || null })
    .eq("id", projectId);
  revalidateClient(tenantId);
}

/** Post a progress update the client sees in their project hub. */
export async function postUpdate(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim() || null;
  if (!projectId || !title) return;
  const supabase = await createClient();
  await supabase.from("project_updates").insert({
    tenant_id: tenantId,
    project_id: projectId,
    type: "update",
    title,
    body,
  });
  await logAudit({
    action: "project_update.posted",
    target: `project:${projectId}`,
    tenantId,
  });
  // Tell the client — an update they never hear about isn't an update. The
  // email carries the summary; the portal has the full feed. Best-effort.
  try {
    const service = createServiceClient();
    const { data: membership } = await service
      .from("memberships")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("role", "client_admin")
      .limit(1)
      .maybeSingle();
    let email: string | null = null;
    if (membership?.user_id) {
      const { data: u } = await service.auth.admin.getUserById(membership.user_id);
      email = u.user?.email ?? null;
    }
    if (email) {
      const portalUrl = `${SITE_URL}/portal/updates`;
      await sendEmail({
        purpose: "service_relationship",
        to: email,
        subject: `Project update: ${title}`,
        html: wrap(
          `<tr><td style="padding:26px 32px"><h1 style="margin:0 0 10px;font-family:${FONT};font-size:20px;font-weight:700;color:${C.fg}">${esc(title)}</h1>${body ? `<p style="margin:0 0 16px;font-family:${FONT};font-size:14px;line-height:1.6;color:${C.muted}">${esc(body)}</p>` : ""}<div>${button(portalUrl, "See it in your portal")}</div></td></tr>`,
          title
        ),
        text: `${title}\n\n${body ?? ""}\n\n${portalUrl}`,
      });
    }
  } catch (e) {
    console.error("update notification email failed (non-fatal):", e);
  }
  revalidateClient(tenantId);
}

/**
 * Client-update drafter (audit 4.2): assembles what actually happened —
 * shipped work, the queue, blocked-on-client, milestones — and asks the
 * assistant for prose. The draft lands back in the editable form via query
 * params; NOTHING is posted or emailed until the human clicks Post update.
 */
export async function draftUpdateWithAi(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  if (!tenantId || !projectId) return;
  const supabase = await createClient();
  const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const [{ data: t }, { data: proj }, { data: shipped }, { data: open }, { data: ms }] =
    await Promise.all([
      supabase.from("tenants").select("name").eq("id", tenantId).maybeSingle(),
      supabase.from("projects").select("name, stage").eq("id", projectId).maybeSingle(),
      supabase
        .from("issues")
        .select("title")
        .eq("project_id", projectId)
        .eq("client_visible", true)
        .in("status", ["fixed", "shipped"])
        .gte("resolved_at", twoWeeksAgo),
      supabase
        .from("issues")
        .select("title, status")
        .eq("project_id", projectId)
        .eq("client_visible", true)
        .in("status", ["queued", "batched", "in_progress", "awaiting_client"]),
      supabase
        .from("milestones")
        .select("title, target_date")
        .eq("project_id", projectId)
        .neq("health", "done"),
    ]);
  const openList = (open ?? []) as { title: string; status: string }[];
  const draft = await draftClientUpdate({
    clientName: t?.name ?? "the client",
    projectName: proj?.name ?? "the project",
    stage: proj?.stage ?? "build",
    shipped: ((shipped ?? []) as { title: string }[]).map((s) => s.title),
    upNext: openList.filter((i) => i.status !== "awaiting_client").map((i) => i.title),
    waitingOnClient: openList
      .filter((i) => i.status === "awaiting_client")
      .map((i) => i.title),
    milestones: (ms ?? []) as { title: string; target_date: string | null }[],
  });
  if (!draft) {
    redirect(`/admin/clients/${tenantId}/account`); // no-op refresh
  }
  const q = new URLSearchParams({
    draft_title: draft.title.slice(0, 200),
    draft_body: draft.body.slice(0, 1800),
  });
  redirect(`/admin/clients/${tenantId}/account?${q.toString()}`);
}

/**
 * Discovery analyst (audit 4.2): drafts the internal discovery brief from the
 * funnel answers, agent research, and call notes — saved as an internal
 * project note, clearly labelled as an AI draft. Never client-visible.
 */
export async function draftDiscoveryBriefAction(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  if (!tenantId || !projectId) return;
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("tenants")
    .select("name, contact_email")
    .eq("id", tenantId)
    .maybeSingle();
  const [{ data: leadRows }, { data: notes }] = await Promise.all([
    t?.contact_email
      ? supabase
          .from("leads")
          .select("quiz_answers, agent_enrichment")
          .ilike("email", escapeLike(t.contact_email))
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
    supabase
      .from("project_notes")
      .select("body")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const facts: [string, string][] = [];
  let agentSummary: string | null = null;
  let painPoints: string[] = [];
  for (const lr of (leadRows ?? []) as {
    quiz_answers: unknown;
    agent_enrichment: unknown;
  }[]) {
    const qa = (lr.quiz_answers ?? {}) as { answers?: Record<string, unknown> };
    if (qa.answers)
      for (const [k, v] of Object.entries(qa.answers))
        if (typeof v === "string" && v.trim()) facts.push([k, v]);
    const enr = lr.agent_enrichment as Record<string, unknown> | null;
    if (enr && !agentSummary && typeof enr.summary === "string")
      agentSummary = enr.summary;
    if (enr && Array.isArray(enr.painPoints))
      painPoints = (enr.painPoints as unknown[]).filter(
        (p): p is string => typeof p === "string"
      );
  }
  const brief = await draftDiscoveryBrief({
    clientName: t?.name ?? "the client",
    facts,
    agentSummary,
    painPoints,
    callNotes: ((notes ?? []) as { body: string }[])
      .map((n) => n.body)
      .filter((b) => !b.startsWith("AI DRAFT")),
  });
  if (brief) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("project_notes").insert({
      tenant_id: tenantId,
      project_id: projectId,
      author: user?.id ?? null,
      body: `AI DRAFT — Discovery brief (verify before relying on it)\n\n${brief.brief}`,
    });
    await logAudit({
      action: "ai.discovery_brief_drafted",
      target: `project:${projectId}`,
      tenantId,
    });
  }
  revalidateClient(tenantId);
}

export async function setStage(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  const stage = String(formData.get("stage") || "");
  const overrideReason = String(formData.get("override_reason") || "").trim();
  if (!STAGES.includes(stage)) return;
  const supabase = await createClient();

  // Deposit-before-build gate (lib/stageGates, unit-tested): committed build
  // work needs money to have moved — any paid invoice on the project — or a
  // staff override carrying a recorded reason (audit-logged below).
  if (stage === "build") {
    const { data: paid } = await supabase
      .from("invoices")
      .select("id")
      .eq("project_id", projectId)
      .eq("status", "paid")
      .limit(1);
    if (!canEnterBuild({ hasPaidInvoice: !!paid?.length, overrideReason })) {
      revalidateClient(tenantId);
      redirect(`/admin/clients/${tenantId}/account?stage_blocked=build`);
    }
  }

  // The DPA-before-live DB trigger blocks stage='live' until a DPA is logged.
  const { error } = await supabase
    .from("projects")
    .update({ stage: stage as never })
    .eq("id", projectId);
  if (error) {
    console.error("setStage:", error.message);
    // The blocked stage must be visible to the admin, not just the server log —
    // otherwise the select silently snaps back with no explanation.
    revalidateClient(tenantId);
    redirect(
      `/admin/clients/${tenantId}/account?stage_blocked=${encodeURIComponent(stage)}`
    );
  }
  await logAudit({
    action: `project.stage.${stage}`,
    target: `project:${projectId}`,
    tenantId,
    ...(overrideReason ? { metadata: { override_reason: overrideReason } } : {}),
  });
  // A built system can score itself: once it is live (or straight into care)
  // read its repo + database and draft the scale assessment, after the
  // response so the stage change never waits on GitHub or Supabase.
  if (stage === "live" || stage === "care") {
    const actorId = (await supabase.auth.getUser()).data.user?.id ?? null;
    after(async () => {
      try {
        await runAutoScore({ tenantId, projectId, trigger: "stage", actorId });
      } catch (e) {
        console.error("auto-score after stage change failed:", e);
      }
    });
  }
  revalidateClient(tenantId);
}

/**
 * Named ownership + the single next action — the brief's rule that a partner
 * should answer "whose is this and what happens next?" from the record, not
 * WhatsApp. One person may hold several roles; the names just have to be
 * written down.
 */
export async function saveOwnership(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  if (!projectId) return;
  const clean = (k: string) => String(formData.get(k) || "").trim() || null;
  const patch = {
    account_owner: clean("account_owner"),
    delivery_owner: clean("delivery_owner"),
    technical_owner: clean("technical_owner"),
    finance_owner: clean("finance_owner"),
    next_action: clean("next_action"),
    next_action_owner: clean("next_action_owner"),
  };
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update(patch).eq("id", projectId);
  if (!error)
    await logAudit({
      action: "project.ownership_updated",
      target: `project:${projectId}`,
      tenantId,
      metadata: patch,
    });
  revalidateClient(tenantId);
}

export async function addNote(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  const body = String(formData.get("body") || "").trim();
  if (!projectId || !body) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("project_notes").insert({
    project_id: projectId,
    tenant_id: tenantId,
    body,
    author: user?.id ?? null,
  });
  revalidateClient(tenantId);
}

export async function advanceCr(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") || "");
  const id = String(formData.get("id") || "");
  const action = String(formData.get("action") || "");
  const supabase = await createClient();
  if (action === "triage") {
    await supabase.from("change_requests").update({ status: "triaged" }).eq("id", id);
    await logAudit({
      action: "change_request.triaged",
      target: `change_request:${id}`,
      tenantId,
    });
  } else if (action === "scope") {
    const hours = Number(formData.get("estimate_hours") || 0);
    const price = Number(formData.get("quoted_price") || 0);
    await supabase
      .from("change_requests")
      .update({ status: "awaiting_approval", estimate_hours: hours, quoted_price: price })
      .eq("id", id);
    await logAudit({
      action: "change_request.scoped",
      target: `change_request:${id}`,
      tenantId,
      metadata: { hours, price },
    });
  } else if (CR_NEXT[action]) {
    await supabase
      .from("change_requests")
      .update({ status: CR_NEXT[action] })
      .eq("id", id);
    await logAudit({
      action: `change_request.${CR_NEXT[action]}`,
      target: `change_request:${id}`,
      tenantId,
    });
  }
  revalidateClient(tenantId);
}

export async function uploadDoc(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  const kind = String(formData.get("kind") || "asset");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  const supabase = await createClient();
  const res = await uploadDeliverable(supabase, {
    tenantId,
    projectId,
    kind,
    fileName: file.name,
    body: await file.arrayBuffer(),
    contentType: file.type || undefined,
  });
  if (res.ok)
    await logAudit({
      action: "document.uploaded",
      target: `project:${projectId}`,
      tenantId,
      metadata: { path: res.path },
    });
  revalidateClient(tenantId);
}

export async function generateInvoice(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  if (!tenantId || !projectId) return;
  // Only invoice an accepted proposal (the button is disabled until then, but
  // re-check server-side since a disabled button isn't a real guard).
  const service = createServiceClient();
  const { data: proj } = await service
    .from("projects")
    .select("proposal_status")
    .eq("id", projectId)
    .maybeSingle();
  if (proj?.proposal_status !== "accepted") return;
  const res = await generateProjectInvoice(service, {
    tenantId,
    projectId,
  });
  if (res.ok)
    await logAudit({
      action: "invoice.generated",
      target: `project:${projectId}`,
      tenantId,
      metadata: { total: res.total },
    });
  revalidateClient(tenantId);
}

/**
 * Raise the build invoice for a project that was agreed OUTSIDE the portal.
 *
 * The normal path drafts this invoice the moment the client signs, and the
 * button above is gated on that signature — money follows the signature. But a
 * project agreed offline (or one delivered before the portal existed) never
 * gets a portal acceptance, so its balance had no way of ever being billed.
 * This is the documented escape hatch: same invoice, same Stripe + email +
 * Xero path, but it records WHY it was raised without a signature.
 */
export async function generateInvoiceOffline(formData: FormData) {
  const staff = await requireStaff();
  if (!staff.ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  const reason = String(formData.get("reason") || "").trim();
  // A reason is the whole point of the override — without one this is just the
  // gate removed, so refuse rather than silently billing.
  if (!tenantId || !projectId || !reason) return;

  const service = createServiceClient();
  const res = await generateProjectInvoice(service, { tenantId, projectId });
  if (res.ok)
    await logAudit({
      action: "invoice.generated_offline_agreement",
      target: `project:${projectId}`,
      tenantId,
      metadata: { total: res.total, reason, staff: staff.email },
    });
  revalidateClient(tenantId);
}

/**
 * Void the current build invoice and regenerate it as a LIVE invoice — used to
 * replace a stale test-mode invoice (whose "Pay now" link points at the Stripe
 * sandbox) now that live keys are in place. Voids in Stripe + locally so the
 * build-invoice dedup lets generateProjectInvoice mint a fresh live one (which
 * re-emails the client a live payment link). Never touches a paid invoice.
 */

export async function regenerateInvoiceLive(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  const invoiceId = String(formData.get("invoice_id") || "");
  if (!tenantId || !projectId || !invoiceId) return;
  const service = createServiceClient();
  const { data: existing } = await service
    .from("invoices")
    .select("stripe_invoice_id, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (existing?.status === "paid") return; // never void a paid invoice
  if (existing?.stripe_invoice_id) await voidStripeInvoice(existing.stripe_invoice_id);
  await service.from("invoices").update({ status: "void" }).eq("id", invoiceId);
  const res = await generateProjectInvoice(service, { tenantId, projectId });
  if (res.ok)
    await logAudit({
      action: "invoice.regenerated_live",
      target: `project:${projectId}`,
      tenantId,
      metadata: { voided: invoiceId, newInvoice: res.invoiceId },
    });
  revalidateClient(tenantId);
}

/**
 * Manual fallback: re-pull each unpaid Stripe invoice's status (so a missed
 * webhook never strands the "invested" total). Stripe invoice statuses map 1:1
 * onto ours (draft|open|paid|void|uncollectible).
 */
export async function syncInvoiceStatus(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  if (!tenantId) return;
  const stripe = getStripe();
  if (!stripe) return;
  const service = createServiceClient();
  const { data: invs } = await service
    .from("invoices")
    .select("id, stripe_invoice_id, status")
    .eq("tenant_id", tenantId)
    .not("stripe_invoice_id", "is", null)
    .neq("status", "paid");
  const valid = ["draft", "open", "paid", "void", "uncollectible"];
  for (const inv of (invs ?? []) as { id: string; stripe_invoice_id: string }[]) {
    try {
      const si = await stripe.invoices.retrieve(inv.stripe_invoice_id);
      if (!si.status || !valid.includes(si.status)) continue;
      const patch: Record<string, unknown> = { status: si.status };
      if (si.status === "paid") {
        const paidAt = si.status_transitions?.paid_at;
        patch.paid_at = paidAt
          ? new Date(paidAt * 1000).toISOString()
          : new Date().toISOString();
      }
      await service.from("invoices").update(patch).eq("id", inv.id);
    } catch (e) {
      console.error("syncInvoiceStatus: retrieve failed", inv.stripe_invoice_id, e);
    }
  }
  revalidateClient(tenantId);
}

/**
 * Record an out-of-band payment (bank transfer): mark the invoice paid here
 * and — when a Stripe invoice exists — mark it paid out-of-band in Stripe too,
 * so the hosted "Pay by card" link stops asking for payment. Never touches an
 * already-paid or voided invoice.
 */
export async function markInvoicePaid(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const invoiceId = String(formData.get("invoice_id") || "");
  if (!tenantId || !invoiceId) return;
  await markInvoicePaidOutOfBand({ tenantId, invoiceId });
  revalidateClient(tenantId);
}

/** Push an invoice into Xero on demand (backfill for pre-Xero invoices). */
export async function pushInvoiceToXero(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const invoiceId = String(formData.get("invoice_id") || "");
  if (!tenantId || !invoiceId) return;
  const service = createServiceClient();
  const res = await syncInvoiceToXero(service, invoiceId);
  if (res.ok)
    await logAudit({
      action: "invoice.xero_synced",
      target: `invoice:${invoiceId}`,
      tenantId,
      metadata: { xeroInvoiceId: res.xeroInvoiceId },
    });
  revalidateClient(tenantId);
}

export async function bookCall(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "") || null;
  const date = String(formData.get("call_date") || "");
  const time = String(formData.get("call_time") || "");
  if (!tenantId || !date || !time) return;
  const supabase = await createClient();
  await supabase.from("calls").insert({
    tenant_id: tenantId,
    project_id: projectId,
    call_date: date,
    call_time: time,
    duration_min: 30,
    status: "confirmed",
  });
  // Confirming the call advances the originating lead to 'call_booked' — this is
  // the ONLY thing that moves them into that column (a call request alone keeps
  // them in 'qualified'). Won/lost leads aren't reopened.
  const { data: t } = await supabase
    .from("tenants")
    .select("contact_email")
    .eq("id", tenantId)
    .maybeSingle();
  if (t?.contact_email) {
    await supabase
      .from("leads")
      .update({ status: "call_booked" })
      .ilike("email", escapeLike(t.contact_email))
      .neq("status", "won")
      .neq("status", "lost");
  }
  await logAudit({ action: "call.booked", target: `tenant:${tenantId}`, tenantId });
  revalidateClient(tenantId);
}

export async function cancelCall(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") || "");
  const id = String(formData.get("id") || "");
  const supabase = await createClient();
  await supabase.from("calls").update({ status: "cancelled" }).eq("id", id);
  revalidateClient(tenantId);
}

export async function saveMeeting(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") || "");
  const id = String(formData.get("id") || "");
  const supabase = await createClient();
  await supabase
    .from("calls")
    .update({
      meeting_link: String(formData.get("meeting_link") || "") || null,
      meeting_id: String(formData.get("meeting_id") || "") || null,
      meeting_password: String(formData.get("meeting_password") || "") || null,
    })
    .eq("id", id);
  revalidateClient(tenantId);
}

export async function recordDpa(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") || "");
  if (!tenantId) return;
  const supabase = await createClient();
  await supabase
    .from("compliance_records")
    .insert({ tenant_id: tenantId, kind: "dpa_signed", detail: { via: "admin" } });
  await logAudit({
    action: "compliance.dpa_signed",
    target: `tenant:${tenantId}`,
    tenantId,
  });
  revalidateClient(tenantId);
}

/**
 * Email the client a Stripe Checkout sign-up for their care plan (they add a card
 * to start the recurring plan). Mirrors the build-invoice send — the webhook
 * flips the local row to active once they complete it.
 */
/**
 * Which plan may staff start billing for? The one the client chose in the
 * portal (terms agreed there). Enterprise — quoted and contracted under its
 * Order Form — may be passed explicitly. Anything else is refused.
 */
async function clientChosenPlan(
  tenantId: string,
  requested: string
): Promise<string | null> {
  if (carePlan(requested)?.quotedOnly) return requested;
  const service = createServiceClient();
  const { data } = await service
    .from("tenants")
    .select("care_plan_choice")
    .eq("id", tenantId)
    .maybeSingle();
  const choice = data?.care_plan_choice ?? null;
  return choice && choice !== "none" && carePlan(choice) ? choice : null;
}

export async function sendSubscriptionSignup(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const plan = await clientChosenPlan(tenantId, String(formData.get("plan") || ""));
  if (!tenantId || !plan || !(plan in CARE_PLAN_MRR)) return;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://nullshift.co.uk").replace(
    /\/$/,
    ""
  );
  const res = await sendCareSubscriptionSignup(createServiceClient(), {
    tenantId,
    planId: plan,
    siteUrl,
  });
  if (res.ok)
    await logAudit({
      action: "subscription.signup_sent",
      target: `tenant:${tenantId}`,
      tenantId,
      metadata: { plan, emailed: res.emailed, alreadyActive: res.alreadyActive ?? false },
    });
  revalidateClient(tenantId);
}

/**
 * Email the client a GoCardless Direct Debit authorisation for a care plan —
 * the admin-initiated path for attaching a plan later (e.g. a client who chose
 * "no care plan" during onboarding). The webhook activates the subscription
 * once the mandate is confirmed.
 */
export async function sendDirectDebitSetup(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const plan = await clientChosenPlan(tenantId, String(formData.get("plan") || ""));
  if (!tenantId || !plan || !carePlan(plan)) return;
  const service = createServiceClient();
  const { data: tenant } = await service
    .from("tenants")
    .select("name, contact_name, contact_email")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant?.contact_email) return;
  // One implementation for every rail entry point (lib/directDebit.ts): the
  // contracted price, the never-double-bill guard, superseding stale links,
  // the pending row and the audit trail all live there.
  const res = await startDirectDebitForTenant(service, {
    tenantId,
    planId: plan,
    via: "admin",
    email: tenant.contact_email,
    name: tenant.name ?? tenant.contact_name ?? null,
    emailLink: true,
  });
  if (!res.ok) console.error("sendDirectDebitSetup:", res.reason, res.detail ?? "");
  revalidateClient(tenantId);
}

export async function cancelSubscription(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const id = String(formData.get("id") || "");
  if (!id) return;
  const service = createServiceClient();
  // Cancel the REAL provider subscription first so billing actually stops, then
  // reflect it locally ('canceled' — the enum is American-spelled; the old
  // 'cancelled' was rejected and silently left the row active).
  const { data: sub } = await service
    .from("subscriptions")
    .select("stripe_subscription_id, gc_subscription_id")
    .eq("id", id)
    .maybeSingle();
  if (sub?.stripe_subscription_id) {
    const stripe = getStripe();
    if (stripe) {
      try {
        await stripe.subscriptions.cancel(sub.stripe_subscription_id);
      } catch (e) {
        console.error("stripe subscription cancel failed:", e);
      }
    }
  }
  if (sub?.gc_subscription_id) {
    // A Direct Debit keeps charging until GoCardless itself is cancelled — if
    // that fails, leave the row alone so the UI can't show a client as
    // cancelled while their bank is still being debited.
    try {
      await cancelGoCardlessSubscription(sub.gc_subscription_id);
    } catch (e) {
      console.error("gocardless subscription cancel failed:", e);
      revalidateClient(tenantId);
      return;
    }
  }
  const { error } = await service
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("id", id);
  if (error) console.error("cancelSubscription:", error.message);
  revalidateClient(tenantId);
}

/**
 * Give the client portal access: an auth user + a client_admin membership.
 * Credential handling depends on the account's state, so we never clobber a
 * password the client chose themselves (rule lives in lib/portalAccess.ts):
 *   • no account yet → invite link; they choose their own password.
 *   • account exists but never signed in → a fresh single-use link.
 *   • account exists AND the client has already signed in → membership only
 *     and a "sign in with your existing password" note — we NEVER reset it.
 */
export async function createPortalAccount(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") || "").trim() || "there";
  if (!tenantId || !email) return;
  const service = createServiceClient();
  const loginUrl = `${SITE_URL}/portal/login`;

  // One rule, one place: lib/portalAccess.ts decides whether this is a brand-new
  // invite, a fresh link for an account that was never used, or membership only
  // for a client who already has a working password. The link carries the
  // hashed token to /portal/reset, where it is verified server-side.
  const access = await ensurePortalAccess(service, { tenantId, email });
  if (!access.ok) {
    console.error("createPortalAccount:", access.error);
    return;
  }
  const inviteUrl = access.link;
  await logAudit({
    action: "portal.account_created",
    target: `tenant:${tenantId}`,
    tenantId,
    // `invited` replaces the old `credentials` flag. No password is ever
    // generated, emailed, or recorded here.
    metadata: { email, invited: !!inviteUrl, kind: access.kind },
  });

  const mail = inviteUrl
    ? portalInviteEmail({ name, inviteUrl })
    : portalAccessEmail({ name, loginUrl });
  const sent = await sendEmail({
    purpose: "transactional",
    to: email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    replyTo: portalReplyTo(),
  });
  if (!sent) console.error("createPortalAccount: portal email did not send for", email);

  revalidateClient(tenantId);
}

/**
 * Send the client a Nullshift-branded password-reset link. Used for clients who
 * have already signed in (so we can't re-issue a login) and forgotten their
 * password. We mint a Supabase recovery link and email it ourselves so the mail
 * stays on-brand; the link lands on /portal/reset where they set a new password.
 */
export async function sendPasswordReset(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") || "").trim() || "there";
  if (!tenantId || !email) return;
  const service = createServiceClient();

  const issued = await issuePortalLink(service, { email, type: "recovery" });
  if (!issued.url) {
    console.error("sendPasswordReset: link failed:", issued.error);
    return;
  }
  const mail = passwordResetEmail({ name, resetUrl: issued.url });
  const sent = await sendEmail({
    purpose: "transactional",
    to: email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    replyTo: portalReplyTo(),
  });
  if (!sent) console.error("sendPasswordReset: reset email did not send for", email);
  await logAudit({
    action: "portal.password_reset_sent",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: { email },
  });
  revalidateClient(tenantId);
}

/**
 * Permanently delete a client and ALL their data (GDPR right-to-erasure). Gated by
 * the admin re-typing the client's email. Hard-deletes the tenant (cascades every
 * project/proposal/invoice/document/update/task/membership) and removes the
 * client's portal login(s) that no longer belong to any tenant.
 */
export async function deleteClient(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const typed = String(formData.get("confirm_email") || "")
    .trim()
    .toLowerCase();
  if (!tenantId) return;
  const service = createServiceClient();

  // Resolve the client's email(s): the contact email + each member's login.
  const { data: tenant } = await service
    .from("tenants")
    .select("contact_email")
    .eq("id", tenantId)
    .maybeSingle();
  const { data: members } = await service
    .from("memberships")
    .select("user_id")
    .eq("tenant_id", tenantId);
  const userIds = (members ?? []).map((m) => m.user_id).filter(Boolean) as string[];

  const emails = new Set<string>();
  if (tenant?.contact_email) emails.add(tenant.contact_email.trim().toLowerCase());
  for (const uid of userIds) {
    const { data: u } = await service.auth.admin.getUserById(uid);
    if (u.user?.email) emails.add(u.user.email.trim().toLowerCase());
  }
  // If the client has any email on record, require the typed confirmation to
  // match it exactly (case-insensitive). A client with NO email — e.g. one
  // converted from an emailless funnel lead — can't be email-confirmed, so the
  // plain Delete button in the danger zone is allowed through without it.
  if (emails.size > 0 && (!typed || !emails.has(typed))) {
    console.error("deleteClient: email confirmation did not match");
    return;
  }

  // Audit BEFORE the rows (and their audit entries) cascade away.
  await logAudit({
    action: "client.deleted",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: { email: typed },
  });

  // Hard-delete the tenant — cascades to all its data + memberships.
  await service.from("tenants").delete().eq("id", tenantId);

  // Also clear the originating funnel lead(s) + enquiry(ies) for this client's
  // email(s). Converting a lead to a client doesn't consume the lead, so without
  // this the deleted client keeps showing on the pipeline / in the enquiries
  // inbox — and leaving them behind would be an incomplete erasure.
  for (const em of emails) {
    await service.from("leads").delete().ilike("email", escapeLike(em));
    await service.from("enquiries").delete().ilike("email", escapeLike(em));
  }

  // Remove the client's auth login(s). Resolve them BOTH ways: by membership
  // (userIds) AND by matching the client's email(s) to any auth account that was
  // never linked as a member — e.g. one created when they booked a call, before
  // an admin issued a portal login. Without the email pass, such an account is
  // orphaned on delete and blocks re-registering with that email.
  const authIds = new Set<string>(userIds);
  for (const email of emails) {
    const found = await findUserByEmail(service, email);
    if (found) authIds.add(found.id);
  }
  // Delete each only if it no longer belongs to any tenant (don't nuke internal
  // staff or another client who still has a membership).
  for (const uid of authIds) {
    const { count } = await service
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid);
    if (!count) {
      try {
        await service.auth.admin.deleteUser(uid);
      } catch (e) {
        console.error("deleteClient: deleteUser failed:", e);
      }
    }
  }

  redirect("/admin/clients");
}

/**
 * Raise a Change Order against the live Order Form — from the agreement page
 * or straight off a "Needs Change Order" issue row on the Issues and Bugs
 * tile (issue_id links the two). Drafted, then approved by a second staff
 * member and sent to the client from /agreement.
 */
export async function createChangeOrder(formData: FormData) {
  const staff = await requireStaff();
  if (!staff.ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const orderFormId = String(formData.get("order_form_id") || "");
  const description = String(formData.get("description") || "").trim();
  if (!tenantId || !orderFormId || !description) return;

  const db = createServiceClient();
  const { data: ref } = await db.rpc("next_change_order_ref");
  const { data: created } = await db
    .from("change_orders")
    .insert({
      tenant_id: tenantId,
      order_form_id: orderFormId,
      issue_id: String(formData.get("issue_id") || "") || null,
      reference: ref ?? `CO-${Date.now()}`,
      description,
      business_outcome: String(formData.get("business_outcome") || "").trim(),
      created_by: staff.userId,
    })
    .select("id, reference")
    .single();

  if (created)
    await logAudit({
      action: "change_order.drafted",
      target: `change_order:${created.id}`,
      tenantId,
      metadata: { reference: created.reference },
    });
  revalidatePath(`/admin/clients/${tenantId}/agreement`);
  revalidatePath("/admin/issues");
  revalidateClient(tenantId);
}

/**
 * Delivery tasks (moved from /admin/tasks): create a task on this client's
 * project, then advance it through backlog → scoped → approved → in progress
 * → review → shipped. Refreshes the global board too.
 */
export async function createTask(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const projectId = String(formData.get("project_id") || "");
  const title = String(formData.get("title") || "").trim();
  const estimate = Number(formData.get("estimate_hours") || 0) || null;
  if (!projectId || !title) return;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("tenant_id")
    .eq("id", projectId)
    .single();
  if (!project) return;
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      tenant_id: project.tenant_id,
      project_id: projectId,
      title,
      estimate_hours: estimate,
      origin: "internal",
      status: "backlog",
    })
    .select("id")
    .single();
  if (!error && data) {
    await logAudit({
      action: "task.created",
      target: `task:${data.id}`,
      tenantId: project.tenant_id,
    });
  }
  revalidatePath("/admin/tasks");
  revalidateClient(project.tenant_id);
}

export async function advanceTask(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  const from = String(formData.get("from") || "");
  const next = TASK_NEXT[from];
  if (!next) return;
  const supabase = await createClient();
  await supabase.from("tasks").update({ status: next }).eq("id", id);
  await logAudit({
    action: `task.${next}`,
    target: `task:${id}`,
    tenantId,
    metadata: { from },
  });
  revalidatePath("/admin/tasks");
  revalidateClient(tenantId);
}
