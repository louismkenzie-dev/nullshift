import Link from "next/link";
import type { CSSProperties } from "react";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireSoc2, WRITE_ROLES, programmeOwnerEmails } from "@/lib/soc2/guard";
import { routeAlert } from "@/lib/soc2/rules";
import { sendExceptionAlert } from "@/lib/soc2/sweep";
import { logSoc2Event } from "@/lib/soc2/events";
import type { ExceptionSeverity, ExceptionStatus } from "@/lib/soc2/types";
import { OPEN_EXCEPTION_STATUSES } from "@/lib/soc2/types";
import { SEVERITY_TONE, EXCEPTION_STATUS_TONE, EXCEPTION_STATUS_LABEL } from "@/lib/soc2/ui";
import { inp, textarea, primaryBtn, Field, shortDate, EmptyRow, HeaderRow, faintMono } from "../shared";
import { addDays, toDateOnly } from "@/lib/soc2/schedule";

/**
 * Exceptions & alerts — the queue the rules engine (and people) feed. An
 * exception states that a configured control may not have been performed, may
 * have failed, or needs review; it is never a declaration of non-compliance.
 * Detected rows come from the daily sweep with severity-routed alerts;
 * declared rows come from the form here. Closure always happens on the detail
 * page, where the two-person gate (owner remediation + independent reviewer
 * verification) is enforced by the database.
 */

export const dynamic = "force-dynamic";

type ExceptionListRow = {
  id: string;
  ref: string;
  rule_key: string | null;
  title: string;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  source: string;
  owner_email: string | null;
  due_at: string | null;
  detected_at: string;
  control_id: string | null;
};
type ControlRef = { id: string; key: string; name: string };

const SEVERITIES: ExceptionSeverity[] = ["critical", "high", "medium", "low"];

// ── server actions ─────────────────────────────────────────────

async function declareException(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;
  const title = String(formData.get("title") || "").trim();
  const detail = String(formData.get("detail") || "").trim();
  const severityRaw = String(formData.get("severity") || "");
  const severityRationale = String(formData.get("severity_rationale") || "").trim();
  const controlId = String(formData.get("control_id") || "");
  const recommended = String(formData.get("recommended_action") || "").trim();
  if (!title || !(SEVERITIES as string[]).includes(severityRaw)) return;
  const severity = severityRaw as ExceptionSeverity;

  const db = createServiceClient();
  const { data: ref } = await db.rpc("next_soc2_exception_ref");
  if (!ref) return;
  const today = toDateOnly(new Date());
  const dueDays = severity === "critical" ? 2 : severity === "high" ? 7 : severity === "medium" ? 30 : 60;
  const { data: created, error } = await db
    .from("soc2_exceptions")
    .insert({
      ref,
      control_id: controlId || null,
      rule_key: null,
      title,
      detail: detail || null,
      severity,
      severity_rationale: severityRationale || null,
      status: "triage_required",
      source: "manual",
      trigger_ref: `declared:${guard.email}`,
      owner_email: guard.email,
      due_at: addDays(today, dueDays),
      recommended_action: recommended || null,
    })
    .select("id, ref")
    .single();
  if (error || !created) return;
  await logSoc2Event({
    recordType: "exception",
    recordId: created.id,
    type: "declared",
    summary: `${created.ref} declared (${severity}): ${title.slice(0, 120)}`,
    actor: guard.email,
  });
  // Declared exceptions follow the same severity routing as detected ones:
  // critical/high alert immediately, medium/low queue.
  let controlOwner: string | null = null;
  if (controlId) {
    const { data: control } = await db
      .from("soc2_controls")
      .select("owner_email")
      .eq("id", controlId)
      .maybeSingle();
    controlOwner = control?.owner_email ?? null;
  }
  const route = routeAlert(severity, {
    programmeOwners: await programmeOwnerEmails(),
    controlOwner,
  });
  if (route.notifyNow.length > 0) {
    await sendExceptionAlert(route.notifyNow, {
      ref: created.ref,
      title,
      severity,
      recommendedAction: recommended || "Triage under Exceptions.",
      incidentCandidate: route.incidentCandidate,
    });
  }
  revalidatePath("/admin/soc2/exceptions");
}

// ── page ───────────────────────────────────────────────────────

const GRID = "90px 90px 1.8fr 150px 120px 110px 110px";

