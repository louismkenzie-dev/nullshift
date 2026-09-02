import { getPortalClient } from "@/lib/clientPreview";
import { T } from "@nullshift/ui/tokens";
import { carePlan, currentPeriodStart, remainingAllowance } from "@/lib/carePlans";
import { contractedPrices, type ContractedPrices } from "@/lib/pricing/contracted";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/Reveal";
import { choosePlan } from "./actions";
import { PendingBeacon } from "@/components/app/PendingBeacon";
import Link from "next/link";
import { planChoiceClosedReason, planChoiceOpen } from "@/lib/planGate";

/**
 * Client portal — your plan. What their care plan covers, how many build items
 * they have left this month, and every invoice with a Pay now link where one is
 * outstanding. RLS scopes subscriptions, build_credit_events and invoices to
 * the client's own tenant.
 */
export const dynamic = "force-dynamic";

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");
const dateGB = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

type Sub = {
  id: string;
  plan: string;
  mrr: number;
  status: string;
  provider?: string | null;
};
type Invoice = {
  id: string;
  amount: number;
  status: string;
  hosted_invoice_url: string | null;
  created_at: string;
  paid_at: string | null;
};

type Tone = "accent" | "success" | "warning" | "danger" | "muted";
const SUB_TONE: Record<string, Tone> = {
  active: "success",
  trialing: "accent",
  past_due: "warning",
  incomplete: "muted",
  canceled: "danger",
};
const SUB_LABEL: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment overdue",
  incomplete: "Awaiting sign-up",
  canceled: "Cancelled",
};
// 'incomplete' means different things per rail — a GoCardless row is waiting
// on the Direct Debit mandate (same copy as the Payments page).
const subLabel = (s: Sub) =>
  s.status === "incomplete" && s.provider === "gocardless"
    ? "Awaiting Direct Debit"
    : (SUB_LABEL[s.status] ?? s.status.replace(/_/g, " "));
const INV_TONE: Record<string, Tone> = {
  open: "warning",
  paid: "success",
  uncollectible: "danger",
  void: "muted",
};

