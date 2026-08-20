import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireSoc2, WRITE_ROLES } from "@/lib/soc2/guard";
import { logSoc2Event } from "@/lib/soc2/events";
import type { ExceptionSeverity } from "@/lib/soc2/types";
import { SEVERITY_TONE, INCIDENT_STATUS_TONE, type ChipTone } from "@/lib/soc2/ui";
import { addDays, toDateOnly } from "@/lib/soc2/schedule";
import {
  inp,
  textarea,
  primaryBtn,
  actionBtn,
  dangerBtn,
  Field,
  shortDate,
  EmptyRow,
  faintMono,
  bodyText,
  monoLabel,
} from "../../shared";

/**
 * Incident detail — one incident's whole life: facts and acknowledgement, the
 * append-only timeline (detection → assessment → containment → investigation →
 * recovery → communication → review), containment and impact summaries, the
 * human notification decision, and resolution. Closing requires a completed
 * post-incident review with lessons learned; every material act is written to
 * the timeline and the domain trail. Nothing here concludes legal or
 * contractual duties — a named person records that decision.
 */

export const dynamic = "force-dynamic";

type IncidentClassification =
  | "security"
  | "availability"
  | "confidentiality"
  | "integrity"
  | "privacy_adjacent";
type IncidentStatus = "open" | "contained" | "recovering" | "resolved" | "closed";
type IncidentPhase =
  | "detection"
  | "assessment"
  | "containment"
  | "investigation"
  | "recovery"
  | "communication"
  | "review"
  | "note";
type NotificationDecision =
  | "undecided"
  | "not_required"
  | "specialist_advice_needed"
  | "clients_notified"
  | "regulator_and_clients_notified";

type IncidentFull = {
  id: string;
  ref: string;
  title: string;
  classification: IncidentClassification;
  severity: ExceptionSeverity;
  status: IncidentStatus;
  detected_at: string;
  reported_by: string | null;
  owner_email: string | null;
  acknowledged_at: string | null;
  impact_summary: string | null;
  containment_summary: string | null;
  notification_decision: NotificationDecision;
  notification_note: string | null;
  affected: Record<string, string[]>;
  lessons_learned: string | null;
  post_review_due_at: string | null;
  post_review_done_at: string | null;
  post_review_by: string | null;
};
type TimelineRow = {
  id: string;
  at: string;
  phase: IncidentPhase;
  entry: string;
  actor: string | null;
};

const PHASES: IncidentPhase[] = [
  "detection",
  "assessment",
  "containment",
  "investigation",
  "recovery",
  "communication",
  "review",
  "note",
];
const PHASE_TONE: Record<IncidentPhase, ChipTone> = {
  detection: "danger",
  assessment: "warning",
  containment: "warning",
  investigation: "accent",
  recovery: "accent",
  communication: "accent",
  review: "success",
  note: "muted",
};
const NOTIFICATION_DECISIONS: NotificationDecision[] = [
  "undecided",
  "not_required",
  "specialist_advice_needed",
  "clients_notified",
  "regulator_and_clients_notified",
];
const LIVE_STATUSES: IncidentStatus[] = ["open", "contained", "recovering"];

const pagePath = (id: string) => `/admin/soc2/incidents/${id}`;

// ── server actions ─────────────────────────────────────────────

async function acknowledgeIncident(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const id = String(formData.get("id") || "");
  if (!id) return;

  const db = createServiceClient();
  const { data: row } = await db
    .from("soc2_incidents")
    .select("id, ref, owner_email, acknowledged_at")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.acknowledged_at) return;
  const { error } = await db
    .from("soc2_incidents")
    .update({
      acknowledged_at: new Date().toISOString(),
      owner_email: row.owner_email || guard.email,
    })
    .eq("id", id);
  if (error) redirect(`${pagePath(id)}?err=${encodeURIComponent(error.message)}`);
  await db.from("soc2_incident_events").insert({
    incident_id: id,
    phase: "assessment",
    entry: "Incident acknowledged; response is owned.",
    actor: guard.email,
  });
  await logSoc2Event({
    recordType: "incident",
    recordId: id,
    type: "acknowledged",
    summary: `${row.ref} acknowledged by ${guard.email}.`,
    actor: guard.email,
  });
  revalidatePath(pagePath(id));
}

