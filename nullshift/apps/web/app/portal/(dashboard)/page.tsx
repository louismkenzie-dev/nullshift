import Link from "next/link";
import { getPortalClient } from "@/lib/clientPreview";
import { T } from "@nullshift/ui/tokens";
import { carePlan, currentPeriodStart, remainingAllowance } from "@/lib/carePlans";
import {
  CLIENT_STATUS_LABEL,
  OPEN_STATUSES,
  STATUS_TONE,
  type IssueRow,
} from "@/lib/ops/issues";
import { StageStepper } from "@/components/portal/StageStepper";
import { BankTransferDetails } from "@/components/portal/BankTransferDetails";
import { clientRef, invoiceRef } from "@nullshift/ui/format";
import { FileText, CreditCard, MessageSquare, Bell, Shield, Folder } from "lucide-react";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { Eyebrow, Display, Lead } from "@/components/kyma";
import { Reveal } from "@/components/Reveal";

/**
 * Client portal home — "Your system" at a glance: where the build is, anything
 * open, anything we need from them, the latest news, their plan and payments.
 * RLS scopes every read to the client's own tenant, so no tenant filters here.
 */
export const dynamic = "force-dynamic";

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");
const dateGB = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

type Project = {
  id: string;
  name: string;
  stage: string;
  proposal_status: string;
  live_url: string | null;
};
type PortalIssue = Pick<IssueRow, "id" | "title" | "status" | "created_at">;
type UpdateRow = {
  id: string;
  title: string;
  created_at: string;
  type: string;
  requires_action: boolean | null;
  action_resolved: boolean | null;
};

/** Small mono link used at the foot of the home panels. */
function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5"
      style={{
        fontFamily: T.mono,
        fontSize: "0.66rem",
        fontWeight: 500,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--k-accent)",
        textDecoration: "none",
      }}
    >
      {children}
      <span className="k-arrow" aria-hidden>
        →
      </span>
    </Link>
  );
}

