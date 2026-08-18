import { notFound } from "next/navigation";
import Link from "next/link";
import { getPortalClient } from "@/lib/clientPreview";
import { T } from "@nullshift/ui/tokens";
import { carePlan } from "@/lib/carePlans";
import { CLIENT_STATUS_LABEL, OPEN_STATUSES, type IssueStatus } from "@/lib/ops/issues";
import { StageStepper } from "@/components/portal/StageStepper";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/Reveal";

/**
 * Client project hub — everything for one project on a single mobile-first page:
 * status, the live site link, what they've invested + their care plan, what's
 * being worked on (client-visible issues), updates from the team, and their
 * documents. Requests + quote approvals live on /portal/requests. RLS scopes
 * every read to the client's own tenant.
 */
export const dynamic = "force-dynamic";

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");

type Project = {
  id: string;
  tenant_id: string;
  name: string;
  stage: string;
  proposal_status: string;
  live_url: string | null;
};
type Task = { id: string; title: string; status: string };
type Update = {
  id: string;
  created_at: string;
  type: string;
  title: string;
  body: string | null;
};

// Map each workflow status onto a StatusChip tone (mono uppercase, square).
type Tone = "accent" | "success" | "warning" | "danger" | "muted";
const TONE: Record<string, Tone> = {
  backlog: "muted",
  scoped: "warning",
  approved: "accent",
  in_progress: "accent",
  review: "warning",
  shipped: "success",
  submitted: "accent",
  triaged: "accent",
  awaiting_approval: "warning",
  rejected: "danger",
  // Issue-bank statuses (the "what we're working on" list).
  new: "accent",
  queued: "accent",
  batched: "accent",
  awaiting_client: "warning",
  fixed: "success",
  closed: "muted",
};

function Pill({ s, label }: { s: string; label?: string }) {
  return (
    <StatusChip tone={TONE[s] ?? "muted"}>{label ?? s.replace(/_/g, " ")}</StatusChip>
  );
}

// ── page ──────────────────────────────────────────────────────

