import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { createClient, createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { T } from "@nullshift/ui/tokens";
import { Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import {
  OPEN_STATUSES,
  SOURCE_LABEL,
  isUnreviewedDraft,
  type IssueRow as Issue,
} from "@/lib/ops/issues";
import { needsChangeOrder } from "@/lib/ops/issueForm";
import { SKIP_LABEL, partitionOutstanding } from "@/lib/ops/buildAll";
import { buildEverything } from "./actions";
import { IssueQuickAdd, IssueRow, IssueRowHeader, chip } from "../../../issues/IssueRow";
import { DraftList, IngestForm } from "../../../inbox/IngestPanels";
import { advanceCr, advanceTask, createTask } from "../actions";
import {
  Badge,
  CR_NEXT,
  TilePage,
  btn,
  card,
  h2,
  inp,
  loadTenantAndProjects,
  monoLink,
  type CR,
} from "../_shared";

/**
 * Issues and Bugs tile — the client's working issue surface, not a list:
 * quick-add (// LOG ISSUE) with the system fixed, the issue table with the
 * same inline triage / quote / queue / close editor as the issue bank (and
 * the §8 "Raise Change Order" hand-off on rows that need one), the promise
 * ledger, the ingest funnel for this client (// PASTE SOURCE + // AWAITING
 * REVIEW), then build edits (change requests across every project), the
 * fix batches compiled for this client's systems and the delivery-tasks
 * Kanban (moved from /admin/tasks).
 */
export const dynamic = "force-dynamic";
// The paste form's AI parsing of long transcripts can exceed the default
// serverless limit — same as /admin/inbox, which hosts the same action.
export const maxDuration = 120;

type Batch = {
  id: string;
  project_id: string;
  title: string | null;
  status: string;
  created_at: string;
  dispatched_at: string | null;
  shipped_at: string | null;
  pr_url: string | null;
  github_issue_url: string | null;
  routine_session_url: string | null;
};
type Task = {
  id: string;
  tenant_id: string;
  project_id: string;
  title: string;
  status: string;
  estimate_hours: number | null;
  origin: string;
};
type CRWithProject = CR & { project_id: string };
type OrderFormLite = { id: string; status: string };

/** Status filter chips — deliberately coarser than the bank's nine. */
const FILTERS = [
  { id: "open", label: "Open" },
  { id: "awaiting", label: "Awaiting client" },
  { id: "all", label: "All" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

const FLOW = [
  "backlog",
  "scoped",
  "approved",
  "in_progress",
  "review",
  "shipped",
] as const;
const TASK_NEXT: Record<string, string> = {
  backlog: "scoped",
  scoped: "approved",
  approved: "in_progress",
  in_progress: "review",
  review: "shipped",
};
const BATCH_TONE: Record<string, "accent" | "success" | "warning" | "danger" | "muted"> =
  {
    draft: "muted",
    compiled: "accent",
    dispatched: "accent",
    pr_open: "warning",
    merged: "success",
    shipped: "success",
  };

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** An unreviewed draft that the inbox actions will accept (ingest-born). */
const isIngestDraft = (i: Issue) =>
  isUnreviewedDraft(i) && (i.ai as { from?: unknown } | null)?.from === "ingest";

export default async function ClientIssuesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    status?: string;
    project?: string;
    err?: string;
    built?: string;
    n?: string;
    promoted?: string;
    skipped?: string;
    fired?: string;
    session?: string;
  }>;
}) {
  const { id: tenantId } = await params;
  if (!(await requireStaff()).ok) notFound();
  const sp = await searchParams;
  const { status: statusParam, project: projectParam } = sp;
  const filter: Filter = FILTERS.some((f) => f.id === statusParam)
    ? (statusParam as Filter)
    : "open";

  const { tenant, projects, project } = await loadTenantAndProjects(tenantId);
  // The systems passport links here with ?project= — narrow to that system.
  const projectFilter =
    projectParam && projects.some((p) => p.id === projectParam) ? projectParam : null;
  const projectIds = projects.map((p) => p.id);
  const supabase = await createClient();
  const service = createServiceClient();

  const noRows = Promise.resolve({ data: [] as Record<string, unknown>[] });
  const [
    { data: issueRows },
    { data: crs },
    { data: batchRows },
    { data: taskRows },
    { data: orderRows },
  ] = await Promise.all([
    supabase
      .from("issues")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(200),
    projectIds.length
      ? supabase
          .from("change_requests")
          .select("id, project_id, description, status, estimate_hours, quoted_price")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
      : noRows,
    projectIds.length
      ? supabase
          .from("fix_batches")
          .select(
            "id, project_id, title, status, created_at, dispatched_at, shipped_at, pr_url, github_issue_url, routine_session_url"
          )
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
          .limit(50)
      : noRows,
    projectIds.length
      ? supabase
          .from("tasks")
          .select("id, tenant_id, project_id, title, status, estimate_hours, origin")
          .in("project_id", projectIds)
          .order("created_at")
      : noRows,
    // The live Order Form a Change Order hangs off (same pick as /agreement).
    service
      .from("order_forms")
      .select("id, status")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
  ]);

  const allIssues = (issueRows ?? []) as Issue[];
  // Ingest drafts are reviewed below, not triaged: they are not the client's
  // issues until a human confirms them (same rule as the Dashboard counts).
  const drafts = allIssues.filter(isIngestDraft);
  const issues = allIssues.filter((i) => !isIngestDraft(i));
  const counted = issues.filter((i) => !isUnreviewedDraft(i));
  const open = counted.filter((i) => OPEN_STATUSES.includes(i.status));
  const critHigh = open.filter((i) => i.severity === "critical" || i.severity === "high");
  const awaitingClient = open.filter((i) => i.status === "awaiting_client");
  const nowMs = Date.now();
  const isOverdue = (i: Issue) =>
    Boolean(i.due_at) &&
    OPEN_STATUSES.includes(i.status) &&
    new Date(i.due_at as string).getTime() < nowMs;
  const promises = issues
    .filter((i) => OPEN_STATUSES.includes(i.status) && i.promised_at)
    .sort(
      (a, b) =>
        new Date(a.promised_at as string).getTime() -
        new Date(b.promised_at as string).getTime()
    );
  const promiseLate = (i: Issue) => new Date(i.promised_at as string).getTime() < nowMs;
  const needsCo = open.filter(needsChangeOrder);

  // "Build everything outstanding" preview — what one click would compile
  // on the chosen system, and what the gates would hold back.
  const buildProject = projectFilter
    ? (projects.find((p) => p.id === projectFilter) ?? project)
    : project;
  const coIds = [
    ...new Set(open.map((i) => i.change_order_id).filter(Boolean)),
  ] as string[];
  const [{ data: coRows }, { data: profileRows }] = await Promise.all([
    coIds.length
      ? supabase.from("change_orders").select("id, status").in("id", coIds)
      : Promise.resolve({ data: [] as { id: string; status: string }[] }),
    projectIds.length
      ? service
          .from("system_profiles")
          .select("project_id, routine_fire_url, routine_token")
          .in("project_id", projectIds)
      : Promise.resolve({
          data: [] as {
            project_id: string;
            routine_fire_url: string | null;
            routine_token: string | null;
          }[],
        }),
  ]);
  const coStatus = new Map(
    ((coRows ?? []) as { id: string; status: string }[]).map((c) => [c.id, c.status])
  );
  const routineReady = new Set(
    (
      (profileRows ?? []) as {
        project_id: string;
        routine_fire_url: string | null;
        routine_token: string | null;
      }[]
    )
      .filter((r) => r.routine_fire_url && r.routine_token)
      .map((r) => r.project_id)
  );
  const buildPart = buildProject
    ? partitionOutstanding(
        issues.filter((i) => i.project_id === buildProject.id),
        coStatus
      )
    : { ready: [], promote: [], blocked: [] };
  const buildCount = buildPart.ready.length + buildPart.promote.length;
  const buildRoutine = buildProject ? routineReady.has(buildProject.id) : false;

  const crList = (crs ?? []) as CRWithProject[];
  const batches = (batchRows ?? []) as Batch[];
  // Batched issues live in their batch's folder below, not in the open list.
  const batchIds = new Set(batches.map((b) => b.id));
  const inFolder = (i: Issue) => Boolean(i.batch_id && batchIds.has(i.batch_id));
  const loose = issues.filter((i) => !inFolder(i));
  const issuesOf = (batchId: string) => issues.filter((i) => i.batch_id === batchId);
  const folderBatches = projectFilter
    ? batches.filter((b) => b.project_id === projectFilter)
    : batches;
  const activeBatch = (b: Batch) => b.status !== "shipped" && b.status !== "cancelled";
  const firstActiveBatch = folderBatches.find(activeBatch)?.id ?? null;

  const shown =
    filter === "open"
      ? loose.filter((i) => OPEN_STATUSES.includes(i.status))
      : filter === "awaiting"
        ? loose.filter((i) => i.status === "awaiting_client")
        : loose;
  const shownForProject = projectFilter
    ? shown.filter(
        (i) => (i as { project_id?: string | null }).project_id === projectFilter
      )
    : shown;
  const taskList = (taskRows ?? []) as Task[];
  const orders = (orderRows ?? []) as OrderFormLite[];
  const liveOrderForm =
    orders.find((o) => o.status === "accepted") ??
    orders.find((o) => o.status === "client_review") ??
    orders.find((o) => o.status === "draft") ??
    null;
  const changeOrderTarget = { tenantId, orderFormId: liveOrderForm?.id ?? null };
  const projectName = (id: string | null) =>
    projects.find((p) => p.id === id)?.name ?? "—";
  const projectOptions = projects.map((p) => ({ id: p.id, label: p.name }));
  const bankHref = (i: Issue) =>
    `/admin/issues?tenant=${tenantId}${i.project_id ? `&project=${i.project_id}` : ""}&issue=${i.id}`;
  const filterHref = (f: Filter) => `/admin/clients/${tenantId}/issues?status=${f}`;

  const headerTone =
    critHigh.length > 0 || open.some(isOverdue) || promises.some(promiseLate)
      ? "danger"
      : open.length > 0 || drafts.length > 0 || needsCo.length > 0
        ? "warning"
        : "success";
  const headerChip =
    open.length > 0
      ? `${open.length} open · ${critHigh.length} critical/high`
      : "All clear";

  const htid = <input type="hidden" name="tenant_id" value={tenantId} />;
  const faint = {
    fontFamily: T.sans,
    fontSize: "0.85rem",
    color: "var(--k-faint)",
  } as const;

  return (
    <TilePage
      tenantId={tenantId}
      tenantName={tenant.name}
      index="03"
      label="Issues and Bugs"
      title={tenant.name}
      lead={
        awaitingClient.length > 0
          ? `${awaitingClient.length} waiting on the client · ${drafts.length} inbox draft${drafts.length === 1 ? "" : "s"} awaiting review`
          : `${counted.length} issue${counted.length === 1 ? "" : "s"} on record · ${drafts.length} inbox draft${drafts.length === 1 ? "" : "s"} awaiting review`
      }
      actions={
        <>
          <StatusChip tone={headerTone}>{headerChip}</StatusChip>
          <Link href={`/admin/issues?tenant=${tenantId}`} style={monoLink}>
            Open in the issue bank →
          </Link>
        </>
      }
      maxWidth={1100}
    >
      {/* ── Counts ─────────────────────────────────────────── */}
      <Reveal className="block">
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            marginBottom: 16,
          }}
        >
          <StatCard value={String(open.length)} label="Open" accent={open.length > 0} />
          <StatCard
            value={String(critHigh.length)}
            label="Critical / high"
            sub={
              open.filter(isOverdue).length
                ? `${open.filter(isOverdue).length} overdue`
                : undefined
            }
          />
          <StatCard value={String(awaitingClient.length)} label="Awaiting client" />
          <StatCard
            value={String(needsCo.length)}
            label="Need Change Order"
            sub={
              drafts.length
                ? `${drafts.length} draft${drafts.length === 1 ? "" : "s"} to review`
                : undefined
            }
          />
        </div>
      </Reveal>

      {/* ── Build everything outstanding ────────────────────── */}
      {(sp.built || sp.err) && (
        <Reveal className="block" delay={0.03}>
          <div
            role="status"
            style={{
              ...card,
              marginBottom: 16,
              borderColor: sp.err ? "var(--k-danger)" : "var(--k-success)",
            }}
          >
            {sp.err ? (
              <p style={{ ...faint, color: "var(--k-danger)", margin: 0 }}>{sp.err}</p>
            ) : (
              <p style={{ ...faint, color: "var(--k-fg)", margin: 0 }}>
                Compiled {sp.n} issue{sp.n === "1" ? "" : "s"} into one work order
                {sp.promoted && sp.promoted !== "0"
                  ? ` (${sp.promoted} marked covered by the plan)`
                  : ""}
                {sp.skipped && sp.skipped !== "0" ? ` · ${sp.skipped} left out` : ""}.{" "}
                {sp.fired === "1" ? (
                  <>
                    Claude is building now
                    {sp.session?.startsWith("https://claude.ai/") ? (
                      <>
                        {" "}
                        —{" "}
                        <a
                          href={sp.session}
                          target="_blank"
                          rel="noreferrer"
                          style={monoLink}
                        >
                          watch the session →
                        </a>
                      </>
                    ) : null}
                    .
                  </>
                ) : (
                  <>
                    The routine did not fire — open{" "}
                    <Link href={`/admin/batches/${sp.built}`} style={monoLink}>
                      the batch →
                    </Link>{" "}
                    to dispatch it by hand.
                  </>
                )}
              </p>
            )}
          </div>
        </Reveal>
      )}
      {buildProject && (
        <Reveal className="block" delay={0.035}>
          <Panel label="// BUILD EVERYTHING" style={{ marginBottom: 16 }}>
            <form
              action={buildEverything}
              className="flex flex-wrap items-start justify-between gap-3"
            >
              {htid}
              <input type="hidden" name="project_id" value={buildProject.id} />
              <div className="min-w-0" style={{ flex: "1 1 320px" }}>
                <p style={{ ...faint, color: "var(--k-fg)", margin: 0 }}>
                  {buildCount === 0
                    ? `Nothing outstanding on ${buildProject.name}.`
                    : `${buildCount} outstanding on ${buildProject.name} — every change request, question and bug still open — goes into one work order and straight to Claude.`}
                </p>
                {buildPart.promote.length > 0 && (
                  <p style={{ ...faint, margin: "4px 0 0" }}>
                    {buildPart.promote.length} unclassified issue
                    {buildPart.promote.length === 1 ? "" : "s"} will be marked covered by
                    the plan on the way through.
                  </p>
                )}
                {!buildRoutine && buildCount > 0 && (
                  <p style={{ ...faint, margin: "4px 0 0", color: "var(--k-warning)" }}>
                    No routine on this system&apos;s passport — the batch compiles but you
                    will need to dispatch it by hand.
                  </p>
                )}
                {buildPart.blocked.length > 0 && (
                  <ul style={{ ...faint, margin: "6px 0 0", paddingLeft: 18 }}>
                    {buildPart.blocked.map(({ issue, reason }) => (
                      <li key={issue.id}>
                        Left out: {issue.title} — {SKIP_LABEL[reason]}
                      </li>
                    ))}
                  </ul>
                )}
                {projects.length > 1 && (
                  <p style={{ ...faint, margin: "6px 0 0", fontSize: "0.78rem" }}>
                    Other systems:{" "}
                    {projects
                      .filter((p) => p.id !== buildProject.id)
                      .map((p, i) => (
                        <span key={p.id}>
                          {i ? " · " : ""}
                          <Link
                            href={`/admin/clients/${tenantId}/issues?project=${p.id}`}
                            style={monoLink}
                          >
                            {p.name}
                          </Link>
                        </span>
                      ))}
                  </p>
                )}
              </div>
              <SubmitButton
                style={btn("var(--k-accent)", "var(--k-bg)")}
                disabled={buildCount === 0}
                pendingLabel="Compiling and sending to Claude…"
              >
                Build everything outstanding
              </SubmitButton>
            </form>
          </Panel>
        </Reveal>
      )}

      {/* ── Quick add — system fixed to this client ────────── */}
      {projects.length > 0 ? (
        <Reveal className="block" delay={0.04}>
          <Panel label="// LOG ISSUE" style={{ marginBottom: 16 }}>
            <IssueQuickAdd projectOptions={projectOptions} />
          </Panel>
        </Reveal>
      ) : (
        <Reveal className="block" delay={0.04}>
          <Panel label="// LOG ISSUE" style={{ marginBottom: 16 }}>
            <p style={faint}>
              No build project yet — issues are logged against a system.{" "}
              <Link href={`/admin/clients/${tenantId}/passport`} style={monoLink}>
                Start the build project →
              </Link>
            </p>
          </Panel>
        </Reveal>
      )}

      {/* ── Issues — inline triage, same editor as the bank ── */}
      <Reveal className="block" delay={0.06}>
        <Panel
          label="// ISSUES"
          pad={false}
          style={{ marginBottom: 16 }}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {FILTERS.map((f) => (
                <Link key={f.id} href={filterHref(f.id)} style={chip(filter === f.id)}>
                  {f.label}
                  {f.id === "awaiting" && awaitingClient.length > 0
                    ? ` · ${awaitingClient.length}`
                    : f.id === "open" && open.length > 0
                      ? ` · ${open.length}`
                      : ""}
                </Link>
              ))}
            </div>
          }
        >
          {/* Right-hand gutter carries the deep link into the bank: the
              title itself is the <summary> toggle for the inline editor. */}
          <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1fr) 44px" }}>
            <IssueRowHeader hasRows={shownForProject.length > 0} />
            <div
              className="max-md:hidden"
              style={{
                background: "var(--k-surface)",
                borderBottom: shownForProject.length
                  ? "1px solid var(--k-border)"
                  : "none",
              }}
            />
            {shownForProject.length === 0 && (
              <p
                className="text-center py-7"
                style={{ ...faint, color: "var(--k-muted)", gridColumn: "1 / -1" }}
              >
                {filter === "all"
                  ? "No issues logged for this client — use // LOG ISSUE above."
                  : filter === "awaiting"
                    ? "Nothing is waiting on the client."
                    : "Nothing open outside a batch — see the folders below."}
              </p>
            )}
            {shownForProject.map((issue, i) => (
              <div key={issue.id} className="contents">
                <div className="min-w-0">
                  <IssueRow
                    issue={issue}
                    subline={`${projectName(issue.project_id)} · ${SOURCE_LABEL[issue.source] ?? issue.source}`}
                    first={i === 0}
                    nowMs={nowMs}
                    changeOrder={changeOrderTarget}
                  />
                </div>
                <div
                  className="flex justify-center"
                  style={{
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                    paddingTop: 13,
                  }}
                >
                  <Link
                    href={bankHref(issue)}
                    title="Open this issue in the issue bank"
                    style={{ ...monoLink, fontSize: 12, lineHeight: 1 }}
                  >
                    ↗
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </Reveal>

      {/* ── Batches — folders of issues handed to Claude ────── */}
      <Reveal className="block" delay={0.07}>
        <Panel
          label="// BATCHES"
          pad={false}
          style={{ marginBottom: 16 }}
          actions={
            project ? (
              <Link href={`/admin/batches?project=${project.id}`} style={monoLink}>
                All batches →
              </Link>
            ) : undefined
          }
        >
          {folderBatches.length === 0 ? (
            <p
              className="text-center py-7"
              style={{ ...faint, color: "var(--k-muted)", margin: 0 }}
            >
              No batches yet — // BUILD EVERYTHING above compiles the open issues into
              one.
            </p>
          ) : (
            folderBatches.map((b, idx) => {
              const items = issuesOf(b.id);
              const done = items.filter((i) =>
                ["fixed", "shipped", "closed"].includes(i.status)
              ).length;
              return (
                <details
                  key={b.id}
                  open={b.id === firstActiveBatch}
                  style={{ borderTop: idx ? "1px solid var(--k-border)" : "none" }}
                >
                  <summary
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5"
                    style={{ padding: "10px 14px", cursor: "pointer", listStyle: "none" }}
                  >
                    <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>
                      {activeBatch(b) ? "📂" : "📁"}
                    </span>
                    <span className="min-w-0" style={{ flex: "1 1 240px" }}>
                      <span
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.88rem",
                          color: "var(--k-fg)",
                          display: "block",
                        }}
                      >
                        {b.title ?? "Fix batch"}
                      </span>
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: 10,
                          color: "var(--k-faint)",
                          display: "block",
                          marginTop: 2,
                        }}
                      >
                        {projectName(b.project_id)} · {shortDate(b.created_at)} ·{" "}
                        {items.length} issue{items.length === 1 ? "" : "s"}
                        {items.length ? ` · ${done} done` : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-3 flex-wrap">
                      {b.routine_session_url?.startsWith("https://claude.ai/") && (
                        <a
                          href={b.routine_session_url}
                          target="_blank"
                          rel="noreferrer"
                          style={monoLink}
                        >
                          Session ↗
                        </a>
                      )}
                      {b.pr_url && (
                        <a
                          href={b.pr_url}
                          target="_blank"
                          rel="noreferrer"
                          style={monoLink}
                        >
                          PR ↗
                        </a>
                      )}
                      <Link href={`/admin/batches/${b.id}`} style={monoLink}>
                        Open →
                      </Link>
                      <StatusChip tone={BATCH_TONE[b.status] ?? "muted"}>
                        {b.status.replace(/_/g, " ")}
                      </StatusChip>
                    </span>
                  </summary>
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: "minmax(0, 1fr) 44px",
                      borderTop: "1px solid var(--k-border)",
                    }}
                  >
                    <IssueRowHeader hasRows={items.length > 0} />
                    <div
                      className="max-md:hidden"
                      style={{
                        background: "var(--k-surface)",
                        borderBottom: items.length ? "1px solid var(--k-border)" : "none",
                      }}
                    />
                    {items.length === 0 && (
                      <p
                        className="text-center py-5"
                        style={{
                          ...faint,
                          color: "var(--k-muted)",
                          gridColumn: "1 / -1",
                        }}
                      >
                        No issues on this batch (modules or exceptions only).
                      </p>
                    )}
                    {items.map((issue, i) => (
                      <div key={issue.id} className="contents">
                        <div className="min-w-0">
                          <IssueRow
                            issue={issue}
                            subline={`${projectName(issue.project_id)} · ${SOURCE_LABEL[issue.source] ?? issue.source}`}
                            first={i === 0}
                            nowMs={nowMs}
                            changeOrder={changeOrderTarget}
                          />
                        </div>
                        <div
                          className="flex justify-center"
                          style={{
                            borderTop: i ? "1px solid var(--k-border)" : "none",
                            paddingTop: 13,
                          }}
                        >
                          <Link
                            href={bankHref(issue)}
                            title="Open this issue in the issue bank"
                            style={{ ...monoLink, fontSize: 12, lineHeight: 1 }}
                          >
                            ↗
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })
          )}
        </Panel>
      </Reveal>

      {/* ── Promise ledger ──────────────────────────────────── */}
      <Reveal className="block" delay={0.08}>
        <Panel label="// PROMISES" pad={false} style={{ marginBottom: 16 }}>
          {promises.length === 0 ? (
            <p className="text-center py-6" style={{ ...faint, color: "var(--k-muted)" }}>
              Nothing promised to this client that is still open.
            </p>
          ) : (
            promises.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-4 flex-wrap"
                style={{
                  padding: "11px 18px",
                  borderTop: i ? "1px solid var(--k-border)" : "none",
                }}
              >
                <Link
                  href={bankHref(p)}
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.86rem",
                    fontWeight: 600,
                    color: "var(--k-fg)",
                    textDecoration: "none",
                  }}
                >
                  {p.title}
                </Link>
                {p.promised_note && (
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.85rem",
                      color: "var(--k-muted)",
                    }}
                  >
                    {p.promised_note}
                  </span>
                )}
                <span
                  className="ml-auto flex items-center gap-2"
                  style={{
                    fontFamily: T.mono,
                    fontSize: "10px",
                    color: "var(--k-faint)",
                  }}
                >
                  {projectName(p.project_id)} · {p.status.replace(/_/g, " ")} ·{" "}
                  {shortDate(p.promised_at as string)}
                  {promiseLate(p) && <StatusChip tone="danger">late</StatusChip>}
                </span>
              </div>
            ))
          )}
        </Panel>
      </Reveal>

      {/* ── Ingest funnel for this client ───────────────────── */}
      <Reveal className="block" delay={0.1}>
        <Panel
          label="// AWAITING REVIEW"
          pad={false}
          style={{ marginBottom: 16 }}
          actions={
            <Link href="/admin/inbox" style={monoLink}>
              Global inbox →
            </Link>
          }
        >
          <DraftList
            drafts={drafts}
            subline={(d) =>
              `${projectName(d.project_id)} · ${SOURCE_LABEL[d.source] ?? d.source}`
            }
          />
        </Panel>
      </Reveal>

      {projects.length > 0 && (
        <Reveal className="block" delay={0.12}>
          <Panel label="// PASTE SOURCE" style={{ marginBottom: 16 }}>
            <p style={{ ...faint, fontSize: "0.8rem", margin: "0 0 12px" }}>
              Paste a WhatsApp export, Zoom transcript or forwarded email — Claude splits
              it into draft issues for {tenant.name}, which land above for you to confirm.
            </p>
            <IngestForm projectOptions={projectOptions} />
          </Panel>
        </Reveal>
      )}

      {/* ── Change requests — every project of the tenant ──── */}
      {projects.length > 0 && (
        <Reveal>
          <section style={card}>
            <h2 style={h2}>Build edits (change requests)</h2>
            {crList.length === 0 && (
              <p style={faint}>None — the client submits these from their portal.</p>
            )}
            <div className="flex flex-col gap-2">
              {crList.map((cr) => (
                <div
                  key={cr.id}
                  style={{
                    background: "var(--k-bg)",
                    border: "1px solid var(--k-border)",
                    borderRadius: 0,
                    padding: "10px 12px",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.86rem",
                        color: "var(--k-fg)",
                      }}
                    >
                      {cr.description}
                    </p>
                    <Badge s={cr.status} />
                  </div>
                  {(projects.length > 1 ||
                    cr.estimate_hours != null ||
                    cr.quoted_price != null) && (
                    <div
                      style={{
                        fontFamily: T.mono,
                        fontSize: 11,
                        color: "var(--k-muted)",
                        marginTop: 5,
                      }}
                    >
                      {projects.length > 1 && <>{projectName(cr.project_id)}</>}
                      {cr.estimate_hours != null && (
                        <>
                          {projects.length > 1 ? " · " : ""}est {cr.estimate_hours}h
                        </>
                      )}
                      {cr.quoted_price != null && <> · £{cr.quoted_price}</>}
                    </div>
                  )}
                  <div
                    className="flex items-center gap-2 flex-wrap"
                    style={{ marginTop: 8 }}
                  >
                    {cr.status === "submitted" && (
                      <form action={advanceCr}>
                        {htid}
                        <input type="hidden" name="id" value={cr.id} />
                        <input type="hidden" name="action" value="triage" />
                        <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)")}>
                          Triage
                        </SubmitButton>
                      </form>
                    )}
                    {(cr.status === "triaged" || cr.status === "submitted") && (
                      <form action={advanceCr} className="flex items-center gap-1.5">
                        {htid}
                        <input type="hidden" name="id" value={cr.id} />
                        <input type="hidden" name="action" value="scope" />
                        <input
                          name="estimate_hours"
                          type="number"
                          step="0.5"
                          placeholder="hrs"
                          required
                          style={{ ...inp, width: 64, height: 28 }}
                        />
                        <input
                          name="quoted_price"
                          type="number"
                          step="1"
                          placeholder="£"
                          required
                          style={{ ...inp, width: 70, height: 28 }}
                        />
                        <SubmitButton style={btn(T.warning, "#1a1300")}>
                          Scope →
                        </SubmitButton>
                      </form>
                    )}
                    {CR_NEXT[cr.status] && (
                      <form action={advanceCr}>
                        {htid}
                        <input type="hidden" name="id" value={cr.id} />
                        <input type="hidden" name="action" value={cr.status} />
                        <SubmitButton
                          style={btn("var(--k-accent)", "var(--k-on-accent)")}
                        >
                          Move to {CR_NEXT[cr.status].replace(/_/g, " ")}
                        </SubmitButton>
                      </form>
                    )}
                    {cr.status === "awaiting_approval" && (
                      <span
                        style={{ fontFamily: T.mono, fontSize: 11, color: T.warning }}
                      >
                        waiting on client approval
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {/* Delivery tasks — the internal engine, moved from /admin/tasks */}
      {projects.length > 0 && (
        <Reveal>
          <section style={card}>
            <h2 style={h2}>Delivery tasks</h2>
            <form action={createTask} className="flex items-center gap-2 flex-wrap">
              {projects.length > 1 ? (
                <select
                  name="project_id"
                  required
                  defaultValue={project?.id ?? ""}
                  style={inp}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input type="hidden" name="project_id" value={projects[0].id} />
              )}
              <input
                name="title"
                placeholder="Task title"
                required
                style={{ ...inp, width: 220 }}
              />
              <input
                name="estimate_hours"
                type="number"
                step="0.5"
                placeholder="hrs"
                style={{ ...inp, width: 70 }}
              />
              <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)")}>
                + Task
              </SubmitButton>
            </form>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 10,
                alignItems: "start",
                marginTop: 16,
              }}
            >
              {FLOW.map((col) => {
                const items = taskList.filter((t) => t.status === col);
                return (
                  <div
                    key={col}
                    style={{
                      background: "var(--k-bg)",
                      border: "1px solid var(--k-border)",
                      padding: 10,
                    }}
                  >
                    <div
                      className="flex items-center justify-between"
                      style={{
                        marginBottom: 8,
                        paddingBottom: 6,
                        borderBottom: "1px solid var(--k-border)",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: "10px",
                          fontWeight: 500,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "var(--k-muted)",
                        }}
                      >
                        {col.replace(/_/g, " ")}
                      </span>
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: "10px",
                          color: items.length ? "var(--k-accent)" : "var(--k-faint)",
                        }}
                      >
                        {items.length}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {items.map((t) => (
                        <div
                          key={t.id}
                          style={{
                            background: "var(--k-surface)",
                            border: "1px solid var(--k-border)",
                            borderRadius: 0,
                            padding: "9px 10px",
                          }}
                        >
                          <div
                            style={{
                              fontFamily: T.sans,
                              fontWeight: 600,
                              fontSize: "0.84rem",
                              color: "var(--k-fg)",
                              lineHeight: 1.35,
                            }}
                          >
                            {t.title}
                          </div>
                          <div
                            style={{
                              fontFamily: T.mono,
                              fontSize: "10px",
                              letterSpacing: "0.04em",
                              color: "var(--k-faint)",
                              marginTop: 5,
                            }}
                          >
                            {projects.length > 1 ? `${projectName(t.project_id)} · ` : ""}
                            {t.origin}
                            {t.estimate_hours != null && <> · {t.estimate_hours}h</>}
                          </div>
                          {TASK_NEXT[t.status] && (
                            <form action={advanceTask} style={{ marginTop: 8 }}>
                              <input type="hidden" name="id" value={t.id} />
                              <input type="hidden" name="tenant_id" value={t.tenant_id} />
                              <input type="hidden" name="from" value={t.status} />
                              <SubmitButton
                                style={{
                                  fontFamily: T.mono,
                                  fontSize: "10px",
                                  fontWeight: 500,
                                  letterSpacing: "0.06em",
                                  textTransform: "uppercase",
                                  height: 26,
                                  paddingInline: 9,
                                  background: "var(--k-surface)",
                                  color: "var(--k-accent)",
                                  border: "1px solid var(--k-border)",
                                  borderRadius: 0,
                                  cursor: "pointer",
                                }}
                              >
                                → {TASK_NEXT[t.status].replace(/_/g, " ")}
                              </SubmitButton>
                            </form>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </Reveal>
      )}
    </TilePage>
  );
}