export default async function PortalHome({
  searchParams,
}: {
  searchParams: Promise<{ care?: string }>;
}) {
  const { care } = await searchParams;
  const { supabase } = await getPortalClient();
  const [
    { data: tenants },
    { data: projects },
    { data: issues },
    { data: updates },
    { data: invoices },
    { data: subs },
    { data: credits },
  ] = await Promise.all([
    supabase.from("tenants").select("id, name").limit(1),
    supabase
      .from("projects")
      .select("id, name, stage, proposal_status, live_url")
      .order("created_at"),
    supabase
      .from("issues")
      .select("id, title, status, created_at")
      .in("status", OPEN_STATUSES)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_updates")
      .select("id, title, created_at, type, requires_action, action_resolved")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("invoices")
      .select("id, tenant_id, amount, status, hosted_invoice_url")
      .order("created_at", { ascending: false }),
    supabase.from("subscriptions").select("plan, mrr, status").eq("status", "active"),
    supabase
      .from("build_credit_events")
      .select("delta")
      .eq("period", currentPeriodStart()),
  ]);

  const tenant = (tenants ?? [])[0] as { id: string; name: string } | undefined;
  const projectList = (projects ?? []) as Project[];
  const openIssues = (issues ?? []) as PortalIssue[];
  const updateList = (updates ?? []) as UpdateRow[];
  const invList = (invoices ?? []) as {
    id: string;
    tenant_id: string;
    amount: number;
    status: string;
    hosted_invoice_url: string | null;
  }[];
  // Invoices to surface for payment: sent/open/paid (skip drafts + voided).
  const billed = invList.filter((i) => i.status !== "void" && i.status !== "draft");
  const sub = (subs ?? [])[0] as { plan: string; mrr: number } | undefined;
  const plan = sub ? carePlan(sub.plan) : null;
  const deltaSum = ((credits ?? []) as { delta: number }[]).reduce(
    (s, e) => s + Number(e.delta),
    0
  );
  const remaining = remainingAllowance(plan, deltaSum);

  const decisions = updateList.filter(
    (u) => u.requires_action === true && u.action_resolved !== true
  );
  const latest = updateList.slice(0, 3);

  // A freshly-onboarded client (no proposal sent yet) sees a "check back after
  // your call" screen rather than an empty project — there's nothing to review
  // until we've had the call and prepared their proposal.
  const hasActiveProposal = projectList.some((p) => p.proposal_status !== "draft");
  if (!hasActiveProposal) {
    return (
      <div
        className="px-4 sm:px-6"
        style={{ maxWidth: 560, margin: "0 auto", paddingTop: 64, paddingBottom: 64 }}
      >
        <Reveal>
          <Panel className="k-kard-h">
            <div className="flex flex-col items-center text-center" style={{ gap: 14 }}>
              <Eyebrow index="00" label="YOU'RE ALL SET" align="center" />
              <Display as="h1" size="md">
                Thanks — we&apos;ve got your details
              </Display>
              <Lead style={{ marginInline: "auto" }}>
                We&apos;ll talk through your project on your call with one of our team,
                then prepare your proposal right here for you to review and sign.
              </Lead>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.72rem",
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--k-accent)",
                  marginTop: 4,
                }}
              >
                Check back here after your call
              </span>
            </div>
          </Panel>
        </Reveal>
      </div>
    );
  }

  // Systems to show as cards — anything past the draft stage.
  const systems = projectList.filter((p) => p.proposal_status !== "draft");

  // ── Quick-nav tiles: each place in the portal, coloured by what's waiting
  //    there right now, so the home page pulls you to whatever needs you. ──
  const proposalSent = projectList.some((p) => p.proposal_status === "sent");
  const outstandingSum = billed
    .filter((i) => i.status !== "paid")
    .reduce((s, i) => s + Number(i.amount), 0);
  type TileTone = "accent" | "warning" | "success" | "muted";
  const TILE_COLOR: Record<TileTone, string> = {
    accent: "var(--k-accent)",
    warning: T.warning,
    success: T.success,
    muted: "var(--k-muted)",
  };
  const tiles: {
    href: string;
    label: string;
    sub: string;
    tone: TileTone;
    Icon: typeof FileText;
  }[] = [
    {
      href: "/portal/proposal",
      label: "Agreement",
      sub: proposalSent ? "Review & sign" : "Signed — view & download",
      tone: proposalSent ? "accent" : "muted",
      Icon: FileText,
    },
    {
      href: "/portal/payments",
      label: "Payments",
      sub: outstandingSum > 0 ? `${gbp(outstandingSum)} outstanding` : "All settled ✓",
      tone: outstandingSum > 0 ? "warning" : "success",
      Icon: CreditCard,
    },
    {
      href: "/portal/requests",
      label: "Requests",
      sub:
        openIssues.length > 0
          ? `${openIssues.length} open request${openIssues.length === 1 ? "" : "s"}`
          : "Tell us about anything",
      tone: openIssues.length > 0 ? "warning" : "muted",
      Icon: MessageSquare,
    },
    {
      href: "/portal/updates",
      label: "Updates",
      sub:
        decisions.length > 0
          ? `${decisions.length} decision${decisions.length === 1 ? "" : "s"} needed`
          : "News from the build",
      tone: decisions.length > 0 ? "warning" : "muted",
      Icon: Bell,
    },
    {
      href: "/portal/plan",
      label: "Plan",
      sub: plan ? `${plan.label} — active` : "Choose your care plan",
      tone: plan ? "success" : "accent",
      Icon: Shield,
    },
    {
      href: "/portal/deliverables",
      label: "Documents",
      sub: "Files & contracts",
      tone: "muted",
      Icon: Folder,
    },
  ];

  return (
    <div
      className="px-4 sm:px-6"
      style={{ maxWidth: 880, margin: "0 auto", paddingTop: 28, paddingBottom: 56 }}
    >
      {/* Stripe Checkout success return — their care plan just went live. */}
      {care === "active" && (
        <Reveal>
          <div
            className="flex items-center gap-3"
            style={{
              padding: "14px 16px",
              marginBottom: 20,
              background: "rgba(16,185,129,0.10)",
              border: "1px solid rgba(16,185,129,0.4)",
            }}
          >
            <span
              aria-hidden
              style={{ fontFamily: T.mono, color: "var(--k-accent)", fontSize: "1.1rem" }}
            >
              ✓
            </span>
            <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: "var(--k-fg)" }}>
              Your care plan is active — thank you. We&apos;re looking after your system
              from here.
            </p>
          </div>
        </Reveal>
      )}

      <PageHeader
        index="01"
        label="CLIENT PORTAL"
        title="Your system"
        lead={`Welcome back — here's how things stand for ${tenant?.name ?? "your business"}.`}
      />

      {/* Proposal awaiting signature — the one action that unlocks everything
          else, so it leads the page until it's signed. */}
      {projectList.some((p) => p.proposal_status === "sent") && (
        <Reveal>
          <div
            className="k-kard flex flex-wrap items-center justify-between gap-x-4 gap-y-3"
            style={{
              marginTop: 24,
              padding: "16px 18px",
              background: "rgba(16,185,129,0.08)",
              borderColor: "var(--k-accent)",
            }}
          >
            <div className="flex flex-col min-w-0" style={{ gap: 2 }}>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.62rem",
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--k-accent)",
                }}
              >
                {"// ACTION NEEDED"}
              </span>
              <span
                style={{
                  fontFamily: T.sans,
                  fontWeight: 700,
                  fontSize: "1rem",
                  letterSpacing: "-0.01em",
                  color: "var(--k-fg)",
                }}
              >
                Your proposal &amp; agreement are ready to review and sign
              </span>
            </div>
            <Link href="/portal/proposal" className="kb kb-primary kb-sm">
              Review &amp; sign
              <span className="k-arrow" aria-hidden>
                →
              </span>
            </Link>
          </div>
        </Reveal>
      )}

      {/* Quick-nav — every portal section as a coloured, iconed tile with a
          live signal of what's waiting there. The thumb-first way around. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" style={{ marginTop: 24 }}>
        {tiles.map((tile, i) => (
          <Reveal key={tile.href} delay={Math.min(i, 6) * 0.04}>
            <Link
              href={tile.href}
              className="k-kard k-kard-h flex flex-col gap-3 h-full"
              style={{
                background: "var(--k-surface)",
                padding: "14px 15px",
                textDecoration: "none",
                minHeight: 108,
              }}
            >
              <span
                className="inline-flex items-center justify-center"
                style={{
                  width: 34,
                  height: 34,
                  background: `color-mix(in oklab, ${TILE_COLOR[tile.tone]} 14%, transparent)`,
                  border: `1px solid color-mix(in oklab, ${TILE_COLOR[tile.tone]} 38%, transparent)`,
                }}
              >
                <tile.Icon size={17} color={TILE_COLOR[tile.tone]} strokeWidth={1.8} />
              </span>
              <span className="flex flex-col gap-0.5" style={{ marginTop: "auto" }}>
                <span
                  className="inline-flex items-center justify-between gap-2"
                  style={{
                    fontFamily: T.sans,
                    fontWeight: 700,
                    fontSize: "0.92rem",
                    letterSpacing: "-0.01em",
                    textTransform: "uppercase",
                    color: "var(--k-fg)",
                  }}
                >
                  {tile.label}
                  <span
                    className="k-arrow"
                    aria-hidden
                    style={{ color: TILE_COLOR[tile.tone] }}
                  >
                    →
                  </span>
                </span>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.6rem",
                    fontWeight: 500,
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    color: TILE_COLOR[tile.tone],
                  }}
                >
                  {tile.sub}
                </span>
              </span>
            </Link>
          </Reveal>
        ))}
      </div>

      {/* System card(s): where the build is + the live site */}
      <div className="flex flex-col gap-3" style={{ margin: "24px 0 20px" }}>
        {systems.map((p, i) => (
          <Reveal key={p.id} delay={i * 0.05}>
            <div
              className="k-kard k-kard-h min-w-0"
              style={{ background: "var(--k-surface)", padding: "18px 20px" }}
            >
              <div
                className="flex items-center justify-between gap-3 flex-wrap"
                style={{ marginBottom: 12 }}
              >
                <span
                  className="min-w-0 break-words"
                  style={{
                    fontFamily: T.sans,
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    letterSpacing: "-0.01em",
                    textTransform: "uppercase",
                    color: "var(--k-fg)",
                  }}
                >
                  {p.name}
                </span>
                {p.live_url && (
                  <a
                    href={p.live_url}
                    target="_blank"
                    rel="noreferrer"
                    className="kb kb-primary kb-sm"
                  >
                    Open your site
                    <span className="k-arrow" aria-hidden>
                      ↗
                    </span>
                  </a>
                )}
              </div>
              <StageStepper stage={p.stage} />
              <div style={{ marginTop: 12 }}>
                <PanelLink href={`/portal/project/${p.id}`}>
                  Project details, key dates &amp; onboarding
                </PanelLink>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Open requests */}
      <Reveal>
        <Panel
          label="// YOUR REQUESTS"
          actions={<PanelLink href="/portal/requests">View all</PanelLink>}
          style={{ marginBottom: 20 }}
        >
          {openIssues.length === 0 ? (
            <p
              className="text-center py-7"
              style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)" }}
            >
              Nothing open — all clear.
            </p>
          ) : (
            <div className="flex flex-col">
              {openIssues.map((iss, i) => (
                <Link
                  key={iss.id}
                  href="/portal/requests"
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5"
                  style={{
                    padding: "10px 0",
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                    textDecoration: "none",
                  }}
                >
                  <span
                    className="min-w-0 break-words"
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.9rem",
                      color: "var(--k-fg)",
                    }}
                  >
                    {iss.title}
                  </span>
                  <StatusChip tone={STATUS_TONE[iss.status]}>
                    {CLIENT_STATUS_LABEL[iss.status]}
                  </StatusChip>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </Reveal>

      {/* Decisions we're waiting on — warning-toned, only when there are any */}
      {decisions.length > 0 && (
        <Reveal>
          <Panel
            label="// DECISIONS NEEDED"
            title="We need a quick decision from you"
            style={{ marginBottom: 20, borderColor: "rgba(245,213,71,0.45)" }}
          >
            <div className="flex flex-col">
              {decisions.map((d, i) => (
                <Link
                  key={d.id}
                  href="/portal/updates"
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5"
                  style={{
                    padding: "10px 0",
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                    textDecoration: "none",
                  }}
                >
                  <span
                    className="min-w-0 break-words"
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.9rem",
                      color: "var(--k-fg)",
                    }}
                  >
                    {d.title}
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5"
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.66rem",
                      fontWeight: 500,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: T.warning,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Choose
                    <span className="k-arrow" aria-hidden>
                      →
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </Panel>
        </Reveal>
      )}

      {/* Latest updates */}
      <Reveal>
        <Panel
          label="// LATEST UPDATES"
          actions={<PanelLink href="/portal/updates">All updates</PanelLink>}
          style={{ marginBottom: 20 }}
        >
          {latest.length === 0 ? (
            <p
              className="text-center py-7"
              style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)" }}
            >
              Updates will appear here as we work on your system.
            </p>
          ) : (
            <div className="flex flex-col">
              {latest.map((u, i) => (
                <Link
                  key={u.id}
                  href="/portal/updates"
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
                  style={{
                    padding: "10px 0",
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                    textDecoration: "none",
                  }}
                >
                  <span
                    className="min-w-0 break-words"
                    style={{
                      fontFamily: T.sans,
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
                      whiteSpace: "nowrap",
                    }}
                  >
                    {dateGB(u.created_at)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </Reveal>

      {/* Care plan + build allowance */}
      <Reveal>
        <Panel
          label="// YOUR PLAN"
          actions={<PanelLink href="/portal/plan">Plan details</PanelLink>}
          style={{ marginBottom: 20 }}
        >
          {plan ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <span
                  style={{
                    fontFamily: T.sans,
                    fontWeight: 700,
                    fontSize: "1.05rem",
                    letterSpacing: "-0.01em",
                    textTransform: "uppercase",
                    color: "var(--k-accent)",
                  }}
                >
                  {plan.label}
                </span>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.72rem",
                    letterSpacing: "0.06em",
                    color: "var(--k-muted)",
                  }}
                >
                  {gbp(plan.mrr)}/mo
                </span>
              </div>
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.86rem",
                  color: "var(--k-muted)",
                  lineHeight: 1.55,
                }}
              >
                {plan.blurb}
              </p>
              {plan.buildAllowance > 0 && (
                <div className="flex flex-col gap-1.5" style={{ marginTop: 4 }}>
                  <div className="flex flex-wrap items-center gap-1">
                    {Array.from({ length: plan.buildAllowance }).map((_, i) => (
                      <span
                        key={i}
                        style={{
                          width: 16,
                          height: 6,
                          background:
                            i < remaining ? "var(--k-accent)" : "var(--k-border-strong)",
                        }}
                      />
                    ))}
                  </div>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.66rem",
                      fontWeight: 500,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--k-muted)",
                    }}
                  >
                    {remaining} of {plan.buildAllowance} build items left this month
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p
              className="text-center py-7"
              style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)" }}
            >
              No active plan yet — talk to us about looking after your system.
            </p>
          )}
        </Panel>
      </Reveal>

      {/* Payments — pay outstanding invoices; flips to Paid automatically once
          the Stripe payment goes through (invoice.paid webhook). */}
      {billed.length > 0 && (
        <Reveal>
          <Panel label="// PAYMENTS">
            <div className="flex flex-col gap-2.5">
              {billed.map((inv) => (
                <div
                  key={inv.id}
                  style={{
                    padding: "12px 14px",
                    background: "var(--k-bg)",
                    border: "1px solid var(--k-border)",
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col min-w-0">
                      <span
                        style={{
                          fontFamily: T.sans,
                          fontWeight: 700,
                          fontSize: "1rem",
                          color: "var(--k-fg)",
                        }}
                      >
                        {gbp(Number(inv.amount))}
                      </span>
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: "0.62rem",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "var(--k-faint)",
                        }}
                      >
                        Build invoice
                      </span>
                    </div>
                    {inv.status === "paid" ? (
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: "0.7rem",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: T.success,
                        }}
                      >
                        Paid ✓
                      </span>
                    ) : inv.hosted_invoice_url ? (
                      <a
                        href={inv.hosted_invoice_url}
                        target="_blank"
                        rel="noreferrer"
                        className="kb kb-primary kb-sm"
                      >
                        Pay by card
                        <span className="k-arrow" aria-hidden>
                          →
                        </span>
                      </a>
                    ) : null}
                  </div>
                  {inv.status !== "paid" && (
                    <BankTransferDetails
                      reference={invoiceRef(inv.tenant_id, inv.id)}
                      amount={Number(inv.amount)}
                      only={!inv.hosted_invoice_url}
                    />
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>
      )}
    </div>
  );
}
