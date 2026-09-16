import { createServiceClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader } from "@/components/app/AppKit";
import { logCostEntry, logTimeEntry, saveQuoteAssessment } from "./actions";

export const dynamic = "force-dynamic";

type EconomicsRow = {
  tenant_id: string;
  name: string;
  vertical: string | null;
  mrr: number;
  paid_invoice_revenue: number;
  application_fee_revenue: number;
  lifetime_cash_revenue: number;
  tracked_hours: number;
  labour_cost: number;
  direct_cost: number;
  tracked_delivery_cost: number;
  tracked_contribution: number;
  effective_revenue_per_hour: number | null;
  issue_count: number;
  bug_count: number;
};

type Tenant = { id: string; name: string };
type Project = { id: string; tenant_id: string; name: string };
type Quote = {
  id: string;
  prospect_name: string;
  complexity_score: number;
  risk_level: string;
  recommended_build_fee: number;
  recommended_monthly_fee: number;
  recommended_transaction_fee_bps: number;
  predicted_support_hours: number;
  created_at: string;
};

const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number(value ?? 0));

const smallMoney = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(Number(value ?? 0));

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const panel: React.CSSProperties = {
  border: "1px solid var(--k-border)",
  background: "var(--k-surface)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 38,
  background: "var(--k-bg)",
  border: "1px solid var(--k-border)",
  color: "var(--k-fg)",
  padding: "8px 10px",
  fontFamily: T.sans,
  fontSize: 13,
};

const btn: React.CSSProperties = {
  minHeight: 38,
  padding: "0 14px",
  border: 0,
  background: "var(--k-accent)",
  color: "var(--k-on-accent)",
  fontFamily: T.mono,
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontWeight: 600,
};

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div style={{ ...panel, padding: 18 }}>
      <div style={{ ...mono, color: "var(--k-muted)" }}>{label}</div>
      <div style={{ fontFamily: T.sans, fontSize: 27, fontWeight: 700, color: "var(--k-fg)", marginTop: 7 }}>{value}</div>
      {detail ? <div style={{ fontFamily: T.sans, fontSize: 12, color: "var(--k-muted)", marginTop: 4 }}>{detail}</div> : null}
    </div>
  );
}

