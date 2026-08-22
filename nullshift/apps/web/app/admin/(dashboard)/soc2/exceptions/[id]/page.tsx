import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireSoc2, WRITE_ROLES } from "@/lib/soc2/guard";
import { logSoc2Event } from "@/lib/soc2/events";
import type { ExceptionSeverity, ExceptionStatus } from "@/lib/soc2/types";
import { SEVERITY_TONE, EXCEPTION_STATUS_TONE, EXCEPTION_STATUS_LABEL } from "@/lib/soc2/ui";
import { composeExceptionWorkOrder } from "@/lib/soc2/workOrder";
import { CopyButton } from "@/components/app/CopyButton";
import { inp, textarea, primaryBtn, actionBtn, dangerBtn, Field, shortDate, faintMono, bodyText, monoLabel } from "../../shared";

/**
 * Exception detail — the record's whole life on one page: what tripped it,
 * the human triage decision, remediation, evidence, and the closure gate.
 * Every transition is a named act written to the domain trail; the database
 * refuses closure without owner remediation details AND verification by a
 * different person, and refuses "not applicable" without a documented reason.
 */

export const dynamic = "force-dynamic";

type ExceptionFull = {
  id: string;
  ref: string;
  control_id: string | null;
  rule_key: string | null;
  fire_key: string | null;
  title: string;
  detail: string | null;
  severity: ExceptionSeverity;
  severity_rationale: string | null;
  status: ExceptionStatus;
  source: string;
  trigger_ref: string | null;
  detected_at: string;
  affected: Record<string, string[]>;
  owner_email: string | null;
  due_at: string | null;
  recommended_action: string | null;
  compensating_control: string | null;
  triage_decision: string | null;
  triaged_by: string | null;
  triaged_at: string | null;
  remediation_plan: string | null;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  verification_note: string | null;
  na_reason: string | null;
  risk_id: string | null;
  incident_id: string | null;
};
type ControlFull = {
  id: string;
  key: string;
  name: string;
  objective: string;
  test_procedure: string | null;
  evidence_requirements: string | null;
};
type EventRow = { id: string; type: string; summary: string; actor: string | null; created_at: string };
type EvidenceRef = { id: string; title: string; capture_date: string; review_result: string | null };

const pagePath = (id: string) => `/admin/soc2/exceptions/${id}`;

// ── server actions ─────────────────────────────────────────────

async function triageException(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const id = String(formData.get("id") || "");
  const decision = String(formData.get("triage_decision") || "").trim();
  const nextStatus = String(formData.get("next_status") || "");
  const ownerEmail = String(formData.get("owner_email") || "").trim();
  const dueAt = String(formData.get("due_at") || "");
  const remediation = String(formData.get("remediation_plan") || "").trim();
  const compensating = String(formData.get("compensating_control") || "").trim();
  const allowed: ExceptionStatus[] = ["in_remediation", "awaiting_evidence", "awaiting_risk_acceptance"];
  if (!id || !decision || !(allowed as string[]).includes(nextStatus)) return;

  const db = createServiceClient();
  const { data: row } = await db.from("soc2_exceptions").select("id, ref, status").eq("id", id).maybeSingle();
  if (!row || row.status === "closed" || row.status === "not_applicable") return;
  const { error } = await db
    .from("soc2_exceptions")
    .update({
      status: nextStatus,
      triage_decision: decision,
      triaged_by: guard.email,
      triaged_at: new Date().toISOString(),
      owner_email: ownerEmail || null,
      due_at: dueAt || null,
      remediation_plan: remediation || null,
      compensating_control: compensating || null,
    })
    .eq("id", id);
  if (error) redirect(`${pagePath(id)}?err=${encodeURIComponent(error.message)}`);
  await logSoc2Event({
    recordType: "exception",
    recordId: id,
    type: "triaged",
    summary: `${row.ref} triaged → ${nextStatus} by ${guard.email}.`,
    detail: { decision: decision.slice(0, 200), owner: ownerEmail },
    actor: guard.email,
  });
  revalidatePath(pagePath(id));
}

