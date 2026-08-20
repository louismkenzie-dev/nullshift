import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireSoc2, WRITE_ROLES } from "@/lib/soc2/guard";
import { logSoc2Event } from "@/lib/soc2/events";
import { redactSecrets } from "@/lib/ai/impact";
import { controlHealth } from "@/lib/soc2/health";
import { HEALTH_TONE } from "@/lib/soc2/ui";
import { addDays, nextDueAfter, toDateOnly } from "@/lib/soc2/schedule";
import type {
  ControlFrequency,
  ControlHealth,
  ControlRow,
  ControlRunRow,
  EvidenceRow,
  ExceptionRow,
} from "@/lib/soc2/types";
import {
  inp,
  textarea,
  primaryBtn,
  Field,
  shortDate,
  EmptyRow,
  HeaderRow,
  faintMono,
  bodyText,
} from "../shared";

/**
 * Business Continuity & Backups — the availability side of the programme.
 * Backup success (AVL-02), restore tests (AVL-03) and service health checks
 * (AVL-06) are recorded here as evidence against their controls: each entry
 * completes the control's open run where one exists, and a failed result
 * raises a high-severity exception for triage rather than disappearing into a
 * note. Management readiness reviews (GOV-06) are recorded with their
 * decisions, so "management reviewed this" is a dated record, not a claim.
 */

export const dynamic = "force-dynamic";

const PAGE_PATH = "/admin/soc2/continuity";

const AVL_KEYS = ["AVL-01", "AVL-02", "AVL-03", "AVL-04", "AVL-05", "AVL-06"];

const RESULTS = ["pass", "fail", "partial"] as const;

type ReviewDecision = { decision?: string; owner?: string; due?: string };

type ManagementReviewRow = {
  id: string;
  held_at: string;
  attendees: string;
  summary: string | null;
  decisions: ReviewDecision[] | null;
  next_due_at: string | null;
  recorded_by: string | null;
};

const errRedirect = (message: string): never =>
  redirect(`${PAGE_PATH}?err=${encodeURIComponent(message)}`);

// ── server actions ─────────────────────────────────────────────

type CheckConfig = {
  controlKey: "AVL-02" | "AVL-03" | "AVL-06";
  source: "backup_report" | "restore_test" | "system_record";
  /** Evidence title prefix, e.g. "Backup review" → "Backup review 2026-08-20". */
  titlePrefix: string;
  failRuleKey: string;
  failTitle: string;
  failAction: string;
};

/**
 * Shared body for the three availability checks: collect evidence against the
 * control, complete its earliest open run if one exists, and raise a
 * high-severity exception when the result is a failure. Callers have already
 * passed the write guard.
 */
