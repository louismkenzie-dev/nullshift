import { revalidatePath } from "next/cache";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { createClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { getMrrSummary } from "@nullshift/billing/mrr";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";

/**
 * Billing — the MRR-to-£8k tracker (brief §5: the number the business steers by)
 * plus build-milestone invoices and care subscriptions per client tenant. The
 * Stripe webhook flips invoices to paid and upserts subscriptions in production;
 * the manual actions here let staff issue/record them and demo the data flow.
 */

export const dynamic = "force-dynamic";

type Tenant = { id: string; name: string };
type Sub = { id: string; tenant_id: string; plan: string; mrr: number; status: string };
type Invoice = {
  id: string;
  tenant_id: string;
  type: string;
  amount: number;
  status: string;
  paid_at: string | null;
};

const PLAN_MRR: Record<string, number> = {
  care_basic: 49,
  care_pro: 149,
  transaction: 39,
};

async function addSubscription(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const plan = String(formData.get("plan") || "care_basic");
  if (!tenantId) return;
  const supabase = await createClient();
  await supabase.from("subscriptions").insert({
    tenant_id: tenantId,
    plan: plan as never,
    mrr: PLAN_MRR[plan] ?? 49,
    status: "active",
    started_at: new Date().toISOString(),
  });
  await logAudit({
    action: "subscription.created",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: { plan },
  });
  revalidatePath("/admin/billing");
}

async function cancelSubscription(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  const supabase = await createClient();
  await supabase.from("subscriptions").update({ status: "canceled" }).eq("id", id);
  await logAudit({
    action: "subscription.canceled",
    target: `subscription:${id}`,
    tenantId,
  });
  revalidatePath("/admin/billing");
}

async function issueInvoice(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const type = String(formData.get("type") || "build_milestone");
  const amount = Number(formData.get("amount") || 0);
  if (!tenantId || amount <= 0) return;
  const supabase = await createClient();
  await supabase.from("invoices").insert({
    tenant_id: tenantId,
    type: type as never,
    amount,
    status: "open",
    due_at: new Date(Date.now() + 14 * 864e5).toISOString(),
  });
  await logAudit({
    action: "invoice.issued",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: { type, amount },
  });
  revalidatePath("/admin/billing");
}

async function markInvoicePaid(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  const supabase = await createClient();
  // In production the Stripe webhook does this on invoice.paid.
  await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id);
  await logAudit({ action: "invoice.paid", target: `invoice:${id}`, tenantId });
  revalidatePath("/admin/billing");
}

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");