async function markNotApplicable(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const id = String(formData.get("id") || "");
  const reason = String(formData.get("na_reason") || "").trim();
  const confirm = String(formData.get("confirm") || "");
  if (!id || !reason || confirm !== "NA") return;

  const db = createServiceClient();
  const { data: row } = await db.from("soc2_exceptions").select("id, ref, status").eq("id", id).maybeSingle();
  if (!row || row.status === "closed" || row.status === "not_applicable") return;
  const { error } = await db
    .from("soc2_exceptions")
    .update({
      status: "not_applicable",
      na_reason: reason,
      triaged_by: guard.email,
      triaged_at: new Date().toISOString(),
      triage_decision: "False positive / not applicable",
    })
    .eq("id", id);
  if (error) redirect(`${pagePath(id)}?err=${encodeURIComponent(error.message)}`);
  await logSoc2Event({
    recordType: "exception",
    recordId: id,
    type: "marked_not_applicable",
    summary: `${row.ref} marked false positive / not applicable by ${guard.email}.`,
    detail: { reason: reason.slice(0, 300) },
    actor: guard.email,
  });
  revalidatePath(pagePath(id));
}

async function resolveException(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const id = String(formData.get("id") || "");
  const note = String(formData.get("resolution_note") || "").trim();
  if (!id || !note) return;

  const db = createServiceClient();
  const { data: row } = await db.from("soc2_exceptions").select("id, ref, status, resolution_note").eq("id", id).maybeSingle();
  if (!row || row.status === "closed" || row.status === "not_applicable") return;
  const { error } = await db
    .from("soc2_exceptions")
    .update({
      status: "resolved_pending_verification",
      resolution_note: note,
      resolved_by: guard.email,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) redirect(`${pagePath(id)}?err=${encodeURIComponent(error.message)}`);
  await logSoc2Event({
    recordType: "exception",
    recordId: id,
    type: "resolved",
    summary: `${row.ref} resolved by ${guard.email} — awaiting independent verification.`,
    actor: guard.email,
  });
  revalidatePath(pagePath(id));
}

async function verifyAndClose(formData: FormData) {
  "use server";
  const guard = await requireSoc2("programme_owner", "evidence_reviewer", "control_owner");
  if (!guard.ok) return;
  const id = String(formData.get("id") || "");
  const note = String(formData.get("verification_note") || "").trim();
  const confirm = String(formData.get("confirm") || "");
  if (!id || !note || confirm !== "CLOSE") return;

  const db = createServiceClient();
  const { data: row } = await db
    .from("soc2_exceptions")
    .select("id, ref, status, resolved_by")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.status !== "resolved_pending_verification") return;
  // The DB trigger is the real gate (resolver ≠ verifier); this pre-check just
  // gives a friendlier message than a raw check_violation.
  if (row.resolved_by === guard.email) {
    redirect(
      `${pagePath(id)}?err=${encodeURIComponent("Verification must come from someone other than the resolver.")}`
    );
  }
  const { error } = await db
    .from("soc2_exceptions")
    .update({
      status: "closed",
      verified_by: guard.email,
      verified_at: new Date().toISOString(),
      verification_note: note,
    })
    .eq("id", id);
  if (error) redirect(`${pagePath(id)}?err=${encodeURIComponent(error.message)}`);
  await logSoc2Event({
    recordType: "exception",
    recordId: id,
    type: "closed",
    summary: `${row.ref} verified and closed by ${guard.email}.`,
    actor: guard.email,
  });
  revalidatePath(pagePath(id));
}

