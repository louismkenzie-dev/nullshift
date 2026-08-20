import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireSoc2, WRITE_ROLES } from "@/lib/soc2/guard";
import { logSoc2Event } from "@/lib/soc2/events";
import type { ExceptionSeverity } from "@/lib/soc2/types";
import { SEVERITY_TONE, INCIDENT_STATUS_TONE } from "@/lib/soc2/ui";
import { toDateOnly } from "@/lib/soc2/schedule";
import {
  inp,
  textarea,
  primaryBtn,
  Field,
  shortDate,
  EmptyRow,
  HeaderRow,
  faintMono,
} from "../shared";

/**
 * Security incidents — the register of security, availability, confidentiality,
 * integrity and privacy-adjacent incidents. Each incident carries a severity,
 * an owner, an acknowledgement, and an append-only timeline (detection →
 * assessment → containment → investigation → recovery → communication →
 * review). Recording one here is an internal operational record, not a legal
 * conclusion: notification duties are decided by a named human on the detail
 * page, and closure requires a completed post-incident review with lessons
 * learned.
 */

export const dynamic = "force-dynamic";

type IncidentClassification =
  | "security"
  | "availability"
  | "confidentiality"
  | "integrity"
  | "privacy_adjacent";
type IncidentStatus = "open" | "contained" | "recovering" | "resolved" | "closed";

type IncidentListRow = {
  id: string;
  ref: string;
  title: string;
  classification: IncidentClassification;
  severity: ExceptionSeverity;
  status: IncidentStatus;
  detected_at: string;
  owner_email: string | null;
  acknowledged_at: string | null;
  post_review_due_at: string | null;
  post_review_done_at: string | null;
};

const SEVERITIES: ExceptionSeverity[] = ["critical", "high", "medium", "low"];
const CLASSIFICATIONS: IncidentClassification[] = [
  "security",
  "availability",
  "confidentiality",
  "integrity",
  "privacy_adjacent",
];
const LIVE_STATUSES: IncidentStatus[] = ["open", "contained", "recovering"];

// ── server actions ─────────────────────────────────────────────

async function reportIncident(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const title = String(formData.get("title") || "").trim();
  const classificationRaw = String(formData.get("classification") || "");
  const severityRaw = String(formData.get("severity") || "");
  const impact = String(formData.get("impact_summary") || "").trim();
  const owner = String(formData.get("owner_email") || "").trim() || guard.email;
  if (
    !title ||
    !(CLASSIFICATIONS as string[]).includes(classificationRaw) ||
    !(SEVERITIES as string[]).includes(severityRaw)
  )
    return;
  const classification = classificationRaw as IncidentClassification;
  const severity = severityRaw as ExceptionSeverity;

  const db = createServiceClient();
  const { data: ref } = await db.rpc("next_soc2_incident_ref");
  if (!ref) return;
  const { data: created, error } = await db
    .from("soc2_incidents")
    .insert({
      ref,
      title,
      classification,
      severity,
      reported_by: guard.email,
      owner_email: owner,
      impact_summary: impact || null,
    })
    .select("id, ref")
    .single();
  if (error || !created) return;
  await db.from("soc2_incident_events").insert({
    incident_id: created.id,
    phase: "detection",
    entry: "Incident recorded.",
    actor: guard.email,
  });
  await logSoc2Event({
    recordType: "incident",
    recordId: created.id,
    type: "created",
    summary: `${created.ref} recorded (${severity} ${classification.replace(/_/g, " ")}): ${title.slice(0, 120)}`,
    detail: { owner },
    actor: guard.email,
  });
  revalidatePath("/admin/soc2/incidents");
}

// ── page ───────────────────────────────────────────────────────

const GRID = "84px 92px 1.6fr 125px 110px 100px 150px 130px";

