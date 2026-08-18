import { revalidatePath } from "next/cache";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { createClient, createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { getMrrSummary } from "@nullshift/billing/mrr";
import { getStripe } from "@nullshift/billing/stripe";
import { cancelGoCardlessSubscription } from "@nullshift/billing/gocardless";
import { markInvoicePaidOutOfBand } from "@/lib/markInvoicePaid";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import {
  CARE_PLANS,
  CARE_PLAN_MRR,
  carePlan,
  currentPeriodStart,
  remainingAllowance,
} from "@/lib/carePlans";
import { sendCareSubscriptionSignup } from "@/lib/careSubscription";

/**
 * Billing — the money cockpit. MRR on the new four-tier retainer model
 * (hosting £40 / hosting+API £80 / build 3 £120 / build 10 £180 — all from
 * @/lib/carePlans, the single source of truth), one row per client with their
 * latest retainer + build-item allowance meter, past-due triage at the top,
 * build invoices, and the usage-footprint cost guardrail. The Stripe webhook
 * flips invoices to paid and upserts subscriptions in production; the actions
 * here let staff send sign-ups, record standing-order retainers, and grant
 * build-credit top-ups.
 */

export const dynamic = "force-dynamic";

type Tenant = { id: string; name: string };
type Sub = {
  id: string;
  tenant_id: string;
  plan: string | null;
  mrr: number;
  status: string;
  stripe_subscription_id: string | null;
  created_at: string;
};
type Invoice = {
  id: string;
  tenant_id: string;
  type: string;
  amount: number;
  status: string;
  hosted_invoice_url: string | null;
  paid_at: string | null;
  created_at: string;
  due_at: string | null;
};
type CreditEvent = { tenant_id: string; delta: number };

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://nullshift.co.uk").replace(
  /\/$/,
  ""
);

const SUB_TONE: Record<string, "accent" | "success" | "warning" | "danger" | "muted"> = {
  active: "success",
  trialing: "accent",
  past_due: "danger",
  incomplete: "warning",
  canceled: "muted",
};

/* ── Server actions ─────────────────────────────────────────────── */

/**
 * Email the client a Stripe Checkout sign-up for a retainer plan (they add a
 * card to start the recurring plan). The webhook flips the local row to active
 * once they complete it. Idempotent — a no-op if already actively subscribed.
 */
async function sendSubscriptionSignup(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const plan = String(formData.get("plan") || "");
  if (!tenantId || !(plan in CARE_PLAN_MRR)) return;
  const res = await sendCareSubscriptionSignup(createServiceClient(), {
    tenantId,
    planId: plan,
    siteUrl: SITE_URL,
  });
  if (res.ok)
    await logAudit({
      action: "subscription.signup_sent",
      target: `tenant:${tenantId}`,
      tenantId,
      metadata: { plan, emailed: res.emailed, alreadyActive: res.alreadyActive ?? false },
    });
  revalidatePath("/admin/billing");
}

async function cancelSubscription(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!id) return;
  const service = createServiceClient();
  // Cancel the REAL provider subscription first so billing actually stops, then
  // reflect it locally ('canceled' — the enum is American-spelled).
  const { data: sub } = await service
    .from("subscriptions")
    .select("stripe_subscription_id, gc_subscription_id")
    .eq("id", id)
    .maybeSingle();
  if (sub?.stripe_subscription_id) {
    const stripe = getStripe();
    if (stripe) {
      try {
        await stripe.subscriptions.cancel(sub.stripe_subscription_id);
      } catch (e) {
        console.error("stripe subscription cancel failed:", e);
      }
    }
  }
  if (sub?.gc_subscription_id) {
    // A Direct Debit keeps charging until GoCardless itself is cancelled — if
    // that fails, leave the row alone so the UI can't show a client as
    // cancelled while their bank is still being debited.
    try {
      await cancelGoCardlessSubscription(sub.gc_subscription_id);
    } catch (e) {
      console.error("gocardless subscription cancel failed:", e);
      revalidatePath("/admin/billing");
      return;
    }
  }
  const { error } = await service
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("id", id);
  if (error) console.error("cancelSubscription:", error.message);
  else
    await logAudit({
      action: "subscription.canceled",
      target: `subscription:${id}`,
      tenantId,
    });
  revalidatePath("/admin/billing");
}

