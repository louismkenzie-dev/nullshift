import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireSoc2, WRITE_ROLES } from "@/lib/soc2/guard";
import { logSoc2Event } from "@/lib/soc2/events";
import { controlHealth } from "@/lib/soc2/health";
import { nextDueAfter } from "@/lib/soc2/schedule";
import {
  EXCEPTION_STATUS_TONE,
  HEALTH_TONE,
  RUN_STATUS_TONE,
  SEVERITY_TONE,
} from "@/lib/soc2/ui";
import {
  OPEN_EXCEPTION_STATUSES,
  TSC_LABEL,
  type ControlFrequency,
  type ControlRow,
  type ControlRunRow,
  type EvidenceRow,
  type ExceptionRow,
} from "@/lib/soc2/types";
import {
  EmptyRow,
  Field,
  HeaderRow,
  actionBtn,
  bodyText,
  dangerBtn,
  faintMono,
  inp,
  monoLabel,
  primaryBtn,
  shortDate,
  textarea,
} from "../../shared";

/**
 * Control detail — one control's full working record: its definition (what it
 * exists to achieve and how it is tested), the runs in which it was performed,
 * the evidence collected for those runs, and any open exceptions against it.
 * This page is where a control is operated: runs are started, completed with a
 * result, skipped with a reason, and independently reviewed — the reviewer
 * must differ from the performer. Marking a control not applicable is a scope
 * claim an auditor will test, so it needs a documented reason and a Programme
 * Owner's approval (DB-enforced).
 */

export const dynamic = "force-dynamic";

type ControlDetail = ControlRow & {
  description: string | null;
  test_procedure: string | null;
  evidence_requirements: string | null;
  automation: "manual" | "automated" | "hybrid";
  na_reason: string | null;
  na_approved_by: string | null;
};

type RunRow = ControlRunRow & {
  period_start: string | null;
  period_end: string | null;
  summary: string | null;
  reviewed_at: string | null;
};

type EvidenceItem = EvidenceRow & { title: string };