export default async function IncidentsPage() {
  const supabase = await createClient();
  const [{ data: rows }] = await Promise.all([
    supabase
      .from("soc2_incidents")
      .select(
        "id, ref, title, classification, severity, status, detected_at, owner_email, acknowledged_at, post_review_due_at, post_review_done_at"
      )
      .order("detected_at", { ascending: false })
      .limit(400),
  ]);
  const incidents = (rows ?? []) as IncidentListRow[];
  const today = toDateOnly(new Date());

  const live = incidents.filter((i) => LIVE_STATUSES.includes(i.status));
  const liveSevere = live.filter((i) => i.severity === "critical" || i.severity === "high");
  const reviewsOverdue = incidents.filter(
    (i) => i.post_review_due_at && i.post_review_due_at < today && !i.post_review_done_at
  );

  return (
    <div>
      <PageHeader
        index="12"
        label="SOC 2"
        title="Security incidents"
        lead="Record, work and close security incidents — severity, ownership, containment and an append-only timeline of who did what, when. Notification duties are decided by a named human on each record; closure needs a completed post-incident review."
      />

      <Reveal delay={0.04}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3" style={{ marginTop: 22 }}>
          <StatCard value={String(live.length)} label="Open incidents" />
          <StatCard
            value={String(liveSevere.length)}
            label="Critical / high open"
            sub={liveSevere.length ? "Acknowledge and contain first." : undefined}
          />
          <StatCard
            value={String(reviewsOverdue.length)}
            label="Post-reviews overdue"
            sub={reviewsOverdue.length ? "Lessons learned are still owed." : undefined}
          />
        </div>
      </Reveal>

      <Reveal delay={0.06}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// INCIDENT REGISTER" pad={false}>
            {incidents.length === 0 ? (
              <EmptyRow>
                No incidents recorded. When something happens, record it below immediately — the
                timeline starts at detection, not at tidy-up.
              </EmptyRow>
            ) : (
              <div className="flex flex-col">
                <HeaderRow
                  grid={GRID}
                  cols={["ref", "severity", "title", "class", "status", "detected", "owner", "ack"]}
                />
                {incidents.map((inc, i) => {
                  const unacknowledged =
                    (inc.severity === "critical" || inc.severity === "high") &&
                    !inc.acknowledged_at;
                  return (
                    <Link
                      key={inc.id}
                      href={`/admin/soc2/incidents/${inc.id}`}
                      className="grid gap-3 items-center px-4 py-2.5 hover:bg-[var(--k-bg)]"
                      style={{
                        gridTemplateColumns: GRID,
                        borderTop: i ? "1px solid var(--k-border)" : "none",
                      }}
                    >
                      <span style={{ fontFamily: T.mono, fontSize: "10px", color: "var(--k-faint)" }}>
                        {inc.ref}
                      </span>
                      <StatusChip tone={SEVERITY_TONE[inc.severity]}>{inc.severity}</StatusChip>
                      <span
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.84rem",
                          color: "var(--k-fg)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={inc.title}
                      >
                        {inc.title}
                      </span>
                      <span style={{ fontFamily: T.mono, fontSize: "10px", color: "var(--k-muted)" }}>
                        {inc.classification.replace(/_/g, " ")}
                      </span>
                      <StatusChip tone={INCIDENT_STATUS_TONE[inc.status] ?? "muted"}>
                        {inc.status}
                      </StatusChip>
                      <span style={faintMono}>{shortDate(inc.detected_at)}</span>
                      <span style={{ ...faintMono, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {inc.owner_email ?? "unassigned"}
                      </span>
                      {unacknowledged ? (
                        <StatusChip tone="danger">unacknowledged</StatusChip>
                      ) : (
                        <span style={faintMono}>
                          {inc.acknowledged_at ? `ack ${shortDate(inc.acknowledged_at)}` : "—"}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </Reveal>

      {/* Record an incident */}
      <Reveal delay={0.08}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// RECORD AN INCIDENT" title="Something happened — start the record">
            <form action={reportIncident} className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-3">
                <Field label="Title" grow>
                  <input
                    name="title"
                    style={inp}
                    required
                    maxLength={200}
                    placeholder="What happened, in one line?"
                  />
                </Field>
                <Field label="Classification">
                  <select name="classification" style={inp} defaultValue="security">
                    {CLASSIFICATIONS.map((c) => (
                      <option key={c} value={c}>
                        {c.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Severity">
                  <select name="severity" style={inp} defaultValue="high">
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Impact summary (references only — never paste secrets or client personal data)">
                <textarea name="impact_summary" style={textarea} maxLength={2000} />
              </Field>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Owner (defaults to you)" grow>
                  <input name="owner_email" style={inp} maxLength={200} placeholder="owner@…" />
                </Field>
                <div>
                  <SubmitButton style={primaryBtn}>Record incident</SubmitButton>
                </div>
              </div>
              <p style={faintMono}>
                Recording opens the incident with a first detection entry on its append-only
                timeline. Containment, notification decisions and the post-incident review live on
                the detail page.
              </p>
            </form>
          </Panel>
        </div>
      </Reveal>
    </div>
  );
}
