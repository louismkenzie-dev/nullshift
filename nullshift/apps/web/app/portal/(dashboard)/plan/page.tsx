import { createClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { CARE_PLANS, carePlan, currentPeriodStart, remainingAllowance } from "@/lib/carePlans";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/Reveal";
import { choosePlan } from "./actions";

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
  searchParams: Promise<{ dd?: string }>;
}) {
  const { dd } = await searchParams;
  const supabase = await createClient();
  const [{ data: subs }, { data: credits }, { data: invoices }, { data: tenants }] =
    await Promise.all([
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
    ]);

  const subList = (subs ?? []) as Sub[];
  const choice = (tenants?.[0] as { care_plan_choice?: string | null } | undefined)
    ?.care_plan_choice;
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
            <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: "var(--k-muted)" }}>
              Direct Debit setup wasn&apos;t completed — no problem, you can pick a plan
              again below whenever you&apos;re ready.
            </p>
          </div>
        </Reveal>
      )}

      {/* ── Choose a plan — shown until billing is live ─────────── */}
      {!subList.some((s) => ["active", "trialing", "past_due"].includes(s.status)) && (
        <div style={{ marginTop: 24 }}>
          {subList.some(
            (s) => s.provider === "gocardless" && s.status === "incomplete"
          ) &&
            dd !== "authorised" && (
              <p
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.68rem",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--k-muted)",
                  marginBottom: 12,
                }}
              >
                A Direct Debit setup is in progress — choosing again restarts it.
              </p>
            )}
          {choice === "none" && (
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
          <Reveal>
            <Panel
              label="// CHOOSE YOUR CARE PLAN"
              title="How would you like your system looked after?"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CARE_PLANS.map((p) => (
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
                        {gbp(p.mrr)}/mo
                      </span>
                    </div>
                    <p
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.82rem",
                        color: "var(--k-muted)",
                        lineHeight: 1.55,
                        flex: 1,
                      }}
                    >
                      {p.blurb}
                    </p>
                    <form action={choosePlan}>
                      <input type="hidden" name="plan" value={p.id} />
                      <button type="submit" className="kb kb-primary kb-sm">
                        Choose {p.label}
                        <span className="k-arrow" aria-hidden>
                          →
                        </span>
                      </button>
                    </form>
                  </div>
                ))}
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
                  Not ready for a monthly plan? That&apos;s fine — we&apos;re still here
                  when you need us.
                </p>
                <form action={choosePlan}>
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
                <div className="flex flex-col justify-center gap-2 min-w-0" style={{ padding: 18 }}>
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
