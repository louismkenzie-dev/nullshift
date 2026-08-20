import Link from "next/link";
import { createClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { controlHealth, rollupByCategory } from "@/lib/soc2/health";
import type {
  ControlHealth,
  ControlRow,
  ControlRunRow,
  EvidenceRow,
  ExceptionRow,
} from "@/lib/soc2/types";
import { CONTROL_HEALTH_LABEL, TSC_LABEL } from "@/lib/soc2/types";
import { HEALTH_TONE, SEVERITY_TONE, READINESS_DISCLAIMER } from "@/lib/soc2/ui";
import { shortDate, faintMono, bodyText, monoLabel, EmptyRow } from "./shared";

/**
 * SOC 2 Readiness overview — the leadership dashboard. Shows scope status,
 * control health by Trust Services category (with its evidence/exception
 * basis), what's due, open critical/high exceptions, upcoming reviews and the
 * AI-governance picture. Deliberately NO overall percentage and NO
 * "compliant" badge anywhere: readiness is a set of explained statuses, and
 * the report conclusion belongs to an independent auditor.
 */

export const dynamic = "force-dynamic";

type ScopeRow = { id: string; version: number; status: string; approved_by: string | null; approved_at: string | null };
type PolicyRow = { id: string; key: string; title: string; status: string; review_due_at: string | null };
type VendorRow = {
  id: string;
  name: string;
  status: string;
  review_due_at: string | null;
  security_docs: { kind?: string; expires_on?: string }[];
};
type RiskRow = { id: string; ref: string; title: string; status: string; review_due_at: string | null };
type AccessReviewRow = { id: string; ref: string; status: string; due_at: string };
type MgmtReviewRow = { id: string; held_at: string; summary: string | null; decisions: { decision?: string }[]; recorded_by: string | null; next_due_at: string | null };
type AgentRow = { id: string; name: string; lifecycle: string; owner_email: string | null };
type IncidentRow = { id: string; ref: string; title: string; severity: string; status: string };

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

export default async function Soc2OverviewPage() {
  const supabase = await createClient();
  const [
    { data: scopes },
    { data: controls },
    { data: runs },
    { data: evidence },
    { data: exceptions },
    { data: policies },
    { data: vendors },
    { data: risks },
    { data: accessReviews },
    { data: mgmtReviews },
    { data: agents },
    { data: incidents },
  ] = await Promise.all([
    supabase.from("soc2_scopes").select("id, version, status, approved_by, approved_at").order("version", { ascending: false }),
    supabase
      .from("soc2_controls")
      .select("id, key, tsc_category, tsc_refs, name, objective, owner_email, frequency, policy_key, applicability, status, next_due_at"),
    supabase
      .from("soc2_control_runs")
      .select("id, control_id, fire_key, due_at, status, result, performed_by, performed_at, reviewer_email, review_result"),
    supabase
      .from("soc2_evidence_items")
      .select("id, control_id, control_run_id, source, capture_date, review_result, classification"),
    supabase
      .from("soc2_exceptions")
      .select("id, ref, control_id, rule_key, fire_key, title, severity, status, owner_email, due_at, detected_at, triaged_at, detail"),
    supabase.from("soc2_policies").select("id, key, title, status, review_due_at"),
    supabase.from("soc2_vendors").select("id, name, status, review_due_at, security_docs"),
    supabase.from("soc2_risks").select("id, ref, title, status, review_due_at"),
    supabase.from("soc2_access_reviews").select("id, ref, status, due_at"),
    supabase
      .from("soc2_management_reviews")
      .select("id, held_at, summary, decisions, recorded_by, next_due_at")
      .order("held_at", { ascending: false })
      .limit(1),
    supabase.from("agents").select("id, name, lifecycle, owner_email"),
    supabase.from("soc2_incidents").select("id, ref, title, severity, status"),
  ]);

  const scopeList = (scopes ?? []) as ScopeRow[];
  const controlList = (controls ?? []) as ControlRow[];
  const runList = (runs ?? []) as ControlRunRow[];
  const evidenceList = (evidence ?? []) as EvidenceRow[];
  const exceptionList = (exceptions ?? []) as ExceptionRow[];
  const t = today();

  const approvedScope = scopeList.find((s) => s.status === "approved") ?? null;
  const draftScope = scopeList.find((s) => s.status === "draft") ?? null;

  const healthRows = controlList
    .filter((c) => c.status === "active")
    .map((control) => ({
      control,
      ...controlHealth({
        control,
        runs: runList.filter((r) => r.control_id === control.id),
        evidence: evidenceList.filter((e) => e.control_id === control.id),
        exceptions: exceptionList.filter((e) => e.control_id === control.id),
        today: t,
      }),
    }));
  const rollups = rollupByCategory(healthRows);

  const openExceptions = exceptionList.filter(
    (e) => e.status !== "closed" && e.status !== "not_applicable"
  );
  const criticalHigh = openExceptions
    .filter((e) => e.severity === "critical" || e.severity === "high")
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1));
  const incidentCandidates = criticalHigh.filter((e) =>
    (e.detail ?? "").includes("incident candidate") || e.severity === "critical"
  );

  const dueRuns = runList
    .filter((r) => r.status === "scheduled" || r.status === "in_progress")
    .sort((a, b) => a.due_at.localeCompare(b.due_at));
  const dueThisWeek = dueRuns.filter((r) => r.due_at >= t && r.due_at <= inDays(7));
  const dueThisMonth = dueRuns.filter((r) => r.due_at >= t && r.due_at <= inDays(31));
  const overdueRuns = dueRuns.filter((r) => r.due_at < t);
  const controlById = new Map(controlList.map((c) => [c.id, c]));

  const upcoming: { kind: string; label: string; due: string; href: string }[] = [
    ...(accessReviews ?? [])
      .filter((r: AccessReviewRow) => r.status !== "complete")
      .map((r: AccessReviewRow) => ({
        kind: "Access review",
        label: r.ref,
        due: r.due_at,
        href: `/admin/soc2/access-reviews/${r.id}`,
      })),
    ...((vendors ?? []) as VendorRow[])
      .filter((v) => v.review_due_at && v.status !== "offboarded" && v.status !== "rejected")
      .map((v) => ({
        kind: "Vendor review",
        label: v.name,
        due: v.review_due_at as string,
        href: "/admin/soc2/vendors",
      })),
    ...((policies ?? []) as PolicyRow[])
      .filter((p) => p.status === "approved" && p.review_due_at)
      .map((p) => ({
        kind: "Policy review",
        label: p.title,
        due: p.review_due_at as string,
        href: `/admin/soc2/policies/${p.key}`,
      })),
    ...((risks ?? []) as RiskRow[])
      .filter((r) => r.status === "open" && r.review_due_at)
      .map((r) => ({ kind: "Risk review", label: r.ref, due: r.review_due_at as string, href: "/admin/soc2/risks" })),
    ...healthRows
      .filter(
        (h) =>
          (h.control.key === "AVL-03" || h.control.key === "AVL-05") && h.control.next_due_at
      )
      .map((h) => ({
        kind: h.control.key === "AVL-03" ? "Restore test" : "Continuity review",
        label: h.control.key,
        due: h.control.next_due_at as string,
        href: "/admin/soc2/continuity",
      })),
  ]
    .filter((u) => u.due <= inDays(45))
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 10);

  const vendorList = (vendors ?? []) as VendorRow[];
  const vendorsUnapproved = vendorList.filter((v) => v.status === "proposed").length;
  const vendorDocsExpired = vendorList.filter((v) =>
    (v.security_docs ?? []).some((d) => d.expires_on && d.expires_on < t)
  ).length;

  const agentList = (agents ?? []) as AgentRow[];
  const activeAgents = agentList.filter((a) => a.lifecycle === "active");
  const unownedAgents = activeAgents.filter((a) => !a.owner_email);
  const aiExceptions = openExceptions.filter((e) => (e.rule_key ?? "").startsWith("ai."));

  const openIncidents = ((incidents ?? []) as IncidentRow[]).filter((i) => i.status !== "closed");

  const mgmt = ((mgmtReviews ?? []) as MgmtReviewRow[])[0] ?? null;

  // Readiness trend: last 6 months of exceptions opened vs resolved/closed.
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }
  const trend = months.map((m) => ({
    month: m,
    opened: exceptionList.filter((e) => e.detected_at.slice(0, 7) === m).length,
    evidenced: runList.filter(
      (r) => r.status === "complete" && (r.performed_at ?? "").slice(0, 7) === m
    ).length,
  }));

  const seeded = controlList.length > 0;

  return (
    <div>
      <PageHeader
        index="12"
        label="SOC 2"
        title="Security & SOC 2 readiness"
        lead="Controls implemented, evidence collected, exceptions needing review — with the basis for every status shown."
        actions={
          approvedScope ? (
            <StatusChip tone="success">Scope v{approvedScope.version} approved</StatusChip>
          ) : (
            <StatusChip tone="warning">No approved scope</StatusChip>
          )
        }
      />

      {/* The mandatory disclaimer — always visible, never buried. */}
      <Reveal delay={0.02}>
        <p
          style={{
            ...faintMono,
            marginTop: 14,
            padding: "10px 14px",
            border: "1px solid var(--k-border)",
            background: "var(--k-surface)",
          }}
        >
          {READINESS_DISCLAIMER}
        </p>
      </Reveal>

      {!seeded && (
        <Reveal delay={0.04}>
          <div style={{ marginTop: 22 }}>
            <Panel label="// GETTING STARTED" title="The programme is not seeded yet">
              <p style={bodyText}>
                Seed the control library, policy drafts, vendor register and asset inventory from{" "}
                <Link href="/admin/soc2/settings" style={{ color: "var(--k-accent)" }}>
                  Settings
                </Link>
                , then draft and approve the Scope of System. Nothing here reports readiness until
                controls exist and a scope version is approved.
              </p>
            </Panel>
          </div>
        </Reveal>
      )}

      {/* KPI row */}
      <Reveal delay={0.05}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginTop: 22 }}>
          <StatCard
            value={String(criticalHigh.length)}
            label="Critical / high exceptions"
            sub={criticalHigh.length ? "Triage under Exceptions." : "None open."}
            accent={criticalHigh.length === 0}
          />
          <StatCard
            value={String(overdueRuns.length)}
            label="Evidence overdue"
            sub={`${dueThisWeek.length} due this week · ${dueThisMonth.length} this month`}
          />
          <StatCard
            value={String(openIncidents.length)}
            label="Open incidents"
            sub={incidentCandidates.length ? `${incidentCandidates.length} exception incident candidate(s)` : undefined}
          />
          <StatCard
            value={`${activeAgents.length - unownedAgents.length}/${activeAgents.length}`}
            label="AI agents with owners"
            sub={aiExceptions.length ? `${aiExceptions.length} AI exception(s) open` : "No open AI exceptions."}
          />
        </div>
      </Reveal>

      {/* Control health by TSC category */}
      <Reveal delay={0.08}>
        <div style={{ marginTop: 22 }}>
          <Panel label="// CONTROL HEALTH BY TRUST SERVICES CATEGORY" pad={false}>
            {rollups.length === 0 ? (
              <EmptyRow>No controls yet — seed the library from Settings.</EmptyRow>
            ) : (
              <div className="flex flex-col">
                {rollups.map((r, i) => (
                  <div
                    key={r.category}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                    style={{ borderTop: i ? "1px solid var(--k-border)" : "none" }}
                  >
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        textTransform: "uppercase",
                        color: "var(--k-fg)",
                        minWidth: 170,
                      }}
                    >
                      {TSC_LABEL[r.category]}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(r.counts) as ControlHealth[])
                        .filter((h) => r.counts[h] > 0)
                        .map((h) => (
                          <StatusChip key={h} tone={HEALTH_TONE[h]}>
                            {r.counts[h]} {CONTROL_HEALTH_LABEL[h]}
                          </StatusChip>
                        ))}
                    </div>
                    <span style={{ ...faintMono, marginLeft: "auto" }}>
                      {r.applicable} applicable / {r.total} total
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </Reveal>

      <div className="grid md:grid-cols-2 gap-4" style={{ marginTop: 18 }}>
        {/* Open critical/high exceptions */}
        <Reveal delay={0.1}>
          <Panel
            label="// EXCEPTIONS NEEDING ATTENTION"
            actions={
              <Link href="/admin/soc2/exceptions" style={{ ...faintMono, color: "var(--k-accent)" }}>
                All exceptions →
              </Link>
            }
            pad={false}
          >
            {criticalHigh.length === 0 ? (
              <EmptyRow>No critical or high exceptions open.</EmptyRow>
            ) : (
              <div className="flex flex-col">
                {criticalHigh.slice(0, 8).map((e, i) => (
                  <Link
                    key={e.id}
                    href={`/admin/soc2/exceptions/${e.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--k-bg)]"
                    style={{ borderTop: i ? "1px solid var(--k-border)" : "none" }}
                  >
                    <StatusChip tone={SEVERITY_TONE[e.severity]}>{e.severity}</StatusChip>
                    <span style={{ fontFamily: T.mono, fontSize: "10px", color: "var(--k-faint)" }}>
                      {e.ref}
                    </span>
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.84rem",
                        color: "var(--k-fg)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {e.title}
                    </span>
                    {e.due_at && (
                      <span style={{ ...faintMono, marginLeft: "auto", whiteSpace: "nowrap" }}>
                        due {shortDate(e.due_at)}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </Reveal>

        {/* Due & overdue evidence */}
        <Reveal delay={0.12}>
          <Panel
            label="// EVIDENCE DUE"
            actions={
              <Link href="/admin/soc2/controls" style={{ ...faintMono, color: "var(--k-accent)" }}>
                Controls →
              </Link>
            }
            pad={false}
          >
            {overdueRuns.length + dueThisMonth.length === 0 ? (
              <EmptyRow>Nothing due in the next month.</EmptyRow>
            ) : (
              <div className="flex flex-col">
                {[...overdueRuns, ...dueThisMonth].slice(0, 8).map((r, i) => {
                  const c = controlById.get(r.control_id);
                  const overdue = r.due_at < t;
                  return (
                    <Link
                      key={r.id}
                      href={c ? `/admin/soc2/controls/${c.id}` : "/admin/soc2/controls"}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--k-bg)]"
                      style={{ borderTop: i ? "1px solid var(--k-border)" : "none" }}
                    >
                      <span style={{ fontFamily: T.mono, fontSize: "10px", color: "var(--k-muted)" }}>
                        {c?.key ?? "—"}
                      </span>
                      <span
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.84rem",
                          color: "var(--k-fg)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {c?.name ?? "Control"}
                      </span>
                      <span
                        style={{
                          ...faintMono,
                          marginLeft: "auto",
                          whiteSpace: "nowrap",
                          color: overdue ? T.danger : "var(--k-faint)",
                        }}
                      >
                        {overdue ? "overdue " : "due "}
                        {shortDate(r.due_at)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>
        </Reveal>

        {/* Upcoming reviews */}
        <Reveal delay={0.14}>
          <Panel label="// UPCOMING REVIEWS (45 DAYS)" pad={false}>
            {upcoming.length === 0 ? (
              <EmptyRow>No reviews scheduled inside 45 days.</EmptyRow>
            ) : (
              <div className="flex flex-col">
                {upcoming.map((u, i) => (
                  <Link
                    key={`${u.kind}-${u.label}-${u.due}`}
                    href={u.href}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--k-bg)]"
                    style={{ borderTop: i ? "1px solid var(--k-border)" : "none" }}
                  >
                    <span style={{ ...monoLabel, minWidth: 120 }}>{u.kind}</span>
                    <span style={{ fontFamily: T.sans, fontSize: "0.84rem", color: "var(--k-fg)" }}>
                      {u.label}
                    </span>
                    <span
                      style={{
                        ...faintMono,
                        marginLeft: "auto",
                        color: u.due < t ? T.danger : "var(--k-faint)",
                      }}
                    >
                      {u.due < t ? "overdue " : ""}
                      {shortDate(u.due)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </Reveal>

        {/* Governance snapshot */}
        <Reveal delay={0.16}>
          <Panel label="// GOVERNANCE SNAPSHOT" pad={false}>
            <div className="flex flex-col">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span style={bodyText}>Scope of System</span>
                {approvedScope ? (
                  <span style={faintMono}>
                    v{approvedScope.version} approved {shortDate(approvedScope.approved_at)} by{" "}
                    {approvedScope.approved_by}
                    {draftScope ? ` · draft v${draftScope.version} open` : ""}
                  </span>
                ) : (
                  <StatusChip tone="warning">{draftScope ? `draft v${draftScope.version} awaiting approval` : "not drafted"}</StatusChip>
                )}
              </div>
              <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{ borderTop: "1px solid var(--k-border)" }}
              >
                <span style={bodyText}>Vendor register</span>
                <span style={faintMono}>
                  {vendorList.length} vendors · {vendorsUnapproved} awaiting approval ·{" "}
                  {vendorDocsExpired} docs expired
                </span>
              </div>
              <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{ borderTop: "1px solid var(--k-border)" }}
              >
                <span style={bodyText}>Policies approved</span>
                <span style={faintMono}>
                  {((policies ?? []) as PolicyRow[]).filter((p) => p.status === "approved").length}/
                  {(policies ?? []).length} — drafts need human review
                </span>
              </div>
              <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{ borderTop: "1px solid var(--k-border)" }}
              >
                <span style={bodyText}>Last management review</span>
                {mgmt ? (
                  <span style={faintMono}>
                    {shortDate(mgmt.held_at)} by {mgmt.recorded_by ?? "—"} ·{" "}
                    {(mgmt.decisions ?? []).length} decision(s)
                    {mgmt.next_due_at ? ` · next ${shortDate(mgmt.next_due_at)}` : ""}
                  </span>
                ) : (
                  <StatusChip tone="warning">never held</StatusChip>
                )}
              </div>
            </div>
          </Panel>
        </Reveal>
      </div>

      {/* Trend */}
      <Reveal delay={0.18}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// READINESS TREND — EXCEPTION & EVIDENCE FLOW, LAST 6 MONTHS" pad={false}>
            <div className="grid" style={{ gridTemplateColumns: "120px repeat(6, 1fr)" }}>
              <span style={{ ...faintMono, padding: "10px 14px" }}>month</span>
              {trend.map((m) => (
                <span key={m.month} style={{ ...faintMono, padding: "10px 6px", textAlign: "center" }}>
                  {m.month.slice(2)}
                </span>
              ))}
              <span style={{ ...faintMono, padding: "10px 14px", borderTop: "1px solid var(--k-border)" }}>
                exceptions raised
              </span>
              {trend.map((m) => (
                <span
                  key={`o-${m.month}`}
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.8rem",
                    padding: "10px 6px",
                    textAlign: "center",
                    borderTop: "1px solid var(--k-border)",
                    color: m.opened ? T.warning : "var(--k-faint)",
                  }}
                >
                  {m.opened}
                </span>
              ))}
              <span style={{ ...faintMono, padding: "10px 14px", borderTop: "1px solid var(--k-border)" }}>
                runs evidenced
              </span>
              {trend.map((m) => (
                <span
                  key={`e-${m.month}`}
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.8rem",
                    padding: "10px 6px",
                    textAlign: "center",
                    borderTop: "1px solid var(--k-border)",
                    color: m.evidenced ? T.success : "var(--k-faint)",
                  }}
                >
                  {m.evidenced}
                </span>
              ))}
            </div>
            <p style={{ ...faintMono, padding: "10px 14px", borderTop: "1px solid var(--k-border)" }}>
              Trend reads from recorded exception and control-run state — it explains movement, it
              does not score it.
            </p>
          </Panel>
        </div>
      </Reveal>
    </div>
  );
}
