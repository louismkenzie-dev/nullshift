import Link from "next/link";
import { createClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { formatCallDate, formatCallTime, money, LONDON_TZ } from "@nullshift/ui/format";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import {
  OPEN_STATUSES,
  SEVERITY_META,
  isUnreviewedDraft,
  type IssueRow,
} from "@/lib/ops/issues";
import { computeMrr } from "@nullshift/billing/mrr";

/**
 * Mission Control — one glance = state of the whole agency. Every open issue,
 * every batch in flight, every promise made to a client and every call this
 * week, folded from a handful of bulk queries (no N+1). Staff-only via RLS.
 */

export const dynamic = "force-dynamic";

type DashIssue = Pick<
  IssueRow,
  | "id"
  | "tenant_id"
  | "project_id"
  | "severity"
  | "status"
  | "title"
  | "due_at"
  | "promised_at"
  | "promised_note"
  | "created_at"
  | "client_visible"
>;
type BatchRow = {
  id: string;
  tenant_id: string;
  project_id: string | null;
  title: string;
  status: string;
  created_at: string;
};
type SubRow = { tenant_id: string; mrr: number; status: string };
type CallRow = {
  id: string;
  tenant_id: string;
  call_date: string;
  call_time: string;
  duration_min: number;
};
type CrRow = {
  id: string;
  tenant_id: string;
  project_id: string | null;
  description: string;
  status: string;
  created_at: string;
};
type InvoiceRow = {
  id: string;
  tenant_id: string;
  amount: number;
  status: string;
  due_at: string | null;
};
type ActivityRow = {
  id: string;
  tenant_id: string | null;
  action: string;
  target: string | null;
  created_at: string;
};

// Batch lifecycle → signal tone (draft is quiet, shipped/cancelled never shown here).
const BATCH_TONE: Record<string, "accent" | "success" | "warning" | "danger" | "muted"> =
  {
    draft: "muted",
    compiled: "accent",
    dispatched: "accent",
    pr_open: "warning",
  };

/** Primary/secondary action button in the build band. */
const heroBtn = (primary: boolean): React.CSSProperties => ({
  fontFamily: T.mono,
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  height: 34,
  display: "inline-flex",
  alignItems: "center",
  paddingInline: 14,
  background: primary ? "var(--k-accent)" : "var(--k-surface)",
  color: primary ? "var(--k-on-accent)" : "var(--k-fg)",
  border: `1px solid ${primary ? "transparent" : "var(--k-border)"}`,
});

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export default async function MissionControlPage() {
  const supabase = await createClient();
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: LONDON_TZ });
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toLocaleDateString("en-CA", { timeZone: LONDON_TZ });

  const [
    { data: issuesRaw },
    { data: batchesRaw },
    { data: subsRaw },
    { data: callsRaw },
    { data: crsRaw },
    { data: invoicesRaw },
    { data: activityRaw },
    { data: draftPlansRaw },
  ] = await Promise.all([
    supabase
      .from("issues")
      .select(
        "id, tenant_id, project_id, severity, status, title, due_at, promised_at, promised_note, created_at, client_visible"
      )
      .in("status", OPEN_STATUSES)
      .order("created_at", { ascending: false }),
    supabase
      .from("fix_batches")
      .select("id, tenant_id, project_id, title, status, created_at")
      .not("status", "in", "(shipped,cancelled)")
      .order("created_at", { ascending: false }),
    supabase
      .from("subscriptions")
      .select("tenant_id, mrr, status")
      .in("status", ["active", "trialing", "past_due"]),
    supabase
      .from("calls")
      .select("id, tenant_id, call_date, call_time, duration_min")
      .eq("status", "confirmed")
      .gte("call_date", todayStr)
      .lte("call_date", weekEndStr)
      .order("call_date")
      .order("call_time"),
    supabase
      .from("change_requests")
      .select("id, tenant_id, project_id, description, status, created_at")
      .not("status", "in", "(shipped,rejected)")
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, tenant_id, amount, status, due_at")
      .eq("status", "open")
      .order("created_at", { ascending: false }),
    supabase
      .from("audit_log")
      .select("id, tenant_id, action, target, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("build_plans").select("id, project_id").eq("status", "draft"),
  ]);

  // Unreviewed inbox drafts (hidden + still 'new') are not confirmed work —
  // the batch compiler excludes them, and mission-control counts must match.
  const issues = ((issuesRaw ?? []) as DashIssue[]).filter((i) => !isUnreviewedDraft(i));
  const batches = (batchesRaw ?? []) as BatchRow[];
  const subs = (subsRaw ?? []) as SubRow[];
  const calls = (callsRaw ?? []) as CallRow[];
  const crs = (crsRaw ?? []) as CrRow[];
  const openInvoices = (invoicesRaw ?? []) as InvoiceRow[];
  const activity = (activityRaw ?? []) as ActivityRow[];
  const draftPlans = (draftPlansRaw ?? []) as { id: string; project_id: string }[];

  // Join issues/batches/calls to tenants + projects in memory (bulk + fold).
  // Projects/tenants are fetched in full (not just the ids referenced above):
  // the build strip lists every system, including quiet ones with nothing
  // banked — those are exactly the ones you go to PLAN something new on.
  const [{ data: tenantsRaw }, { data: projectsRaw }] = await Promise.all([
    supabase.from("tenants").select("id, name"),
    supabase.from("projects").select("id, tenant_id, name").order("created_at", {
      ascending: false,
    }),
  ]);
  const tenantName = new Map(
    ((tenantsRaw ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name])
  );
  const allProjects = (projectsRaw ?? []) as {
    id: string;
    tenant_id: string;
    name: string;
  }[];
  const projectName = new Map(allProjects.map((p) => [p.id, p.name]));

  const now = Date.now();
  const isOverdue = (i: DashIssue) => !!i.due_at && new Date(i.due_at).getTime() < now;

  // Needs attention: critical + high first (critical before high), then anything
  // else that has blown past its due date.
  const critHigh = issues.filter(
    (i) => i.severity === "critical" || i.severity === "high"
  );
  critHigh.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1
  );
  const overdueRest = issues.filter(
    (i) => i.severity !== "critical" && i.severity !== "high" && isOverdue(i)
  );
  const needsAttention = [...critHigh, ...overdueRest];

  const blocked = issues.filter((i) => i.status === "awaiting_client");
  const promises = issues.filter((i) => i.promised_at !== null);
  const mrr = computeMrr(subs);
  const pastDueSubs = subs.filter((s) => s.status === "past_due");
  const overdueInvoices = openInvoices.filter(
    (i) => !!i.due_at && new Date(i.due_at).getTime() < now
  );
  // CR queue folded into the two states a partner acts on: with us (assess /
  // scope) vs with the client (awaiting their approval); the rest is in-flight.
  const crAwaitingUs = crs.filter(
    (c) => c.status === "submitted" || c.status === "triaged"
  );
  const crAwaitingClient = crs.filter((c) => c.status === "awaiting_approval");
  const crInFlight = crs.filter(
    (c) => !["submitted", "triaged", "awaiting_approval"].includes(c.status)
  );

  // ── Build cockpit rail ──────────────────────────────────────
  // The most-used road out of this page: from any system into a Claude Code
  // session. Each system carries the one thing waiting on you, worst first,
  // so the strip is a work queue rather than a menu.
  const planByProject = new Map(draftPlans.map((pl) => [pl.project_id, pl.id]));
  const batchByProject = new Map<string, BatchRow>();
  for (const b of batches) {
    if (!b.project_id) continue;
    const held = batchByProject.get(b.project_id);
    // Worst-first: a PR waiting to merge beats a live session beats a
    // compiled batch nobody has dispatched.
    const rank = (st: string) =>
      st === "pr_open" ? 0 : st === "dispatched" ? 1 : st === "compiled" ? 2 : 3;
    if (!held || rank(b.status) < rank(held.status)) batchByProject.set(b.project_id, b);
  }
  const issueCountByProject = new Map<string, number>();
  for (const i of issues) {
    if (!i.project_id) continue;
    issueCountByProject.set(i.project_id, (issueCountByProject.get(i.project_id) ?? 0) + 1);
  }

  type BuildTone = "accent" | "success" | "warning" | "danger" | "muted";
  const buildRail = allProjects
    .map((proj) => {
      const batch = batchByProject.get(proj.id);
      const planId = planByProject.get(proj.id);
      const openCount = issueCountByProject.get(proj.id) ?? 0;
      let rank = 5;
      let note = "Plan a build";
      let tone: BuildTone = "muted";
      let href = `/admin/systems/${proj.id}/plan`;
      if (batch?.status === "pr_open") {
        rank = 0; note = "PR to review"; tone = "warning"; href = `/admin/batches/${batch.id}`;
      } else if (batch?.status === "dispatched") {
        rank = 1; note = "Claude working"; tone = "accent"; href = `/admin/batches/${batch.id}`;
      } else if (batch?.status === "compiled") {
        rank = 2; note = "Ready to dispatch"; tone = "accent"; href = `/admin/batches/${batch.id}`;
      } else if (planId) {
        rank = 3; note = "Plan to review"; tone = "warning"; href = `/admin/systems/${proj.id}/plan`;
      } else if (openCount > 0) {
        rank = 4;
        note = `${openCount} issue${openCount === 1 ? "" : "s"} to batch`;
        tone = "muted";
        href = `/admin/batches?project=${proj.id}`;
      }
      return { proj, rank, note, tone, href };
    })
    .sort((a, b) => a.rank - b.rank || a.proj.name.localeCompare(b.proj.name));

  const readyToDispatch = batches.filter((b) => b.status === "compiled").length;
  const sessionsLive = batches.filter((b) => b.status === "dispatched").length;

  return (
    <div>
      <PageHeader
        index="01"
        label="Overview"
        title="Mission control"
        lead="The whole agency in one glance — what to fix first, who we're waiting on, what we've promised and what's in flight."
        actions={
          <span style={{ ...mono, fontSize: 11, color: "var(--k-muted)" }}>
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: LONDON_TZ,
            })}
          </span>
        }
      />

      {/* ── Build with Claude — the road out of this page ── */}
      <Reveal delay={0.04}>
        <div
          className="mt-8"
          style={{
            border: "1px solid var(--k-border)",
            borderLeft: "2px solid var(--k-accent)",
            background:
              "linear-gradient(90deg, rgba(16,185,129,0.07) 0%, var(--k-surface) 55%)",
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-4 pb-3">
            <div className="min-w-0">
              <span style={{ ...mono, color: "var(--k-accent)" }}>
                {"// BUILD WITH CLAUDE"}
              </span>
              <p
                style={{
                  fontFamily: T.sans,
                  fontWeight: 600,
                  fontSize: "1.05rem",
                  color: "var(--k-fg)",
                  marginTop: 6,
                }}
              >
                Turn anything into a Claude Code session
              </p>
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.85rem",
                  color: "var(--k-muted)",
                  marginTop: 3,
                }}
              >
                Client requests, cached build modules, SOC 2 remediations — or an
                AI-drafted plan from a system&apos;s goal. Pick a system below, or start
                straight from a batch.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/admin/systems" style={heroBtn(true)}>
                Plan a build
              </Link>
              <Link href="/admin/batches" style={heroBtn(false)}>
                Compile a batch
              </Link>
              <Link href="/admin/modules" style={heroBtn(false)}>
                Module library
              </Link>
            </div>
          </div>

          {(readyToDispatch > 0 || sessionsLive > 0 || draftPlans.length > 0) && (
            <div
              className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 pb-3"
              style={{ ...mono, color: "var(--k-faint)" }}
            >
              <span style={{ color: "var(--k-muted)" }}>waiting on you</span>
              {readyToDispatch > 0 && (
                <span style={{ color: "var(--k-accent)" }}>
                  {readyToDispatch} batch{readyToDispatch === 1 ? "" : "es"} ready to
                  dispatch
                </span>
              )}
              {draftPlans.length > 0 && (
                <span style={{ color: T.warning }}>
                  {draftPlans.length} plan{draftPlans.length === 1 ? "" : "s"} to review
                </span>
              )}
              {sessionsLive > 0 && (
                <span>
                  {sessionsLive} session{sessionsLive === 1 ? "" : "s"} in flight
                </span>
              )}
            </div>
          )}

          {buildRail.length > 0 && (
            <div style={{ borderTop: "1px solid var(--k-border)" }}>
              {buildRail.slice(0, 6).map((row, i) => (
                <Link
                  key={row.proj.id}
                  href={row.href}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 hover:bg-[var(--k-bg)]"
                  style={{
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                    transition: "background-color 0.15s ease",
                  }}
                >
                  <span
                    className="min-w-0"
                    style={{
                      fontFamily: T.sans,
                      fontWeight: 600,
                      fontSize: "0.88rem",
                      color: "var(--k-fg)",
                    }}
                  >
                    {row.proj.name}
                  </span>
                  <span style={{ ...mono, color: "var(--k-faint)" }}>
                    {tenantName.get(row.proj.tenant_id) ?? "—"}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    <StatusChip tone={row.tone}>{row.note}</StatusChip>
                    <span style={{ ...mono, color: "var(--k-accent)" }}>→</span>
                  </span>
                </Link>
              ))}
              {buildRail.length > 6 && (
                <Link
                  href="/admin/systems"
                  className="block px-5 py-2.5"
                  style={{
                    ...mono,
                    color: "var(--k-accent)",
                    borderTop: "1px solid var(--k-border)",
                  }}
                >
                  All {buildRail.length} systems →
                </Link>
              )}
            </div>
          )}
        </div>
      </Reveal>

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 mb-6">
        {[
          {
            value: String(issues.length),
            label: "Open issues",
            sub: "Across every system",
            accent: false,
          },
          {
            value: String(critHigh.length),
            label: "Critical / high",
            sub: "Fix these first",
            accent: false,
          },
          {
            value: String(batches.length),
            label: "Batches in flight",
            sub: "Compiled → shipped",
            accent: false,
          },
          {
            value: money(mrr),
            label: "MRR",
            sub: "Active + trialing plans",
            accent: true,
          },
        ].map((s, i) => (
          <Reveal key={s.label} delay={i * 0.05}>
            <StatCard value={s.value} label={s.label} sub={s.sub} accent={s.accent} />
          </Reveal>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* Left: the work */}
        <div className="flex flex-col gap-6">
          {/* Needs attention rail */}
          <Reveal delay={0.1}>
            <Panel
              label="// NEEDS ATTENTION"
              title="Fix first"
              pad={false}
              actions={<ViewAll href="/admin/issues" />}
            >
              {needsAttention.length === 0 ? (
                <EmptyState text="Nothing on fire — no critical, high or overdue issues." />
              ) : (
                needsAttention.slice(0, 8).map((iss, i) => {
                  const overdue = isOverdue(iss);
                  return (
                    <Reveal key={iss.id} delay={Math.min(i, 8) * 0.04}>
                      <Link
                        href="/admin/issues"
                        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 px-4 hover:bg-[var(--k-bg)]"
                        style={{
                          borderTop: i ? "1px solid var(--k-border)" : "none",
                          transition: "background-color 0.15s ease",
                        }}
                      >
                        <div className="min-w-0">
                          <div
                            style={{
                              fontFamily: T.sans,
                              fontWeight: 600,
                              fontSize: "0.9rem",
                              color: "var(--k-fg)",
                            }}
                          >
                            {iss.title}
                          </div>
                          <div style={{ ...mono, color: "var(--k-faint)", marginTop: 4 }}>
                            {tenantName.get(iss.tenant_id) ?? "—"}
                            {iss.project_id && projectName.get(iss.project_id) && (
                              <> · {projectName.get(iss.project_id)}</>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {overdue && <StatusChip tone="danger">Overdue</StatusChip>}
                          <StatusChip tone={SEVERITY_META[iss.severity].tone}>
                            {SEVERITY_META[iss.severity].label}
                          </StatusChip>
                        </div>
                      </Link>
                    </Reveal>
                  );
                })
              )}
              {needsAttention.length > 8 && (
                <MoreLink href="/admin/issues" count={needsAttention.length - 8} />
              )}
            </Panel>
          </Reveal>

          {/* Batches in flight */}
          <Reveal delay={0.15}>
            <Panel
              label="// BATCHES IN FLIGHT"
              title="Work orders"
              pad={false}
              actions={<ViewAll href="/admin/batches" />}
            >
              {batches.length === 0 ? (
                <EmptyState text="No batches in flight — compile one from the issue bank when you're ready." />
              ) : (
                batches.map((b, i) => (
                  <Reveal key={b.id} delay={Math.min(i, 8) * 0.04}>
                    <Link
                      href={`/admin/batches/${b.id}`}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 px-4 hover:bg-[var(--k-bg)]"
                      style={{
                        borderTop: i ? "1px solid var(--k-border)" : "none",
                        transition: "background-color 0.15s ease",
                      }}
                    >
                      <div className="min-w-0">
                        <div
                          style={{
                            fontFamily: T.sans,
                            fontWeight: 600,
                            fontSize: "0.9rem",
                            color: "var(--k-fg)",
                          }}
                        >
                          {b.title}
                        </div>
                        <div style={{ ...mono, color: "var(--k-faint)", marginTop: 4 }}>
                          {tenantName.get(b.tenant_id) ?? "—"}
                        </div>
                      </div>
                      <StatusChip tone={BATCH_TONE[b.status] ?? "muted"}>
                        {b.status.replace(/_/g, " ")}
                      </StatusChip>
                    </Link>
                  </Reveal>
                ))
              )}
            </Panel>
          </Reveal>
          {/* Change requests — the scope-control queue (audit Phase 1.4) */}
          <Reveal delay={0.2}>
            <Panel
              label="// CHANGE REQUESTS"
              title="Scope control"
              pad={false}
              actions={
                <span style={{ ...mono, color: "var(--k-faint)" }}>
                  {crAwaitingUs.length} to assess · {crAwaitingClient.length} with client
                  · {crInFlight.length} in flight
                </span>
              }
            >
              {crs.length === 0 ? (
                <EmptyState text="No open change requests." />
              ) : (
                crs.slice(0, 6).map((cr, i) => (
                  <Reveal key={cr.id} delay={Math.min(i, 8) * 0.04}>
                    <Link
                      href={`/admin/clients/${cr.tenant_id}`}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 px-4 hover:bg-[var(--k-bg)]"
                      style={{
                        borderTop: i ? "1px solid var(--k-border)" : "none",
                        transition: "background-color 0.15s ease",
                      }}
                    >
                      <div className="min-w-0">
                        <div
                          style={{
                            fontFamily: T.sans,
                            fontWeight: 600,
                            fontSize: "0.9rem",
                            color: "var(--k-fg)",
                          }}
                        >
                          {cr.description.length > 90
                            ? `${cr.description.slice(0, 90)}…`
                            : cr.description}
                        </div>
                        <div style={{ ...mono, color: "var(--k-faint)", marginTop: 4 }}>
                          {tenantName.get(cr.tenant_id) ?? "—"}
                        </div>
                      </div>
                      <StatusChip
                        tone={
                          cr.status === "awaiting_approval"
                            ? "warning"
                            : cr.status === "submitted" || cr.status === "triaged"
                              ? "accent"
                              : "muted"
                        }
                      >
                        {cr.status.replace(/_/g, " ")}
                      </StatusChip>
                    </Link>
                  </Reveal>
                ))
              )}
            </Panel>
          </Reveal>
        </div>

        {/* Right: waiting, promised, booked */}
        <div className="flex flex-col gap-6">
          {/* Money — due and overdue (audit Phase 1.4) */}
          <Reveal delay={0.05}>
            <Panel label="// MONEY" title="Payments" pad={false}>
              {openInvoices.length === 0 && pastDueSubs.length === 0 ? (
                <EmptyState text="Nothing outstanding — no open invoices, no past-due plans." />
              ) : (
                <>
                  {overdueInvoices.map((inv, i) => (
                    <MoneyRow
                      key={inv.id}
                      first={i === 0}
                      name={tenantName.get(inv.tenant_id) ?? "—"}
                      amount={inv.amount}
                      tone="danger"
                      chip="Overdue"
                    />
                  ))}
                  {openInvoices
                    .filter((inv) => !overdueInvoices.includes(inv))
                    .map((inv, i) => (
                      <MoneyRow
                        key={inv.id}
                        first={overdueInvoices.length === 0 && i === 0}
                        name={tenantName.get(inv.tenant_id) ?? "—"}
                        amount={inv.amount}
                        tone="warning"
                        chip={
                          inv.due_at
                            ? `Due ${new Date(inv.due_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: LONDON_TZ })}`
                            : "Open"
                        }
                      />
                    ))}
                  {pastDueSubs.map((s) => (
                    <MoneyRow
                      key={`sub-${s.tenant_id}`}
                      first={false}
                      name={tenantName.get(s.tenant_id) ?? "—"}
                      amount={s.mrr}
                      tone="danger"
                      chip="Plan past due"
                    />
                  ))}
                </>
              )}
            </Panel>
          </Reveal>

          {/* Blocked on client */}
          <Reveal delay={0.1}>
            <Panel label="// BLOCKED ON CLIENT" title="Waiting on them" pad={false}>
              {blocked.length === 0 ? (
                <EmptyState text="Nothing is waiting on a client right now." />
              ) : (
                blocked.map((iss, i) => (
                  <Reveal key={iss.id} delay={Math.min(i, 8) * 0.04}>
                    <Link
                      href="/admin/issues"
                      className="block py-3 px-4 hover:bg-[var(--k-bg)]"
                      style={{
                        borderTop: i ? "1px solid var(--k-border)" : "none",
                        transition: "background-color 0.15s ease",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: T.sans,
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          color: "var(--k-fg)",
                        }}
                      >
                        {iss.title}
                      </div>
                      <div style={{ ...mono, color: T.warning, marginTop: 4 }}>
                        {tenantName.get(iss.tenant_id) ?? "—"}
                      </div>
                    </Link>
                  </Reveal>
                ))
              )}
            </Panel>
          </Reveal>

          {/* Promise ledger */}
          <Reveal delay={0.15}>
            <Panel label="// PROMISES" title="Promise ledger" pad={false}>
              {promises.length === 0 ? (
                <EmptyState text="No outstanding promises — say it, log it, ship it." />
              ) : (
                promises.map((iss, i) => (
                  <Reveal key={iss.id} delay={Math.min(i, 8) * 0.04}>
                    <Link
                      href="/admin/issues"
                      className="block py-3 px-4 hover:bg-[var(--k-bg)]"
                      style={{
                        borderTop: i ? "1px solid var(--k-border)" : "none",
                        transition: "background-color 0.15s ease",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: T.sans,
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          color: "var(--k-fg)",
                        }}
                      >
                        {iss.promised_note || iss.title}
                      </div>
                      <div style={{ ...mono, color: "var(--k-faint)", marginTop: 4 }}>
                        {tenantName.get(iss.tenant_id) ?? "—"} ·{" "}
                        <span style={{ color: "var(--k-accent)" }}>
                          {new Date(iss.promised_at as string).toLocaleDateString(
                            "en-GB",
                            {
                              day: "numeric",
                              month: "short",
                              timeZone: LONDON_TZ,
                            }
                          )}
                        </span>
                      </div>
                    </Link>
                  </Reveal>
                ))
              )}
            </Panel>
          </Reveal>

          {/* This week's calls */}
          <Reveal delay={0.2}>
            <Panel
              label="// THIS WEEK"
              title="Upcoming calls"
              pad={false}
              actions={<ViewAll href="/admin/calendar" />}
            >
              {calls.length === 0 ? (
                <EmptyState text="No calls booked in the next seven days." />
              ) : (
                calls.map((c, i) => (
                  <Reveal key={c.id} delay={Math.min(i, 8) * 0.04}>
                    <div
                      className="py-3 px-4"
                      style={{ borderTop: i ? "1px solid var(--k-border)" : "none" }}
                    >
                      <div
                        style={{
                          fontFamily: T.sans,
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          color: "var(--k-fg)",
                        }}
                      >
                        {tenantName.get(c.tenant_id) ?? "—"}
                      </div>
                      <div style={{ ...mono, color: "var(--k-muted)", marginTop: 4 }}>
                        {formatCallDate(c.call_date)} ·{" "}
                        <span style={{ color: "var(--k-accent)" }}>
                          {formatCallTime(c.call_time)}
                        </span>{" "}
                        · {c.duration_min} min
                      </div>
                    </div>
                  </Reveal>
                ))
              )}
            </Panel>
          </Reveal>

          {/* Recent activity — the audit trail, finally read (audit Phase 1.4) */}
          <Reveal delay={0.25}>
            <Panel label="// ACTIVITY" title="Recent activity" pad={false}>
              {activity.length === 0 ? (
                <EmptyState text="No recorded activity yet." />
              ) : (
                activity.map((a, i) => (
                  <div
                    key={a.id}
                    className="py-2.5 px-4"
                    style={{ borderTop: i ? "1px solid var(--k-border)" : "none" }}
                  >
                    <div style={{ ...mono, color: "var(--k-fg)" }}>
                      {a.action.replace(/[._]/g, " ")}
                    </div>
                    <div style={{ ...mono, color: "var(--k-faint)", marginTop: 3 }}>
                      {(a.tenant_id && tenantName.get(a.tenant_id)) || "—"} ·{" "}
                      {new Date(a.created_at).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: LONDON_TZ,
                      })}
                    </div>
                  </div>
                ))
              )}
            </Panel>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

/** One money line: client · amount · state chip. */
function MoneyRow({
  first,
  name,
  amount,
  tone,
  chip,
}: {
  first: boolean;
  name: string;
  amount: number;
  tone: "danger" | "warning";
  chip: string;
}) {
  return (
    <Link
      href="/admin/billing"
      className="flex items-center justify-between gap-3 py-2.5 px-4 hover:bg-[var(--k-bg)]"
      style={{
        borderTop: first ? "none" : "1px solid var(--k-border)",
        transition: "background-color 0.15s ease",
      }}
    >
      <span
        className="min-w-0 truncate"
        style={{
          fontFamily: T.sans,
          fontWeight: 600,
          fontSize: "0.85rem",
          color: "var(--k-fg)",
        }}
      >
        {name}
      </span>
      <span className="flex items-center gap-2 shrink-0">
        <span style={{ ...mono, color: "var(--k-muted)" }}>{money(amount)}</span>
        <StatusChip tone={tone}>{chip}</StatusChip>
      </span>
    </Link>
  );
}

/** Mono uppercase "view all →" link for Panel headers. */
function ViewAll({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5"
      style={{
        fontFamily: T.mono,
        fontSize: "0.62rem",
        fontWeight: 500,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--k-muted)",
      }}
    >
      VIEW ALL
      <span aria-hidden>→</span>
    </Link>
  );
}

/** "+N more" footer row inside a list Panel. */
function MoreLink({ href, count }: { href: string; count: number }) {
  return (
    <div style={{ borderTop: "1px solid var(--k-border)", padding: "12px 16px" }}>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5"
        style={{
          fontFamily: T.mono,
          fontSize: "0.62rem",
          fontWeight: 500,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--k-accent)",
        }}
      >
        +{count} more
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-7 px-4 text-center">
      <span style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)" }}>
        {text}
      </span>
    </div>
  );
}