export default async function PortalProject({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await getPortalClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, tenant_id, name, stage, proposal_status, live_url")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();
  const p = project as Project;

  const [
    { data: tasks },
    { data: updates },
    { data: invoices },
    { data: subs },
    { count: docCount },
    { data: milestonesRaw },
    { data: onboardingRaw },
  ] = await Promise.all([
    // "What we're working on" reads the issue bank — the tracker staff
    // actually use — not the retired tasks board, and only client-visible
    // rows with client-friendly status labels.
    supabase
      .from("issues")
      .select("id, title, status")
      .eq("project_id", id)
      .eq("client_visible", true)
      .in("status", OPEN_STATUSES)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_updates")
      .select("id, created_at, type, title, body")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("invoices").select("amount, status").eq("tenant_id", p.tenant_id),
    supabase
      .from("subscriptions")
      .select("plan, mrr, status")
      .eq("tenant_id", p.tenant_id)
      .eq("status", "active"),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id),
    // Key dates — milestones are member-readable by design (0028).
    supabase
      .from("milestones")
      .select("id, title, target_date, health")
      .eq("project_id", id)
      .order("target_date", { ascending: true, nullsFirst: false }),
    // Their onboarding checklist — the client-readable kind (0028 RLS).
    supabase
      .from("checklists")
      .select("id, items")
      .eq("project_id", id)
      .eq("kind", "onboarding")
      .maybeSingle(),
  ]);

  const taskList = (tasks ?? []) as Task[];
  const updateList = (updates ?? []) as Update[];
  const milestoneList = (milestonesRaw ?? []) as {
    id: string;
    title: string;
    target_date: string | null;
    health: string;
  }[];
  const onboardingItems = (
    (onboardingRaw?.items ?? []) as {
      name: string;
      done: boolean;
    }[]
  ).filter((i) => !i.done);
  const invList = (invoices ?? []) as { amount: number; status: string }[];
  const invested = invList
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.amount), 0);
  const sub = (subs ?? [])[0] as { plan: string; mrr: number } | undefined;
  const plan = sub ? carePlan(sub.plan) : null;

  // Square link-row style shared by the documents block.
  const docRow: React.CSSProperties = {
    padding: "11px 13px",
    textDecoration: "none",
  };

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 16px 56px" }}>
      <Reveal>
        <Link
          href="/portal"
          className="inline-flex items-center gap-2"
          style={{
            fontFamily: T.mono,
            fontSize: "0.68rem",
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--k-muted)",
            textDecoration: "none",
          }}
        >
          <span aria-hidden>←</span> Your projects
        </Link>
      </Reveal>

      <div style={{ marginTop: 14 }}>
        <PageHeader index="02" label="PROJECT" title={p.name} />
      </div>
      <div style={{ margin: "16px 0 18px" }}>
        <StageStepper stage={p.stage} />
      </div>

      {/* Live site */}
      {p.live_url && (
        <Reveal>
          <a
            href={p.live_url}
            target="_blank"
            rel="noreferrer"
            className="k-kard k-kard-h flex items-center justify-between"
            style={{
              background: "var(--k-surface)",
              borderColor: "var(--k-accent)",
              padding: "18px",
              marginBottom: 14,
              textDecoration: "none",
            }}
          >
            <div>
              <div
                className="inline-flex items-center gap-2"
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.66rem",
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--k-accent)",
                }}
              >
                <span className="k-livedot" aria-hidden />
                Your live site
              </div>
              <div
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.92rem",
                  color: "var(--k-fg)",
                  marginTop: 4,
                  wordBreak: "break-all",
                }}
              >
                {p.live_url.replace(/^https?:\/\//, "")}
              </div>
            </div>
            <span
              className="inline-flex items-center gap-1.5"
              style={{
                fontFamily: T.mono,
                fontSize: "0.68rem",
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--k-accent)",
              }}
            >
              Open
              <span className="k-arrow" aria-hidden>
                ↗
              </span>
            </span>
          </a>
        </Reveal>
      )}

      {/* Invested + plan */}
      <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 14 }}>
        <Reveal delay={0}>
          <StatCard value={gbp(invested)} label="Invested" />
        </Reveal>
        <Reveal delay={0.05}>
          <StatCard
            value={plan ? plan.label : "None yet"}
            label="Care plan"
            sub={plan ? `${gbp(plan.mrr)}/mo` : undefined}
            accent={!!plan}
          />
        </Reveal>
      </div>

      {/* What we still need from you — the client's slice of onboarding */}
      {onboardingItems.length > 0 && (
        <Reveal>
          <Panel
            label="NEEDED FROM YOU"
            title="To keep things moving"
            className="mb-[14px]"
          >
            <div className="flex flex-col gap-1.5">
              {onboardingItems.map((item) => (
                <span
                  key={item.name}
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.88rem",
                    color: "var(--k-fg)",
                  }}
                >
                  ○ {item.name}
                </span>
              ))}
            </div>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.8rem",
                color: "var(--k-faint)",
                marginTop: 10,
              }}
            >
              Send anything on this list over whenever it&apos;s ready — we tick it off as
              it arrives.
            </p>
          </Panel>
        </Reveal>
      )}

      {/* Key dates */}
      {milestoneList.length > 0 && (
        <Reveal>
          <Panel label="KEY DATES" title="Milestones" className="mb-[14px]">
            <div className="flex flex-col">
              {milestoneList.map((m, i) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3"
                  style={{
                    padding: "8px 0",
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                    opacity: m.health === "done" ? 0.55 : 1,
                  }}
                >
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.9rem",
                      color: "var(--k-fg)",
                      textDecoration: m.health === "done" ? "line-through" : "none",
                    }}
                  >
                    {m.title}
                  </span>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.66rem",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: m.health === "done" ? "var(--k-faint)" : "var(--k-accent)",
                    }}
                  >
                    {m.health === "done"
                      ? "Done"
                      : m.target_date
                        ? new Date(m.target_date).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })
                        : "Scheduled"}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>
      )}

      {/* Documents + deliverables */}
      <Reveal>
        <Panel label="DOCUMENTS" title="Documents" className="mb-[14px]">
          <div className="flex flex-col gap-2">
            <Link
              href="/portal/proposal"
              className="flex items-center justify-between"
              style={{
                ...docRow,
                background:
                  p.proposal_status === "sent" ? "rgba(16,185,129,0.12)" : "var(--k-bg)",
                border: `1px solid ${
                  p.proposal_status === "sent" ? "var(--k-accent)" : "var(--k-border)"
                }`,
              }}
            >
              <span
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.92rem",
                  color: "var(--k-fg)",
                }}
              >
                {p.proposal_status === "sent"
                  ? "Review & sign your proposal + DPA"
                  : "Your proposal & DPA"}
              </span>
              <span
                className="inline-flex items-center gap-1.5"
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.66rem",
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--k-accent)",
                }}
              >
                {p.proposal_status === "sent" ? "Action" : "View"}
                <span className="k-arrow" aria-hidden>
                  →
                </span>
              </span>
            </Link>
            <Link
              href="/portal/deliverables"
              className="flex items-center justify-between"
              style={{
                ...docRow,
                background: "var(--k-bg)",
                border: "1px solid var(--k-border)",
              }}
            >
              <span
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.92rem",
                  color: "var(--k-fg)",
                }}
              >
                Deliverables{docCount ? ` (${docCount})` : ""}
              </span>
              <span
                className="inline-flex items-center gap-1.5"
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.66rem",
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--k-accent)",
                }}
              >
                View
                <span className="k-arrow" aria-hidden>
                  →
                </span>
              </span>
            </Link>
          </div>
        </Panel>
      </Reveal>

      {/* Outstanding tasks */}
      <Reveal>
        <Panel label="IN PROGRESS" title="What we're working on" className="mb-[14px]">
          {taskList.length === 0 ? (
            <p
              style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-faint)" }}
            >
              No outstanding tasks right now.
            </p>
          ) : (
            <div className="flex flex-col">
              {taskList.map((t, i) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3"
                  style={{
                    padding: "9px 0",
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                  }}
                >
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.9rem",
                      color: "var(--k-fg)",
                    }}
                  >
                    {t.title}
                  </span>
                  <Pill
                    s={t.status}
                    label={CLIENT_STATUS_LABEL[t.status as IssueStatus]}
                  />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </Reveal>

      {/* Team updates */}
      <Reveal>
        <Panel label="UPDATES" title="Updates from the team" className="mb-[14px]">
          {updateList.length === 0 ? (
            <p
              style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-faint)" }}
            >
              No updates yet — we&apos;ll post progress here.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {updateList.map((u, i) => (
                <div
                  key={u.id}
                  style={{
                    padding: "8px 0",
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                  }}
                >
                  <div
                    className="flex items-center justify-between gap-2"
                    style={{ marginBottom: 4 }}
                  >
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        color: "var(--k-fg)",
                      }}
                    >
                      {u.title}
                    </span>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: "0.62rem",
                        letterSpacing: "0.06em",
                        color: "var(--k-faint)",
                      }}
                    >
                      {new Date(u.created_at).toLocaleDateString("en-GB")}
                    </span>
                  </div>
                  {u.body && (
                    <p
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.86rem",
                        color: "var(--k-muted)",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {u.body}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </Reveal>

      {/* Requests live in ONE place — the issues pipeline on /portal/requests
          (intake, honest status, quote approval). The change_requests panel
          that used to sit here was a second, silent intake nothing monitored. */}
      <Reveal>
        <Panel label="REQUESTS" title="Requests & changes">
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.85rem",
              color: "var(--k-muted)",
              lineHeight: 1.6,
              marginBottom: 12,
            }}
          >
            Want something fixed or changed? Send it from the Requests page — it lands
            straight on our board and you can follow its progress (and approve any quotes)
            there.
          </p>
          <Link href="/portal/requests" className="kb kb-primary kb-sm">
            Open requests →
          </Link>
        </Panel>
      </Reveal>
    </div>
  );
}