export default async function PortalPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ dd?: string; price?: string; gate?: string }>;
}) {
  const { dd, price, gate } = await searchParams;
  const { supabase } = await getPortalClient();
  const [
    { data: subs },
    { data: credits },
    { data: invoices },
    { data: tenants },
    { data: projects },
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, plan, mrr, status, provider")
      .order("started_at", { ascending: false }),
    supabase
      .from("build_credit_events")
      .select("delta")
      .eq("period", currentPeriodStart()),
    supabase
      .from("invoices")
      .select("id, amount, status, hosted_invoice_url, created_at, paid_at")
      .order("created_at", { ascending: false }),
    supabase.from("tenants").select("id, care_plan_choice").limit(1),
    supabase
      .from("projects")
      .select("stage")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  // The plan is chosen after the build — the chooser stays closed until then.
  const stage = (projects?.[0] as { stage?: string | null } | undefined)?.stage ?? null;
  const built = planChoiceOpen(stage);

  const subList = (subs ?? []) as Sub[];
  const tenantRow = tenants?.[0] as
    | { id?: string; care_plan_choice?: string | null }
    | undefined;
  const choice = tenantRow?.care_plan_choice;
  // The client's three options at THEIR contracted price (scale band applied).
  // scale_assessments is staff-only under RLS, so this goes via the service
  // client — the client only ever sees three figures, never the band or score.
  const pricing: ContractedPrices | null = tenantRow?.id
    ? await contractedPrices(tenantRow.id)
    : null;
  const enterpriseReview = !!pricing?.assessment?.enterprise_review_required;
  // Prefer a live subscription; fall back to the newest non-cancelled one.
  const sub =
    subList.find((s) => s.status === "active" || s.status === "trialing") ??
    subList.find((s) => s.status !== "canceled") ??
    subList[0];
  const plan = sub ? carePlan(sub.plan) : null;
  const deltaSum = ((credits ?? []) as { delta: number }[]).reduce(
    (s, e) => s + Number(e.delta),
    0
  );
  const remaining = remainingAllowance(plan, deltaSum);
  // Clients see real bills only — drafts and voided invoices stay internal.
  const invList = ((invoices ?? []) as Invoice[]).filter(
    (i) => i.status !== "draft" && i.status !== "void"
  );

  const hasLiveSub = subList.some((s) =>
    ["active", "trialing", "past_due"].includes(s.status)
  );
  // A Direct Debit authorisation is underway — don't push the full chooser at
  // someone who already started (re-choosing would restart the flow).
  const pendingDd = subList.some(
    (s) => s.provider === "gocardless" && s.status === "incomplete"
  );
  // A recorded paid-plan choice with no subscription row at all means
  // GoCardless wasn't configured when they chose — the Direct Debit link
  // arrives by email later, so acknowledge the choice instead of staying
  // silent.
  const chosenPlan =
    choice && choice !== "none" && !subList.some((s) => s.status === "incomplete")
      ? carePlan(choice)
      : null;

  const preparingPanel = (
    <Panel
      label="// YOUR PLAN OPTIONS"
      title={
        enterpriseReview
          ? "Your plan is priced individually"
          : "Your plan options are being prepared"
      }
    >
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.9rem",
          color: "var(--k-muted)",
          lineHeight: 1.65,
        }}
      >
        {enterpriseReview
          ? "A system at your scale is quoted rather than picked off a list. We'll send your Order Form and Direct Debit link directly — nothing to do here for now."
          : "We're setting the right level for your system. You'll get an email the moment your three options are ready to choose from — nothing to do here for now."}
      </p>
      <div
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
        style={{
          marginTop: 14,
          padding: "12px 16px",
          border: "1px dashed var(--k-border)",
        }}
      >
        <p style={{ fontFamily: T.sans, fontSize: "0.84rem", color: "var(--k-muted)" }}>
          Not planning a monthly plan at all? Tell us and we&apos;ll leave it there.
        </p>
        <form action={choosePlan}>
          <PendingBeacon />
          <input type="hidden" name="plan" value="none" />
          <button type="submit" className="kb kb-sm">
            Continue without a plan
          </button>
        </form>
      </div>
    </Panel>
  );

  const chooserPanel = (
    <Panel
      label="// CHOOSE YOUR CARE PLAN"
      title="How would you like your system looked after?"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(pricing?.sellable ?? [])
          .filter((pp) => pp.priced && pp.mrr !== null)
          .map((pp) => {
            const p = carePlan(pp.planId)!;
            return (
              <div
                key={p.id}
                className="k-kard k-kard-h flex flex-col gap-2"
                style={{ background: "var(--k-bg)", padding: "16px 18px" }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontWeight: 700,
                      fontSize: "0.98rem",
                      letterSpacing: "-0.01em",
                      textTransform: "uppercase",
                      color: "var(--k-accent)",
                    }}
                  >
                    {p.label}
                  </span>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.72rem",
                      letterSpacing: "0.04em",
                      color: "var(--k-fg)",
                    }}
                  >
                    {gbp(pp.mrr!)}/mo
                  </span>
                </div>
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.82rem",
                    color: "var(--k-muted)",
                    lineHeight: 1.55,
                  }}
                >
                  {p.blurb}
                </p>
                <ul
                  className="flex flex-col gap-1"
                  style={{ flex: 1, margin: "4px 0 6px" }}
                >
                  {p.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span
                        aria-hidden
                        style={{
                          fontFamily: T.mono,
                          fontSize: "0.7rem",
                          color: "var(--k-accent)",
                        }}
                      >
                        ✓
                      </span>
                      <span
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.78rem",
                          color: "var(--k-fg)",
                          lineHeight: 1.45,
                        }}
                      >
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
                {/* The choice is confirmed on the next step, where the client
                    reads and agrees the care-plan terms before any Direct
                    Debit is started. */}
                <Link
                  href={`/portal/plan/confirm?plan=${encodeURIComponent(p.id)}`}
                  className="kb kb-primary kb-sm"
                  style={{ textDecoration: "none" }}
                >
                  Choose {p.label}
                  <span className="k-arrow" aria-hidden>
                    →
                  </span>
                </Link>
              </div>
            );
          })}
      </div>
      <div
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
        style={{
          marginTop: 12,
          padding: "12px 16px",
          border: "1px dashed var(--k-border)",
        }}
      >
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.84rem",
            color: "var(--k-muted)",
          }}
        >
          Not ready for a monthly plan? That&apos;s fine — we&apos;re still here when you
          need us.
        </p>
        <form action={choosePlan}>
          <PendingBeacon />
          <input type="hidden" name="plan" value="none" />
          <button type="submit" className="kb kb-sm">
            Continue without a plan
          </button>
        </form>
      </div>
      <p
        style={{
          fontFamily: T.mono,
          fontSize: "0.62rem",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--k-faint)",
          marginTop: 10,
        }}
      >
        Paid monthly by Direct Debit — cancel any time
      </p>
    </Panel>
  );

  const notBuiltPanel = (
    <Panel label="// YOUR PLAN OPTIONS" title="Your care plan comes after the build">
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.9rem",
          color: "var(--k-muted)",
          lineHeight: 1.65,
        }}
      >
        {planChoiceClosedReason(stage)} You&apos;ll choose from three options at your own
        price, agree the terms and set up the Direct Debit — all from here, once
        there&apos;s a live system to look after.
      </p>
    </Panel>
  );

  return (
    <div
      className="px-4 sm:px-6"
      style={{ maxWidth: 760, margin: "0 auto", paddingTop: 28, paddingBottom: 56 }}
    >
      <PageHeader
        index="06"
        label="YOUR PLAN"
        title="Your plan"
        lead="What we look after for you each month, and where your invoices live."
      />

      {/* Direct Debit return banners */}
      {dd === "authorised" && (
        <Reveal>
          <div
            className="flex items-center gap-3"
            style={{
              padding: "14px 16px",
              marginTop: 20,
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
              Direct Debit authorised — your plan goes live as soon as the mandate is
              confirmed (usually within a couple of minutes).
            </p>
          </div>
        </Reveal>
      )}
      {dd === "exit" && (
        <Reveal>
          <div
            style={{
              padding: "14px 16px",
              marginTop: 20,
              border: "1px solid rgba(245,213,71,0.45)",
            }}
          >
            <p
              style={{ fontFamily: T.sans, fontSize: "0.9rem", color: "var(--k-muted)" }}
            >
              Direct Debit setup wasn&apos;t completed — no problem, you can pick a plan
              again below whenever you&apos;re ready.
            </p>
          </div>
        </Reveal>
      )}

      {/* ── Choose a plan — shown until billing is live. Hidden entirely on
          the ?dd=authorised return leg: the success banner plus the pending
          plan chip below are the whole story, and re-choosing would restart
          the flow that was just completed. ─────────────────────────────── */}
      {!hasLiveSub && dd !== "authorised" && (
        <div style={{ marginTop: 24 }}>
          {choice === "none" && !pendingDd && (
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.88rem",
                color: "var(--k-muted)",
                marginBottom: 12,
              }}
            >
              You&apos;ve chosen to go without a care plan for now — that&apos;s all
              recorded. You can add one below any time.
            </p>
          )}
          {chosenPlan && !pendingDd && (
            <div
              className="flex items-center gap-3"
              style={{
                padding: "14px 16px",
                marginBottom: 12,
                background: "rgba(16,185,129,0.10)",
                border: "1px solid rgba(16,185,129,0.4)",
              }}
            >
              <span
                aria-hidden
                style={{
                  fontFamily: T.mono,
                  color: "var(--k-accent)",
                  fontSize: "1.1rem",
                }}
              >
                ✓
              </span>
              <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: "var(--k-fg)" }}>
                You chose the {chosenPlan.label} plan — that&apos;s recorded. We&apos;ll
                email you a Direct Debit link to start it.
              </p>
            </div>
          )}
          {gate === "closed" && (
            <div
              style={{
                padding: "14px 16px",
                marginBottom: 12,
                border: "1px solid rgba(245,213,71,0.45)",
              }}
            >
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.9rem",
                  color: "var(--k-muted)",
                }}
              >
                Plan options aren&apos;t open yet — they unlock once your system is live.
              </p>
            </div>
          )}
          {price === "changed" && (
            <div
              style={{
                padding: "14px 16px",
                marginBottom: 12,
                border: "1px solid rgba(245,213,71,0.45)",
              }}
            >
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.9rem",
                  color: "var(--k-muted)",
                }}
              >
                Your plan prices were updated while this page was open — please review the
                figures below and choose again.
              </p>
            </div>
          )}
          <Reveal>
            {pendingDd ? (
              <Panel label="// DIRECT DEBIT" title="Direct Debit setup in progress">
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.88rem",
                    color: "var(--k-muted)",
                    lineHeight: 1.6,
                  }}
                >
                  Check your email for the authorisation link — your plan goes live once
                  the Direct Debit mandate is authorised.
                </p>
                <details style={{ marginTop: 14 }}>
                  <summary
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.68rem",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--k-muted)",
                      cursor: "pointer",
                    }}
                  >
                    Start over / choose a different plan
                  </summary>
                  <div style={{ marginTop: 14 }}>
                    {pricing?.anyPriced ? chooserPanel : preparingPanel}
                  </div>
                </details>
              </Panel>
            ) : !built ? (
              notBuiltPanel
            ) : pricing?.anyPriced ? (
              chooserPanel
            ) : (
              preparingPanel
            )}
          </Reveal>
        </div>
      )}

      {/* The plan itself */}
      <div style={{ margin: "24px 0 20px" }}>
        <Reveal>
          <Panel
            label="// YOUR PLAN"
            actions={
              sub ? (
                <StatusChip tone={SUB_TONE[sub.status] ?? "muted"}>
                  {subLabel(sub)}
                </StatusChip>
              ) : undefined
            }
          >
            {plan && sub ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontWeight: 700,
                      fontSize: "1.3rem",
                      letterSpacing: "-0.02em",
                      textTransform: "uppercase",
                      color: "var(--k-accent)",
                    }}
                  >
                    {plan.label}
                  </span>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.78rem",
                      fontWeight: 500,
                      letterSpacing: "0.06em",
                      color: "var(--k-muted)",
                    }}
                  >
                    {gbp(Number(sub.mrr ?? plan.mrr))}/mo
                  </span>
                </div>
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.9rem",
                    color: "var(--k-muted)",
                    lineHeight: 1.6,
                  }}
                >
                  {plan.blurb}
                </p>
                <div className="flex flex-col gap-1.5" style={{ marginTop: 2 }}>
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-start gap-2.5">
                      <span
                        aria-hidden
                        style={{
                          fontFamily: T.mono,
                          fontSize: "0.78rem",
                          color: "var(--k-accent)",
                          lineHeight: 1.5,
                        }}
                      >
                        ✓
                      </span>
                      <span
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.88rem",
                          color: "var(--k-fg)",
                          lineHeight: 1.5,
                        }}
                      >
                        {f}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p
                className="text-center py-7"
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.85rem",
                  color: "var(--k-muted)",
                }}
              >
                No active plan — talk to us about looking after your system.
              </p>
            )}
          </Panel>
        </Reveal>
      </div>

      {/* Build allowance */}
      {plan && plan.buildAllowance > 0 && (
        <div style={{ margin: "0 0 20px" }}>
          <Reveal>
            <Panel label="// BUILD ALLOWANCE" pad={false}>
              <div className="grid sm:grid-cols-2">
                <StatCard
                  value={`${remaining} left`}
                  label="Build items"
                  sub={`of ${plan.buildAllowance} this month — resets on the 1st`}
                  accent={remaining > 0}
                />
                <div
                  className="flex flex-col justify-center gap-2 min-w-0"
                  style={{ padding: 18 }}
                >
                  <div className="flex flex-wrap items-center gap-1">
                    {Array.from({ length: plan.buildAllowance }).map((_, i) => (
                      <span
                        key={i}
                        style={{
                          width: 18,
                          height: 7,
                          background:
                            i < remaining ? "var(--k-accent)" : "var(--k-border-strong)",
                        }}
                      />
                    ))}
                  </div>
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.82rem",
                      color: "var(--k-muted)",
                      lineHeight: 1.55,
                    }}
                  >
                    A build item is a small improvement or new feature — roughly a
                    day&apos;s work. Bug fixes never count; they&apos;re always covered.
                  </p>
                </div>
              </div>
            </Panel>
          </Reveal>
        </div>
      )}

      {/* Invoices */}
      <Reveal>
        <Panel label="// INVOICES">
          {invList.length === 0 ? (
            <p
              className="text-center py-7"
              style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)" }}
            >
              No invoices yet — anything we bill will appear here.
            </p>
          ) : (
            <div className="flex flex-col">
              {invList.map((inv, i) => (
                <Reveal key={inv.id} delay={Math.min(i, 8) * 0.04}>
                  <div
                    className="flex items-center justify-between gap-3 flex-wrap"
                    style={{
                      padding: "12px 0",
                      borderTop: i ? "1px solid var(--k-border)" : "none",
                    }}
                  >
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
                        {inv.status === "paid" && inv.paid_at
                          ? `Paid ${dateGB(inv.paid_at)}`
                          : `Issued ${dateGB(inv.created_at)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <StatusChip tone={INV_TONE[inv.status] ?? "muted"}>
                        {inv.status}
                      </StatusChip>
                      {inv.status === "open" && inv.hosted_invoice_url && (
                        <a
                          href={inv.hosted_invoice_url}
                          target="_blank"
                          rel="noreferrer"
                          className="kb kb-primary kb-sm"
                        >
                          Pay now
                          <span className="k-arrow" aria-hidden>
                            →
                          </span>
                        </a>
                      )}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          )}
        </Panel>
      </Reveal>
    </div>
  );
}