export default async function ExceptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; severity?: string; show?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: rows }, { data: controls }] = await Promise.all([
    supabase
      .from("soc2_exceptions")
      .select("id, ref, rule_key, title, severity, status, source, owner_email, due_at, detected_at, control_id")
      .order("detected_at", { ascending: false })
      .limit(400),
    supabase.from("soc2_controls").select("id, key, name").order("key"),
  ]);
  const all = (rows ?? []) as ExceptionListRow[];
  const controlList = (controls ?? []) as ControlRef[];
  const controlById = new Map(controlList.map((c) => [c.id, c]));
  const today = toDateOnly(new Date());

  const showClosed = params.show === "all";
  let list = showClosed ? all : all.filter((e) => OPEN_EXCEPTION_STATUSES.includes(e.status));
  if (params.severity) list = list.filter((e) => e.severity === params.severity);
  if (params.status) list = list.filter((e) => e.status === params.status);

  const open = all.filter((e) => OPEN_EXCEPTION_STATUSES.includes(e.status));
  const overdue = open.filter((e) => e.due_at && e.due_at < today);
  const awaitingVerification = open.filter((e) => e.status === "resolved_pending_verification");

  const qs = (patch: Record<string, string | undefined>) => {
    const merged = { ...params, ...patch };
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    const s = sp.toString();
    return `/admin/soc2/exceptions${s ? `?${s}` : ""}`;
  };

  const chip = (active: boolean): CSSProperties => ({
    fontFamily: T.mono,
    fontSize: "10px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding: "5px 9px",
    border: `1px solid ${active ? "var(--k-accent)" : "var(--k-border)"}`,
    color: active ? "var(--k-accent)" : "var(--k-muted)",
    whiteSpace: "nowrap",
  });

  return (
    <div>
      <PageHeader
        index="12"
        label="SOC 2"
        title="Exceptions & alerts"
        lead="A configured control may not have been performed, may have failed, or needs review. Triage, remediate, evidence, verify — the database refuses closure without owner remediation and independent verification."
      />

      <Reveal delay={0.04}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginTop: 22 }}>
          <StatCard value={String(open.length)} label="Open exceptions" />
          <StatCard
            value={String(open.filter((e) => e.severity === "critical" || e.severity === "high").length)}
            label="Critical / high"
          />
          <StatCard value={String(overdue.length)} label="Past due date" />
          <StatCard
            value={String(awaitingVerification.length)}
            label="Awaiting verification"
            sub={awaitingVerification.length ? "Needs a reviewer other than the resolver." : undefined}
          />
        </div>
      </Reveal>

      {/* Filters */}
      <Reveal delay={0.06}>
        <div className="flex flex-wrap gap-1.5" style={{ marginTop: 18 }}>
          <Link href={qs({ severity: undefined, status: undefined, show: undefined })} style={chip(!params.severity && !params.status && !showClosed)}>
            Open
          </Link>
          {SEVERITIES.map((s) => (
            <Link key={s} href={qs({ severity: params.severity === s ? undefined : s })} style={chip(params.severity === s)}>
              {s}
            </Link>
          ))}
          <Link
            href={qs({ status: params.status === "resolved_pending_verification" ? undefined : "resolved_pending_verification" })}
            style={chip(params.status === "resolved_pending_verification")}
          >
            pending verification
          </Link>
          <Link href={qs({ show: showClosed ? undefined : "all" })} style={chip(showClosed)}>
            include closed
          </Link>
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <div style={{ marginTop: 14 }}>
          <Panel label="// EXCEPTION QUEUE" pad={false}>
            {list.length === 0 ? (
              <EmptyRow>
                Nothing here under this filter. The daily sweep raises detected exceptions; declare
                one below if you have observed a gap yourself.
              </EmptyRow>
            ) : (
              <div className="flex flex-col">
                <HeaderRow grid={GRID} cols={["ref", "severity", "title", "status", "control", "owner", "due"]} />
                {list.map((e, i) => {
                  const control = e.control_id ? controlById.get(e.control_id) : undefined;
                  const isOverdue = e.due_at && e.due_at < today && OPEN_EXCEPTION_STATUSES.includes(e.status);
                  return (
                    <Link
                      key={e.id}
                      href={`/admin/soc2/exceptions/${e.id}`}
                      className="grid gap-3 items-center px-4 py-2.5 hover:bg-[var(--k-bg)]"
                      style={{ gridTemplateColumns: GRID, borderTop: i ? "1px solid var(--k-border)" : "none" }}
                    >
                      <span style={{ fontFamily: T.mono, fontSize: "10px", color: "var(--k-faint)" }}>{e.ref}</span>
                      <StatusChip tone={SEVERITY_TONE[e.severity]}>{e.severity}</StatusChip>
                      <span
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.84rem",
                          color: "var(--k-fg)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={e.title}
                      >
                        {e.title}
                      </span>
                      <StatusChip tone={EXCEPTION_STATUS_TONE[e.status]}>
                        {EXCEPTION_STATUS_LABEL[e.status]}
                      </StatusChip>
                      <span style={{ fontFamily: T.mono, fontSize: "10px", color: "var(--k-muted)" }}>
                        {control?.key ?? "—"}
                      </span>
                      <span style={{ ...faintMono, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {e.owner_email ?? "unassigned"}
                      </span>
                      <span style={{ ...faintMono, color: isOverdue ? T.danger : "var(--k-faint)" }}>
                        {e.due_at ? shortDate(e.due_at) : "—"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </Reveal>

      {/* Declare an exception */}
      <Reveal delay={0.1}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// DECLARE AN EXCEPTION" title="Observed a gap the rules did not catch?">
            <form action={declareException} className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-3">
                <Field label="Title" grow>
                  <input name="title" style={inp} required maxLength={200} placeholder="What may not have operated as configured?" />
                </Field>
                <Field label="Severity">
                  <select name="severity" style={inp} defaultValue="medium">
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Related control">
                  <select name="control_id" style={inp} defaultValue="">
                    <option value="">— none —</option>
                    {controlList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.key} — {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Detail (references only — never paste secrets or client personal data)">
                <textarea name="detail" style={textarea} maxLength={2000} />
              </Field>
              <div className="flex flex-wrap gap-3">
                <Field label="Severity rationale" grow>
                  <input name="severity_rationale" style={inp} maxLength={300} />
                </Field>
                <Field label="Recommended action" grow>
                  <input name="recommended_action" style={inp} maxLength={300} />
                </Field>
              </div>
              <div>
                <SubmitButton style={primaryBtn}>Declare exception</SubmitButton>
              </div>
            </form>
          </Panel>
        </div>
      </Reveal>
    </div>
  );
}