async function progressStatus(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const id = String(formData.get("id") || "");
  const next = String(formData.get("next_status") || "");
  if (!id || (next !== "contained" && next !== "recovering")) return;

  const db = createServiceClient();
  const { data: row } = await db
    .from("soc2_incidents")
    .select("id, ref, status")
    .eq("id", id)
    .maybeSingle();
  if (!row) return;
  const allowedFrom: IncidentStatus[] = next === "contained" ? ["open"] : ["open", "contained"];
  if (!allowedFrom.includes(row.status as IncidentStatus)) return;
  const { error } = await db.from("soc2_incidents").update({ status: next }).eq("id", id);
  if (error) redirect(`${pagePath(id)}?err=${encodeURIComponent(error.message)}`);
  await db.from("soc2_incident_events").insert({
    incident_id: id,
    phase: next === "contained" ? "containment" : "recovery",
    entry: `Status changed to ${next}.`,
    actor: guard.email,
  });
  await logSoc2Event({
    recordType: "incident",
    recordId: id,
    type: "status.changed",
    summary: `${row.ref} moved to ${next} by ${guard.email}.`,
    detail: { from: row.status, to: next },
    actor: guard.email,
  });
  revalidatePath(pagePath(id));
}

async function addTimelineEntry(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const id = String(formData.get("id") || "");
  const phaseRaw = String(formData.get("phase") || "");
  const entry = String(formData.get("entry") || "").trim();
  if (!id || !entry || !(PHASES as string[]).includes(phaseRaw)) return;
  const phase = phaseRaw as IncidentPhase;

  const db = createServiceClient();
  const { data: row } = await db
    .from("soc2_incidents")
    .select("id, ref")
    .eq("id", id)
    .maybeSingle();
  if (!row) return;
  const { error } = await db.from("soc2_incident_events").insert({
    incident_id: id,
    phase,
    entry,
    actor: guard.email,
  });
  if (error) redirect(`${pagePath(id)}?err=${encodeURIComponent(error.message)}`);
  await logSoc2Event({
    recordType: "incident",
    recordId: id,
    type: "timeline.appended",
    summary: `${row.ref} timeline: ${phase} entry appended by ${guard.email}.`,
    actor: guard.email,
  });
  revalidatePath(pagePath(id));
}

async function updateSummaries(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const id = String(formData.get("id") || "");
  const impact = String(formData.get("impact_summary") || "").trim();
  const containment = String(formData.get("containment_summary") || "").trim();
  if (!id) return;

  const db = createServiceClient();
  const { data: row } = await db
    .from("soc2_incidents")
    .select("id, ref, status, impact_summary, containment_summary")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.status === "closed") return;
  const impactChanged = impact !== (row.impact_summary ?? "").trim();
  const containmentChanged = containment !== (row.containment_summary ?? "").trim();
  if (!impactChanged && !containmentChanged) return;
  const { error } = await db
    .from("soc2_incidents")
    .update({ impact_summary: impact || null, containment_summary: containment || null })
    .eq("id", id);
  if (error) redirect(`${pagePath(id)}?err=${encodeURIComponent(error.message)}`);
  if (containmentChanged) {
    await db.from("soc2_incident_events").insert({
      incident_id: id,
      phase: "containment",
      entry: "Containment summary updated.",
      actor: guard.email,
    });
  }
  await logSoc2Event({
    recordType: "incident",
    recordId: id,
    type: "summaries.updated",
    summary: `${row.ref} impact/containment summaries updated by ${guard.email}.`,
    detail: { impact_changed: impactChanged, containment_changed: containmentChanged },
    actor: guard.email,
  });
  revalidatePath(pagePath(id));
}

async function recordNotificationDecision(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const id = String(formData.get("id") || "");
  const decisionRaw = String(formData.get("notification_decision") || "");
  const note = String(formData.get("notification_note") || "").trim();
  if (!id || !(NOTIFICATION_DECISIONS as string[]).includes(decisionRaw)) return;
  const decision = decisionRaw as NotificationDecision;

  const db = createServiceClient();
  const { data: row } = await db
    .from("soc2_incidents")
    .select("id, ref, status")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.status === "closed") return;
  const { error } = await db
    .from("soc2_incidents")
    .update({ notification_decision: decision, notification_note: note || null })
    .eq("id", id);
  if (error) redirect(`${pagePath(id)}?err=${encodeURIComponent(error.message)}`);
  await db.from("soc2_incident_events").insert({
    incident_id: id,
    phase: "communication",
    entry: `Notification decision recorded as "${decision.replace(/_/g, " ")}" by ${guard.email}.`,
    actor: guard.email,
  });
  await logSoc2Event({
    recordType: "incident",
    recordId: id,
    type: "notification.decided",
    summary: `${row.ref} notification decision: ${decision.replace(/_/g, " ")} — recorded by ${guard.email}.`,
    actor: guard.email,
  });
  revalidatePath(pagePath(id));
}