async function reopenException(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const id = String(formData.get("id") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!id || !reason) return;
  const db = createServiceClient();
  const { data: row } = await db.from("soc2_exceptions").select("id, ref, status").eq("id", id).maybeSingle();
  if (!row || (row.status !== "resolved_pending_verification" && row.status !== "closed")) return;
  // Reopening a CLOSED rule exception can collide with the partial unique
  // fire_key index when the sweep has since raised a fresh open one for the
  // same condition. Keep the key where possible (it carries the dedupe
  // history); only on an actual collision does the reopened record become
  // human-tracked with its key dropped.
  const reopenFields = {
    status: "in_remediation",
    verified_by: null,
    verified_at: null,
    verification_note: null,
  };
  let { error } = await db.from("soc2_exceptions").update(reopenFields).eq("id", id);
  if (error && error.code === "23505") {
    ({ error } = await db
      .from("soc2_exceptions")
      .update({ ...reopenFields, fire_key: null })
      .eq("id", id));
  }
  if (error) redirect(`${pagePath(id)}?err=${encodeURIComponent(error.message)}`);
  await logSoc2Event({
    recordType: "exception",
    recordId: id,
    type: "reopened",
    summary: `${row.ref} reopened by ${guard.email}: ${reason.slice(0, 160)}`,
    actor: guard.email,
  });
  revalidatePath(pagePath(id));
}

async function openIncidentFromException(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const db = createServiceClient();
  const { data: exc } = await db
    .from("soc2_exceptions")
    .select("id, ref, title, severity, incident_id")
    .eq("id", id)
    .maybeSingle();
  if (!exc || exc.incident_id) return;
  const { data: incRef } = await db.rpc("next_soc2_incident_ref");
  if (!incRef) return;
  const { data: incident, error } = await db
    .from("soc2_incidents")
    .insert({
      ref: incRef,
      title: `From exception ${exc.ref}: ${exc.title}`.slice(0, 200),
      classification: "security",
      severity: exc.severity === "low" ? "medium" : exc.severity,
      reported_by: guard.email,
      owner_email: guard.email,
      impact_summary: `Opened from exception ${exc.ref}. See the exception record for the trigger.`,
    })
    .select("id, ref")
    .single();
  if (error || !incident) return;
  await db.from("soc2_exceptions").update({ incident_id: incident.id }).eq("id", id);
  await db.from("soc2_incident_events").insert({
    incident_id: incident.id,
    phase: "detection",
    entry: `Incident opened from exception ${exc.ref} by ${guard.email}.`,
    actor: guard.email,
  });
  await logSoc2Event({
    recordType: "incident",
    recordId: incident.id,
    type: "created",
    summary: `${incident.ref} opened from exception ${exc.ref}.`,
    actor: guard.email,
  });
  redirect(`/admin/soc2/incidents/${incident.id}`);
}

// ── page ───────────────────────────────────────────────────────

