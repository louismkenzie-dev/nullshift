"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { requireStaff } from "@nullshift/auth/guards";
import {
  PLAYBOOKS,
  instantiate,
  toggleItem,
  type ChecklistItem,
  type PlaybookKind,
} from "@/lib/playbooks";

/**
 * Server actions for the delivery layer (migration 0028): milestones, risks,
 * decisions, and playbook checklists. Kept out of the (already huge) client
 * hub page. Every action is staff-guarded and audit-logged; writes go through
 * the caller's RLS-scoped client (staff-all policies are the backstop).
 */

const hub = (tenantId: string) => `/admin/clients/${tenantId}`;

function fields(formData: FormData, names: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const n of names) out[n] = String(formData.get(n) || "").trim();
  return out;
}

// ── Milestones ─────────────────────────────────────────────────

export async function addMilestone(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const f = fields(formData, [
    "tenant_id",
    "project_id",
    "title",
    "target_date",
    "owner",
    "acceptance_criteria",
  ]);
  if (!f.project_id || !f.title) return;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("milestones")
    .insert({
      tenant_id: f.tenant_id,
      project_id: f.project_id,
      title: f.title,
      target_date: f.target_date || null,
      owner: f.owner || null,
      acceptance_criteria: f.acceptance_criteria || null,
    })
    .select("id")
    .single();
  if (!error && data)
    await logAudit({
      action: "milestone.created",
      target: `milestone:${data.id}`,
      tenantId: f.tenant_id,
      metadata: { title: f.title, target_date: f.target_date || null },
    });
  revalidatePath(hub(f.tenant_id));
}

export async function setMilestoneHealth(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const f = fields(formData, ["tenant_id", "id", "health"]);
  if (!f.id || !["on_track", "watch", "at_risk", "done"].includes(f.health)) return;
  const supabase = await createClient();
  await supabase
    .from("milestones")
    .update({
      health: f.health,
      done_at: f.health === "done" ? new Date().toISOString() : null,
    })
    .eq("id", f.id);
  await logAudit({
    action: `milestone.${f.health}`,
    target: `milestone:${f.id}`,
    tenantId: f.tenant_id,
  });
  revalidatePath(hub(f.tenant_id));
}

// ── Risks ──────────────────────────────────────────────────────

export async function addRisk(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const f = fields(formData, [
    "tenant_id",
    "project_id",
    "title",
    "impact",
    "owner",
    "mitigation",
    "review_date",
  ]);
  if (!f.project_id || !f.title) return;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("risks")
    .insert({
      tenant_id: f.tenant_id,
      project_id: f.project_id,
      title: f.title,
      impact: f.impact || null,
      owner: f.owner || null,
      mitigation: f.mitigation || null,
      review_date: f.review_date || null,
    })
    .select("id")
    .single();
  if (!error && data)
    await logAudit({
      action: "risk.raised",
      target: `risk:${data.id}`,
      tenantId: f.tenant_id,
      metadata: { title: f.title },
    });
  revalidatePath(hub(f.tenant_id));
}

export async function resolveRisk(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const f = fields(formData, ["tenant_id", "id", "status", "resolution"]);
  if (!f.id || !["mitigated", "closed"].includes(f.status)) return;
  const supabase = await createClient();
  await supabase
    .from("risks")
    .update({
      status: f.status,
      resolution: f.resolution || null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", f.id);
  await logAudit({
    action: `risk.${f.status}`,
    target: `risk:${f.id}`,
    tenantId: f.tenant_id,
    metadata: f.resolution ? { resolution: f.resolution } : undefined,
  });
  revalidatePath(hub(f.tenant_id));
}

// ── Decisions ──────────────────────────────────────────────────

export async function addDecision(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const f = fields(formData, [
    "tenant_id",
    "project_id",
    "decision",
    "rationale",
    "approver",
    "source",
    "impact",
  ]);
  if (!f.project_id || !f.decision) return;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("decisions")
    .insert({
      tenant_id: f.tenant_id,
      project_id: f.project_id,
      decision: f.decision,
      rationale: f.rationale || null,
      approver: f.approver || null,
      source: f.source || null,
      impact: f.impact || null,
    })
    .select("id")
    .single();
  if (!error && data)
    await logAudit({
      action: "decision.recorded",
      target: `decision:${data.id}`,
      tenantId: f.tenant_id,
      metadata: { decision: f.decision.slice(0, 200) },
    });
  revalidatePath(hub(f.tenant_id));
}

// ── Playbook checklists ────────────────────────────────────────

export async function seedChecklist(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const f = fields(formData, ["tenant_id", "project_id", "kind"]);
  const kind = f.kind as PlaybookKind;
  if (!f.project_id || !PLAYBOOKS[kind]) return;
  const supabase = await createClient();
  // Idempotent: the unique (project_id, kind) index means a double-click or a
  // re-offer can't create a second copy — the insert just fails quietly.
  const { error } = await supabase.from("checklists").insert({
    tenant_id: f.tenant_id,
    project_id: f.project_id,
    kind,
    title: PLAYBOOKS[kind].title,
    items: instantiate(kind),
  });
  if (!error)
    await logAudit({
      action: "checklist.seeded",
      target: `project:${f.project_id}`,
      tenantId: f.tenant_id,
      metadata: { kind },
    });
  revalidatePath(hub(f.tenant_id));
}

export async function toggleChecklistItem(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const f = fields(formData, ["tenant_id", "id", "name"]);
  if (!f.id || !f.name) return;
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("checklists")
    .select("id, items")
    .eq("id", f.id)
    .maybeSingle();
  if (!row) return;
  await supabase
    .from("checklists")
    .update({ items: toggleItem((row.items ?? []) as ChecklistItem[], f.name) })
    .eq("id", f.id);
  revalidatePath(hub(f.tenant_id));
}