async function recordAvailabilityCheck(
  formData: FormData,
  actorEmail: string,
  cfg: CheckConfig
) {
  const periodNote = String(formData.get("period_note") || "").trim();
  const outcome = String(formData.get("outcome") || "").trim();
  const result = String(formData.get("result") || "");
  if (!periodNote || !outcome || !(RESULTS as readonly string[]).includes(result)) return;

  // Secret gate — same refusal as the evidence register: credential-shaped
  // content is never stored. Nothing is written on a match.
  const textFields = [periodNote, outcome].join("\n");
  if (JSON.stringify(redactSecrets(textFields)) !== JSON.stringify(textFields)) {
    errRedirect("Blocked: a field matched a secret pattern. Record references and outcomes, never credentials.");
  }

  const db = createServiceClient();
  const { data: controlRow } = await db
    .from("soc2_controls")
    .select("id, key, frequency")
    .eq("key", cfg.controlKey)
    .maybeSingle();
  const control = (controlRow ?? null) as
    | { id: string; key: string; frequency: ControlFrequency }
    | null;
  if (!control) {
    errRedirect(`Control ${cfg.controlKey} is not installed — seed the programme from Settings.`);
    return;
  }

  const today = toDateOnly(new Date());

  const { data: openRunRows } = await db
    .from("soc2_control_runs")
    .select("id, due_at")
    .eq("control_id", control.id)
    .in("status", ["scheduled", "in_progress"])
    .order("due_at", { ascending: true })
    .limit(1);
  const openRun = ((openRunRows ?? []) as { id: string; due_at: string }[])[0] ?? null;

  const { data: evidence, error: evidenceError } = await db
    .from("soc2_evidence_items")
    .insert({
      control_id: control.id,
      control_run_id: openRun?.id ?? null,
      title: `${cfg.titlePrefix} ${today}`,
      source: cfg.source,
      collected_by: actorEmail,
      classification: "confidential",
      notes: outcome,
    })
    .select("id")
    .single();
  if (evidenceError || !evidence) {
    errRedirect(evidenceError?.message ?? "Evidence could not be saved");
    return;
  }
  await logSoc2Event({
    recordType: "evidence",
    recordId: evidence.id,
    type: "collected",
    summary: `${cfg.titlePrefix} recorded for ${control.key} with result "${result}"`,
    detail: { source: cfg.source, result, control_key: control.key },
    actor: actorEmail,
  });

  if (openRun) {
    const { error: runError } = await db
      .from("soc2_control_runs")
      .update({
        status: "complete",
        result,
        performed_by: actorEmail,
        performed_at: new Date().toISOString(),
        summary: periodNote,
      })
      .eq("id", openRun.id);
    if (runError) {
      errRedirect(runError.message);
      return;
    }
    const nextDue = nextDueAfter(control.frequency, today);
    await db.from("soc2_controls").update({ next_due_at: nextDue }).eq("id", control.id);
    await logSoc2Event({
      recordType: "control_run",
      recordId: openRun.id,
      type: "completed",
      summary: `${control.key} run due ${openRun.due_at} completed with result "${result}"`,
      detail: { result, next_due_at: nextDue },
      actor: actorEmail,
    });
  }

  if (result === "fail") {
    const { data: ref } = await db.rpc("next_soc2_exception_ref");
    if (!ref) {
      revalidatePath(PAGE_PATH);
      return;
    }
    const { data: exc, error: excError } = await db
      .from("soc2_exceptions")
      .insert({
        ref,
        control_id: control.id,
        rule_key: cfg.failRuleKey,
        severity: "high",
        status: "triage_required",
        title: cfg.failTitle,
        detail: periodNote.slice(0, 300),
        source: "manual",
        owner_email: actorEmail,
        due_at: addDays(today, 7),
        recommended_action: cfg.failAction,
      })
      .select("id, ref")
      .single();
    if (excError || !exc) {
      errRedirect(excError?.message ?? "The failure exception could not be raised");
      return;
    }
    await logSoc2Event({
      recordType: "exception",
      recordId: exc.id,
      type: "detected",
      summary: `${exc.ref} raised: ${cfg.failTitle.toLowerCase()} (${control.key})`,
      detail: { rule_key: cfg.failRuleKey, severity: "high" },
      actor: actorEmail,
    });
  }

  revalidatePath(PAGE_PATH);
}

async function recordBackupReview(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  await recordAvailabilityCheck(formData, guard.email, {
    controlKey: "AVL-02",
    source: "backup_report",
    titlePrefix: "Backup review",
    failRuleKey: "availability.backup_failure",
    failTitle: "Backup review recorded a failure",
    failAction: "Remediate the failed backup and re-verify.",
  });
}

async function recordRestoreTest(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  await recordAvailabilityCheck(formData, guard.email, {
    controlKey: "AVL-03",
    source: "restore_test",
    titlePrefix: "Restore test",
    failRuleKey: "availability.restore_test_failed",
    failTitle: "Restore test recorded a failure",
    failAction: "Remediate the failed restore path and re-run the test.",
  });
}

async function recordServiceHealthCheck(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  await recordAvailabilityCheck(formData, guard.email, {
    controlKey: "AVL-06",
    source: "system_record",
    titlePrefix: "Service health check",
    failRuleKey: "availability.health_check_failed",
    failTitle: "Service health check recorded a failure",
    failAction: "Remediate the failing service and re-check availability.",
  });
}