export default async function ExceptionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { id } = await params;
  const { err } = await searchParams;
  const supabase = await createClient();
  const [{ data: row }, { data: events }, { data: evidence }] = await Promise.all([
    supabase.from("soc2_exceptions").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("soc2_events")
      .select("id, type, summary, actor, created_at")
      .eq("record_type", "exception")
      .eq("record_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("soc2_evidence_items")
      .select("id, title, capture_date, review_result")
      .eq("exception_id", id),
  ]);
  if (!row) notFound();
  const e = row as ExceptionFull;
  let control: ControlFull | null = null;
  if (e.control_id) {
    const { data: c } = await supabase
      .from("soc2_controls")
      .select("id, key, name, objective, test_procedure, evidence_requirements")
      .eq("id", e.control_id)
      .maybeSingle();
    control = (c as ControlFull | null) ?? null;
  }
  const eventList = (events ?? []) as EventRow[];
  const evidenceList = (evidence ?? []) as EvidenceRef[];
  const open = e.status !== "closed" && e.status !== "not_applicable";
  const affectedEntries = Object.entries(e.affected ?? {}).filter(([, v]) => (v ?? []).length > 0);

  // Compiled, context-complete prompt for a Claude Code session — the same
  // affordance fix batches have, pointed at this remediation.
  const workOrder = composeExceptionWorkOrder({
    ref: e.ref,
    title: e.title,
    severity: e.severity,
    status: e.status,
    detail: e.detail,
    ruleKey: e.rule_key,
    triggerRef: e.trigger_ref,
    recommendedAction: e.recommended_action,
    severityRationale: e.severity_rationale,
    remediationPlan: e.remediation_plan,
    affected: e.affected ?? {},
    control: control
      ? {
          key: control.key,
          name: control.name,
          objective: control.objective,
          testProcedure: control.test_procedure,
          evidenceRequirements: control.evidence_requirements,
        }
      : null,
    trail: eventList.map(
      (ev) => `${ev.created_at.slice(0, 10)} · ${ev.type} · ${ev.summary}`
    ),
  });

  return (
    <div>
      <PageHeader
        index="12"
        label="SOC 2"
        title={e.ref}
        lead={e.title}
        actions={
          <div className="flex items-center gap-2">
            <StatusChip tone={SEVERITY_TONE[e.severity]}>{e.severity}</StatusChip>
            <StatusChip tone={EXCEPTION_STATUS_TONE[e.status]}>{EXCEPTION_STATUS_LABEL[e.status]}</StatusChip>
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
            border: `1px solid ${T.danger}40`,
            padding: "10px 14px",
            marginTop: 16,
          }}
        >
          {err}
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-4" style={{ marginTop: 22 }}>
        <Reveal delay={0.04}>
          <Panel label="// WHAT TRIPPED IT">
            <div className="flex flex-col gap-2.5">
              <p style={bodyText}>{e.detail ?? "No further detail recorded."}</p>
              {e.severity_rationale && (
                <p style={bodyText}>
                  <span style={monoLabel}>severity rationale · </span>
                  {e.severity_rationale}
                </p>
              )}
              <p style={faintMono}>
                source {e.source}
                {e.rule_key ? ` · rule ${e.rule_key}` : ""} · detected {shortDate(e.detected_at)}
                {e.trigger_ref ? ` · trigger ${e.trigger_ref}` : ""}
              </p>
              {control && (
                <p style={bodyText}>
                  <span style={monoLabel}>control · </span>
                  <Link href={`/admin/soc2/controls/${control.id}`} style={{ color: "var(--k-accent)" }}>
                    {control.key} — {control.name}
                  </Link>
                </p>
              )}
              {affectedEntries.length > 0 && (
                <div>
                  <span style={monoLabel}>affected</span>
                  <p style={{ ...faintMono, marginTop: 4 }}>
                    {affectedEntries.map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`).join(" · ")}
                  </p>
                </div>
              )}
              {e.recommended_action && (
                <p style={bodyText}>
                  <span style={monoLabel}>recommended · </span>
                  {e.recommended_action}
                </p>
              )}
              {e.incident_id ? (
                <p style={bodyText}>
                  <Link href={`/admin/soc2/incidents/${e.incident_id}`} style={{ color: "var(--k-accent)" }}>
                    Linked incident →
                  </Link>
                </p>
              ) : (
                open && (
                  <form action={openIncidentFromException}>
                    <input type="hidden" name="id" value={e.id} />
                    <SubmitButton style={dangerBtn}>Open incident from this exception</SubmitButton>
                  </form>
                )
              )}
            </div>
          </Panel>
        </Reveal>

        <Reveal delay={0.06}>
          <Panel label="// LIFECYCLE">
            <div className="flex flex-col gap-2">
              <p style={faintMono}>
                owner {e.owner_email ?? "unassigned"} · due {e.due_at ? shortDate(e.due_at) : "—"}
              </p>
              {e.triaged_by && (
                <p style={bodyText}>
                  <span style={monoLabel}>triage · </span>
                  {e.triage_decision} — {e.triaged_by}, {shortDate(e.triaged_at)}
                </p>
              )}
              {e.remediation_plan && (
                <p style={bodyText}>
                  <span style={monoLabel}>remediation plan · </span>
                  {e.remediation_plan}
                </p>
              )}
              {e.compensating_control && (
                <p style={bodyText}>
                  <span style={monoLabel}>compensating control · </span>
                  {e.compensating_control}
                </p>
              )}
              {e.resolution_note && (
                <p style={bodyText}>
                  <span style={monoLabel}>resolution · </span>
                  {e.resolution_note} — {e.resolved_by}, {shortDate(e.resolved_at)}
                </p>
              )}
              {e.verified_by && (
                <p style={bodyText}>
                  <span style={monoLabel}>verification · </span>
                  {e.verification_note} — {e.verified_by}, {shortDate(e.verified_at)}
                </p>
              )}
              {e.na_reason && (
                <p style={bodyText}>
                  <span style={monoLabel}>not applicable · </span>
                  {e.na_reason}
                </p>
              )}
              {evidenceList.length > 0 && (
                <div>
                  <span style={monoLabel}>closure evidence</span>
                  {evidenceList.map((ev) => (
                    <p key={ev.id} style={{ ...faintMono, marginTop: 4 }}>
                      {ev.title} · {shortDate(ev.capture_date)} · {ev.review_result ?? "unreviewed"}
                    </p>
                  ))}
                </div>
              )}
              <p style={{ ...faintMono, marginTop: 6 }}>
                Attach closure evidence from the{" "}
                <Link href={`/admin/soc2/evidence${e.control_id ? `?control=${e.control_id}` : ""}`} style={{ color: "var(--k-accent)" }}>
                  Evidence page
                </Link>{" "}
                against the related control.
              </p>
            </div>
          </Panel>
        </Reveal>
      </div>

      {/* Actions by state */}
      {open && (
        <Reveal delay={0.08}>
          <div className="grid md:grid-cols-2 gap-4" style={{ marginTop: 18 }}>
            {(e.status === "detected" || e.status === "triage_required") && (
              <Panel label="// TRIAGE" title="Human decision required">
                <form action={triageException} className="flex flex-col gap-3">
                  <input type="hidden" name="id" value={e.id} />
                  <Field label="Triage decision (what is this, and why does it matter?)">
                    <textarea name="triage_decision" style={textarea} required maxLength={1000} />
                  </Field>
                  <div className="flex flex-wrap gap-3">
                    <Field label="Route to">
                      <select name="next_status" style={inp} defaultValue="in_remediation">
                        <option value="in_remediation">In remediation</option>
                        <option value="awaiting_evidence">Awaiting evidence</option>
                        <option value="awaiting_risk_acceptance">Awaiting risk acceptance</option>
                      </select>
                    </Field>
                    <Field label="Owner" grow>
                      <input name="owner_email" style={inp} defaultValue={e.owner_email ?? ""} />
                    </Field>
                    <Field label="Due">
                      <input type="date" name="due_at" style={inp} defaultValue={e.due_at ?? ""} />
                    </Field>
                  </div>
                  <Field label="Remediation plan">
                    <textarea name="remediation_plan" style={textarea} defaultValue={e.remediation_plan ?? ""} maxLength={2000} />
                  </Field>
                  <Field label="Compensating control (if any)">
                    <input name="compensating_control" style={inp} defaultValue={e.compensating_control ?? ""} maxLength={500} />
                  </Field>
                  <div>
                    <SubmitButton style={primaryBtn}>Record triage</SubmitButton>
                  </div>
                </form>
                <div style={{ borderTop: "1px solid var(--k-border)", marginTop: 16, paddingTop: 14 }}>
                  <form action={markNotApplicable} className="flex flex-col gap-3">
                    <input type="hidden" name="id" value={e.id} />
                    <Field label='False positive / not applicable — documented reason + type "NA" to confirm'>
                      <textarea name="na_reason" style={textarea} maxLength={1000} />
                    </Field>
                    <div className="flex items-center gap-3">
                      <input name="confirm" style={{ ...inp, width: 90 }} placeholder="NA" />
                      <SubmitButton style={actionBtn}>Mark not applicable</SubmitButton>
                    </div>
                  </form>
                </div>
              </Panel>
            )}

            {(e.status === "in_remediation" ||
              e.status === "awaiting_evidence" ||
              e.status === "awaiting_risk_acceptance") && (
              <Panel label="// RESOLVE" title="Owner remediation details">
                <form action={resolveException} className="flex flex-col gap-3">
                  <input type="hidden" name="id" value={e.id} />
                  <Field label="What was done, by whom, and how it is evidenced">
                    <textarea name="resolution_note" style={textarea} required maxLength={2000} />
                  </Field>
                  <p style={faintMono}>
                    Resolving moves this to “Resolved — pending verification”. A different person
                    then verifies and closes; the database refuses same-person closure.
                  </p>
                  <div>
                    <SubmitButton style={primaryBtn}>Mark resolved</SubmitButton>
                  </div>
                </form>
              </Panel>
            )}

            {e.status === "resolved_pending_verification" && (
              <Panel label="// VERIFY & CLOSE" title="Independent verification">
                <form action={verifyAndClose} className="flex flex-col gap-3">
                  <input type="hidden" name="id" value={e.id} />
                  <Field label="Verification note (what you checked)">
                    <textarea name="verification_note" style={textarea} required maxLength={1000} />
                  </Field>
                  <div className="flex items-center gap-3">
                    <input name="confirm" style={{ ...inp, width: 110 }} placeholder="CLOSE" />
                    <SubmitButton style={primaryBtn}>Verify &amp; close</SubmitButton>
                  </div>
                  <p style={faintMono}>
                    Resolver: {e.resolved_by ?? "—"}. You must be a different person; the database
                    enforces it even if this page does not stop you.
                  </p>
                </form>
                <div style={{ borderTop: "1px solid var(--k-border)", marginTop: 16, paddingTop: 14 }}>
                  <form action={reopenException} className="flex items-center gap-3">
                    <input type="hidden" name="id" value={e.id} />
                    <input name="reason" style={{ ...inp, maxWidth: 340 }} placeholder="Why is this not actually resolved?" />
                    <SubmitButton style={dangerBtn}>Reopen</SubmitButton>
                  </form>
                </div>
              </Panel>
            )}
          </div>
        </Reveal>
      )}

      {/* Work order — hand the remediation to a Claude Code session */}
      {open && (
        <Reveal delay={0.09}>
          <div style={{ marginTop: 18 }}>
            <Panel
              label="// WORK THIS IN CLAUDE CODE"
              title="Pre-populated session prompt"
              actions={<CopyButton text={workOrder} label="Copy work order" />}
            >
              <div className="flex flex-col gap-2.5">
                <p style={bodyText}>
                  Copy the work order and paste it as the first message of a new session at
                  claude.ai/code (or the CLI). It carries everything the session needs: the
                  exception, its control, the recent trail, and the ground rules. The
                  session&apos;s commits carry a Claude-Session link, so the deploy mirror
                  attaches the resulting production change back into the change register —
                  a human still resolves and verifies this exception here.
                </p>
                <pre
                  style={{
                    ...faintMono,
                    whiteSpace: "pre-wrap",
                    maxHeight: 260,
                    overflowY: "auto",
                    border: "1px solid var(--k-border)",
                    padding: "10px 12px",
                    margin: 0,
                  }}
                >
                  {workOrder}
                </pre>
              </div>
            </Panel>
          </div>
        </Reveal>
      )}

      {/* Trail */}
      <Reveal delay={0.1}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// TRAIL" pad={false}>
            {eventList.length === 0 ? (
              <p className="text-center py-6" style={bodyText}>
                No trail entries yet.
              </p>
            ) : (
              <div className="flex flex-col">
                {eventList.map((ev, i) => (
                  <div
                    key={ev.id}
                    className="flex items-baseline gap-3 px-4 py-2.5"
                    style={{ borderTop: i ? "1px solid var(--k-border)" : "none" }}
                  >
                    <span style={{ ...faintMono, whiteSpace: "nowrap" }}>
                      {new Date(ev.created_at).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span style={{ ...faintMono, minWidth: 110 }}>{ev.type}</span>
                    <span style={bodyText}>{ev.summary}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </Reveal>
    </div>
  );
}
