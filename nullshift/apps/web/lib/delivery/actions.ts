"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { flagOn } from "@/lib/flags";
import { isClientPreview } from "@/lib/clientPreview";
import {
  isUuid,
  planRecordAcceptance,
  validateAcceptanceInput,
  type AcceptanceInput,
  type AcceptanceOutcome,
} from "./acceptance";
import {
  clientTransition,
  generateInitialChecklist,
  generateLaterChecklist,
} from "./checklists";
import { governingAcceptance } from "./acceptance";
import { isTaskState } from "./types";
import { loadProjectFacts } from "./load";
import type {
  AcceptanceEvidence,
  BuildAcceptance,
  ChecklistTask,
  DeliverableEvidence,
  Journey,
  OutstandingDefect,
  TaskEvidence,
} from "./types";

/**
 * Delivery server actions (brief §5.5, §8.2, §8.6).
 *
 * Every write: flag `acceptanceGate` → not a preview session → identity
 * (staff via requireStaff(), or the client's own tenant-admin membership) →
 * validate → tenant check → write through the caller's OWN client so the
 * database policies in migration 0060 are the authority → audit_log row.
 * With the flag off every function returns `{ ok: false, reason: "flag_off" }`
 * and touches nothing.
 *
 * None of these functions selects a package, marks an invoice paid, records a
 * signature or starts a Direct Debit. They cannot: nothing here imports the
 * billing, pricing or provider modules.
 */

export type DeliveryFailure =
  | "flag_off"
  | "preview"
  | "unauthenticated"
  | "forbidden"
  | "invalid"
  | "not_found"
  | "wrong_tenant"
  | "already_accepted"
  | "db_error";

export type AcceptanceResult =
  | { ok: true; outcome: AcceptanceOutcome; id: string; message: string }
  | { ok: false; reason: DeliveryFailure; message: string };

const PORTAL_PATHS = [
  "/portal",
  "/portal/checklist",
  "/portal/acceptance",
  "/portal/plan",
];
const revalidatePortal = () => PORTAL_PATHS.forEach((p) => revalidatePath(p));

async function baseGate(): Promise<
  { ok: true } | { ok: false; reason: DeliveryFailure; message: string }
> {
  if (!flagOn("acceptanceGate"))
    return {
      ok: false,
      reason: "flag_off",
      message: "Flag acceptanceGate is off — nothing was recorded.",
    };
  if (await isClientPreview())
    return {
      ok: false,
      reason: "preview",
      message: "Client preview sessions are read-only; nothing was recorded.",
    };
  return { ok: true };
}

/** The signed-in client's tenant-admin membership for this tenant (never staff-wide RLS). */
async function clientSignatory(
  tenantId: string
): Promise<
  | { ok: true; userId: string; email: string | null }
  | { ok: false; reason: DeliveryFailure; message: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { ok: false, reason: "unauthenticated", message: "Sign in to continue." };
  const service = createServiceClient();
  const { data: m } = await service
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .eq("role", "client_admin")
    .limit(1)
    .maybeSingle();
  if (!m)
    return {
      ok: false,
      reason: "forbidden",
      message: "Only your organisation's signatory can accept the build.",
    };
  return { ok: true, userId: user.id, email: user.email ?? null };
}

/**
 * Record a build acceptance — by the client signatory through the portal, or
 * by staff recording an acceptance given elsewhere (with a reason). Partial
 * and disputed acceptances are recorded as such; a second clean acceptance of
 * the same scope version is refused.
 */
