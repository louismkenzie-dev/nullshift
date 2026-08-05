import { revalidatePath } from "next/cache";
import Link from "next/link";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { currentPeriodStart } from "@/lib/carePlans";
import {
  BILLING_LABEL,
  BILLING_TONE,
  KIND_LABEL,
  OPEN_STATUSES,
  SEVERITY_META,
  SOURCE_LABEL,
  STATUS_TONE,
  dueAtFor,
  type IssueBilling,
  type IssueKind,
  type IssueRow,
  type IssueSeverity,
  type IssueSource,
  type IssueStatus,
} from "@/lib/ops/issues";

/**
 * Issue bank — the single intake for every bug, change request and question
 * from every channel. Filter by status/tenant, log new issues, and triage
 * each row inline (kind/severity/billing/status, pricing, due dates and the
 * promise ledger). Shipping a build_item issue consumes a build credit.
 */

export const dynamic = "force-dynamic";

type Tenant = { id: string; name: string };
type Project = { id: string; tenant_id: string; name: string };

const STATUS_FILTERS: IssueStatus[] = [
  "new",
  "triaged",
  "queued",
  "batched",
  "in_progress",
  "awaiting_client",
  "fixed",
  "shipped",
];
const ALL_STATUSES: IssueStatus[] = [...STATUS_FILTERS, "closed"];
const KINDS = Object.keys(KIND_LABEL) as IssueKind[];
const SEVERITIES = Object.keys(SEVERITY_META) as IssueSeverity[];
const BILLINGS = Object.keys(BILLING_LABEL) as IssueBilling[];
const SOURCES = Object.keys(SOURCE_LABEL) as IssueSource[];

const GRID = "1.9fr 90px 100px 130px 160px 130px";

// ── server actions ─────────────────────────────────────────────

async function createIssue(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const projectId = String(formData.get("project_id") || "");
  const title = String(formData.get("title") || "").trim();
  if (!projectId || !title) return;
  const description = String(formData.get("description") || "").trim() || null;
  const kindRaw = String(formData.get("kind") || "bug");
  const severityRaw = String(formData.get("severity") || "normal");
  const sourceRaw = String(formData.get("source") || "internal");
  const kind = (KINDS as string[]).includes(kindRaw) ? kindRaw : "bug";
  const severity = (SEVERITIES as string[]).includes(severityRaw) ? severityRaw : "normal";
  const source = (SOURCES as string[]).includes(sourceRaw) ? sourceRaw : "internal";
  const clientVisible = formData.get("client_visible") === "on";
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, tenant_id")
    .eq("id", projectId)
    .single();
  if (!project) return;
  const { data, error } = await supabase
    .from("issues")
    .insert({
      tenant_id: project.tenant_id,
      project_id: projectId,
      source,
      kind,
      severity,
      title,
      description,
      status: "new",
      client_visible: clientVisible,
    })
    .select("id")
    .single();
  if (!error && data) {
    await logAudit({
      action: "issue.created",
      target: `issue:${data.id}`,
      tenantId: project.tenant_id,
      metadata: { source, kind, severity },
    });
  }
  revalidatePath("/admin/issues");
}