export default async function BillingPage() {
  const supabase = await createClient();
  const summary = await getMrrSummary(supabase);
  const [{ data: tenants }, { data: subs }, { data: invoices }] = await Promise.all([
    supabase.from("tenants").select("id, name").eq("type", "client").order("name"),
    supabase.from("subscriptions").select("id, tenant_id, plan, mrr, status"),
    supabase
      .from("invoices")
      .select("id, tenant_id, type, amount, status, paid_at")
      .order("created_at", { ascending: false }),
  ]);
  const tenantList = (tenants ?? []) as Tenant[];
  const subList = (subs ?? []) as Sub[];
  const invoiceList = (invoices ?? []) as Invoice[];
  const nameOf = (id: string) => tenantList.find((t) => t.id === id)?.name ?? "—";

  // Per-tenant usage footprint (cost guardrail). A pricing trigger fires when a
  // tenant carries real activity but little/no recurring fee to cover it.
  const { data: footprintRows } = await supabase.rpc("tenant_footprint");
  type Footprint = {
    tenant_id: string;
    name: string;
    documents: number;
    change_requests: number;
    tasks: number;
    invoices: number;
    audit_rows: number;
    mrr: number;
  };
  const footprint = ((footprintRows ?? []) as Footprint[]).map((f) => {
    const score =
      Number(f.documents) +
      Number(f.change_requests) +
      Number(f.tasks) +
      Number(f.audit_rows) / 10;
    return { ...f, score, flag: score >= 15 && Number(f.mrr) < 49 };
  });

  return (
    <div>
      <PageHeader
        index="06"
        label="Billing"
        title="MRR to £8,000"
        lead="The number the business steers by — care subscriptions, build invoices and the cost guardrail."
      />

      {/* ── The £8k tracker ─────────────────────────────────── */}
      <Reveal className="block" delay={0.05}>
        <div className="k-kard" style={{ background: "var(--k-surface)", marginTop: 28 }}>
          <div style={{ padding: "26px 28px" }}>
            <div className="flex items-end justify-between flex-wrap gap-3">
              <div>
                <div
                  style={{
                    fontFamily: T.display,
                    fontWeight: 800,
                    fontSize: "clamp(2.4rem, 6vw, 3.6rem)",
                    letterSpacing: "-0.03em",
                    color: "var(--k-accent)",
                    lineHeight: 1,
                  }}
                >
                  {gbp(summary.mrr)}
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.78rem",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--k-muted)",
                      fontWeight: 500,
                    }}
                  >
                    {" "}
                    /mo MRR
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.74rem",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--k-muted)",
                    marginTop: 10,
                  }}
                >
                  {gbp(summary.gap)} to go · {summary.pctToTarget}% of the £8,000 target
                </div>
              </div>
              <div className="flex gap-8">
                <Stat label="Active clients" value={String(summary.activeClients)} />
                <Stat
                  label="Avg build fee (mo)"
                  value={gbp(summary.avgBuildFeeThisMonth)}
                />
              </div>
            </div>
            <div
              style={{
                height: 8,
                background: "var(--k-bg)",
                border: "1px solid var(--k-border)",
                marginTop: 20,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${summary.pctToTarget}%`,
                  height: "100%",
                  background: "var(--k-accent)",
                  transition: "width .4s",
                }}
              />
            </div>
          </div>
        </div>
      </Reveal>

      {/* ── Subscriptions ───────────────────────────────────── */}
      <Reveal className="block" delay={0.1}>
        <Panel
          label="Recurring"
          title="Care subscriptions (MRR)"
          pad={false}
          className="mt-7"
        >
          <form
            action={addSubscription}
            className="flex items-center gap-2 flex-wrap"
            style={{ padding: "16px 18px", borderBottom: "1px solid var(--k-border)" }}
          >
            <select name="tenant_id" style={inp} required defaultValue="">
              <option value="" disabled>
                Client…
              </option>
              {tenantList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select name="plan" style={inp} defaultValue="care_basic">
              <option value="care_basic">Care Basic · £49</option>
              <option value="care_pro">Care Pro · £149</option>
              <option value="transaction">Transaction · £39 floor</option>
            </select>
            <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)", true)}>
              + Subscription
            </SubmitButton>
          </form>
          <Table
            head={["Client", "Plan", "MRR", "Status"]}
            rows={subList.map((s) => ({
              key: s.id,
              cells: [
                nameOf(s.tenant_id),
                s.plan.replace(/_/g, " "),
                gbp(s.mrr) + "/mo",
                <StatusChip key="st" tone={s.status === "active" ? "success" : "muted"}>
                  {s.status}
                </StatusChip>,
              ],
              action:
                s.status === "active" ? (
                  <form action={cancelSubscription}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="tenant_id" value={s.tenant_id} />
                    <SubmitButton style={btn("transparent", "var(--k-muted)", true)}>
                      Cancel
                    </SubmitButton>
                  </form>
                ) : null,
            }))}
            empty="No subscriptions yet."
          />
        </Panel>
      </Reveal>

      {/* ── Invoices ────────────────────────────────────────── */}
      <Reveal className="block" delay={0.1}>
        <Panel
          label="One-off"
          title="Build & one-off invoices"
          pad={false}
          className="mt-7"
        >
          <form
            action={issueInvoice}
            className="flex items-center gap-2 flex-wrap"
            style={{ padding: "16px 18px", borderBottom: "1px solid var(--k-border)" }}
          >
            <select name="tenant_id" style={inp} required defaultValue="">
              <option value="" disabled>
                Client…
              </option>
              {tenantList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select name="type" style={inp} defaultValue="build_milestone">
              <option value="build_milestone">Build milestone</option>
              <option value="one_off">One-off</option>
            </select>
            <input
              name="amount"
              type="number"
              step="1"
              placeholder="£ amount"
              style={{ ...inp, width: 110 }}
              required
            />
            <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)", true)}>
              Issue invoice
            </SubmitButton>
          </form>
          <Table
            head={["Client", "Type", "Amount", "Status"]}
            rows={invoiceList.map((i) => ({
              key: i.id,
              cells: [
                nameOf(i.tenant_id),
                i.type.replace(/_/g, " "),
                gbp(i.amount),
                <StatusChip key="st" tone={i.status === "paid" ? "success" : "warning"}>
                  {i.status}
                </StatusChip>,
              ],
              action:
                i.status !== "paid" ? (
                  <form action={markInvoicePaid}>
                    <input type="hidden" name="id" value={i.id} />
                    <input type="hidden" name="tenant_id" value={i.tenant_id} />
                    <SubmitButton style={btn("var(--k-accent)", "var(--k-on-accent)")}>
                      Mark paid
                    </SubmitButton>
                  </form>
                ) : (
                  <StatusChip tone="success">✓ paid</StatusChip>
                ),
            }))}
            empty="No invoices yet."
          />
        </Panel>
      </Reveal>

      {/* ── Usage footprint / cost guardrail ────────────────── */}
      <Reveal className="block" delay={0.1}>
        <Panel
          label="Cost guardrail"
          title="Usage footprint"
          pad={false}
          className="mt-7"
        >
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.84rem",
              lineHeight: 1.5,
              color: "var(--k-muted)",
              padding: "14px 18px",
              borderBottom: "1px solid var(--k-border)",
              maxWidth: "64ch",
            }}
          >
            A proxy for each client&apos;s resource footprint vs its recurring fee. A flag
            is a pricing trigger — raise the plan, never absorb the cost.
          </p>
          {footprint.length === 0 ? (
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.85rem",
                color: "var(--k-faint)",
                padding: "14px 18px",
              }}
            >
              No client tenants yet.
            </p>
          ) : (
            <div>
              {footprint.map((f, idx) => (
                <div
                  key={f.tenant_id}
                  className="flex items-center justify-between gap-3 k-kard-h"
                  style={{
                    padding: "12px 18px",
                    borderTop: idx ? "1px solid var(--k-border)" : "none",
                  }}
                >
                  <div
                    className="flex items-center gap-4 flex-wrap"
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.72rem",
                      letterSpacing: "0.04em",
                      color: "var(--k-muted)",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.86rem",
                        color: "var(--k-fg)",
                        fontWeight: 600,
                      }}
                    >
                      {f.name}
                    </span>
                    <span>docs {f.documents}</span>
                    <span>reqs {f.change_requests}</span>
                    <span>tasks {f.tasks}</span>
                    <span>audit {f.audit_rows}</span>
                    <span>{gbp(Number(f.mrr))}/mo</span>
                  </div>
                  {f.flag ? (
                    <StatusChip tone="warning">⚠ review pricing</StatusChip>
                  ) : (
                    <StatusChip tone="success">✓ healthy</StatusChip>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </Reveal>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: T.display,
          fontWeight: 800,
          fontSize: "1.5rem",
          letterSpacing: "-0.02em",
          color: "var(--k-fg)",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--k-muted)",
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function Table({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: { key: string; cells: React.ReactNode[]; action: React.ReactNode }[];
  empty: string;
}) {
  if (rows.length === 0)
    return (
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.85rem",
          color: "var(--k-faint)",
          padding: "14px 18px",
        }}
      >
        {empty}
      </p>
    );
  return (
    <div>
      {/* mono uppercase column header */}
      <div
        className="flex items-center justify-between gap-3"
        style={{
          padding: "10px 18px",
          borderBottom: "1px solid var(--k-border)",
        }}
      >
        <div className="flex items-center gap-4 flex-wrap">
          {head.map((h) => (
            <span
              key={h}
              style={{
                fontFamily: T.mono,
                fontSize: "0.6rem",
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--k-faint)",
              }}
            >
              {h}
            </span>
          ))}
        </div>
      </div>
      {rows.map((r, idx) => (
        <div
          key={r.key}
          className="flex items-center justify-between gap-3 k-kard-h"
          style={{
            padding: "12px 18px",
            borderTop: idx ? "1px solid var(--k-border)" : "none",
          }}
        >
          <div className="flex items-center gap-4 flex-wrap">
            {r.cells.map((c, i) => (
              <span
                key={i}
                style={{
                  color: i === 0 ? "var(--k-fg)" : "var(--k-muted)",
                  fontFamily: i === 0 ? T.sans : T.mono,
                  fontSize: i === 0 ? "0.86rem" : "0.74rem",
                  letterSpacing: i === 0 ? undefined : "0.04em",
                }}
              >
                {c}
              </span>
            ))}
          </div>
          {r.action}
        </div>
      ))}
    </div>
  );
}

const inp = {
  fontFamily: T.sans,
  fontSize: "0.85rem",
  height: 36,
  padding: "0 11px",
  background: "var(--k-surface)",
  color: "var(--k-fg)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
} as const;
const btn = (bg: string, fg: string, outline = false) => ({
  fontFamily: T.mono,
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  height: 36,
  paddingInline: 14,
  background: bg,
  color: fg,
  border: outline ? "1px solid var(--k-border)" : "1px solid transparent",
  borderRadius: 0,
  cursor: "pointer",
});