async function recordManagementReview(formData: FormData) {
  "use server";
  const guard = await requireSoc2("programme_owner");
  if (!guard.ok) return;

  const today = toDateOnly(new Date());
  const heldAt = String(formData.get("held_at") || "").trim() || today;
  const attendees = String(formData.get("attendees") || "").trim();
  const summary = String(formData.get("summary") || "").trim();
  const decisionsRaw = String(formData.get("decisions") || "");
  const nextDueAt = String(formData.get("next_due_at") || "").trim();
  const dateShape = /^\d{4}-\d{2}-\d{2}$/;
  if (!attendees || !dateShape.test(heldAt)) return;
  if (nextDueAt && !dateShape.test(nextDueAt)) return;

  const decisions = decisionsRaw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => ({ decision: line }));

  const db = createServiceClient();
  const { data: review, error: reviewError } = await db
    .from("soc2_management_reviews")
    .insert({
      held_at: heldAt,
      attendees,
      summary: summary || null,
      decisions: decisions as never,
      next_due_at: nextDueAt || null,
      recorded_by: guard.email,
    })
    .select("id")
    .single();
  if (reviewError || !review) {
    errRedirect(reviewError?.message ?? "The management review could not be recorded");
    return;
  }
  await logSoc2Event({
    recordType: "management_review",
    recordId: review.id,
    type: "recorded",
    summary: `Management review held ${heldAt} recorded with ${decisions.length} decision${decisions.length === 1 ? "" : "s"}`,
    detail: { held_at: heldAt, next_due_at: nextDueAt || null, decision_count: decisions.length },
    actor: guard.email,
  });

  // GOV-06's evidence: the recorded review itself.
  const { data: controlRow } = await db
    .from("soc2_controls")
    .select("id, key, frequency")
    .eq("key", "GOV-06")
    .maybeSingle();
  const control = (controlRow ?? null) as
    | { id: string; key: string; frequency: ControlFrequency }
    | null;
  if (control) {
    const { data: openRunRows } = await db
      .from("soc2_control_runs")
      .select("id, due_at")
      .eq("control_id", control.id)
      .in("status", ["scheduled", "in_progress"])
      .order("due_at", { ascending: true })
      .limit(1);
    const openRun = ((openRunRows ?? []) as { id: string; due_at: string }[])[0] ?? null;

    const { data: evidence, error: evidenceError } = await db
      .from("soc2_evidence_items")
      .insert({
        control_id: control.id,
        control_run_id: openRun?.id ?? null,
        title: `Management review ${heldAt}`,
        source: "system_record",
        collected_by: guard.email,
      })
      .select("id")
      .single();
    if (evidenceError || !evidence) {
      errRedirect(evidenceError?.message ?? "The review's evidence item could not be saved");
      return;
    }
    await logSoc2Event({
      recordType: "evidence",
      recordId: evidence.id,
      type: "collected",
      summary: `Evidence collected for GOV-06: management review held ${heldAt}`,
      detail: { source: "system_record", control_key: control.key },
      actor: guard.email,
    });

    if (openRun) {
      const { error: runError } = await db
        .from("soc2_control_runs")
        .update({
          status: "complete",
          result: "pass",
          performed_by: guard.email,
          performed_at: new Date().toISOString(),
          summary: `Management review held ${heldAt}`,
        })
        .eq("id", openRun.id);
      if (runError) {
        errRedirect(runError.message);
        return;
      }
      const nextDue = nextDueAfter(control.frequency, today);
      await db.from("soc2_controls").update({ next_due_at: nextDue }).eq("id", control.id);
      await logSoc2Event({
        recordType: "control_run",
        recordId: openRun.id,
        type: "completed",
        summary: `GOV-06 run due ${openRun.due_at} completed by the recorded management review`,
        detail: { result: "pass", next_due_at: nextDue },
        actor: guard.email,
      });
    }
  }

  revalidatePath(PAGE_PATH);
}

// ── page ───────────────────────────────────────────────────────

const GRID = "90px 1.6fr 110px 1.9fr 110px";
const MR_GRID = "110px 1.2fr 1.4fr 90px 110px";

