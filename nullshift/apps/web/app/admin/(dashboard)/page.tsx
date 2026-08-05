import Link from "next/link";
import { createClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { formatCallDate, formatCallTime, money, LONDON_TZ } from "@nullshift/ui/format";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { OPEN_STATUSES, SEVERITY_META, type IssueRow } from "@/lib/ops/issues";

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

// Batch lifecycle → signal tone (draft is quiet, shipped/cancelled never shown here).
const BATCH_TONE: Record<string, "accent" | "success" | "warning" | "danger" | "muted"> = {
  draft: "muted",
  compiled: "accent",
  dispatched: "accent",
  pr_open: "warning",
};

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

  const [{ data: issuesRaw }, { data: batchesRaw }, { data: subsRaw }, { data: callsRaw }] =
    await Promise.all([
      supabase
        .from("issues")
        .select(
          "id, tenant_id, project_id, severity, status, title, due_at, promised_at, promised_note, created_at"
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
        .in("status", ["active", "trialing"]),
      supabase
        .from("calls")
        .select("id, tenant_id, call_date, call_time, duration_min")
        .eq("status", "confirmed")
        .gte("call_date", todayStr)
        .lte("call_date", weekEndStr)
        .order("call_date")
        .order("call_time"),
    ]);

  const issues = (issuesRaw ?? []) as DashIssue[];
  const batches = (batchesRaw ?? []) as BatchRow[];
  const subs = (subsRaw ?? []) as SubRow[];
  const calls = (callsRaw ?? []) as CallRow[];

  // Join issues/batches/calls to tenants + projects in memory (bulk + fold).
  const tenantIds = [
    ...new Set([...issues, ...batches, ...calls].map((r) => r.tenant_id)),
  ];
  const projectIds = [
    ...new Set(
      [...issues, ...batches].map((r) => r.project_id).filter((p): p is string => !!p)
    ),
  ];
  const [{ data: tenantsRaw }, { data: projectsRaw }] = await Promise.all([
    tenantIds.length
      ? supabase.from("tenants").select("id, name").in("id", tenantIds)
      : Promise.resolve({ data: [] }),
    projectIds.length
      ? supabase.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [] }),
  ]);
  const tenantName = new Map(
    ((tenantsRaw ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name])
  );
  const projectName = new Map(
    ((projectsRaw ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name])
  );

  const now = Date.now();
  const isOverdue = (i: DashIssue) => !!i.due_at && new Date(i.due_at).getTime() < now;

  // Needs attention: critical + high first (critical before high), then anything
  // else that has blown past its due date.
  const critHigh = issues.filter((i) => i.severity === "critical" || i.severity === "high");
  critHigh.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1));
  const overdueRest = issues.filter(
    (i) => i.severity !== "critical" && i.severity !== "high" && isOverdue(i)
  );
  const needsAttention = [...critHigh, ...overdueRest];

  const blocked = issues.filter((i) => i.status === "awaiting_client");
  const promises = issues.filter((i) => i.promised_at !== null);
  const mrr = subs.reduce((sum, s) => sum + (Number(s.mrr) || 0), 0);

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

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 mb-6">
        {[
          { value: String(issues.length), label: "Open issues", sub: "Across every system", accent: false },
          { value: String(critHigh.length), label: "Critical / high", sub: "Fix these first", accent: false },
          { value: String(batches.length), label: "Batches in flight", sub: "Compiled → shipped", accent: false },
          { value: money(mrr), label: "MRR", sub: "Active + trialing plans", accent: true },
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
        </div>

        {/* Right: waiting, promised, booked */}
        <div className="flex flex-col gap-6">
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
                          {new Date(iss.promised_at as string).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            timeZone: LONDON_TZ,
                          })}
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
        </div>
      </div>
    </div>
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