async function resolveIncident(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const id = String(formData.get("id") || "");
  if (!id) return;

  const db = createServiceClient();
  const { data: row } = await db
    .from("soc2_incidents")
    .select("id, ref, status")
    .eq("id", id)
    .maybeSingle();
  if (!row || !LIVE_STATUSES.includes(row.status as IncidentStatus)) return;
  const reviewDue = addDays(toDateOnly(new Date()), 14);
  const { error } = await db
    .from("soc2_incidents")
    .update({ status: "resolved", post_review_due_at: reviewDue })
    .eq("id", id);
  if (error) redirect(`${pagePath(id)}?err=${encodeURIComponent(error.message)}`);
  await db.from("soc2_incident_events").insert({
    incident_id: id,
    phase: "recovery",
    entry: `Status changed to resolved. Post-incident review due ${reviewDue}.`,
    actor: guard.email,
  });
  await logSoc2Event({
    recordType: "incident",
    recordId: id,
    type: "status.changed",
    summary: `${row.ref} resolved by ${guard.email}; post-incident review due ${reviewDue}.`,
    detail: { from: row.status, to: "resolved", post_review_due_at: reviewDue },
    actor: guard.email,
  });
  revalidatePath(pagePath(id));
}

async function completePostReview(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const id = String(formData.get("id") || "");
  const lessons = String(formData.get("lessons_learned") || "").trim();
  if (!id || !lessons) return;

  const db = createServiceClient();
  const { data: row } = await db
    .from("soc2_incidents")
    .select("id, ref, post_review_done_at")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.post_review_done_at) return;
  const { error } = await db
    .from("soc2_incidents")
    .update({
      lessons_learned: lessons,
      post_review_by: guard.email,
      post_review_done_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) redirect(`${pagePath(id)}?err=${encodeURIComponent(error.message)}`);
  await db.from("soc2_incident_events").insert({
    incident_id: id,
    phase: "review",
    entry: "Post-incident review completed; lessons learned recorded.",
    actor: guard.email,
  });
  await logSoc2Event({
    recordType: "incident",
    recordId: id,
    type: "post_review.completed",
    summary: `${row.ref} post-incident review completed by ${guard.email}.`,
    actor: guard.email,
  });
  revalidatePath(pagePath(id));
}

async function closeIncident(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const id = String(formData.get("id") || "");
  const confirm = String(formData.get("confirm") || "");
  if (!id || confirm !== "CLOSE") return;

  const db = createServiceClient();
  const { data: row } = await db
    .from("soc2_incidents")
    .select("id, ref, status, post_review_done_at, lessons_learned")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.status === "closed") return;
  if (!row.post_review_done_at || !(row.lessons_learned ?? "").trim()) {
    redirect(
      `${pagePath(id)}?err=${encodeURIComponent("Close needs a completed post-incident review with lessons learned")}`
    );
  }
  const { error } = await db.from("soc2_incidents").update({ status: "closed" }).eq("id", id);
  if (error) redirect(`${pagePath(id)}?err=${encodeURIComponent(error.message)}`);
  await db.from("soc2_incident_events").insert({
    incident_id: id,
    phase: "review",
    entry: "Incident closed.",
    actor: guard.email,
  });
  await logSoc2Event({
    recordType: "incident",
    recordId: id,
    type: "closed",
    summary: `${row.ref} closed by ${guard.email} after completed post-incident review.`,
    detail: { from: row.status, to: "closed" },
    actor: guard.email,
  });
  revalidatePath(pagePath(id));
}

// ── page ───────────────────────────────────────────────────────

