import { createClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { carePlan, currentPeriodStart, remainingAllowance } from "@/lib/carePlans";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/Reveal";

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

type Sub = { id: string; plan: string; mrr: number; status: string };
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
const INV_TONE: Record<string, Tone> = {
  open: "warning",
  paid: "success",
  uncollectible: "danger",
  void: "muted",
};

export default async function PortalPlanPage() {
  const supabase = await createClient();
  const [{ data: subs }, { data: credits }, { data: invoices }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, plan, mrr, status")
      .order("started_at", { ascending: false }),
    supabase
      .from("build_credit_events")
      .select("delta")
      .eq("period", currentPeriodStart()),
    supabase
      .from("invoices")
      .select("id, amount, status, hosted_invoice_url, created_at, paid_at")
      .order("created_at", { ascending: false }),
  ]);

  const subList = (subs ?? []) as Sub[];
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
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 16px 56px" }}>
      <PageHeader
        index="04"
        label="YOUR PLAN"
        title="Your plan"
        lead="What we look after for you each month, and where your invoices live."
      />

      {/* The plan itself */}
      <div style={{ margin: "24px 0 20px" }}>
        <Reveal>
          <Panel
            label="// YOUR PLAN"
            actions={
              sub ? (
                <StatusChip tone={SUB_TONE[sub.status] ?? "muted"}>
                  {SUB_LABEL[sub.status] ?? sub.status.replace(/_/g, " ")}
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
                <div className="flex flex-col justify-center gap-2" style={{ padding: 18 }}>
                  <div className="flex items-center gap-1">
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
                    <div className="flex flex-col">
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
