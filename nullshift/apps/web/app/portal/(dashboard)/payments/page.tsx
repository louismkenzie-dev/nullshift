import { createClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { clientRef } from "@nullshift/ui/format";
import { carePlan } from "@/lib/carePlans";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { BankTransferDetails } from "@/components/portal/BankTransferDetails";
import { Reveal } from "@/components/Reveal";

/**
 * Client portal — payments. The money page: what's outstanding right now, every
 * invoice with its status and both ways to pay (card link + bank transfer), and
 * the monthly care plan billing line. RLS scopes every read to the client's own
 * tenant.
 */
export const dynamic = "force-dynamic";

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");
const dateGB = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

type Invoice = {
  id: string;
  tenant_id: string;
  amount: number;
  status: string;
  hosted_invoice_url: string | null;
  created_at: string;
  paid_at: string | null;
  due_at: string | null;
  type: string | null;
};
type Sub = { plan: string; mrr: number; status: string; provider?: string | null };

type Tone = "accent" | "success" | "warning" | "danger" | "muted";
const INV_TONE: Record<string, Tone> = {
  open: "warning",
  paid: "success",
  uncollectible: "danger",
  void: "muted",
};
// Client-facing wording — raw Stripe statuses like "uncollectible" stay internal.
const INV_LABEL: Record<string, string> = {
  open: "Awaiting payment",
  paid: "Paid",
  uncollectible: "Overdue",
  void: "Void",
};
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
  incomplete: "Awaiting Direct Debit",
  canceled: "Cancelled",
};

export default async function PortalPaymentsPage() {
  const supabase = await createClient();
  const [{ data: invoices }, { data: subs }] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id, tenant_id, amount, status, hosted_invoice_url, created_at, paid_at, due_at, type"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("subscriptions")
      .select("plan, mrr, status, provider")
      .order("started_at", { ascending: false }),
  ]);

  // Clients see real bills only — drafts and voided invoices stay internal.
  const invList = ((invoices ?? []) as Invoice[]).filter(
    (i) => i.status !== "draft" && i.status !== "void"
  );
  const open = invList.filter((i) => i.status === "open");
  const outstanding = open.reduce((s, i) => s + Number(i.amount), 0);
  const paidTotal = invList
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.amount), 0);

  const subList = (subs ?? []) as Sub[];
  const sub =
    subList.find((s) => s.status === "active" || s.status === "trialing") ??
    subList.find((s) => s.status !== "canceled");
  const plan = sub ? carePlan(sub.plan) : null;

  return (
    <div
      className="px-4 sm:px-6"
      style={{ maxWidth: 760, margin: "0 auto", paddingTop: 28, paddingBottom: 56 }}
    >
      <PageHeader
        index="03"
        label="PAYMENTS"
        title="Payments"
        lead="Everything money in one place — what's outstanding, what's paid, and how to pay."
      />

      {/* The headline numbers */}
      <div style={{ margin: "24px 0 20px" }}>
        <Reveal>
          <Panel pad={false}>
            <div className="grid grid-cols-1 sm:grid-cols-3">
              <StatCard
                value={outstanding > 0 ? gbp(outstanding) : "£0"}
                label="Outstanding"
                sub={
                  open.length > 0
                    ? `${open.length} invoice${open.length === 1 ? "" : "s"} awaiting payment`
                    : "Nothing owed — all settled"
                }
                accent={outstanding > 0}
              />
              <StatCard
                value={gbp(paidTotal)}
                label="Paid to date"
                sub="Across all invoices"
              />
              <StatCard
                value={plan && sub ? `${gbp(Number(sub.mrr ?? plan.mrr))}/mo` : "—"}
                label="Care plan"
                sub={
                  plan && sub
                    ? `${plan.label} · ${SUB_LABEL[sub.status] ?? sub.status}`
                    : "No monthly plan yet"
                }
              />
            </div>
          </Panel>
        </Reveal>
      </div>

      {/* Monthly plan billing line */}
      {plan && sub && (
        <Reveal>
          <Panel label="// MONTHLY PLAN" style={{ marginBottom: 20 }}>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex flex-col min-w-0" style={{ gap: 2 }}>
                <span
                  style={{
                    fontFamily: T.sans,
                    fontWeight: 700,
                    fontSize: "1rem",
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
                    fontSize: "0.66rem",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--k-faint)",
                  }}
                >
                  {gbp(Number(sub.mrr ?? plan.mrr))}/month ·{" "}
                  {sub.provider === "gocardless"
                    ? "Direct Debit"
                    : sub.provider === "manual"
                      ? "Standing order"
                      : "Card"}
                </span>
              </div>
              <StatusChip tone={SUB_TONE[sub.status] ?? "muted"}>
                {SUB_LABEL[sub.status] ?? sub.status.replace(/_/g, " ")}
              </StatusChip>
            </div>
          </Panel>
        </Reveal>
      )}

      {/* Every invoice, newest first */}
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
                    style={{
                      padding: "14px 0",
                      borderTop: i ? "1px solid var(--k-border)" : "none",
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                      <div className="flex flex-col min-w-0">
                        <span
                          style={{
                            fontFamily: T.sans,
                            fontWeight: 700,
                            fontSize: "1.05rem",
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
                          {inv.type === "one_off"
                            ? "Deposit / one-off"
                            : inv.type === "build_milestone"
                              ? "Build invoice"
                              : "Invoice"}{" "}
                          ·{" "}
                          {inv.status === "paid" && inv.paid_at
                            ? `Paid ${dateGB(inv.paid_at)}`
                            : inv.due_at
                              ? `Issued ${dateGB(inv.created_at)} · due ${dateGB(inv.due_at)}`
                              : `Issued ${dateGB(inv.created_at)}`}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <StatusChip tone={INV_TONE[inv.status] ?? "muted"}>
                          {INV_LABEL[inv.status] ?? inv.status.replace(/_/g, " ")}
                        </StatusChip>
                        {inv.status === "open" && inv.hosted_invoice_url && (
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
                        )}
                      </div>
                    </div>
                    {inv.status === "open" && (
                      <BankTransferDetails
                        reference={clientRef(inv.tenant_id)}
                        amount={Number(inv.amount)}
                        only={!inv.hosted_invoice_url}
                      />
                    )}
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