export async function recordBuildAcceptance(
  input: Partial<AcceptanceInput>
): Promise<AcceptanceResult> {
  const g = await baseGate();
  if (!g.ok) return g;

  let actorId: string;
  let recordedBy: string | null = null;
  if (input.acceptedRole === "staff") {
    const staff = await requireStaff();
    if (!staff.ok)
      return {
        ok: false,
        reason: staff.reason,
        message: staff.reason === "unauthenticated" ? "Sign in as staff." : "Staff only.",
      };
    actorId = staff.userId;
    recordedBy = staff.userId;
  } else {
    if (!isUuid(input.tenantId))
      return { ok: false, reason: "invalid", message: "Tenant id is not valid." };
    const c = await clientSignatory(input.tenantId);
    if (!c.ok) return c;
    actorId = c.userId;
    input = {
      ...input,
      acceptedRole: "client_signatory",
      method: "portal",
      acceptedByUser: c.userId,
    };
  }

  const v = validateAcceptanceInput(input);
  if (!v.ok) return { ok: false, reason: "invalid", message: v.message };
  const value = v.value;

  // Tenant check through the caller's own client: the project must be visible
  // to them AND belong to the tenant they named.
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, tenant_id")
    .eq("id", value.projectId)
    .maybeSingle();
  if (!project) return { ok: false, reason: "not_found", message: "Project not found." };
  if (project.tenant_id !== value.tenantId)
    return {
      ok: false,
      reason: "wrong_tenant",
      message: "That project does not belong to this organisation.",
    };

  const { data: existingRaw, error: exErr } = await supabase
    .from("build_acceptances")
    .select("scope_version_ref, partial, disputed")
    .eq("project_id", value.projectId);
  if (exErr) return { ok: false, reason: "db_error", message: exErr.message };
  const plan = planRecordAcceptance(
    (existingRaw ?? []) as AcceptanceEvidence[],
    value,
    new Date().toISOString(),
    recordedBy
  );
  if (!plan.ok) return { ok: false, reason: plan.reason, message: plan.message };

  const { data: inserted, error } = await supabase
    .from("build_acceptances")
    .insert(plan.row as never)
    .select("id")
    .single();
  if (error || !inserted)
    return { ok: false, reason: "db_error", message: error?.message ?? "Insert failed." };

  await logAudit({
    action: `build.${plan.outcome}`,
    target: `project:${value.projectId}`,
    tenantId: value.tenantId,
    metadata: {
      acceptanceId: inserted.id,
      scopeVersionRef: value.scopeVersionRef,
      role: value.acceptedRole,
      method: value.method,
      partial: plan.row.partial,
      disputed: plan.row.disputed,
      defects: plan.row.defects_outstanding.length,
      deliverables: plan.row.evidence.length,
      actor: actorId,
      // Explicitly what this did NOT do (brief §8.2, §17.1 row 2).
      packageSelected: false,
      paymentMarked: false,
      signatureRecorded: false,
    },
  });
  revalidatePortal();
  const message =
    plan.outcome === "accepted"
      ? "Build accepted. This did not choose a package, mark a payment or sign anything."
      : plan.outcome === "accepted_with_exceptions"
        ? "Build accepted with the listed exceptions. They stay open until resolved."
        : "Your dispute is recorded. Nullshift will respond with the next step.";
  return { ok: true, outcome: plan.outcome, id: inserted.id as string, message };
}

/* ── Portal form wrapper ───────────────────────────────── */

const str = (fd: FormData, k: string, max = 2000) =>
  String(fd.get(k) ?? "")
    .trim()
    .slice(0, max);

/** Parse the portal acceptance form (pure; exported for tests). */
export async function parseAcceptanceForm(
  fd: FormData
): Promise<Partial<AcceptanceInput>> {
  const count = Math.min(50, Math.max(0, Number(fd.get("d_count") || 0)));
  const deliverables: DeliverableEvidence[] = [];
  for (let i = 0; i < count; i++) {
    deliverables.push({
      deliverable: str(fd, `d_${i}_label`, 300),
      criteria: str(fd, `d_${i}_criteria`, 1000),
      met: str(fd, `d_${i}_met`) !== "no",
      evidence: str(fd, `d_${i}_evidence`, 1000),
      client_comment: str(fd, `d_${i}_comment`, 1000),
    });
  }
  const defects: OutstandingDefect[] = str(fd, "defects", 4000)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((summary, i) => ({ ref: `D${i + 1}`, summary, owner: "nullshift" as const }));
  return {
    tenantId: str(fd, "tenant_id", 40),
    projectId: str(fd, "project_id", 40),
    scopeVersionRef: str(fd, "scope_version_ref", 200),
    acceptedByName: str(fd, "accepted_by_name", 200),
    acceptedRole: "client_signatory",
    method: "portal",
    acceptedByUser: null,
    deliverables,
    defects,
    disputed: fd.get("disputed") === "on",
    notes: str(fd, "notes") || null,
  };
}