export default async function IncidentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { id } = await params;
  const { err } = await searchParams;
  const supabase = await createClient();
  const [{ data: row }, { data: events }] = await Promise.all([
    supabase.from("soc2_incidents").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("soc2_incident_events")
      .select("id, at, phase, entry, actor")
      .eq("incident_id", id)
      .order("at", { ascending: true }),
  ]);
  if (!row) notFound();
  const inc = row as IncidentFull;
  const timeline = (events ?? []) as TimelineRow[];
  const live = LIVE_STATUSES.includes(inc.status);
  const today = toDateOnly(new Date());
  const reviewOverdue =
    !!inc.post_review_due_at && inc.post_review_due_at < today && !inc.post_review_done_at;
  const affectedEntries = Object.entries(inc.affected ?? {}).filter(
    ([, v]) => (v ?? []).length > 0
  );

  return (
    <div>
      <PageHeader
        index="12"
        label="SOC 2"
        title={inc.ref}
        lead={inc.title}
        actions={
          <div className="flex items-center gap-2">
            <StatusChip tone={SEVERITY_TONE[inc.severity]}>{inc.severity}</StatusChip>
            <StatusChip tone={INCIDENT_STATUS_TONE[inc.status] ?? "muted"}>{inc.status}</StatusChip>
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

      {/* (1) Facts */}
      <Reveal delay={0.04}>
        <div style={{ marginTop: 22 }}>
          <Panel label="// FACTS">
            <div className="flex flex-col gap-2.5">
              <p style={faintMono}>
                {inc.classification.replace(/_/g, " ")} · detected {shortDate(inc.detected_at)} ·
                reported by {inc.reported_by ?? "—"} · owner {inc.owner_email ?? "unassigned"}
              </p>
              <p style={bodyText}>
                <span style={monoLabel}>acknowledged · </span>
                {inc.acknowledged_at ? shortDate(inc.acknowledged_at) : "not yet"}
              </p>
              {affectedEntries.length > 0 && (
                <div>
                  <span style={monoLabel}>affected</span>
                  <p style={{ ...faintMono, marginTop: 4 }}>
                    {affectedEntries
                      .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
                      .join(" · ")}
                  </p>
                </div>
              )}
              {!inc.acknowledged_at && (
                <form action={acknowledgeIncident}>
                  <input type="hidden" name="id" value={inc.id} />
                  <SubmitButton
                    style={
                      inc.severity === "critical" || inc.severity === "high"
                        ? dangerBtn
                        : primaryBtn
                    }
                  >
                    Acknowledge incident
                  </SubmitButton>
                </form>
              )}
              {live && (
                <div
                  className="flex flex-wrap items-center gap-2"
                  style={{ borderTop: "1px solid var(--k-border)", marginTop: 8, paddingTop: 12 }}
                >
                  <span style={faintMono}>working status —</span>
                  {inc.status === "open" && (
                    <form action={progressStatus}>
                      <input type="hidden" name="id" value={inc.id} />
                      <input type="hidden" name="next_status" value="contained" />
                      <SubmitButton style={actionBtn}>Mark contained</SubmitButton>
                    </form>
                  )}
                  {(inc.status === "open" || inc.status === "contained") && (
                    <form action={progressStatus}>
                      <input type="hidden" name="id" value={inc.id} />
                      <input type="hidden" name="next_status" value="recovering" />
                      <SubmitButton style={actionBtn}>Mark recovering</SubmitButton>
                    </form>
                  )}
                </div>
              )}
            </div>
          </Panel>
        </div>
      </Reveal>

      {/* (2) Timeline — append-only */}
      <Reveal delay={0.06}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// TIMELINE (APPEND-ONLY)" pad={false}>
            {timeline.length === 0 ? (
              <EmptyRow>No timeline entries yet — the record starts at detection.</EmptyRow>
            ) : (
              <div className="flex flex-col">
                {timeline.map((ev, i) => (
                  <div
                    key={ev.id}
                    className="flex flex-wrap items-baseline gap-3 px-4 py-2.5"
                    style={{ borderTop: i ? "1px solid var(--k-border)" : "none" }}
                  >
                    <span style={{ ...faintMono, whiteSpace: "nowrap" }}>
                      {new Date(ev.at).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <StatusChip tone={PHASE_TONE[ev.phase] ?? "muted"}>{ev.phase}</StatusChip>
                    <span style={{ ...bodyText, flex: 1, minWidth: 200 }}>{ev.entry}</span>
                    <span style={faintMono}>{ev.actor ?? "—"}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ borderTop: "1px solid var(--k-border)", padding: 16 }}>
              <form action={addTimelineEntry} className="flex flex-col gap-3">
                <input type="hidden" name="id" value={inc.id} />
                <div className="flex flex-wrap gap-3">
                  <Field label="Phase">
                    <select name="phase" style={inp} defaultValue="note">
                      {PHASES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Entry (references only — never paste secrets or client personal data)" grow>
                    <textarea name="entry" style={textarea} required maxLength={2000} />
                  </Field>
                </div>
                <div className="flex items-center gap-3">
                  <SubmitButton style={primaryBtn}>Append entry</SubmitButton>
                  <span style={faintMono}>
                    Entries cannot be edited or deleted — corrections are new entries.
                  </span>
                </div>
              </form>
            </div>
          </Panel>
        </div>
      </Reveal>

      <div className="grid md:grid-cols-2 gap-4" style={{ marginTop: 18 }}>
        {/* (3) Containment & impact */}
        <Reveal delay={0.08}>
          <Panel label="// CONTAINMENT & IMPACT">
            <form action={updateSummaries} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={inc.id} />
              <Field label="Impact summary">
                <textarea
                  name="impact_summary"
                  style={textarea}
                  defaultValue={inc.impact_summary ?? ""}
                  maxLength={4000}
                />
              </Field>
              <Field label="Containment summary (what was done to stop it spreading)">
                <textarea
                  name="containment_summary"
                  style={textarea}
                  defaultValue={inc.containment_summary ?? ""}
                  maxLength={4000}
                />
              </Field>
              <div className="flex items-center gap-3">
                <SubmitButton style={primaryBtn}>Save summaries</SubmitButton>
                <span style={faintMono}>
                  A containment change also writes a containment entry to the timeline.
                </span>
              </div>
            </form>
          </Panel>
        </Reveal>

        {/* (4) Notification decision */}
        <Reveal delay={0.1}>
          <Panel label="// NOTIFICATION DECISION">
            <div className="flex flex-col gap-3">
              <p style={bodyText}>
                Whether client, regulator or contractual notification duties arise is a named human
                decision. Where the position is unclear, take specialist legal advice before
                concluding — the system records the decision and never makes it.
              </p>
              <p style={faintMono}>
                current: {inc.notification_decision.replace(/_/g, " ")}
                {inc.notification_note ? ` — ${inc.notification_note}` : ""}
              </p>
              <form action={recordNotificationDecision} className="flex flex-col gap-3">
                <input type="hidden" name="id" value={inc.id} />
                <Field label="Decision">
                  <select
                    name="notification_decision"
                    style={inp}
                    defaultValue={inc.notification_decision}
                  >
                    {NOTIFICATION_DECISIONS.map((d) => (
                      <option key={d} value={d}>
                        {d.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Decision note (basis, who decided, advice taken)">
                  <textarea
                    name="notification_note"
                    style={textarea}
                    defaultValue={inc.notification_note ?? ""}
                    maxLength={2000}
                  />
                </Field>
                <div>
                  <SubmitButton style={primaryBtn}>Record decision</SubmitButton>
                </div>
              </form>
            </div>
          </Panel>
        </Reveal>
      </div>

      {/* (5) Resolution */}
      <Reveal delay={0.12}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// RESOLUTION" title="Resolve, review, close">
            <div className="flex flex-col gap-4">
              {live && (
                <form action={resolveIncident} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="id" value={inc.id} />
                  <SubmitButton style={primaryBtn}>Mark resolved</SubmitButton>
                  <span style={faintMono}>
                    Resolving sets a post-incident review due 14 days out. Closing requires that
                    review, with lessons learned.
                  </span>
                </form>
              )}

              {inc.post_review_due_at && (
                <p style={{ ...faintMono, color: reviewOverdue ? T.danger : "var(--k-faint)" }}>
                  post-incident review due {shortDate(inc.post_review_due_at)}
                  {reviewOverdue ? " — overdue" : ""}
                </p>
              )}

              {inc.post_review_done_at ? (
                <div className="flex flex-col gap-1.5">
                  <p style={bodyText}>
                    <span style={monoLabel}>post-incident review · </span>
                    completed {shortDate(inc.post_review_done_at)} by {inc.post_review_by ?? "—"}
                  </p>
                  {inc.lessons_learned && (
                    <p style={bodyText}>
                      <span style={monoLabel}>lessons learned · </span>
                      {inc.lessons_learned}
                    </p>
                  )}
                </div>
              ) : (
                !live && (
                  <form
                    action={completePostReview}
                    className="flex flex-col gap-3"
                    style={{ borderTop: "1px solid var(--k-border)", paddingTop: 14 }}
                  >
                    <input type="hidden" name="id" value={inc.id} />
                    <Field label="Lessons learned (required — what changes because this happened?)">
                      <textarea name="lessons_learned" style={textarea} required maxLength={4000} />
                    </Field>
                    <div>
                      <SubmitButton style={primaryBtn}>Complete post-incident review</SubmitButton>
                    </div>
                  </form>
                )
              )}

              {inc.status !== "closed" && !live && (
                <form
                  action={closeIncident}
                  className="flex flex-wrap items-center gap-3"
                  style={{ borderTop: "1px solid var(--k-border)", paddingTop: 14 }}
                >
                  <input type="hidden" name="id" value={inc.id} />
                  <input name="confirm" style={{ ...inp, width: 110 }} placeholder="CLOSE" />
                  <SubmitButton style={dangerBtn}>Close incident</SubmitButton>
                  <span style={faintMono}>
                    Type CLOSE to confirm. Refused until the post-incident review is completed with
                    lessons learned.
                  </span>
                </form>
              )}

              {inc.status === "closed" && (
                <p style={faintMono}>
                  Closed. The timeline above remains the permanent record of this incident.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </Reveal>
    </div>
  );
}
