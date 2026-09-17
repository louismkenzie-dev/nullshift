"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { flagOn } from "@/lib/flags";
import { isClientPreview } from "@/lib/clientPreview";
import {
  isUuid,
  planCompleteNextAction,
  planSetNextAction,
  validateNextActionInput,
  type NextActionInput,
  type NextActionRow,
} from "./model";

/**
 * Client next actions — server actions (brief §5.4).
 *
 * Every write: requireStaff() → flag `workIntake` → not a preview session →
 * validate → tenant check → write through the caller's RLS client (staff-only
 * policy, migration 0058) → audit_log row. With the flag off every function
 * returns `{ ok: false, reason: "flag_off" }` and touches nothing.
 */

export type NextActionFailure =
  | "flag_off"
  | "unauthenticated"
  | "forbidden"
  | "preview"
  | "invalid"
  | "not_found"
  | "not_open"
  | "wrong_tenant"
  | "db_error";

export type NextActionResult =
  | {
      ok: true;
      kind: "set" | "superseded" | "unchanged" | "completed";
      row: NextActionRow;
      message: string;
    }
  | { ok: false; reason: NextActionFailure; message: string };

export type NextActionList =
  | { ok: true; open: NextActionRow | null; history: NextActionRow[] }
  | { ok: false; reason: NextActionFailure; message: string; open: null; history: [] };

const TABLE = "client_next_actions";

async function gate(): Promise<
  { ok: true; userId: string } | { ok: false; reason: NextActionFailure; message: string }
> {
  const staff = await requireStaff();
  if (!staff.ok) {
    return {
      ok: false,
      reason: staff.reason,
      message: staff.reason === "unauthenticated" ? "Sign in as staff." : "Staff only.",
    };
  }
  if (!flagOn("workIntake")) {
    return {
      ok: false,
      reason: "flag_off",
      message:
        "Flag workIntake is off — next actions are not persisted; nothing was written.",
    };
  }
  if (await isClientPreview()) {
    return {
      ok: false,
      reason: "preview",
      message: "Client preview sessions are read-only; nothing was written.",
    };
  }
  return { ok: true, userId: staff.userId };
}

function revalidate() {
  revalidatePath("/admin/next/delivery/intake");
  revalidatePath("/admin/next/clients/[id]", "page");
}

/** Set the client's next action, superseding the open one. Never duplicates. */
export async function setNextAction(input: NextActionInput): Promise<NextActionResult> {
  const g = await gate();
  if (!g.ok) return g;
  const v = validateNextActionInput(input);
  if (!v.ok) return { ok: false, reason: "invalid", message: v.message };
  const value = v.value;

  const supabase = await createClient();

  // Tenant check: the tenant must exist and be visible to this staff user.
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("id", value.tenantId)
    .maybeSingle();
  if (!tenant) return { ok: false, reason: "not_found", message: "Client not found." };

  if (value.projectId) {
    const { data: project } = await supabase
      .from("projects")
      .select("id, tenant_id")
      .eq("id", value.projectId)
      .maybeSingle();
    if (!project || project.tenant_id !== value.tenantId) {
      return {
        ok: false,
        reason: "wrong_tenant",
        message: "That project does not belong to this client.",
      };
    }
  }

  const { data: openRaw, error: openErr } = await supabase
    .from(TABLE)
    .select("*")
    .eq("tenant_id", value.tenantId)
    .eq("state", "open")
    .maybeSingle();
  if (openErr) return { ok: false, reason: "db_error", message: openErr.message };
  const open = (openRaw as NextActionRow | null) ?? null;

  const plan = planSetNextAction(open, value);
  if (plan.kind === "noop") {
    return {
      ok: true,
      kind: "unchanged",
      row: plan.keep,
      message: "The open next action already says this; nothing was duplicated.",
    };
  }

  if (plan.kind === "supersede") {
    // Guarded update: only an open row may be superseded, so two concurrent
    // writers cannot both "win" — the second finds no open row and the insert
    // then hits the partial unique index.
    const { data: sup, error: supErr } = await supabase
      .from(TABLE)
      .update({ state: "superseded" })
      .eq("id", plan.supersede.id)
      .eq("state", "open")
      .select("id");
    if (supErr) return { ok: false, reason: "db_error", message: supErr.message };
    if (!sup || sup.length !== 1) {
      return {
        ok: false,
        reason: "db_error",
        message: "The open next action changed underneath you; reload and try again.",
      };
    }
  }

  const { data: inserted, error: insErr } = await supabase
    .from(TABLE)
    .insert({
      tenant_id: value.tenantId,
      project_id: value.projectId,
      text: value.text,
      owner: value.owner,
      owner_user: value.ownerUser,
      due_at: value.dueAt,
      state: "open",
      source: value.source,
      created_by: g.userId,
    })
    .select("*")
    .single();
  if (insErr || !inserted) {
    return {
      ok: false,
      reason: "db_error",
      message: insErr?.message ?? "Insert failed.",
    };
  }
  const row = inserted as NextActionRow;

  if (plan.kind === "supersede") {
    await supabase
      .from(TABLE)
      .update({ superseded_by_id: row.id })
      .eq("id", plan.supersede.id);
  }

  await logAudit({
    action: plan.kind === "supersede" ? "next_action.superseded" : "next_action.set",
    target: `client_next_action:${row.id}`,
    tenantId: value.tenantId,
    metadata: {
      text: value.text,
      owner: value.owner,
      due_at: value.dueAt,
      project_id: value.projectId,
      source: value.source,
      superseded_id: plan.kind === "supersede" ? plan.supersede.id : null,
    },
  });
  revalidate();
  return {
    ok: true,
    kind: plan.kind === "supersede" ? "superseded" : "set",
    row,
    message:
      plan.kind === "supersede"
        ? "Next action replaced; the previous one is kept as superseded."
        : "Next action set.",
  };
}