const FREQUENCIES: ControlFrequency[] = [
  "continuous",
  "per_change",
  "weekly",
  "monthly",
  "quarterly",
  "semiannual",
  "annual",
  "event",
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const RUN_GRID = "100px 110px 90px 1.2fr 1.2fr 140px";
const EV_GRID = "1.8fr 150px 110px 110px";
const EXC_GRID = "120px 90px 170px 1.6fr";

// ── server actions ─────────────────────────────────────────────

async function updateControl(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const id = String(formData.get("id") || "").trim();
  const frequency = String(formData.get("frequency") || "").trim();
  if (!id || !(FREQUENCIES as string[]).includes(frequency)) return;
  const ownerEmail = String(formData.get("owner_email") || "").trim().toLowerCase() || null;
  if (ownerEmail && !ownerEmail.includes("@")) return;
  const nextDueAt = String(formData.get("next_due_at") || "").trim() || null;
  if (nextDueAt && !DATE_RE.test(nextDueAt)) return;
  const testProcedure = String(formData.get("test_procedure") || "").trim() || null;
  const evidenceRequirements =
    String(formData.get("evidence_requirements") || "").trim() || null;

  const db = createServiceClient();
  const { data: controlData } = await db
    .from("soc2_controls")
    .select("id, key")
    .eq("id", id)
    .maybeSingle();
  const control = controlData as { id: string; key: string } | null;
  if (!control) return;

  const { error } = await db
    .from("soc2_controls")
    .update({
      owner_email: ownerEmail,
      frequency,
      next_due_at: nextDueAt,
      test_procedure: testProcedure,
      evidence_requirements: evidenceRequirements,
    })
    .eq("id", id);
  if (error) redirect(`/admin/soc2/controls/${id}?err=${encodeURIComponent(error.message)}`);

  await logSoc2Event({
    recordType: "control",
    recordId: id,
    type: "updated",
    summary: `Control ${control.key} definition updated (owner, frequency, schedule, procedure or evidence requirements).`,
    detail: { owner_email: ownerEmail, frequency, next_due_at: nextDueAt },
    actor: guard.email,
  });
  revalidatePath(`/admin/soc2/controls/${id}`);
  revalidatePath("/admin/soc2/controls");
}

async function markNotApplicable(formData: FormData) {
  "use server";
  const guard = await requireSoc2("programme_owner");
  if (!guard.ok) return;
  const id = String(formData.get("id") || "").trim();
  const naReason = String(formData.get("na_reason") || "").trim();
  const confirm = String(formData.get("confirm") || "").trim();
  if (!id || !naReason || confirm !== "NA") return;

  const db = createServiceClient();
  const { data: controlData } = await db
    .from("soc2_controls")
    .select("id, key")
    .eq("id", id)
    .maybeSingle();
  const control = controlData as { id: string; key: string } | null;
  if (!control) return;

  const { error } = await db
    .from("soc2_controls")
    .update({
      applicability: "not_applicable",
      na_reason: naReason,
      na_approved_by: guard.email,
    })
    .eq("id", id);
  if (error) redirect(`/admin/soc2/controls/${id}?err=${encodeURIComponent(error.message)}`);

  await logSoc2Event({
    recordType: "control",
    recordId: id,
    type: "applicability.changed",
    summary: `Control ${control.key} marked not applicable; reason recorded, approved by ${guard.email}.`,
    detail: { applicability: "not_applicable" },
    actor: guard.email,
  });
  revalidatePath(`/admin/soc2/controls/${id}`);
  revalidatePath("/admin/soc2/controls");
}

async function reactivateControl(formData: FormData) {
  "use server";
  const guard = await requireSoc2("programme_owner");
  if (!guard.ok) return;
  const id = String(formData.get("id") || "").trim();
  if (!id) return;

  const db = createServiceClient();
  const { data: controlData } = await db
    .from("soc2_controls")
    .select("id, key")
    .eq("id", id)
    .maybeSingle();
  const control = controlData as { id: string; key: string } | null;
  if (!control) return;

  const { error } = await db
    .from("soc2_controls")
    .update({ applicability: "applicable", na_reason: null, na_approved_by: null })
    .eq("id", id);
  if (error) redirect(`/admin/soc2/controls/${id}?err=${encodeURIComponent(error.message)}`);

  await logSoc2Event({
    recordType: "control",
    recordId: id,
    type: "applicability.changed",
    summary: `Control ${control.key} reactivated as applicable by ${guard.email}; not-applicable reason cleared.`,
    detail: { applicability: "applicable" },
    actor: guard.email,
  });
  revalidatePath(`/admin/soc2/controls/${id}`);
  revalidatePath("/admin/soc2/controls");
}

async function createManualRun(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const controlId = String(formData.get("control_id") || "").trim();
  const dueAt = String(formData.get("due_at") || "").trim();
  if (!controlId || !DATE_RE.test(dueAt)) return;

  const db = createServiceClient();
  const { data: controlData } = await db
    .from("soc2_controls")
    .select("id, key")
    .eq("id", controlId)
    .maybeSingle();
  const control = controlData as { id: string; key: string } | null;
  if (!control) return;

  const { data: created, error } = await db
    .from("soc2_control_runs")
    .insert({ control_id: controlId, due_at: dueAt, fire_key: null, status: "scheduled" })
    .select("id")
    .single();
  if (error || !created)
    redirect(
      `/admin/soc2/controls/${controlId}?err=${encodeURIComponent(
        error?.message ?? "Run could not be created."
      )}`
    );

  await logSoc2Event({
    recordType: "control_run",
    recordId: (created as { id: string }).id,
    type: "created",
    summary: `Manual run created for control ${control.key}, due ${dueAt}.`,
    detail: { due_at: dueAt },
    actor: guard.email,
  });
  revalidatePath(`/admin/soc2/controls/${controlId}`);
  revalidatePath("/admin/soc2/controls");
}

async function startRun(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const runId = String(formData.get("run_id") || "").trim();
  if (!runId) return;

  const db = createServiceClient();
  const { data: runData } = await db
    .from("soc2_control_runs")
    .select("id, control_id, status")
    .eq("id", runId)
    .maybeSingle();
  const run = runData as { id: string; control_id: string; status: string } | null;
  if (!run || run.status !== "scheduled") return;
  const { data: controlData } = await db
    .from("soc2_controls")
    .select("id, key")
    .eq("id", run.control_id)
    .maybeSingle();
  const control = controlData as { id: string; key: string } | null;
  if (!control) return;

  const { error } = await db
    .from("soc2_control_runs")
    .update({ status: "in_progress" })
    .eq("id", runId);
  if (error)
    redirect(
      `/admin/soc2/controls/${run.control_id}?err=${encodeURIComponent(error.message)}`
    );

  await logSoc2Event({
    recordType: "control_run",
    recordId: runId,
    type: "status.changed",
    summary: `Run for control ${control.key} started by ${guard.email}.`,
    detail: { status: "in_progress" },
    actor: guard.email,
  });
  revalidatePath(`/admin/soc2/controls/${run.control_id}`);
  revalidatePath("/admin/soc2/controls");
}

async function completeRun(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const runId = String(formData.get("run_id") || "").trim();
  const result = String(formData.get("result") || "").trim();
  const summary = String(formData.get("summary") || "").trim();
  if (!runId || !["pass", "fail", "partial"].includes(result)) return;

  const db = createServiceClient();
  const { data: runData } = await db
    .from("soc2_control_runs")
    .select("id, control_id, status")
    .eq("id", runId)
    .maybeSingle();
  const run = runData as { id: string; control_id: string; status: string } | null;
  if (!run || (run.status !== "scheduled" && run.status !== "in_progress")) return;
  const { data: controlData } = await db
    .from("soc2_controls")
    .select("id, key, frequency")
    .eq("id", run.control_id)
    .maybeSingle();
  const control = controlData as
    | { id: string; key: string; frequency: ControlFrequency }
    | null;
  if (!control) return;

  const { error } = await db
    .from("soc2_control_runs")
    .update({
      status: "complete",
      result,
      summary: summary || null,
      performed_by: guard.email,
      performed_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (error)
    redirect(
      `/admin/soc2/controls/${run.control_id}?err=${encodeURIComponent(error.message)}`
    );

  // Advance the control's schedule from today (the performance date).
  const today = new Date().toISOString().slice(0, 10);
  const nextDue = nextDueAfter(control.frequency, today);

  await logSoc2Event({
    recordType: "control_run",
    recordId: runId,
    type: "completed",
    summary: `Run for control ${control.key} completed with result "${result}" by ${guard.email}.`,
    detail: { result, next_due_at: nextDue },
    actor: guard.email,
  });

  if (nextDue) {
    const { error: schedError } = await db
      .from("soc2_controls")
      .update({ next_due_at: nextDue })
      .eq("id", control.id);
    if (schedError)
      redirect(
        `/admin/soc2/controls/${run.control_id}?err=${encodeURIComponent(schedError.message)}`
      );
  }
  revalidatePath(`/admin/soc2/controls/${run.control_id}`);
  revalidatePath("/admin/soc2/controls");
}

async function skipRun(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const runId = String(formData.get("run_id") || "").trim();
  const reason = String(formData.get("reason") || "").trim();
  if (!runId || !reason) return;

  const db = createServiceClient();
  const { data: runData } = await db
    .from("soc2_control_runs")
    .select("id, control_id, status")
    .eq("id", runId)
    .maybeSingle();
  const run = runData as { id: string; control_id: string; status: string } | null;
  if (!run || (run.status !== "scheduled" && run.status !== "in_progress")) return;
  const { data: controlData } = await db
    .from("soc2_controls")
    .select("id, key")
    .eq("id", run.control_id)
    .maybeSingle();
  const control = controlData as { id: string; key: string } | null;
  if (!control) return;

  const { error } = await db
    .from("soc2_control_runs")
    .update({ status: "skipped", summary: reason })
    .eq("id", runId);
  if (error)
    redirect(
      `/admin/soc2/controls/${run.control_id}?err=${encodeURIComponent(error.message)}`
    );

  await logSoc2Event({
    recordType: "control_run",
    recordId: runId,
    type: "skipped",
    summary: `Run for control ${control.key} skipped by ${guard.email}; reason recorded on the run.`,
    detail: { status: "skipped" },
    actor: guard.email,
  });
  revalidatePath(`/admin/soc2/controls/${run.control_id}`);
  revalidatePath("/admin/soc2/controls");
}

async function reviewRun(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const runId = String(formData.get("run_id") || "").trim();
  const reviewResult = String(formData.get("review_result") || "").trim();
  const note = String(formData.get("note") || "").trim();
  if (!runId || !["accepted", "returned"].includes(reviewResult)) return;

  const db = createServiceClient();
  const { data: runData } = await db
    .from("soc2_control_runs")
    .select("id, control_id, status, performed_by, summary")
    .eq("id", runId)
    .maybeSingle();
  const run = runData as
    | {
        id: string;
        control_id: string;
        status: string;
        performed_by: string | null;
        summary: string | null;
      }
    | null;
  if (!run || run.status !== "complete") return;
  if (
    run.performed_by &&
    guard.email.toLowerCase() === run.performed_by.toLowerCase()
  ) {
    redirect(
      `/admin/soc2/controls/${run.control_id}?err=${encodeURIComponent(
        "Reviewer must differ from performer"
      )}`
    );
  }
  const { data: controlData } = await db
    .from("soc2_controls")
    .select("id, key")
    .eq("id", run.control_id)
    .maybeSingle();
  const control = controlData as { id: string; key: string } | null;
  if (!control) return;

  const newSummary = note
    ? [run.summary, `Review note (${guard.email}): ${note}`].filter(Boolean).join("\n\n")
    : run.summary;
  const { error } = await db
    .from("soc2_control_runs")
    .update({
      review_result: reviewResult,
      reviewer_email: guard.email,
      reviewed_at: new Date().toISOString(),
      summary: newSummary,
    })
    .eq("id", runId);
  if (error)
    redirect(
      `/admin/soc2/controls/${run.control_id}?err=${encodeURIComponent(error.message)}`
    );

  await logSoc2Event({
    recordType: "control_run",
    recordId: runId,
    type: "reviewed",
    summary: `Run for control ${control.key} review recorded as "${reviewResult}" by ${guard.email}.`,
    detail: { review_result: reviewResult },
    actor: guard.email,
  });
  revalidatePath(`/admin/soc2/controls/${run.control_id}`);
  revalidatePath("/admin/soc2/controls");
}

// ── page ───────────────────────────────────────────────────────

export default async function Soc2ControlDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const err = sp.err || null;

  const supabase = await createClient();
  const [
    { data: controlRow },
    { data: runRows },
    { data: evidenceRows },
    { data: exceptionRows },
  ] = await Promise.all([
    supabase
      .from("soc2_controls")
      .select(
        "id, key, tsc_category, tsc_refs, name, objective, description, owner_email, frequency, test_procedure, evidence_requirements, policy_key, automation, applicability, na_reason, na_approved_by, status, next_due_at"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("soc2_control_runs")
      .select(
        "id, control_id, fire_key, due_at, period_start, period_end, status, result, performed_by, performed_at, summary, reviewer_email, reviewed_at, review_result"
      )
      .eq("control_id", id)
      .order("due_at", { ascending: false }),
    supabase
      .from("soc2_evidence_items")
      .select(
        "id, control_id, control_run_id, title, source, capture_date, review_result, classification"
      )
      .eq("control_id", id)
      .order("capture_date", { ascending: false }),
    supabase
      .from("soc2_exceptions")
      .select(
        "id, ref, control_id, rule_key, fire_key, title, detail, severity, status, owner_email, due_at, detected_at, triaged_at"
      )
      .eq("control_id", id)
      .order("detected_at", { ascending: false }),
  ]);
  if (!controlRow) notFound();
  const control = controlRow as ControlDetail;
  const runs = (runRows ?? []) as RunRow[];
  const evidence = (evidenceRows ?? []) as EvidenceItem[];
  const exceptions = (exceptionRows ?? []) as ExceptionRow[];
  const openExceptions = exceptions.filter((e) =>
    OPEN_EXCEPTION_STATUSES.includes(e.status)
  );

  const today = new Date().toISOString().slice(0, 10);
  const { health, explain } = controlHealth({
    control: { ...control, tsc_refs: (control.tsc_refs ?? []) as string[] },
    runs,
    evidence,
    exceptions,
    today,
  });

  return (
    <div>
      <PageHeader
        index="12"
        label="SOC 2"
        title={`${control.key} — ${control.name}`}
        lead="One control's working record: definition, performance runs, collected evidence and open exceptions."
        actions={
          <div className="flex flex-col items-start md:items-end gap-1.5">
            <StatusChip tone={HEALTH_TONE[health]}>{health.replace(/_/g, " ")}</StatusChip>
            <span style={{ ...faintMono, maxWidth: 320 }}>{explain}</span>
          </div>
        }
      />

      {err && (
        <p
          style={{
            fontFamily: T.mono,
            fontSize: "11px",
            letterSpacing: "0.04em",
            color: T.danger,
            border: `1px solid ${T.danger}55`,
            padding: "10px 14px",
            marginTop: 20,
          }}
        >
          {err}
        </p>
      )}

      <div className="flex flex-col gap-5" style={{ marginTop: 28 }}>
        <Reveal delay={0.05}>
          <Panel label="// DEFINITION">
            <div className="flex flex-col gap-4">
              <div>
                <span style={monoLabel}>Objective</span>
                <p style={{ ...bodyText, marginTop: 4 }}>{control.objective}</p>
              </div>
              {control.description && (
                <div>
                  <span style={monoLabel}>Description</span>
                  <p style={{ ...bodyText, marginTop: 4 }}>{control.description}</p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <span style={{ ...monoLabel, marginRight: 4 }}>TSC refs</span>
                <StatusChip tone="muted">{TSC_LABEL[control.tsc_category]}</StatusChip>
                {((control.tsc_refs ?? []) as string[]).map((r) => (
                  <StatusChip key={r} tone="accent">
                    {r}
                  </StatusChip>
                ))}
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <span style={monoLabel}>Test procedure</span>
                  <p style={{ ...bodyText, marginTop: 4 }}>
                    {control.test_procedure ?? "Not documented yet."}
                  </p>
                </div>
                <div>
                  <span style={monoLabel}>Evidence requirements</span>
                  <p style={{ ...bodyText, marginTop: 4 }}>
                    {control.evidence_requirements ?? "Not documented yet."}
                  </p>
                </div>
              </div>
              <div
                className="flex flex-wrap items-center gap-x-6 gap-y-2"
                style={{ paddingTop: 10, borderTop: "1px solid var(--k-border)" }}
              >
                <span style={faintMono}>
                  owner: {control.owner_email ?? "unowned"}
                </span>
                <span style={faintMono}>
                  frequency: {control.frequency.replace(/_/g, " ")}
                </span>
                <span style={faintMono}>automation: {control.automation}</span>
                <span style={faintMono}>next due: {shortDate(control.next_due_at)}</span>
                <span style={faintMono}>status: {control.status}</span>
                {control.policy_key ? (
                  <Link
                    href={`/admin/soc2/policies/${control.policy_key}`}
                    style={{ ...faintMono, color: "var(--k-accent)" }}
                  >
                    policy: {control.policy_key} →
                  </Link>
                ) : (
                  <span style={faintMono}>no source policy</span>
                )}
              </div>
            </div>
          </Panel>
        </Reveal>

        <Reveal delay={0.1}>
          <Panel label="// EDIT CONTROL">
            <form action={updateControl} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={control.id} />
              <div className="flex flex-wrap gap-3">
                <Field label="Owner email" grow>
                  <input
                    name="owner_email"
                    defaultValue={control.owner_email ?? ""}
                    placeholder="owner@nullshift.co"
                    autoComplete="off"
                    style={inp}
                  />
                </Field>
                <Field label="Frequency">
                  <select name="frequency" defaultValue={control.frequency} style={{ ...inp, width: 150 }}>
                    {FREQUENCIES.map((f) => (
                      <option key={f} value={f}>
                        {f.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Next due">
                  <input
                    type="date"
                    name="next_due_at"
                    defaultValue={control.next_due_at ?? ""}
                    style={{ ...inp, width: 160 }}
                  />
                </Field>
              </div>
              <Field label="Test procedure">
                <textarea
                  name="test_procedure"
                  defaultValue={control.test_procedure ?? ""}
                  placeholder="How this control is performed and tested"
                  style={textarea}
                />
              </Field>
              <Field label="Evidence requirements">
                <textarea
                  name="evidence_requirements"
                  defaultValue={control.evidence_requirements ?? ""}
                  placeholder="What must be collected each run to show the control operated"
                  style={textarea}
                />
              </Field>
              <div>
                <SubmitButton style={primaryBtn}>Save control</SubmitButton>
              </div>
            </form>

            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--k-border)" }}>
              {control.applicability === "applicable" ? (
                <form action={markNotApplicable} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-end gap-3">
                    <Field label="Not-applicable reason" grow>
                      <input
                        name="na_reason"
                        placeholder="Why this control does not apply to the service"
                        autoComplete="off"
                        style={inp}
                      />
                    </Field>
                    <Field label={'Type "NA" to confirm'}>
                      <input
                        name="confirm"
                        placeholder="NA"
                        autoComplete="off"
                        style={{ ...inp, width: 90 }}
                      />
                    </Field>
                    <SubmitButton style={dangerBtn}>Mark not applicable</SubmitButton>
                  </div>
                  <p style={faintMono}>
                    Programme Owner only. Not-applicable is a scope claim an auditor will
                    test: it needs a documented reason and a named approver.
                  </p>
                </form>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <StatusChip tone="muted">not applicable</StatusChip>
                  <span style={bodyText}>{control.na_reason ?? "No reason recorded."}</span>
                  <span style={faintMono}>approved by {control.na_approved_by ?? "—"}</span>
                  <form action={reactivateControl}>
                    <input type="hidden" name="id" value={control.id} />
                    <SubmitButton style={actionBtn}>Reactivate as applicable</SubmitButton>
                  </form>
                </div>
              )}
            </div>
          </Panel>
        </Reveal>

        <Reveal delay={0.15}>
          <Panel
            label="// RUNS"
            pad={false}
            actions={
              <form action={createManualRun} className="flex items-center gap-2">
                <input type="hidden" name="control_id" value={control.id} />
                <input
                  type="date"
                  name="due_at"
                  aria-label="Manual run due date"
                  style={{ ...inp, width: 150, height: 30 }}
                />
                <SubmitButton style={primaryBtn}>Add manual run</SubmitButton>
              </form>
            }
          >
            <HeaderRow
              grid={RUN_GRID}
              cols={["Due", "Status", "Result", "Performed by", "Reviewer", "Review"]}
            />
            {runs.length === 0 && (
              <EmptyRow>
                No runs yet. The scheduler raises runs as due dates approach, or add a
                manual run above.
              </EmptyRow>
            )}
            {runs.map((r, i) => {
              const canStart = r.status === "scheduled";
              const canComplete = r.status === "scheduled" || r.status === "in_progress";
              const canReview = r.status === "complete";
              return (
                <div key={r.id} style={{ borderTop: i ? "1px solid var(--k-border)" : "none" }}>
                  <div
                    className="grid md:grid gap-3 items-center px-4 py-2.5"
                    style={{ gridTemplateColumns: RUN_GRID }}
                  >
                    <span style={{ fontFamily: T.mono, fontSize: "0.75rem", color: "var(--k-fg)" }}>
                      {shortDate(r.due_at)}
                    </span>
                    <span>
                      <StatusChip tone={RUN_STATUS_TONE[r.status] ?? "muted"}>
                        {r.status.replace(/_/g, " ")}
                      </StatusChip>
                    </span>
                    <span style={faintMono}>{r.result ?? "—"}</span>
                    <span
                      className="min-w-0 truncate"
                      style={{ fontFamily: T.mono, fontSize: "0.72rem", color: "var(--k-muted)" }}
                    >
                      {r.performed_by ?? "—"}
                    </span>
                    <span
                      className="min-w-0 truncate"
                      style={{ fontFamily: T.mono, fontSize: "0.72rem", color: "var(--k-muted)" }}
                    >
                      {r.reviewer_email ?? "—"}
                    </span>
                    <span style={faintMono}>
                      {r.review_result
                        ? `${r.review_result} · ${shortDate(r.reviewed_at)}`
                        : "—"}
                    </span>
                  </div>
                  {r.summary && (
                    <p className="px-4" style={{ ...bodyText, margin: "0 0 10px", whiteSpace: "pre-wrap" }}>
                      {r.summary}
                    </p>
                  )}
                  {(canStart || canComplete || canReview) && (
                    <details className="px-4 pb-3">
                      <summary style={{ ...faintMono, cursor: "pointer", color: "var(--k-accent)" }}>
                        Run actions
                      </summary>
                      <div className="flex flex-col gap-4" style={{ marginTop: 10 }}>
                        {canStart && (
                          <form action={startRun}>
                            <input type="hidden" name="run_id" value={r.id} />
                            <SubmitButton style={actionBtn}>Start run</SubmitButton>
                          </form>
                        )}
                        {canComplete && (
                          <form action={completeRun} className="flex flex-wrap items-end gap-3">
                            <input type="hidden" name="run_id" value={r.id} />
                            <Field label="Result">
                              <select name="result" defaultValue="pass" style={{ ...inp, width: 110 }}>
                                <option value="pass">pass</option>
                                <option value="fail">fail</option>
                                <option value="partial">partial</option>
                              </select>
                            </Field>
                            <Field label="What was performed" grow>
                              <textarea
                                name="summary"
                                placeholder="What was checked and where the evidence is filed"
                                style={{ ...textarea, minHeight: 56 }}
                              />
                            </Field>
                            <SubmitButton style={primaryBtn}>Complete run</SubmitButton>
                          </form>
                        )}
                        {canComplete && (
                          <form action={skipRun} className="flex flex-wrap items-end gap-3">
                            <input type="hidden" name="run_id" value={r.id} />
                            <Field label="Skip reason" grow>
                              <input
                                name="reason"
                                placeholder="Why this run is not being performed"
                                autoComplete="off"
                                style={inp}
                              />
                            </Field>
                            <SubmitButton style={dangerBtn}>Skip run</SubmitButton>
                          </form>
                        )}
                        {canReview && (
                          <form action={reviewRun} className="flex flex-wrap items-end gap-3">
                            <input type="hidden" name="run_id" value={r.id} />
                            <Field label="Review result">
                              <select
                                name="review_result"
                                defaultValue={r.review_result ?? "accepted"}
                                style={{ ...inp, width: 130 }}
                              >
                                <option value="accepted">accepted</option>
                                <option value="returned">returned</option>
                              </select>
                            </Field>
                            <Field label="Review note (optional)" grow>
                              <input name="note" autoComplete="off" style={inp} />
                            </Field>
                            <SubmitButton style={primaryBtn}>Record review</SubmitButton>
                          </form>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </Panel>
        </Reveal>

        <Reveal delay={0.2}>
          <Panel
            label="// EVIDENCE"
            pad={false}
            actions={
              <Link
                href={`/admin/soc2/evidence?control=${control.id}`}
                style={{
                  ...actionBtn,
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "none",
                }}
              >
                Evidence register →
              </Link>
            }
          >
            <HeaderRow grid={EV_GRID} cols={["Title", "Source", "Captured", "Review"]} />
            {evidence.length === 0 && (
              <EmptyRow>
                No evidence collected for this control yet. Attach items from the
                Evidence register.
              </EmptyRow>
            )}
            {evidence.map((e, i) => (
              <Link
                key={e.id}
                href={`/admin/soc2/evidence?control=${control.id}`}
                className="grid md:grid gap-3 items-center px-4 py-2.5"
                style={{
                  gridTemplateColumns: EV_GRID,
                  borderTop: i ? "1px solid var(--k-border)" : "none",
                  textDecoration: "none",
                }}
              >
                <span
                  className="min-w-0"
                  style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-fg)" }}
                >
                  {e.title}
                </span>
                <span style={faintMono}>{e.source.replace(/_/g, " ")}</span>
                <span style={faintMono}>{shortDate(e.capture_date)}</span>
                {e.review_result ? (
                  <span>
                    <StatusChip tone={e.review_result === "accepted" ? "success" : "warning"}>
                      {e.review_result}
                    </StatusChip>
                  </span>
                ) : (
                  <span style={faintMono}>—</span>
                )}
              </Link>
            ))}
          </Panel>
        </Reveal>

        <Reveal delay={0.25}>
          <Panel label="// OPEN EXCEPTIONS" pad={false}>
            <HeaderRow grid={EXC_GRID} cols={["Ref", "Severity", "Status", "Title"]} />
            {openExceptions.length === 0 && (
              <EmptyRow>No open exceptions on this control.</EmptyRow>
            )}
            {openExceptions.map((e, i) => (
              <Link
                key={e.id}
                href={`/admin/soc2/exceptions/${e.id}`}
                className="grid md:grid gap-3 items-center px-4 py-2.5"
                style={{
                  gridTemplateColumns: EXC_GRID,
                  borderTop: i ? "1px solid var(--k-border)" : "none",
                  textDecoration: "none",
                }}
              >
                <span style={{ fontFamily: T.mono, fontSize: "0.75rem", color: "var(--k-fg)" }}>
                  {e.ref}
                </span>
                <span>
                  <StatusChip tone={SEVERITY_TONE[e.severity]}>{e.severity}</StatusChip>
                </span>
                <span>
                  <StatusChip tone={EXCEPTION_STATUS_TONE[e.status]}>
                    {e.status.replace(/_/g, " ")}
                  </StatusChip>
                </span>
                <span
                  className="min-w-0"
                  style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-fg)" }}
                >
                  {e.title}
                </span>
              </Link>
            ))}
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}