async function triageIssue(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createClient();
  const { data: existing } = await supabase.from("issues").select("*").eq("id", id).single();
  if (!existing) return;
  const cur = existing as IssueRow;

  const kindRaw = String(formData.get("kind") || cur.kind);
  const severityRaw = String(formData.get("severity") || cur.severity);
  const billingRaw = String(formData.get("billing") || cur.billing);
  const statusRaw = String(formData.get("status") || cur.status);
  const kind = ((KINDS as string[]).includes(kindRaw) ? kindRaw : cur.kind) as IssueKind;
  const severity = ((SEVERITIES as string[]).includes(severityRaw)
    ? severityRaw
    : cur.severity) as IssueSeverity;
  const billing = ((BILLINGS as string[]).includes(billingRaw)
    ? billingRaw
    : cur.billing) as IssueBilling;
  const status = ((ALL_STATUSES as string[]).includes(statusRaw)
    ? statusRaw
    : cur.status) as IssueStatus;

  const buildItemsRaw = String(formData.get("build_items") || "").trim();
  const buildItems = buildItemsRaw ? Number(buildItemsRaw) : null;
  const quotedRaw = String(formData.get("quoted_price") || "").trim();
  const dueRaw = String(formData.get("due_at") || "").trim();
  const promised = formData.get("promised") === "on";
  const now = new Date().toISOString();

  // Due date: explicit input wins; else keep the existing one; else derive it
  // from severity when the severity has just changed.
  let dueAt = dueRaw ? new Date(dueRaw).toISOString() : cur.due_at;
  if (!dueAt && severity !== cur.severity) dueAt = dueAtFor(severity);

  const update: Record<string, unknown> = {
    kind,
    severity,
    billing,
    status,
    build_items: buildItems,
    quoted_price: quotedRaw ? Number(quotedRaw) : null,
    due_at: dueAt,
    promised_at: promised ? (cur.promised_at ?? now) : null,
    promised_note: String(formData.get("promised_note") || "").trim() || null,
    client_visible: formData.get("client_visible") === "on",
    resolution_note: String(formData.get("resolution_note") || "").trim() || null,
  };
  if (status === "fixed" || status === "shipped" || status === "closed") {
    update.resolved_at = cur.resolved_at ?? now;
  }
  await supabase.from("issues").update(update).eq("id", id);

  // A shipped build_item consumes a build credit — exactly once per issue.
  // Deliberately NOT gated on the transition into "shipped": billing is often
  // classified after the fact, and the debit must still land. The partial
  // unique index build_credit_events_one_debit_per_issue (migration 0016)
  // makes the once-per-issue guarantee hold even under concurrent saves.
  if (billing === "build_item" && (status === "shipped" || status === "fixed")) {
    const { data: prior } = await supabase
      .from("build_credit_events")
      .select("id")
      .eq("issue_id", id)
      .lt("delta", 0)
      .limit(1);
    if (!prior?.length) {
      await supabase.from("build_credit_events").insert({
        tenant_id: cur.tenant_id,
        project_id: cur.project_id,
        issue_id: id,
        period: currentPeriodStart(),
        delta: -Number(buildItems ?? cur.build_items ?? 1),
        reason: cur.title,
      });
    }
  }

  await logAudit({
    action: "issue.triaged",
    target: `issue:${id}`,
    tenantId: cur.tenant_id,
    metadata: { kind, severity, billing, status },
  });
  revalidatePath("/admin/issues");
}

async function queueIssue(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("issues").update({ status: "queued" }).eq("id", id);
  await logAudit({ action: "issue.queued", target: `issue:${id}`, tenantId });
  revalidatePath("/admin/issues");
}

async function closeIssue(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("issues")
    .update({ status: "closed", resolved_at: new Date().toISOString() })
    .eq("id", id);
  await logAudit({ action: "issue.closed", target: `issue:${id}`, tenantId });
  revalidatePath("/admin/issues");
}