/** Mark the open next action done. */
export async function completeNextAction(args: {
  id: string;
  tenantId: string;
}): Promise<NextActionResult> {
  const g = await gate();
  if (!g.ok) return g;
  if (!isUuid(args.id) || !isUuid(args.tenantId)) {
    return {
      ok: false,
      reason: "invalid",
      message: "A valid action id and client are required.",
    };
  }
  const supabase = await createClient();
  const { data: raw, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", args.id)
    .maybeSingle();
  if (error) return { ok: false, reason: "db_error", message: error.message };
  const plan = planCompleteNextAction(
    (raw as NextActionRow | null) ?? null,
    args.tenantId
  );
  if (!plan.ok) {
    const message =
      plan.reason === "not_found"
        ? "Next action not found."
        : plan.reason === "wrong_tenant"
          ? "That next action belongs to a different client."
          : "Only an open next action can be completed.";
    return { ok: false, reason: plan.reason, message };
  }
  const now = new Date().toISOString();
  const { data: updated, error: updErr } = await supabase
    .from(TABLE)
    .update({ state: "done", completed_at: now })
    .eq("id", plan.row.id)
    .eq("state", "open")
    .select("*")
    .maybeSingle();
  if (updErr) return { ok: false, reason: "db_error", message: updErr.message };
  if (!updated) {
    return {
      ok: false,
      reason: "not_open",
      message: "The next action was already closed.",
    };
  }
  await logAudit({
    action: "next_action.completed",
    target: `client_next_action:${plan.row.id}`,
    tenantId: args.tenantId,
    metadata: { text: plan.row.text, owner: plan.row.owner, completed_at: now },
  });
  revalidate();
  return {
    ok: true,
    kind: "completed",
    row: updated as NextActionRow,
    message: "Next action completed.",
  };
}

/** The open next action and recent history for a client. Read-only; still flag-gated. */
export async function listNextActions(args: {
  tenantId: string;
  limit?: number;
}): Promise<NextActionList> {
  const staff = await requireStaff();
  if (!staff.ok) {
    return {
      ok: false,
      reason: staff.reason,
      message: "Staff only.",
      open: null,
      history: [],
    };
  }
  if (!flagOn("workIntake")) {
    return {
      ok: false,
      reason: "flag_off",
      message: "Flag workIntake is off — next actions are not read from the database.",
      open: null,
      history: [],
    };
  }
  if (!isUuid(args.tenantId)) {
    return {
      ok: false,
      reason: "invalid",
      message: "Invalid client id.",
      open: null,
      history: [],
    };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("tenant_id", args.tenantId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(args.limit ?? 20, 1), 100));
  if (error) {
    return {
      ok: false,
      reason: "db_error",
      message: error.message,
      open: null,
      history: [],
    };
  }
  const rows = (data ?? []) as NextActionRow[];
  return {
    ok: true,
    open: rows.find((r) => r.state === "open") ?? null,
    history: rows.filter((r) => r.state !== "open"),
  };
}

/* ── useActionState-compatible wrappers for the intake forms ──────────── */

export async function setNextActionForm(
  _prev: NextActionResult | null,
  formData: FormData
): Promise<NextActionResult> {
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : "";
  };
  return setNextAction({
    tenantId: str("tenant_id"),
    projectId: str("project_id") || null,
    text: str("text"),
    owner: str("owner"),
    dueAt: str("due_at") || null,
    source: "manual",
  });
}

export async function completeNextActionForm(
  _prev: NextActionResult | null,
  formData: FormData
): Promise<NextActionResult> {
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : "";
  };
  return completeNextAction({ id: str("id"), tenantId: str("tenant_id") });
}
