"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { flagOn } from "@/lib/flags";
import { isClientPreview } from "@/lib/clientPreview";
import { isUuid } from "@/lib/nextActions/model";
import {
  COVERAGE_WORDING,
  WORK_CLASS_META,
  parseCoverageDecision,
  parseWorkClass,
  type CoverageDecision,
  type WorkClassId,
} from "./classify";

/**
 * §7 work intake — server actions.
 *
 * recordClassification writes ONLY the four additive 0058 columns on `issues`
 * (work_class, coverage_decision, coverage_evidence, split_from_issue_id is
 * left alone). It never touches `billing`, `classification`, `status`,
 * `quoted_price` or the 0030 Change Order gate, so legacy tickets and the
 * existing queue keep working unchanged. splitRequest raises linked child
 * issues for a mixed request.
 *
 * Gate on every write: requireStaff() → flag `workIntake` → not a preview
 * session → validate → tenant check → RLS client write → audit_log row.
 */

export type WorkActionFailure =
  | "flag_off"
  | "unauthenticated"
  | "forbidden"
  | "preview"
  | "invalid"
  | "not_found"
  | "wrong_tenant"
  | "db_error";

export type WorkActionResult =
  | {
      ok: true;
      kind: "classified" | "split";
      issueId: string;
      childIds?: string[];
      message: string;
    }
  | { ok: false; reason: WorkActionFailure; message: string };

async function gate(): Promise<
  { ok: true; userId: string } | { ok: false; reason: WorkActionFailure; message: string }
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
        "Flag workIntake is off — classification is not persisted; nothing was written.",
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
  revalidatePath("/admin/next/delivery");
}

type IssueHead = {
  id: string;
  tenant_id: string;
  project_id: string | null;
  title: string;
  client_visible: boolean;
};

async function loadIssue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  issueId: string,
  tenantId: string
): Promise<
  | { ok: true; issue: IssueHead }
  | { ok: false; reason: WorkActionFailure; message: string }
> {
  const { data, error } = await supabase
    .from("issues")
    .select("id, tenant_id, project_id, title, client_visible")
    .eq("id", issueId)
    .maybeSingle();
  if (error) return { ok: false, reason: "db_error", message: error.message };
  if (!data) return { ok: false, reason: "not_found", message: "Issue not found." };
  const issue = data as IssueHead;
  if (issue.tenant_id !== tenantId) {
    return {
      ok: false,
      reason: "wrong_tenant",
      message: "That issue belongs to a different client.",
    };
  }
  return { ok: true, issue };
}

export type RecordClassificationInput = {
  issueId: string;
  tenantId: string;
  workClass: WorkClassId | null;
  coverageDecision: CoverageDecision;
  /** Evidence the decision rests on; stored as jsonb, shown in the audit row. */
  evidence: {
    governing?: string | null;
    reasons?: string[];
    clientLabel?: string | null;
    facts?: Record<string, boolean | undefined>;
    entitlements?: Record<string, boolean | string | null | undefined>;
    note?: string | null;
  };
};

/** Record the §7 class and coverage decision on an issue (additive columns only). */
export async function recordClassification(
  input: RecordClassificationInput
): Promise<WorkActionResult> {
  const g = await gate();
  if (!g.ok) return g;
  if (!isUuid(input.issueId) || !isUuid(input.tenantId)) {
    return {
      ok: false,
      reason: "invalid",
      message: "A valid issue id and client are required.",
    };
  }
  if (input.workClass !== null && !parseWorkClass(input.workClass)) {
    return { ok: false, reason: "invalid", message: "Unknown work class." };
  }
  if (!parseCoverageDecision(input.coverageDecision)) {
    return { ok: false, reason: "invalid", message: "Unknown coverage decision." };
  }
  const supabase = await createClient();
  const loaded = await loadIssue(supabase, input.issueId, input.tenantId);
  if (!loaded.ok) return loaded;

  const evidence = {
    ...input.evidence,
    wording: COVERAGE_WORDING[input.coverageDecision],
    decided_by: g.userId,
    decided_at: new Date().toISOString(),
    policy: "brief §7 — classification does not itself create an entitlement",
  };

  const { error } = await supabase
    .from("issues")
    .update({
      work_class: input.workClass,
      coverage_decision: input.coverageDecision,
      coverage_evidence: evidence,
    })
    .eq("id", loaded.issue.id)
    .eq("tenant_id", input.tenantId);
  if (error) return { ok: false, reason: "db_error", message: error.message };

  await logAudit({
    action: "issue.work_classified",
    target: `issue:${loaded.issue.id}`,
    tenantId: input.tenantId,
    metadata: {
      work_class: input.workClass,
      coverage_decision: input.coverageDecision,
      wording: COVERAGE_WORDING[input.coverageDecision],
      governing: input.evidence.governing ?? null,
      reasons: input.evidence.reasons ?? [],
    },
  });
  revalidate();
  return {
    ok: true,
    kind: "classified",
    issueId: loaded.issue.id,
    message: `Recorded ${input.workClass ? WORK_CLASS_META[input.workClass].label : "no class"} · ${COVERAGE_WORDING[input.coverageDecision]}`,
  };
}