// ── page ───────────────────────────────────────────────────────

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tenant?: string; project?: string }>;
}) {
  const params = await searchParams;
  const statusFilter = (ALL_STATUSES as string[]).includes(params.status ?? "")
    ? (params.status as IssueStatus)
    : null;
  const tenantFilter = params.tenant || null;
  const projectFilter = params.project || null;

  const supabase = await createClient();
  let issueQuery = supabase
    .from("issues")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (statusFilter) issueQuery = issueQuery.eq("status", statusFilter);
  if (tenantFilter) issueQuery = issueQuery.eq("tenant_id", tenantFilter);
  if (projectFilter) issueQuery = issueQuery.eq("project_id", projectFilter);

  const [{ data: issueRows }, { data: tenantRows }, { data: projectRows }] =
    await Promise.all([
      issueQuery,
      supabase.from("tenants").select("id, name").order("name"),
      supabase.from("projects").select("id, tenant_id, name").order("created_at"),
    ]);
  const issues = (issueRows ?? []) as IssueRow[];
  const tenants = (tenantRows ?? []) as Tenant[];
  const projects = (projectRows ?? []) as Project[];
  const tenantName = (id: string) => tenants.find((t) => t.id === id)?.name ?? "—";
  const projectOptions = projects
    .map((p) => ({ id: p.id, label: `${tenantName(p.tenant_id)} — ${p.name}` }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const qs = (patch: Record<string, string | null>) => {
    const merged: Record<string, string | null> = {
      status: statusFilter,
      tenant: tenantFilter,
      project: projectFilter,
      ...patch,
    };
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, v);
    const s = u.toString();
    return `/admin/issues${s ? `?${s}` : ""}`;
  };

  const nowMs = Date.now();
  const isOverdue = (i: IssueRow) =>
    Boolean(i.due_at) &&
    OPEN_STATUSES.includes(i.status) &&
    new Date(i.due_at as string).getTime() < nowMs;
  const promises = issues.filter(
    (i) => OPEN_STATUSES.includes(i.status) && i.promised_at
  );
  const openCount = issues.filter((i) => OPEN_STATUSES.includes(i.status)).length;

  const shortDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const ageDays = (iso: string) =>
    Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 864e5));

  return (
    <div>
      <PageHeader
        index="09"
        label="Ops"
        title="Issue bank"
        lead="Every bug, change and question from every channel — triaged, priced and queued for the next fix batch."
        actions={
          <span style={{ fontFamily: T.mono, fontSize: "11px", color: "var(--k-muted)" }}>
            {issues.length} shown ·{" "}
            <span style={{ color: "var(--k-accent)" }}>{openCount} open</span>
          </span>
        }
      />

      {/* ── Filter bar ──────────────────────────────────────── */}
      <Reveal className="block" delay={0.05}>
        <div className="flex flex-wrap items-center gap-2 mt-7">
          <Link href={qs({ status: null })} style={chip(!statusFilter)}>
            All
          </Link>
          {STATUS_FILTERS.map((s) => (
            <Link key={s} href={qs({ status: s })} style={chip(statusFilter === s)}>
              {s.replace(/_/g, " ")}
            </Link>
          ))}
          <form
            method="get"
            action="/admin/issues"
            className="flex flex-wrap items-center gap-2 ml-auto max-md:ml-0 max-md:w-full"
          >
            {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
            {projectFilter && <input type="hidden" name="project" value={projectFilter} />}
            <select
              name="tenant"
              defaultValue={tenantFilter ?? ""}
              className="min-w-0 max-md:flex-1"
              style={{ ...inp, maxWidth: "100%" }}
            >
              <option value="">All clients</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button style={btn("var(--k-surface)", "var(--k-fg)", true)}>Filter</button>
          </form>
        </div>
      </Reveal>

      {/* ── Quick add ───────────────────────────────────────── */}
      <Reveal className="block" delay={0.08}>
        <Panel label="// LOG ISSUE" className="mt-5">
          <form action={createIssue} className="flex items-end gap-2 flex-wrap">
            <Field label="System">
              <select
                name="project_id"
                required
                defaultValue=""
                className="max-md:w-full"
                style={{ ...inp, maxWidth: "100%" }}
              >
                <option value="" disabled>
                  Client — project…
                </option>
                {projectOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Title">
              <input
                name="title"
                required
                placeholder="What happened?"
                className="w-full md:w-[240px]"
                style={inp}
              />
            </Field>
            <Field label="Description">
              <input
                name="description"
                placeholder="Detail (optional)"
                className="w-full md:w-[260px]"
                style={inp}
              />
            </Field>
            <Field label="Kind">
              <select name="kind" defaultValue="bug" className="max-md:w-full" style={inp}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Severity">
              <select name="severity" defaultValue="normal" className="max-md:w-full" style={inp}>
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {SEVERITY_META[s].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Source">
              <select name="source" defaultValue="internal" className="max-md:w-full" style={inp}>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-2" style={{ ...check, height: 36 }}>
              <input type="checkbox" name="client_visible" defaultChecked />
              Client visible
            </label>
            <SubmitButton style={btn("var(--k-accent)", "var(--k-on-accent)")}>
              Log issue
            </SubmitButton>
          </form>
        </Panel>
      </Reveal>

      {/* ── Promise ledger ──────────────────────────────────── */}
      {promises.length > 0 && (
        <Reveal className="block" delay={0.1}>
          <Panel label="// PROMISES" pad={false} className="mt-5">
            {promises.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-4 flex-wrap"
                style={{
                  padding: "11px 18px",
                  borderTop: i ? "1px solid var(--k-border)" : "none",
                }}
              >
                <span
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.86rem",
                    fontWeight: 600,
                    color: "var(--k-fg)",
                  }}
                >
                  {tenantName(p.tenant_id)}
                </span>
                <span
                  style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)" }}
                >
                  {p.promised_note ?? p.title}
                </span>
                <span
                  className="ml-auto"
                  style={{ fontFamily: T.mono, fontSize: "10px", color: "var(--k-faint)" }}
                >
                  {shortDate(p.promised_at as string)}
                </span>
              </div>
            ))}
          </Panel>
        </Reveal>
      )}

      {/* ── Issue table ─────────────────────────────────────── */}
      <div className="mt-5" style={{ border: "1px solid var(--k-border)" }}>
        <div
          className="max-md:hidden md:grid gap-3 items-center px-4 py-2.5"
          style={{
            gridTemplateColumns: GRID,
            background: "var(--k-surface)",
            borderBottom: issues.length ? "1px solid var(--k-border)" : "none",
            fontFamily: T.mono,
            fontSize: "10px",
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--k-faint)",
          }}
        >
          <span>Title</span>
          <span>Kind</span>
          <span>Severity</span>
          <span>Billing</span>
          <span>Status</span>
          <span>Age / due</span>
        </div>

        {issues.length === 0 && (
          <p
            className="text-center py-7"
            style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)" }}
          >
            Nothing here — log an issue above, or loosen the filters.
          </p>
        )}

        {issues.map((issue, i) => {
          const overdue = isOverdue(issue);
          const ai = issue.ai as {
            kind?: string;
            severity?: string;
            billing?: string;
            rationale?: string;
          } | null;
          return (
            <Reveal key={issue.id} delay={Math.min(i, 8) * 0.04}>
              <details style={{ borderTop: i ? "1px solid var(--k-border)" : "none" }}>
                <summary
                  className="max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-2 max-md:gap-y-1.5 md:grid md:gap-3 items-center px-4 py-3 list-none hover:bg-[var(--k-surface)] transition-colors"
                  style={{ gridTemplateColumns: GRID, cursor: "pointer" }}
                >
                  <span className="min-w-0 max-md:w-full">
                    <span
                      className="block truncate"
                      style={{
                        fontFamily: T.sans,
                        fontWeight: 600,
                        fontSize: "0.88rem",
                        color: "var(--k-fg)",
                      }}
                    >
                      {issue.title}
                    </span>
                    <span
                      className="block"
                      style={{
                        fontFamily: T.mono,
                        fontSize: "10px",
                        letterSpacing: "0.04em",
                        color: "var(--k-faint)",
                        marginTop: 3,
                      }}
                    >
                      {tenantName(issue.tenant_id)} · {SOURCE_LABEL[issue.source]}
                    </span>
                    {ai && issue.billing === "unclassified" && (
                      <span
                        className="block max-md:break-words md:truncate"
                        style={{
                          fontFamily: T.mono,
                          fontSize: "10px",
                          color: "var(--k-faint)",
                          marginTop: 3,
                        }}
                      >
                        AI: {String(ai.kind ?? "?")}/{String(ai.severity ?? "?")}/
                        {String(ai.billing ?? "?")}
                        {ai.rationale ? ` — ${String(ai.rationale)}` : ""}
                      </span>
                    )}
                  </span>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: "10px",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--k-muted)",
                    }}
                  >
                    {KIND_LABEL[issue.kind]}
                  </span>
                  <span>
                    <StatusChip tone={SEVERITY_META[issue.severity].tone}>
                      {SEVERITY_META[issue.severity].label}
                    </StatusChip>
                  </span>
                  <span>
                    <StatusChip tone={BILLING_TONE[issue.billing]}>
                      {BILLING_LABEL[issue.billing]}
                    </StatusChip>
                  </span>
                  <span>
                    <StatusChip tone={STATUS_TONE[issue.status]}>
                      {issue.status.replace(/_/g, " ")}
                    </StatusChip>
                  </span>
                  <span className="flex items-center gap-2 flex-wrap">
                    <span
                      style={{ fontFamily: T.mono, fontSize: "10px", color: "var(--k-muted)" }}
                    >
                      {ageDays(issue.created_at)}d
                      {issue.due_at ? ` · due ${shortDate(issue.due_at)}` : ""}
                    </span>
                    {overdue && <StatusChip tone="danger">overdue</StatusChip>}
                  </span>
                </summary>

                {/* ── Inline triage ─────────────────────────── */}
                <div
                  style={{
                    borderTop: "1px solid var(--k-border)",
                    background: "var(--k-surface)",
                    padding: "14px 16px",
                  }}
                >
                  {issue.description && (
                    <p
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.85rem",
                        lineHeight: 1.6,
                        color: "var(--k-muted)",
                        whiteSpace: "pre-wrap",
                        maxWidth: "72ch",
                        marginBottom: 12,
                      }}
                    >
                      {issue.description}
                    </p>
                  )}
                  <form action={triageIssue} className="flex items-end gap-2 flex-wrap">
                    <input type="hidden" name="id" value={issue.id} />
                    <Field label="Kind">
                      <select name="kind" defaultValue={issue.kind} className="max-md:w-full" style={inp}>
                        {KINDS.map((k) => (
                          <option key={k} value={k}>
                            {KIND_LABEL[k]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Severity">
                      <select name="severity" defaultValue={issue.severity} className="max-md:w-full" style={inp}>
                        {SEVERITIES.map((s) => (
                          <option key={s} value={s}>
                            {SEVERITY_META[s].label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Billing">
                      <select name="billing" defaultValue={issue.billing} className="max-md:w-full" style={inp}>
                        {BILLINGS.map((b) => (
                          <option key={b} value={b}>
                            {BILLING_LABEL[b]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Status">
                      <select name="status" defaultValue={issue.status} className="max-md:w-full" style={inp}>
                        {ALL_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Build items">
                      <input
                        name="build_items"
                        type="number"
                        step="0.5"
                        min="0"
                        defaultValue={issue.build_items ?? ""}
                        className="w-full md:w-[80px]"
                        style={inp}
                      />
                    </Field>
                    <Field label="Quoted £">
                      <input
                        name="quoted_price"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={issue.quoted_price ?? ""}
                        className="w-full md:w-[100px]"
                        style={inp}
                      />
                    </Field>
                    <Field label="Due">
                      <input
                        name="due_at"
                        type="date"
                        defaultValue={issue.due_at ? issue.due_at.slice(0, 10) : ""}
                        className="max-md:w-full"
                        style={{ ...inp, maxWidth: "100%" }}
                      />
                    </Field>
                    <label className="flex items-center gap-2" style={{ ...check, height: 36 }}>
                      <input type="checkbox" name="promised" defaultChecked={!!issue.promised_at} />
                      Promised
                    </label>
                    <Field label="Promised note">
                      <input
                        name="promised_note"
                        defaultValue={issue.promised_note ?? ""}
                        placeholder="What was promised"
                        className="w-full md:w-[190px]"
                        style={inp}
                      />
                    </Field>
                    <label className="flex items-center gap-2" style={{ ...check, height: 36 }}>
                      <input
                        type="checkbox"
                        name="client_visible"
                        defaultChecked={issue.client_visible}
                      />
                      Client visible
                    </label>
                    <Field label="Resolution note">
                      <input
                        name="resolution_note"
                        defaultValue={issue.resolution_note ?? ""}
                        placeholder="Plain-English fix summary"
                        className="w-full md:w-[240px]"
                        style={inp}
                      />
                    </Field>
                    <SubmitButton style={btn("var(--k-accent)", "var(--k-on-accent)")}>
                      Save
                    </SubmitButton>
                  </form>
                  {OPEN_STATUSES.includes(issue.status) && (
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {issue.status !== "queued" && issue.status !== "batched" && (
                        <form action={queueIssue}>
                          <input type="hidden" name="id" value={issue.id} />
                          <input type="hidden" name="tenant_id" value={issue.tenant_id} />
                          <SubmitButton style={btn("var(--k-bg)", "var(--k-accent)", true)}>
                            Queue
                          </SubmitButton>
                        </form>
                      )}
                      <form action={closeIssue}>
                        <input type="hidden" name="id" value={issue.id} />
                        <input type="hidden" name="tenant_id" value={issue.tenant_id} />
                        <SubmitButton style={btn("var(--k-bg)", "var(--k-muted)", true)}>
                          Close
                        </SubmitButton>
                      </form>
                    </div>
                  )}
                </div>
              </details>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 min-w-0 max-md:w-full">
      <span
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--k-faint)",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const chip = (active: boolean) =>
  ({
    fontFamily: T.mono,
    fontSize: "10px",
    fontWeight: 500,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding: "7px 12px",
    background: active ? "var(--k-accent)" : "transparent",
    color: active ? "var(--k-on-accent)" : "var(--k-muted)",
    border: `1px solid ${active ? "var(--k-accent)" : "var(--k-border)"}`,
    borderRadius: 0,
  }) as const;

const check = {
  fontFamily: T.mono,
  fontSize: "10px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "var(--k-muted)",
  cursor: "pointer",
};

const inp = {
  fontFamily: T.sans,
  fontSize: "0.85rem",
  height: 36,
  padding: "0 11px",
  background: "var(--k-surface)",
  color: "var(--k-fg)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
} as const;
const btn = (bg: string, fg: string, outline = false) => ({
  fontFamily: T.mono,
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  height: 36,
  paddingInline: 14,
  background: bg,
  color: fg,
  border: outline ? "1px solid var(--k-border)" : "1px solid transparent",
  borderRadius: 0,
  cursor: "pointer",
});