function CheckForm({
  action,
  noun,
  note,
}: {
  action: (formData: FormData) => Promise<void>;
  noun: string;
  note: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Field label="Period note" grow>
          <input
            name="period_note"
            style={inp}
            required
            maxLength={300}
            placeholder={`Which period this ${noun} covers, and what was in scope`}
          />
        </Field>
        <Field label="Result">
          <select name="result" style={inp} defaultValue="pass">
            {RESULTS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Per-system outcome (references and outcomes — never credentials)">
        <textarea
          name="outcome"
          style={textarea}
          required
          maxLength={2000}
          placeholder="System by system: what was checked and what it showed"
        />
      </Field>
      <div className="flex items-center gap-3 flex-wrap">
        <SubmitButton style={primaryBtn}>Record {noun}</SubmitButton>
        <span style={faintMono}>{note}</span>
      </div>
    </form>
  );
}

export default async function ContinuityPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const sp = await searchParams;
  const err = sp.err || null;

  const supabase = await createClient();
  const [
    { data: controlRows },
    { data: runRows },
    { data: evidenceRows },
    { data: exceptionRows },
    { data: reviewRows },
  ] = await Promise.all([
    supabase
      .from("soc2_controls")
      .select(
        "id, key, tsc_category, tsc_refs, name, objective, owner_email, frequency, policy_key, applicability, status, next_due_at"
      )
      .in("key", AVL_KEYS)
      .order("key"),
    supabase
      .from("soc2_control_runs")
      .select(
        "id, control_id, fire_key, due_at, status, result, performed_by, performed_at, reviewer_email, review_result"
      ),
    supabase
      .from("soc2_evidence_items")
      .select("id, control_id, control_run_id, source, capture_date, review_result, classification"),
    supabase
      .from("soc2_exceptions")
      .select(
        "id, ref, control_id, rule_key, fire_key, title, detail, severity, status, owner_email, due_at, detected_at, triaged_at"
      ),
    supabase
      .from("soc2_management_reviews")
      .select("id, held_at, attendees, summary, decisions, next_due_at, recorded_by")
      .order("held_at", { ascending: false })
      .limit(100),
  ]);
  const controls = (controlRows ?? []) as ControlRow[];
  const runs = (runRows ?? []) as ControlRunRow[];
  const evidence = (evidenceRows ?? []) as EvidenceRow[];
  const exceptions = (exceptionRows ?? []) as ExceptionRow[];
  const reviews = (reviewRows ?? []) as ManagementReviewRow[];

  const today = toDateOnly(new Date());
  const healthById = new Map<string, { health: ControlHealth; explain: string }>();
  for (const c of controls) {
    healthById.set(
      c.id,
      controlHealth({
        control: { ...c, tsc_refs: (c.tsc_refs ?? []) as string[] },
        runs: runs.filter((r) => r.control_id === c.id),
        evidence: evidence.filter((e) => e.control_id === c.id),
        exceptions: exceptions.filter((e) => e.control_id === c.id),
        today,
      })
    );
  }

  return (
    <div>
      <PageHeader
        index="12"
        label="SOC 2"
        title="Business continuity & backups"
        lead="Backup success, restore tests and continuity reviews are controls with owners and evidence, not assumptions."
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

      {/* (1) Availability controls */}
      <Reveal delay={0.05}>
        <div style={{ marginTop: 24 }}>
          <Panel label="// AVAILABILITY & CONTINUITY CONTROLS" pad={false}>
            <HeaderRow grid={GRID} cols={["Key", "Name", "Frequency", "Health", "Next due"]} />
            {controls.length === 0 && (
              <EmptyRow>
                The availability controls (AVL-01 – AVL-06) are not installed yet — seed the
                programme from{" "}
                <Link href="/admin/soc2/settings" style={{ color: "var(--k-accent)" }}>
                  Settings
                </Link>
                .
              </EmptyRow>
            )}
            {controls.map((c, i) => {
              const h = healthById.get(c.id)!;
              return (
                <Link
                  key={c.id}
                  href={`/admin/soc2/controls/${c.id}`}
                  className="grid md:grid gap-3 items-center px-4 py-2.5"
                  style={{
                    gridTemplateColumns: GRID,
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                    textDecoration: "none",
                  }}
                >
                  <span style={{ fontFamily: T.mono, fontSize: "0.75rem", color: "var(--k-fg)" }}>
                    {c.key}
                  </span>
                  <span
                    className="min-w-0"
                    style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-fg)" }}
                  >
                    {c.name}
                  </span>
                  <span style={faintMono}>{c.frequency.replace(/_/g, " ")}</span>
                  <span className="flex flex-col items-start gap-1 min-w-0">
                    <StatusChip tone={HEALTH_TONE[h.health]}>
                      {h.health.replace(/_/g, " ")}
                    </StatusChip>
                    <span style={{ ...faintMono, whiteSpace: "normal" }}>{h.explain}</span>
                  </span>
                  <span style={faintMono}>{shortDate(c.next_due_at)}</span>
                </Link>
              );
            })}
          </Panel>
        </div>
      </Reveal>

      {/* (2) Backup review */}
      <Reveal delay={0.1}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// RECORD BACKUP REVIEW" title="Backup success reviewed (AVL-02)">
            <CheckForm
              action={recordBackupReview}
              noun="backup review"
              note="Collects evidence against AVL-02, completes its open run if one exists, and a fail raises a high-severity exception for triage."
            />
          </Panel>
        </div>
      </Reveal>

      {/* (3) Restore test */}
      <Reveal delay={0.14}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// RECORD RESTORE TEST" title="Restore test performed (AVL-03)">
            <CheckForm
              action={recordRestoreTest}
              noun="restore test"
              note="A restore is tested and recorded, not assumed. Collects evidence against AVL-03; a fail raises a high-severity exception."
            />
          </Panel>
        </div>
      </Reveal>

      {/* (4) Service health check */}
      <Reveal delay={0.18}>
        <div style={{ marginTop: 18 }}>
          <Panel
            label="// RECORD SERVICE HEALTH CHECK"
            title="Availability monitoring (AVL-06)"
          >
            <CheckForm
              action={recordServiceHealthCheck}
              noun="service health check"
              note="Collects evidence against AVL-06 from the monitoring in place; a fail raises a high-severity exception."
            />
          </Panel>
        </div>
      </Reveal>

      {/* (5) Management reviews */}
      <Reveal delay={0.22}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// MANAGEMENT REVIEWS" pad={false}>
            <HeaderRow
              grid={MR_GRID}
              cols={["Held", "Recorded by", "Attendees", "Decisions", "Next due"]}
            />
            {reviews.length === 0 && (
              <EmptyRow>
                No management review recorded yet — record one below; it becomes GOV-06&apos;s
                evidence.
              </EmptyRow>
            )}
            {reviews.map((r, i) => {
              const decisions = Array.isArray(r.decisions) ? r.decisions : [];
              return (
                <details key={r.id}>
                  <summary
                    className="grid md:grid gap-3 items-center px-4 py-2.5"
                    style={{
                      gridTemplateColumns: MR_GRID,
                      borderTop: i ? "1px solid var(--k-border)" : "none",
                      cursor: "pointer",
                      listStyle: "none",
                    }}
                  >
                    <span style={faintMono}>{shortDate(r.held_at)}</span>
                    <span
                      className="min-w-0"
                      style={{ ...faintMono, overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      {r.recorded_by ?? "—"}
                    </span>
                    <span
                      className="min-w-0"
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.85rem",
                        color: "var(--k-fg)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={r.attendees}
                    >
                      {r.attendees}
                    </span>
                    <span style={faintMono}>
                      {decisions.length} decision{decisions.length === 1 ? "" : "s"}
                    </span>
                    <span style={faintMono}>{shortDate(r.next_due_at)}</span>
                  </summary>
                  <div
                    className="flex flex-col gap-3 px-4 py-4"
                    style={{ borderTop: "1px dashed var(--k-border)", background: "var(--k-bg)" }}
                  >
                    <p style={bodyText}>{r.summary || "No summary recorded."}</p>
                    {decisions.length > 0 && (
                      <ul className="flex flex-col gap-1.5" style={{ paddingLeft: 18 }}>
                        {decisions.map((d, di) => (
                          <li key={di} style={{ ...bodyText, listStyleType: "square" }}>
                            {d.decision ?? "—"}
                            {(d.owner || d.due) && (
                              <span style={{ ...faintMono, marginLeft: 8 }}>
                                {d.owner ?? ""}
                                {d.owner && d.due ? " · " : ""}
                                {d.due ? `due ${shortDate(d.due)}` : ""}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              );
            })}

            <form
              action={recordManagementReview}
              className="flex flex-col gap-3 px-4 py-4"
              style={{ borderTop: "1px solid var(--k-border)" }}
            >
              <div className="flex flex-wrap gap-3">
                <Field label="Held on">
                  <input type="date" name="held_at" style={inp} defaultValue={today} required />
                </Field>
                <Field label="Attendees" grow>
                  <input
                    name="attendees"
                    style={inp}
                    required
                    maxLength={300}
                    placeholder="Who took part in the review"
                  />
                </Field>
                <Field label="Next review due">
                  <input type="date" name="next_due_at" style={inp} />
                </Field>
              </div>
              <Field label="Summary">
                <textarea
                  name="summary"
                  style={textarea}
                  maxLength={2000}
                  placeholder="What was looked at: readiness, risks, incidents, open exceptions"
                />
              </Field>
              <Field label="Decisions (one per line)">
                <textarea
                  name="decisions"
                  style={textarea}
                  maxLength={2000}
                  placeholder={"One decision per line, e.g.\nRe-run the restore test against the reporting database"}
                />
              </Field>
              <div className="flex items-center gap-3 flex-wrap">
                <SubmitButton style={primaryBtn}>Record management review</SubmitButton>
                <span style={faintMono}>
                  Programme Owner only. Recording the review collects GOV-06&apos;s evidence and
                  completes its open run.
                </span>
              </div>
            </form>
          </Panel>
        </div>
      </Reveal>
    </div>
  );
}