/** `<form action>` entry for /portal/acceptance. Redirects with the result. */
export async function recordBuildAcceptanceForm(formData: FormData): Promise<void> {
  if (await isClientPreview()) redirect("/portal/acceptance?result=preview");
  if (formData.get("authorised") !== "on")
    redirect("/portal/acceptance?result=invalid&why=authorised");
  const input = await parseAcceptanceForm(formData);
  const r = await recordBuildAcceptance(input);
  if (!r.ok)
    redirect(
      `/portal/acceptance?result=${r.reason}&why=${encodeURIComponent(r.message)}`
    );
  redirect(`/portal/acceptance?result=${r.outcome}`);
}

/* ── Client task updates ───────────────────────────────── */

export type TaskUpdateResult =
  | { ok: true; task: ChecklistTask }
  | { ok: false; reason: DeliveryFailure; message: string };

/**
 * A client moves their OWN task (state and evidence only) through the
 * SECURITY DEFINER function in migration 0060, which re-checks membership and
 * refuses waivers. The pre-check here only gives a better message.
 */
export async function updateChecklistTaskFromPortal(input: {
  taskId: string;
  state: string;
  note?: string | null;
}): Promise<TaskUpdateResult> {
  const g = await baseGate();
  if (!g.ok) return g;
  if (!isUuid(input.taskId))
    return { ok: false, reason: "invalid", message: "Task id is not valid." };
  if (!isTaskState(input.state))
    return { ok: false, reason: "invalid", message: "State is not valid." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { ok: false, reason: "unauthenticated", message: "Sign in to continue." };

  const { data: current } = await supabase
    .from("checklist_tasks")
    .select("*")
    .eq("id", input.taskId)
    .maybeSingle();
  if (!current)
    return {
      ok: false,
      reason: "not_found",
      message: "That item is not on your checklist.",
    };
  const task = current as ChecklistTask;
  const tr = clientTransition(task, input.state);
  if (!tr.ok) return { ok: false, reason: "forbidden", message: tr.reason };

  const note = (input.note ?? "").trim().slice(0, 1000);
  const evidence: TaskEvidence[] = note
    ? [{ kind: "note", note, at: new Date().toISOString(), by: user.id }]
    : [];
  const { data: updated, error } = await supabase.rpc("portal_update_checklist_task", {
    task_id: input.taskId,
    new_state: tr.state,
    new_evidence: evidence,
  });
  if (error) return { ok: false, reason: "db_error", message: error.message };
  const row = updated as ChecklistTask;

  await logAudit({
    action: "checklist_task.client_updated",
    target: `checklist_task:${input.taskId}`,
    tenantId: row.tenant_id ?? task.tenant_id ?? null,
    metadata: {
      key: row.key,
      journey: row.journey,
      from: task.state,
      to: row.state,
      evidenceAdded: evidence.length,
      actor: user.id,
    },
  });
  revalidatePortal();
  return { ok: true, task: row };
}

/** `<form action>` entry for a checklist item. */
export async function updateChecklistTaskForm(formData: FormData): Promise<void> {
  if (await isClientPreview()) redirect("/portal/checklist?result=preview");
  const r = await updateChecklistTaskFromPortal({
    taskId: str(formData, "task_id", 40),
    state: str(formData, "state", 40),
    note: str(formData, "note", 1000),
  });
  if (!r.ok)
    redirect(`/portal/checklist?result=${r.reason}&why=${encodeURIComponent(r.message)}`);
  redirect(`/portal/checklist?result=updated&key=${encodeURIComponent(r.task.key)}`);
}

/* ── Staff: publish a checklist ────────────────────────── */

export type PublishResult =
  | { ok: true; inserted: number; skipped: number; message: string }
  | { ok: false; reason: DeliveryFailure; message: string };

/**
 * Staff publish the generated checklist for a project as persisted tasks.
 * `insert … on conflict do nothing`: re-publishing never overwrites a task's
 * state, evidence or waiver, and never duplicates a key.
 */
export async function publishChecklist(input: {
  tenantId: string;
  projectId: string;
  journey: Journey;
}): Promise<PublishResult> {
  const g = await baseGate();
  if (!g.ok) return g;
  const staff = await requireStaff();
  if (!staff.ok)
    return {
      ok: false,
      reason: staff.reason,
      message: staff.reason === "unauthenticated" ? "Sign in as staff." : "Staff only.",
    };
  if (!isUuid(input.tenantId) || !isUuid(input.projectId))
    return { ok: false, reason: "invalid", message: "Ids are not valid." };
  if (input.journey !== "initial" && input.journey !== "later")
    return { ok: false, reason: "invalid", message: "Journey is not valid." };

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, tenant_id")
    .eq("id", input.projectId)
    .maybeSingle();
  if (!project) return { ok: false, reason: "not_found", message: "Project not found." };
  if (project.tenant_id !== input.tenantId)
    return {
      ok: false,
      reason: "wrong_tenant",
      message: "That project does not belong to this client.",
    };

  // Staff-wide RLS would blend tenants in loadProjectFacts, so scope every read
  // to this tenant through a filtered facade before generating.
  const scoped = tenantScoped(supabase, input.tenantId);
  const facts = await loadProjectFacts(scoped, { projectId: input.projectId });
  let tasks: ChecklistTask[] = [];
  if (input.journey === "initial" && facts.initialFacts)
    tasks = generateInitialChecklist(facts.initialFacts);
  if (input.journey === "later" && facts.laterFacts) {
    const { data: acc } = await supabase
      .from("build_acceptances")
      .select("scope_version_ref, partial, disputed, accepted_at")
      .eq("project_id", input.projectId);
    const list = (acc ?? []) as (AcceptanceEvidence & { accepted_at: string })[];
    const gov = governingAcceptance(list, facts.scope?.ref ?? null);
    tasks = generateLaterChecklist({
      ...facts.laterFacts,
      buildAccepted: !!gov && !gov.partial,
      buildAcceptedPartial: !!gov?.partial,
      buildDisputed:
        !gov && list.some((a) => a.scope_version_ref === facts.scope?.ref && a.disputed),
    });
  }
  if (tasks.length === 0)
    return {
      ok: false,
      reason: "not_found",
      message: "Nothing to publish for this project yet.",
    };

  const { data: existing } = await supabase
    .from("checklist_tasks")
    .select("key")
    .eq("project_id", input.projectId)
    .eq("journey", input.journey);
  const have = new Set(((existing ?? []) as { key: string }[]).map((r) => r.key));
  const rows = tasks
    .filter((t) => !have.has(t.key))
    .map((t) => ({ ...t, tenant_id: input.tenantId, project_id: input.projectId }));
  if (rows.length > 0) {
    const { error } = await supabase.from("checklist_tasks").insert(rows as never);
    if (error) return { ok: false, reason: "db_error", message: error.message };
  }
  await logAudit({
    action: "checklist.published",
    target: `project:${input.projectId}`,
    tenantId: input.tenantId,
    metadata: {
      journey: input.journey,
      inserted: rows.length,
      skipped: have.size,
      actor: staff.userId,
    },
  });
  revalidatePortal();
  return {
    ok: true,
    inserted: rows.length,
    skipped: have.size,
    message: `${rows.length} task(s) published, ${have.size} already present and left unchanged.`,
  };
}

/** Read-only, tenant-filtered facade over a staff client for the facts loader. */
function tenantScoped(db: Awaited<ReturnType<typeof createClient>>, tenantId: string) {
  const col: Record<string, string> = { tenants: "id" };
  return {
    from(table: string) {
      return {
        select: (...args: unknown[]) =>
          (
            db.from(table).select as unknown as (
              ...a: unknown[]
            ) => ReturnType<ReturnType<typeof db.from>["select"]>
          )(...args).eq(col[table] ?? "tenant_id", tenantId),
      };
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>;
}

/** Re-exported for the workspace: the list of a project's acceptances (staff or member RLS). */
export async function listBuildAcceptances(
  projectId: string
): Promise<BuildAcceptance[]> {
  if (!flagOn("acceptanceGate") || !isUuid(projectId)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("build_acceptances")
    .select("*")
    .eq("project_id", projectId)
    .order("accepted_at", { ascending: false });
  return (data ?? []) as BuildAcceptance[];
}