/**
 * Record a retainer without Stripe — for clients who pay by standing order.
 * MRR comes from the plan table so the number can never drift from pricing.
 */
async function recordManualSubscription(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const plan = String(formData.get("plan") || "");
  if (!tenantId || !(plan in CARE_PLAN_MRR)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("subscriptions").insert({
    tenant_id: tenantId,
    plan,
    mrr: CARE_PLAN_MRR[plan],
    status: "active",
    started_at: new Date().toISOString(),
  });
  if (!error)
    await logAudit({
      action: "subscription.recorded_manually",
      target: `tenant:${tenantId}`,
      tenantId,
      metadata: { plan, mrr: CARE_PLAN_MRR[plan] },
    });
  revalidatePath("/admin/billing");
}

/** Grant extra build items for the current month (positive build-credit delta). */
async function grantTopUp(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const delta = Number(formData.get("delta") || 0);
  if (!tenantId || !(delta > 0)) return;
  const period = currentPeriodStart();
  const supabase = await createClient();
  const { error } = await supabase.from("build_credit_events").insert({
    tenant_id: tenantId,
    period,
    delta,
    reason: "Top-up",
  });
  if (!error)
    await logAudit({
      action: "build_credit.topup",
      target: `tenant:${tenantId}`,
      tenantId,
      metadata: { period, delta },
    });
  revalidatePath("/admin/billing");
}

async function issueInvoice(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const type = String(formData.get("type") || "build_milestone");
  const amount = Number(formData.get("amount") || 0);
  if (!tenantId || amount <= 0) return;
  const supabase = await createClient();
  await supabase.from("invoices").insert({
    tenant_id: tenantId,
    type,
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
  if (!(await requireStaff()).ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!id || !tenantId) return;
  // Shared implementation — settles the Stripe hosted invoice out-of-band (so
  // the card link stops collecting), CAS status flip, Xero payment mirror.
  // This page used to have a weaker copy that skipped all three.
  await markInvoicePaidOutOfBand({ tenantId, invoiceId: id });
  revalidatePath("/admin/billing");
}

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");

/* ── Page ───────────────────────────────────────────────────────── */

export default async function BillingPage() {
  const supabase = await createClient();
  const period = currentPeriodStart();
  const [
    summary,
    { data: tenants },
    { data: subs },
    { data: invoices },
    { data: credits },
    { data: footprintRows },
  ] = await Promise.all([
    getMrrSummary(supabase),
    // Prospective clients (status 'prospect') stay out of the money cockpit
    // until they're onboarded — see /admin/systems.
    supabase
      .from("tenants")
      .select("id, name")
      .eq("type", "client")
      .neq("status", "prospect")
      .order("name"),
    supabase
      .from("subscriptions")
      .select("id, tenant_id, plan, mrr, status, stripe_subscription_id, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select(
        "id, tenant_id, type, amount, status, hosted_invoice_url, paid_at, created_at, due_at"
      )
      .order("created_at", { ascending: false }),
    supabase.from("build_credit_events").select("tenant_id, delta").eq("period", period),
    supabase.rpc("tenant_footprint"),
  ]);
  const tenantList = (tenants ?? []) as Tenant[];
  const subList = (subs ?? []) as Sub[];
  const invoiceList = (invoices ?? []) as Invoice[];
  const creditList = (credits ?? []) as CreditEvent[];
  const nameOf = (id: string) => tenantList.find((t) => t.id === id)?.name ?? "—";

  // Latest subscription per tenant (subList is created_at desc → first wins).
  const latestSub = new Map<string, Sub>();
  for (const s of subList) if (!latestSub.has(s.tenant_id)) latestSub.set(s.tenant_id, s);

  // Build-credit deltas folded per tenant for the current period.
  const creditByTenant = new Map<string, number>();
  for (const c of creditList)
    creditByTenant.set(
      c.tenant_id,
      (creditByTenant.get(c.tenant_id) ?? 0) + Number(c.delta)
    );

  const activeSubs = subList.filter((s) => s.status === "active");
  const trialingSubs = subList.filter((s) => s.status === "trialing");
  const pastDueSubs = subList.filter((s) => s.status === "past_due");
  const openInvoices = invoiceList.filter((i) => i.status === "open");
  const openTotal = openInvoices.reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const recentPaid = invoiceList.filter((i) => i.status === "paid").slice(0, 10);
  // Overdue = open past its due date. Legacy rows without due_at can't be
  // overdue (they predate due dates being set at generation).
  const nowMs = Date.now();
  const isOverdueInv = (i: Invoice) =>
    i.status === "open" && !!i.due_at && new Date(i.due_at).getTime() < nowMs;
  const overdueInvoices = openInvoices.filter(isOverdueInv);

  // Per-tenant usage footprint (cost guardrail). A pricing trigger fires when a
  // tenant carries real activity but little/no recurring fee to cover it.
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
    // Flag anyone below the cheapest retainer (£40 Hosting) with a real footprint.
    return { ...f, score, flag: score >= 15 && Number(f.mrr) < 40 };
  });

  return (
    <div>
      <PageHeader
        index="06"
        label="Billing"
        title="Money cockpit"
        lead="Retainers, build invoices and the cost guardrail — the numbers the business steers by."
      />

      {/* ── Past-due rail: the first thing to look at ─────────── */}
      {pastDueSubs.length > 0 && (
        <Reveal className="block" delay={0.03}>
          <div
            className="k-kard mt-7"
            style={{ background: "var(--k-surface)", borderColor: T.danger }}
          >
            <div
              className="flex flex-wrap items-center justify-between gap-4"
              style={{ padding: "14px 18px", borderBottom: "1px solid var(--k-border)" }}
            >
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.66rem",
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: T.danger,
                }}
              >
                {"// PAST DUE — chase these first"}
              </span>
              <StatusChip tone="danger">{pastDueSubs.length} at risk</StatusChip>
            </div>
            {pastDueSubs.map((s, i) => (
              <div
                key={s.id}
                className="flex items-center gap-4 flex-wrap"
                style={{
                  padding: "11px 18px",
                  borderTop: i ? "1px solid var(--k-border)" : "none",
                }}
              >
                <span
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.86rem",
                    fontWeight: 600,
                    color: "var(--k-fg)",
                  }}
                >
                  {nameOf(s.tenant_id)}
                </span>
                <StatusChip tone="danger">past due</StatusChip>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.72rem",
                    letterSpacing: "0.04em",
                    color: "var(--k-muted)",
                  }}
                >
                  {carePlan(s.plan)?.label ?? s.plan ?? "—"} · {gbp(Number(s.mrr))}/mo
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      )}

      {/* ── The four numbers ──────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mt-7">
        <Reveal delay={0.05}>
          <StatCard
            value={gbp(summary.mrr)}
            label="MRR"
            sub="Active + trialing retainers"
            accent
          />
        </Reveal>
        <Reveal delay={0.1}>
          <StatCard
            value={String(activeSubs.length)}
            label="Active retainers"
            sub={
              trialingSubs.length
                ? `+${trialingSubs.length} trialing`
                : "Recurring plans live now"
            }
          />
        </Reveal>
        <Reveal delay={0.15}>
          <StatCard
            value={String(pastDueSubs.length)}
            label="Past due"
            sub={pastDueSubs.length ? "Payment failed — chase" : "Nothing overdue"}
          />
        </Reveal>
        <Reveal delay={0.2}>
          <StatCard
            value={gbp(openTotal)}
            label="Unpaid invoices"
            sub={
              overdueInvoices.length > 0
                ? `${openInvoices.length} open · ${overdueInvoices.length} OVERDUE`
                : `${openInvoices.length} open invoice${openInvoices.length === 1 ? "" : "s"}`
            }
          />
        </Reveal>
      </div>

      {/* ── The £8k tracker ───────────────────────────────────── */}
      <Reveal className="block" delay={0.22}>
        <div className="k-kard mt-3" style={{ background: "var(--k-surface)" }}>
          <div style={{ padding: "18px 20px" }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.66rem",
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--k-muted)",
                }}
              >
                {"// MRR TO £8,000"}
              </span>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.72rem",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--k-muted)",
                }}
              >
                {gbp(summary.gap)} to go · {summary.pctToTarget}% of target
              </span>
            </div>
            <div
              style={{
                height: 8,
                background: "var(--k-bg)",
                border: "1px solid var(--k-border)",
                marginTop: 12,
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

      {/* ── Retainers: one row per client ─────────────────────── */}
      <Reveal className="block" delay={0.1}>
        <Panel
          label="// RETAINERS"
          title="One row per client"
          pad={false}
          className="mt-7"
        >
          {tenantList.length === 0 ? (
            <p style={emptyStyle}>No client tenants yet — add one in Clients.</p>
          ) : (
            <div>
              <div
                className="max-md:hidden md:grid"
                style={{
                  gridTemplateColumns: RETAINER_GRID,
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 18px",
                  background: "var(--k-surface)",
                  borderBottom: "1px solid var(--k-border)",
                }}
              >
                {["Client", "Plan", "Status", "MRR", "Allowance", ""].map((h, i) => (
                  <span key={i} style={headLabel}>
                    {h}
                  </span>
                ))}
              </div>
              {tenantList.map((t, i) => {
                const sub = latestSub.get(t.id) ?? null;
                const plan = carePlan(sub?.plan);
                const live =
                  !!sub && ["active", "trialing", "past_due"].includes(sub.status);
                const deltaSum = creditByTenant.get(t.id) ?? 0;
                const left = remainingAllowance(plan, deltaSum);
                return (
                  <Reveal key={t.id} className="block" delay={Math.min(i, 8) * 0.04}>
                    <details
                      style={{ borderTop: i ? "1px solid var(--k-border)" : "none" }}
                    >
                      <summary
                        className="k-kard-h max-md:flex max-md:flex-wrap max-md:items-center md:grid"
                        style={{
                          gridTemplateColumns: RETAINER_GRID,
                          gap: 12,
                          alignItems: "center",
                          padding: "12px 18px",
                          cursor: "pointer",
                          listStyle: "none",
                        }}
                      >
                        <span
                          className="min-w-0 max-md:w-full"
                          style={{
                            fontFamily: T.sans,
                            fontSize: "0.86rem",
                            fontWeight: 600,
                            color: "var(--k-fg)",
                          }}
                        >
                          {t.name}
                        </span>
                        <span className={sub ? undefined : "max-md:hidden"}>
                          {sub ? (
                            <StatusChip tone="accent">
                              {plan?.label ?? sub.plan ?? "—"}
                            </StatusChip>
                          ) : (
                            <span style={dimMono}>—</span>
                          )}
                        </span>
                        <span>
                          {sub ? (
                            <StatusChip tone={SUB_TONE[sub.status] ?? "muted"}>
                              {sub.status.replace(/_/g, " ")}
                            </StatusChip>
                          ) : (
                            <StatusChip tone="muted">none</StatusChip>
                          )}
                        </span>
                        <span
                          className={sub ? undefined : "max-md:hidden"}
                          style={dimMono}
                        >
                          {sub ? `${gbp(Number(sub.mrr))}/mo` : "—"}
                        </span>
                        <span
                          className={
                            plan && plan.buildAllowance > 0
                              ? "max-md:w-full"
                              : "max-md:hidden"
                          }
                        >
                          {plan && plan.buildAllowance > 0 ? (
                            <span className="inline-flex items-center gap-2">
                              <span
                                style={{
                                  width: 54,
                                  height: 5,
                                  background: "var(--k-bg)",
                                  border: "1px solid var(--k-border)",
                                  overflow: "hidden",
                                  display: "inline-block",
                                }}
                              >
                                <span
                                  style={{
                                    display: "block",
                                    height: "100%",
                                    width: `${Math.min(
                                      100,
                                      Math.round((left / plan.buildAllowance) * 100)
                                    )}%`,
                                    background: left > 0 ? "var(--k-accent)" : T.warning,
                                  }}
                                />
                              </span>
                              <span style={dimMono}>
                                {left} left of {plan.buildAllowance} this month
                              </span>
                            </span>
                          ) : (
                            <span style={{ ...dimMono, color: "var(--k-faint)" }}>—</span>
                          )}
                        </span>
                        <span
                          className="max-md:ml-auto"
                          style={{ ...dimMono, textAlign: "right" as const }}
                        >
                          Manage ▾
                        </span>
                      </summary>
                      <div
                        className="flex flex-wrap gap-x-8 gap-y-4"
                        style={{
                          padding: "14px 18px 16px",
                          borderTop: "1px dashed var(--k-border)",
                          background: "var(--k-bg)",
                        }}
                      >
                        {!live && (
                          <ActionGroup label="Send signup">
                            <form
                              action={sendSubscriptionSignup}
                              className="flex flex-wrap items-center gap-2"
                            >
                              <input type="hidden" name="tenant_id" value={t.id} />
                              <select
                                name="plan"
                                className="max-md:w-full"
                                style={{ ...inp, maxWidth: "100%" }}
                                defaultValue={plan?.id ?? "hosting"}
                              >
                                {CARE_PLANS.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.label} · £{p.mrr}/mo
                                  </option>
                                ))}
                              </select>
                              <SubmitButton
                                style={btn("var(--k-accent)", "var(--k-on-accent)")}
                              >
                                Send signup
                              </SubmitButton>
                            </form>
                          </ActionGroup>
                        )}
                        {!live && (
                          <ActionGroup label="Record manually (standing order)">
                            <form
                              action={recordManualSubscription}
                              className="flex flex-wrap items-center gap-2"
                            >
                              <input type="hidden" name="tenant_id" value={t.id} />
                              <select
                                name="plan"
                                className="max-md:w-full"
                                style={{ ...inp, maxWidth: "100%" }}
                                defaultValue="hosting"
                              >
                                {CARE_PLANS.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.label} · £{p.mrr}/mo
                                  </option>
                                ))}
                              </select>
                              <SubmitButton
                                style={btn("var(--k-surface)", "var(--k-fg)", true)}
                              >
                                Record
                              </SubmitButton>
                            </form>
                          </ActionGroup>
                        )}
                        <ActionGroup label="Grant top-up (build items)">
                          <form
                            action={grantTopUp}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <input type="hidden" name="tenant_id" value={t.id} />
                            <input
                              name="delta"
                              type="number"
                              min="1"
                              step="1"
                              placeholder="+N"
                              required
                              style={{ ...inp, width: 70, maxWidth: "100%" }}
                            />
                            <SubmitButton
                              style={btn("var(--k-surface)", "var(--k-fg)", true)}
                            >
                              Grant
                            </SubmitButton>
                          </form>
                        </ActionGroup>
                        {live && sub && (
                          <ActionGroup label="Cancel retainer">
                            <form action={cancelSubscription}>
                              <input type="hidden" name="id" value={sub.id} />
                              <input type="hidden" name="tenant_id" value={t.id} />
                              <SubmitButton style={btn("transparent", T.danger, true)}>
                                Cancel
                              </SubmitButton>
                            </form>
                          </ActionGroup>
                        )}
                      </div>
                    </details>
                  </Reveal>
                );
              })}
            </div>
          )}
        </Panel>
      </Reveal>

      {/* ── Invoices ──────────────────────────────────────────── */}
      <Reveal className="block" delay={0.1}>
        <Panel
          label="// INVOICES"
          title="Build & one-off invoices"
          pad={false}
          className="mt-7"
        >
          <form
            action={issueInvoice}
            className="flex items-center gap-2 flex-wrap"
            style={{ padding: "16px 18px", borderBottom: "1px solid var(--k-border)" }}
          >
            <select
              name="tenant_id"
              className="max-md:w-full"
              style={{ ...inp, maxWidth: "100%" }}
              required
              defaultValue=""
            >
              <option value="" disabled>
                Client…
              </option>
              {tenantList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              name="type"
              className="max-md:w-full"
              style={{ ...inp, maxWidth: "100%" }}
              defaultValue="build_milestone"
            >
              <option value="build_milestone">Build milestone</option>
              <option value="one_off">One-off</option>
            </select>
            <input
              name="amount"
              type="number"
              step="1"
              placeholder="£ amount"
              className="w-full md:w-[110px]"
              style={inp}
              required
            />
            <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)", true)}>
              Issue invoice
            </SubmitButton>
          </form>
          {openInvoices.length === 0 && recentPaid.length === 0 ? (
            <p style={emptyStyle}>No invoices yet.</p>
          ) : (
            <div>
              <div
                className="max-md:hidden md:grid"
                style={{
                  gridTemplateColumns: INVOICE_GRID,
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 18px",
                  background: "var(--k-surface)",
                  borderBottom: "1px solid var(--k-border)",
                }}
              >
                {["Client", "Type", "Amount", "Status", "Stripe", ""].map((h, i) => (
                  <span key={i} style={headLabel}>
                    {h}
                  </span>
                ))}
              </div>
              {[...openInvoices, ...recentPaid].map((inv, i) => (
                <Reveal key={inv.id} className="block" delay={Math.min(i, 8) * 0.04}>
                  <div
                    className="k-kard-h max-md:flex max-md:flex-wrap max-md:items-center md:grid"
                    style={{
                      gridTemplateColumns: INVOICE_GRID,
                      gap: 12,
                      alignItems: "center",
                      padding: "12px 18px",
                      borderTop: i ? "1px solid var(--k-border)" : "none",
                    }}
                  >
                    <span
                      className="min-w-0 max-md:w-full"
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.86rem",
                        fontWeight: 600,
                        color: "var(--k-fg)",
                      }}
                    >
                      {nameOf(inv.tenant_id)}
                    </span>
                    <span style={dimMono}>{inv.type.replace(/_/g, " ")}</span>
                    <span style={dimMono}>{gbp(Number(inv.amount))}</span>
                    <span>
                      <StatusChip
                        tone={
                          inv.status === "paid"
                            ? "success"
                            : isOverdueInv(inv)
                              ? "danger"
                              : "warning"
                        }
                      >
                        {isOverdueInv(inv) ? "overdue" : inv.status}
                      </StatusChip>
                    </span>
                    <span
                      className={inv.hosted_invoice_url ? undefined : "max-md:hidden"}
                    >
                      {inv.hosted_invoice_url ? (
                        <a
                          href={inv.hosted_invoice_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ ...dimMono, color: "var(--k-accent)" }}
                        >
                          View ↗
                        </a>
                      ) : (
                        <span style={{ ...dimMono, color: "var(--k-faint)" }}>—</span>
                      )}
                    </span>
                    <span className="flex justify-end max-md:ml-auto">
                      {inv.status !== "paid" ? (
                        <form action={markInvoicePaid}>
                          <input type="hidden" name="id" value={inv.id} />
                          <input type="hidden" name="tenant_id" value={inv.tenant_id} />
                          <SubmitButton
                            style={btn("var(--k-accent)", "var(--k-on-accent)")}
                          >
                            Mark paid
                          </SubmitButton>
                        </form>
                      ) : (
                        <span style={{ ...dimMono, color: "var(--k-faint)" }}>
                          {inv.paid_at
                            ? new Date(inv.paid_at).toLocaleDateString("en-GB")
                            : "paid"}
                        </span>
                      )}
                    </span>
                  </div>
                </Reveal>
              ))}
            </div>
          )}
        </Panel>
      </Reveal>

      {/* ── Usage footprint / cost guardrail ──────────────────── */}
      <Reveal className="block" delay={0.1}>
        <Panel
          label="// COST GUARDRAIL"
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
            <p style={emptyStyle}>No client tenants yet.</p>
          ) : (
            <div>
              {footprint.map((f, idx) => (
                <div
                  key={f.tenant_id}
                  className="flex flex-wrap items-center justify-between gap-3 k-kard-h"
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
                    <span>issues {f.change_requests}</span>
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

function ActionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 min-w-0 max-md:w-full">
      <span
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          fontWeight: 500,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--k-faint)",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/* ── Local style consts (house pattern) ─────────────────────────── */

const RETAINER_GRID = "1.5fr 0.9fr 0.9fr 90px 1.4fr 90px";
const INVOICE_GRID = "1.5fr 1fr 90px 110px 90px 120px";

const headLabel = {
  fontFamily: T.mono,
  fontSize: "10px",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--k-faint)",
} as const;

const dimMono = {
  fontFamily: T.mono,
  fontSize: "0.72rem",
  letterSpacing: "0.04em",
  color: "var(--k-muted)",
} as const;

const emptyStyle = {
  fontFamily: T.sans,
  fontSize: "0.85rem",
  color: "var(--k-muted)",
  padding: "28px 18px",
  textAlign: "center" as const,
};

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
