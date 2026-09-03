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
  searchParams: Promise<{ status?: string; project?: string }>;
}) {
  const { id: tenantId } = await params;
  if (!(await requireStaff()).ok) notFound();
  const { status: statusParam, project: projectParam } = await searchParams;
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
          .select("id, project_id, title, status, created_at")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
          .limit(20)
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

  const shown =
    filter === "open"
      ? issues.filter((i) => OPEN_STATUSES.includes(i.status))
      : filter === "awaiting"
        ? issues.filter((i) => i.status === "awaiting_client")
        : issues;
  const shownForProject = projectFilter
    ? shown.filter(
        (i) => (i as { project_id?: string | null }).project_id === projectFilter
      )
    : shown;

  const crList = (crs ?? []) as CRWithProject[];
  const batches = (batchRows ?? []) as Batch[];
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
                    : "Nothing open — every issue is fixed, shipped or closed."}
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

      {/* Fix batches — code work orders for this client's systems */}
      <Reveal>
        <section style={card}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 style={{ ...h2, marginBottom: 0 }}>Fix batches</h2>
            {project && (
              <Link href={`/admin/batches?project=${project.id}`} style={monoLink}>
                Compile a batch →
              </Link>
            )}
          </div>
          <p style={{ ...faint, fontSize: "0.8rem", margin: "6px 0 12px" }}>
            Queued issues compiled into a work order for Claude — dispatch, review the PR,
            ship.
          </p>
          {batches.length === 0 ? (
            <p style={faint}>No batches compiled for this client&apos;s systems yet.</p>
          ) : (
            <div className="flex flex-col">
              {batches.map((b, idx) => (
                <Link
                  key={b.id}
                  href={`/admin/batches/${b.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5"
                  style={{
                    padding: "8px 0",
                    borderTop: idx ? "1px solid var(--k-border)" : "none",
                    textDecoration: "none",
                  }}
                >
                  <div className="min-w-0">
                    <div
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.88rem",
                        color: "var(--k-fg)",
                      }}
                    >
                      {b.title ?? "Fix batch"}
                    </div>
                    <div
                      style={{
                        fontFamily: T.mono,
                        fontSize: 10,
                        color: "var(--k-faint)",
                        marginTop: 2,
                      }}
                    >
                      {projectName(b.project_id)} · {shortDate(b.created_at)}
                    </div>
                  </div>
                  <StatusChip tone={BATCH_TONE[b.status] ?? "muted"}>
                    {b.status.replace(/_/g, " ")}
                  </StatusChip>
                </Link>
              ))}
            </div>
          )}
        </section>
      </Reveal>

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
