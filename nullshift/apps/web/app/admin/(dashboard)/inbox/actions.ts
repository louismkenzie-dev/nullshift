"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { parseIngest } from "@/lib/ops/ingest";
import { OPEN_STATUSES } from "@/lib/ops/issues";
import { PASTE_SOURCES } from "@/lib/ops/issueForm";

/**
 * Ingest inbox actions — paste a source against a project and confirm / keep
 * private / discard the drafts Claude splits it into. Shared by the global
 * inbox and every client's Issues and Bugs tile (project fixed there). The
 * page that hosts the paste form must export maxDuration = 120: parsing a
 * long transcript can exceed the default serverless limit.
 */

function revalidateInbox() {
  revalidatePath("/admin/inbox");
  revalidatePath("/admin/issues");
  revalidatePath("/admin/clients/[id]", "layout");
}

export async function ingestSource(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const projectId = String(formData.get("project_id") || "");
  const sourceRaw = String(formData.get("source") || "whatsapp");
  const source = (PASTE_SOURCES as string[]).includes(sourceRaw) ? sourceRaw : "whatsapp";
  const text = String(formData.get("text") || "").trim();
  if (!projectId || !text) return;

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, tenant_id, name")
    .eq("id", projectId)
    .single();
  if (!project) return;
  const [{ data: tenant }, { data: openRows }] = await Promise.all([
    supabase.from("tenants").select("id, name").eq("id", project.tenant_id).single(),
    supabase
      .from("issues")
      .select("title")
      .eq("project_id", projectId)
      .in("status", OPEN_STATUSES),
  ]);

  const drafts = await parseIngest({
    text,
    systemName: project.name,
    clientName: tenant?.name ?? "the client",
    existingOpenTitles: ((openRows ?? []) as { title: string }[]).map((r) => r.title),
  });

  const now = new Date().toISOString();
  let count = 0;
  if (!drafts) {
    // No API key or the call failed — file the raw paste as one issue so
    // nothing is lost, and triage it by hand in the Issue bank.
    const title =
      text.split(/\s+/).slice(0, 8).join(" ").slice(0, 140) || "Pasted source";
    await supabase.from("issues").insert({
      tenant_id: project.tenant_id,
      project_id: project.id,
      source,
      kind: "task",
      title,
      description: text,
      status: "new",
      client_visible: false,
      ai: { from: "ingest" },
    });
    count = 1;
  } else if (drafts.length > 0) {
    await supabase.from("issues").insert(
      drafts.map((d) => ({
        tenant_id: project.tenant_id,
        project_id: project.id,
        source,
        kind: d.kind,
        severity: d.severity,
        title: d.title,
        description: d.description,
        source_quote: d.source_quote,
        client_visible: false,
        status: "new",
        promised_at: d.is_promise ? now : null,
        promised_note: d.promised_note,
        ai: { from: "ingest" },
      }))
    );
    count = drafts.length;
  }

  await logAudit({
    action: "inbox.ingested",
    target: `project:${projectId}`,
    tenantId: project.tenant_id,
    metadata: { source, count, parsed: drafts !== null },
  });
  revalidateInbox();
}

/**
 * The inbox actions receive an issue id from a form post, so each re-verifies
 * the row really is an unreviewed ingest draft before acting — the page query
 * filters to drafts, but a crafted post must not be able to mutate (or,
 * worse, hard-delete) an arbitrary issue via these actions.
 */
async function isIngestDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<boolean> {
  const { data } = await supabase
    .from("issues")
    .select("id")
    .eq("id", id)
    .eq("client_visible", false)
    .eq("status", "new")
    .contains("ai", { from: "ingest" })
    .maybeSingle();
  return !!data;
}

export async function confirmIssue(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!id) return;
  const supabase = await createClient();
  if (!(await isIngestDraft(supabase, id))) return;
  await supabase.from("issues").update({ client_visible: true }).eq("id", id);
  await logAudit({ action: "issue.confirmed", target: `issue:${id}`, tenantId });
  revalidateInbox();
}

export async function confirmPrivate(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!id) return;
  const supabase = await createClient();
  if (!(await isIngestDraft(supabase, id))) return;
  await supabase.from("issues").update({ status: "triaged" }).eq("id", id);
  await logAudit({ action: "issue.confirmed_private", target: `issue:${id}`, tenantId });
  revalidateInbox();
}

export async function discardIssue(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!id) return;
  const supabase = await createClient();
  if (!(await isIngestDraft(supabase, id))) return;
  await supabase.from("issues").delete().eq("id", id);
  await logAudit({ action: "issue.discarded", target: `issue:${id}`, tenantId });
  revalidateInbox();
}