export default async function EconomicsPage() {
  const db = createServiceClient();
  const [summaryRes, tenantRes, projectRes, quoteRes] = await Promise.all([
    db.from("client_economics_summary").select("*").order("lifetime_cash_revenue", { ascending: false }),
    db.from("tenants").select("id,name").neq("type", "internal").order("name"),
    db.from("projects").select("id,tenant_id,name").order("name"),
    db.from("quote_assessments").select("id,prospect_name,complexity_score,risk_level,recommended_build_fee,recommended_monthly_fee,recommended_transaction_fee_bps,predicted_support_hours,created_at").order("created_at", { ascending: false }).limit(8),
  ]);

  const rows = (summaryRes.data ?? []) as EconomicsRow[];
  const tenants = (tenantRes.data ?? []) as Tenant[];
  const projects = (projectRes.data ?? []) as Project[];
  const quotes = (quoteRes.data ?? []) as Quote[];
  const customerIds = new Set(tenants.map((t) => t.id));
  const customerRows = rows.filter((r) => customerIds.has(r.tenant_id));

  const totalMrr = customerRows.reduce((sum, r) => sum + Number(r.mrr), 0);
  const totalCash = customerRows.reduce((sum, r) => sum + Number(r.lifetime_cash_revenue), 0);
  const trackedCost = customerRows.reduce((sum, r) => sum + Number(r.tracked_delivery_cost), 0);
  const trackedHours = customerRows.reduce((sum, r) => sum + Number(r.tracked_hours), 0);
  const totalContribution = totalCash - trackedCost;

  return (
    <div>
      <PageHeader
        index="06"
        label="Commercial intelligence"
        title="Client economics"
        lead="Know which clients actually make money, where support time leaks margin, and what Nullshift should charge before the next proposal goes out."
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 mt-8">
        <Metric label="Current MRR" value={money(totalMrr)} detail="Active + trialling subscriptions" />
        <Metric label="Tracked cash revenue" value={money(totalCash)} detail="Paid invoices + live application fees" />
        <Metric label="Tracked delivery cost" value={money(trackedCost)} detail={`${trackedHours.toFixed(1)} staff hours logged`} />
        <Metric label="Tracked contribution" value={money(totalContribution)} detail="Revenue minus recorded labour and direct costs" />
      </div>

      <section className="mt-8" style={panel}>
        <div className="flex items-end justify-between gap-4 p-5" style={{ borderBottom: "1px solid var(--k-border)" }}>
          <div>
            <div style={{ ...mono, color: "var(--k-accent)" }}>// CLIENT PROFITABILITY</div>
            <h2 style={{ fontFamily: T.sans, fontSize: 20, fontWeight: 700, color: "var(--k-fg)", marginTop: 5 }}>Economics by client</h2>
          </div>
          <div style={{ ...mono, color: "var(--k-muted)" }}>Labour defaults to £40/hr until overridden</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 960 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--k-border)" }}>
                {["Client", "MRR", "Cash revenue", "App fees", "Hours", "Delivery cost", "Contribution", "£ / tracked hr", "Issues"].map((h) => (
                  <th key={h} style={{ ...mono, textAlign: h === "Client" ? "left" : "right", color: "var(--k-muted)", padding: "11px 14px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customerRows.map((r) => {
                const contribution = Number(r.tracked_contribution);
                return (
                  <tr key={r.tenant_id} style={{ borderBottom: "1px solid var(--k-border)" }}>
                    <td style={{ padding: "13px 14px", fontFamily: T.sans, color: "var(--k-fg)", fontWeight: 600 }}>{r.name}</td>
                    <td style={{ padding: "13px 14px", textAlign: "right", fontFamily: T.mono }}>{smallMoney(r.mrr)}</td>
                    <td style={{ padding: "13px 14px", textAlign: "right", fontFamily: T.mono }}>{smallMoney(r.lifetime_cash_revenue)}</td>
                    <td style={{ padding: "13px 14px", textAlign: "right", fontFamily: T.mono }}>{smallMoney(r.application_fee_revenue)}</td>
                    <td style={{ padding: "13px 14px", textAlign: "right", fontFamily: T.mono }}>{Number(r.tracked_hours).toFixed(1)}</td>
                    <td style={{ padding: "13px 14px", textAlign: "right", fontFamily: T.mono }}>{smallMoney(r.tracked_delivery_cost)}</td>
                    <td style={{ padding: "13px 14px", textAlign: "right", fontFamily: T.mono, color: contribution < 0 ? "var(--k-danger)" : "var(--k-fg)" }}>{smallMoney(contribution)}</td>
                    <td style={{ padding: "13px 14px", textAlign: "right", fontFamily: T.mono }}>{r.effective_revenue_per_hour == null ? "—" : smallMoney(r.effective_revenue_per_hour)}</td>
                    <td style={{ padding: "13px 14px", textAlign: "right", fontFamily: T.mono }}>{r.issue_count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 mt-8">
        <section style={{ ...panel, padding: 20 }}>
          <div style={{ ...mono, color: "var(--k-accent)" }}>// COST TO SERVE</div>
          <h2 style={{ fontFamily: T.sans, fontSize: 20, fontWeight: 700, color: "var(--k-fg)", margin: "5px 0 16px" }}>Log staff time</h2>
          <form action={logTimeEntry} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <select name="tenant_id" required style={inputStyle}><option value="">Client</option>{tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <select name="project_id" style={inputStyle}><option value="">Project — optional</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <select name="category" defaultValue="support" style={inputStyle}>{["build","bug_fix","support","meeting","training","content","feature","admin","other"].map((c) => <option key={c} value={c}>{c.replaceAll("_", " ")}</option>)}</select>
            <input name="hours" type="number" min="0.1" step="0.1" placeholder="Hours" required style={inputStyle} />
            <input name="internal_hourly_cost" type="number" min="0" step="1" defaultValue="40" aria-label="Internal hourly cost" style={inputStyle} />
            <input name="occurred_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} style={inputStyle} />
            <input name="description" placeholder="What did we do?" className="md:col-span-2" style={inputStyle} />
            <button type="submit" className="md:col-span-2" style={btn}>Log time</button>
          </form>
        </section>

        <section style={{ ...panel, padding: 20 }}>
          <div style={{ ...mono, color: "var(--k-accent)" }}>// DIRECT COSTS</div>
          <h2 style={{ fontFamily: T.sans, fontSize: 20, fontWeight: 700, color: "var(--k-fg)", margin: "5px 0 16px" }}>Log client cost</h2>
          <form action={logCostEntry} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <select name="tenant_id" required style={inputStyle}><option value="">Client</option>{tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <select name="project_id" style={inputStyle}><option value="">Project — optional</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <select name="category" defaultValue="hosting" style={inputStyle}>{["hosting","api","email","ai","payments","software","contractor","other"].map((c) => <option key={c} value={c}>{c}</option>)}</select>
            <input name="amount" type="number" min="0" step="0.01" placeholder="Cost £" required style={inputStyle} />
            <input name="description" placeholder="e.g. ElevenLabs explainer videos" required style={inputStyle} />
            <input name="occurred_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} style={inputStyle} />
            <label className="flex items-center gap-2 md:col-span-2" style={{ fontFamily: T.sans, fontSize: 13, color: "var(--k-muted)" }}><input name="recurring" type="checkbox" /> Recurring monthly cost</label>
            <button type="submit" className="md:col-span-2" style={btn}>Log cost</button>
          </form>
        </section>
      </div>

      <section className="mt-8" style={{ ...panel, padding: 20 }}>
        <div style={{ ...mono, color: "var(--k-accent)" }}>// QUOTE INTELLIGENCE V1</div>
        <h2 style={{ fontFamily: T.sans, fontSize: 20, fontWeight: 700, color: "var(--k-fg)", margin: "5px 0 6px" }}>Price the next bespoke system consistently</h2>
        <p style={{ fontFamily: T.sans, fontSize: 13, color: "var(--k-muted)", marginBottom: 18 }}>The first version is deterministic and explainable. As cost/time history builds, these coefficients can be calibrated against actual Nullshift outcomes.</p>
        <form action={saveQuoteAssessment} className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-4">
          <input name="prospect_name" placeholder="Prospect / project name" required style={inputStyle} />
          <select name="tenant_id" style={inputStyle}><option value="">Not an existing client</option>{tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <input name="user_roles" type="number" min="1" defaultValue="2" placeholder="User roles" style={inputStyle} />
          <input name="integrations" type="number" min="0" defaultValue="1" placeholder="Integrations" style={inputStyle} />
          <input name="payment_flows" type="number" min="0" defaultValue="0" placeholder="Payment flows" style={inputStyle} />
          <input name="admin_workflows" type="number" min="0" defaultValue="2" placeholder="Admin workflows" style={inputStyle} />
          <input name="ai_features" type="number" min="0" defaultValue="0" placeholder="AI features" style={inputStyle} />
          <select name="auth_complexity" defaultValue="1" style={inputStyle}><option value="0">No auth</option><option value="1">Simple auth</option><option value="2">Multi-role auth</option><option value="3">Complex / regulated auth</option></select>
          <input name="expected_monthly_transactions" type="number" min="0" defaultValue="0" placeholder="Monthly transactions" style={inputStyle} />
          <input name="expected_monthly_active_users" type="number" min="0" defaultValue="100" placeholder="Monthly active users" style={inputStyle} />
          <select name="client_change_risk" defaultValue="1" style={inputStyle}><option value="0">Very stable scope</option><option value="1">Normal change risk</option><option value="2">High change risk</option><option value="3">Very high change risk</option></select>
          <div className="flex flex-wrap gap-4 items-center" style={{ fontFamily: T.sans, fontSize: 12, color: "var(--k-muted)" }}>
            <label><input name="booking_or_scheduling" type="checkbox" /> Booking</label>
            <label><input name="subscription_billing" type="checkbox" /> Subscriptions</label>
            <label><input name="data_migration" type="checkbox" /> Migration</label>
          </div>
          <button type="submit" className="md:col-span-3 xl:col-span-4" style={btn}>Calculate + save recommendation</button>
        </form>

        {quotes.length > 0 ? (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 820 }}>
              <thead><tr style={{ borderBottom: "1px solid var(--k-border)" }}>{["Assessment", "Complexity", "Risk", "Build fee", "Monthly", "Transaction fee", "Support"].map((h) => <th key={h} style={{ ...mono, textAlign: h === "Assessment" ? "left" : "right", padding: "10px 12px", color: "var(--k-muted)" }}>{h}</th>)}</tr></thead>
              <tbody>{quotes.map((q) => <tr key={q.id} style={{ borderBottom: "1px solid var(--k-border)" }}><td style={{ padding: 12, fontFamily: T.sans, fontWeight: 600 }}>{q.prospect_name}</td><td style={{ padding: 12, textAlign: "right", fontFamily: T.mono }}>{q.complexity_score}/100</td><td style={{ padding: 12, textAlign: "right", fontFamily: T.mono }}>{q.risk_level}</td><td style={{ padding: 12, textAlign: "right", fontFamily: T.mono }}>{money(q.recommended_build_fee)}</td><td style={{ padding: 12, textAlign: "right", fontFamily: T.mono }}>{money(q.recommended_monthly_fee)}/mo</td><td style={{ padding: 12, textAlign: "right", fontFamily: T.mono }}>{(q.recommended_transaction_fee_bps / 100).toFixed(2)}%</td><td style={{ padding: 12, textAlign: "right", fontFamily: T.mono }}>{q.predicted_support_hours}h/mo</td></tr>)}</tbody>
            </table>
          </div>
        ) : null}
      </section>

      <p className="mt-5" style={{ fontFamily: T.sans, fontSize: 12, color: "var(--k-muted)" }}>
        Important: contribution is only as accurate as time and direct-cost tracking. Historical revenue is already populated; labour costs start becoming meaningful from the moment you log delivery work here.
      </p>
    </div>
  );
}
