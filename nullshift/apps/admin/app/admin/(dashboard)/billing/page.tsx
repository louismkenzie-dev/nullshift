import { revalidatePath } from "next/cache";
import { createClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { getMrrSummary } from "@nullshift/billing/mrr";
import { T } from "@nullshift/ui/tokens";

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

  return (
    <div>
      <div
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: T.primary,
          marginBottom: 8,
        }}
      >
        {"// Billing"}
      </div>
      <h1
        style={{
          fontFamily: T.display,
          fontWeight: 600,
          fontSize: "1.9rem",
          color: T.fg,
          marginBottom: 20,
        }}
      >
        MRR to £8,000
      </h1>

      {/* ── The £8k tracker ─────────────────────────────────── */}
      <section
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: T.r.xl,
          padding: "26px 28px",
          marginBottom: 28,
        }}
      >
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div
              style={{
                fontFamily: T.display,
                fontWeight: 700,
                fontSize: "clamp(2.4rem, 6vw, 3.6rem)",
                letterSpacing: "-0.03em",
                color: T.primary,
                lineHeight: 1,
              }}
              className="hero-glow"
            >
              {gbp(summary.mrr)}
              <span
                style={{
                  fontFamily: T.sans,
                  fontSize: "1rem",
                  color: T.muted,
                  fontWeight: 500,
                }}
              >
                {" "}
                /mo MRR
              </span>
            </div>
            <div
              style={{
                fontFamily: T.sans,
                fontSize: "0.9rem",
                color: T.muted,
                marginTop: 6,
              }}
            >
              {gbp(summary.gap)} to go · {summary.pctToTarget}% of the £8,000 target
            </div>
          </div>
          <div className="flex gap-6">
            <Stat label="Active clients" value={String(summary.activeClients)} />
            <Stat label="Avg build fee (mo)" value={gbp(summary.avgBuildFeeThisMonth)} />
          </div>
        </div>
        <div
          style={{
            height: 10,
            background: T.bg,
            border: `1px solid ${T.border}`,
            borderRadius: 999,
            marginTop: 20,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${summary.pctToTarget}%`,
              height: "100%",
              background: T.primary,
              boxShadow: `0 0 16px ${T.primary}`,
              transition: "width .4s",
            }}
          />
        </div>
      </section>

      {/* ── Subscriptions ───────────────────────────────────── */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={sectionH}>Care subscriptions (MRR)</h2>
        <form
          action={addSubscription}
          className="flex items-center gap-2"
          style={{ margin: "10px 0 14px" }}
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
          <button type="submit" style={btn(T.surface2, T.fg)}>
            + Subscription
          </button>
        </form>
        <Table
          rows={subList.map((s) => ({
            key: s.id,
            cells: [
              nameOf(s.tenant_id),
              s.plan.replace(/_/g, " "),
              gbp(s.mrr) + "/mo",
              s.status,
            ],
            action:
              s.status === "active" ? (
                <form action={cancelSubscription}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="tenant_id" value={s.tenant_id} />
                  <button type="submit" style={btn("transparent", T.muted)}>
                    Cancel
                  </button>
                </form>
              ) : null,
          }))}
          empty="No subscriptions yet."
        />
      </section>

      {/* ── Invoices ────────────────────────────────────────── */}
      <section>
        <h2 style={sectionH}>Build &amp; one-off invoices</h2>
        <form
          action={issueInvoice}
          className="flex items-center gap-2"
          style={{ margin: "10px 0 14px" }}
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
          <button type="submit" style={btn(T.surface2, T.fg)}>
            Issue invoice
          </button>
        </form>
        <Table
          rows={invoiceList.map((i) => ({
            key: i.id,
            cells: [
              nameOf(i.tenant_id),
              i.type.replace(/_/g, " "),
              gbp(i.amount),
              i.status,
            ],
            action:
              i.status !== "paid" ? (
                <form action={markInvoicePaid}>
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="tenant_id" value={i.tenant_id} />
                  <button type="submit" style={btn(T.primary, T.primaryFg)}>
                    Mark paid
                  </button>
                </form>
              ) : (
                <span style={{ fontFamily: T.mono, fontSize: "10px", color: T.success }}>
                  ✓ paid
                </span>
              ),
          }))}
          empty="No invoices yet."
        />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: T.display,
          fontWeight: 700,
          fontSize: "1.5rem",
          color: T.fg,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: T.muted,
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function Table({
  rows,
  empty,
}: {
  rows: { key: string; cells: string[]; action: React.ReactNode }[];
  empty: string;
}) {
  if (rows.length === 0)
    return (
      <p style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.faint }}>{empty}</p>
    );
  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.r.lg,
        overflow: "hidden",
      }}
    >
      {rows.map((r, idx) => (
        <div
          key={r.key}
          className="flex items-center justify-between gap-3"
          style={{
            padding: "12px 16px",
            borderTop: idx ? `1px solid ${T.border}` : "none",
          }}
        >
          <div
            className="flex items-center gap-4 flex-wrap"
            style={{ fontFamily: T.sans, fontSize: "0.86rem", color: T.fg }}
          >
            {r.cells.map((c, i) => (
              <span
                key={i}
                style={{
                  color: i === 0 ? T.fg : T.muted,
                  fontFamily: i === 0 ? T.sans : T.mono,
                  fontSize: i === 0 ? "0.86rem" : "0.78rem",
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

const sectionH = {
  fontFamily: T.display,
  fontWeight: 600,
  fontSize: "1.1rem",
  color: T.fg,
} as const;
const inp = {
  fontFamily: T.sans,
  fontSize: "0.85rem",
  height: 34,
  padding: "0 10px",
  background: T.bg,
  color: T.fg,
  border: `1px solid ${T.border}`,
  borderRadius: 6,
} as const;
const btn = (bg: string, fg: string) => ({
  fontFamily: T.mono,
  fontSize: "11px",
  letterSpacing: "0.05em",
  textTransform: "uppercase" as const,
  height: 34,
  paddingInline: 12,
  background: bg,
  color: fg,
  border: bg === "transparent" ? `1px solid ${T.border}` : "none",
  borderRadius: 6,
  cursor: "pointer",
});