export type SplitRequestInput = {
  issueId: string;
  tenantId: string;
  parts: {
    title: string;
    workClass: WorkClassId;
    coverageDecision: CoverageDecision;
    reason?: string;
  }[];
};

const KIND_FOR: Record<WorkClassId, "bug" | "change" | "question" | "task"> = {
  defect: "bug",
  support: "question",
  maintenance: "task",
  change_feature: "change",
  content_training: "task",
  data_integration_expansion: "task",
  transaction: "question",
};

/** Split a mixed request into linked child issues (§7). The parent is left as is. */
export async function splitRequest(input: SplitRequestInput): Promise<WorkActionResult> {
  const g = await gate();
  if (!g.ok) return g;
  if (!isUuid(input.issueId) || !isUuid(input.tenantId)) {
    return {
      ok: false,
      reason: "invalid",
      message: "A valid issue id and client are required.",
    };
  }
  const parts = (input.parts ?? [])
    .map((p) => ({
      title: (p.title ?? "").trim().replace(/\s+/g, " "),
      workClass: parseWorkClass(p.workClass),
      coverageDecision: parseCoverageDecision(p.coverageDecision),
      reason: (p.reason ?? "").trim() || null,
    }))
    .filter((p) => p.title);
  if (parts.length < 2) {
    return {
      ok: false,
      reason: "invalid",
      message: "A split needs at least two titled parts.",
    };
  }
  if (parts.some((p) => !p.workClass || !p.coverageDecision)) {
    return {
      ok: false,
      reason: "invalid",
      message: "Each part needs a class and a coverage decision.",
    };
  }
  const supabase = await createClient();
  const loaded = await loadIssue(supabase, input.issueId, input.tenantId);
  if (!loaded.ok) return loaded;
  const parent = loaded.issue;

  const rows = parts.map((p) => ({
    tenant_id: parent.tenant_id,
    project_id: parent.project_id,
    source: "internal",
    kind: KIND_FOR[p.workClass as WorkClassId],
    severity: "normal",
    status: "new",
    title: p.title,
    description: `Split from "${parent.title}" (issue ${parent.id}).${p.reason ? ` ${p.reason}` : ""}`,
    client_visible: parent.client_visible,
    split_from_issue_id: parent.id,
    work_class: p.workClass,
    coverage_decision: p.coverageDecision,
    coverage_evidence: {
      split_from: parent.id,
      reason: p.reason,
      wording: COVERAGE_WORDING[p.coverageDecision as CoverageDecision],
      decided_by: g.userId,
      decided_at: new Date().toISOString(),
    },
  }));

  const { data, error } = await supabase.from("issues").insert(rows).select("id");
  if (error) return { ok: false, reason: "db_error", message: error.message };
  const childIds = ((data ?? []) as { id: string }[]).map((r) => r.id);

  await logAudit({
    action: "issue.split",
    target: `issue:${parent.id}`,
    tenantId: input.tenantId,
    metadata: {
      children: childIds,
      parts: parts.map((p) => ({
        title: p.title,
        work_class: p.workClass,
        coverage_decision: p.coverageDecision,
      })),
    },
  });
  revalidate();
  return {
    ok: true,
    kind: "split",
    issueId: parent.id,
    childIds,
    message: `Raised ${childIds.length} linked items from "${parent.title}".`,
  };
}

/* ── useActionState-compatible wrappers ───────────────────────────────── */

function str(formData: FormData, k: string): string {
  const v = formData.get(k);
  return typeof v === "string" ? v : "";
}

export async function recordClassificationForm(
  _prev: WorkActionResult | null,
  formData: FormData
): Promise<WorkActionResult> {
  const workClass = parseWorkClass(str(formData, "work_class"));
  const coverage = parseCoverageDecision(str(formData, "coverage_decision"));
  if (!coverage) {
    return { ok: false, reason: "invalid", message: "Choose a coverage decision." };
  }
  let reasons: string[] = [];
  try {
    const parsed: unknown = JSON.parse(str(formData, "reasons") || "[]");
    if (Array.isArray(parsed))
      reasons = parsed.filter((r): r is string => typeof r === "string");
  } catch {
    reasons = [];
  }
  return recordClassification({
    issueId: str(formData, "issue_id"),
    tenantId: str(formData, "tenant_id"),
    workClass,
    coverageDecision: coverage,
    evidence: {
      governing: str(formData, "governing") || null,
      clientLabel: str(formData, "client_label") || null,
      reasons,
      note: str(formData, "note") || null,
    },
  });
}

export async function splitRequestForm(
  _prev: WorkActionResult | null,
  formData: FormData
): Promise<WorkActionResult> {
  const part = (n: number) => ({
    title: str(formData, `part${n}_title`),
    workClass:
      parseWorkClass(str(formData, `part${n}_class`)) ?? ("defect" as WorkClassId),
    coverageDecision:
      parseCoverageDecision(str(formData, `part${n}_coverage`)) ??
      ("needs_review" as CoverageDecision),
    reason: str(formData, `part${n}_reason`),
  });
  return splitRequest({
    issueId: str(formData, "issue_id"),
    tenantId: str(formData, "tenant_id"),
    parts: [part(1), part(2)],
  });
}
