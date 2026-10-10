import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { createClient, createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { T } from "@nullshift/ui/tokens";
import { SELLABLE_PLANS, carePlan, currentPeriodStart, remainingAllowance } from "@/lib/carePlans";
import { tickInvoicedPlans } from "@/lib/billing/invoicedPlansRun";
import {
  INVOICE_TERMS_DEFAULT_DAYS,
  daysOverdue,
  nextPeriodStart,
  periodLabel,
  suggestedInvoicedFrom,
} from "@/lib/billing/invoicedPlans";
import { runCarePlanInvoicingNow, switchToMonthlyInvoicing } from "./actions";
import { isGoCardlessConfigured } from "@nullshift/billing/gocardless";
import { planChoiceOpen } from "@/lib/planGate";
import { contractedPrices } from "@/lib/pricing/contracted";
import { SCALE_BAND_LABEL } from "@/lib/pricing/nsi";
import { tenantBalance } from "@/lib/billing/balance";
import { Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { loadClientBlock } from "@/lib/hub/load";
import { carePlanState } from "@/lib/hub/rules";
import { sendPlanInvite } from "../../../billing/direct-debits/actions";
import {
  cancelSubscription,
  sendDirectDebitSetup,
  sendSubscriptionSignup,
} from "../actions";
import {
  TilePage,
  btn,
  card,
  dateGB,
  gbp,
  h2,
  inp,
  loadTenantAndProjects,
  monoLink,
  type Invoice,
  type Item,
  type Sub,
} from "../_shared";

type PlanSub = Sub & {
  invoicing?: string | null;
  invoiced_from?: string | null;
  invoice_terms_days?: number | null;
  invoice_note?: string | null;
};

type PlanInvoice = {
  id: string;
  amount: number;
  status: string;
  due_at: string | null;
  paid_at: string | null;
  period_start: string | null;
  hosted_invoice_url: string | null;
  xero_invoice_id: string | null;
  subscription_id: string | null;
};

const mono11: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: 11,
  letterSpacing: "0.04em",
  color: "var(--k-muted)",
};

/**
 * The switch to a monthly invoice, for the client who will not set up a
 * Direct Debit. Folded away so the Direct Debit path stays the obvious one.
 */
function InvoiceSwitch({
  tenantId,
  planId,
  mrr,
}: {
  tenantId: string;
  planId: string | null;
  mrr: number | null;
}) {
  const plans = SELLABLE_PLANS;
  const defaultPlan = planId && plans.some((p) => p.id === planId) ? planId : (plans[0]?.id ?? "");
  return (
    <details style={{ marginTop: 14, borderTop: "1px solid var(--k-border)", paddingTop: 12 }}>
      <summary style={{ ...mono11, cursor: "pointer", color: "var(--k-fg)" }}>
        Invoice monthly instead (client will not use Direct Debit)
      </summary>
      <p style={{ fontFamily: T.sans, fontSize: "0.82rem", color: "var(--k-faint)", margin: "10px 0 12px", maxWidth: "60ch" }}>
        An invoice is raised in Xero on the first day of each period and emailed to the client, with
        a reminder at 3, 10 and 17 days overdue. The plan shows past due after 14 days. Paying it in
        Xero, confirming the bank transfer on the Bank feed, or marking it paid here all settle it.
      </p>
      <form action={switchToMonthlyInvoicing} className="flex flex-col gap-3" style={{ maxWidth: 520 }}>
        <input type="hidden" name="tenant_id" value={tenantId} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label>
            <span style={mono11}>Plan</span>
            <select name="plan" defaultValue={defaultPlan} style={{ ...inp, width: "100%", marginTop: 4 }}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span style={mono11}>Monthly amount (£)</span>
            <input name="mrr" type="number" min="1" step="0.01" defaultValue={mrr ?? ""} required style={{ ...inp, width: "100%", marginTop: 4 }} />
          </label>
          <label>
            <span style={mono11}>First period starts</span>
            <input name="invoiced_from" type="date" defaultValue={suggestedInvoicedFrom()} required style={{ ...inp, width: "100%", marginTop: 4 }} />
          </label>
          <label>
            <span style={mono11}>Payment terms (days)</span>
            <input name="terms_days" type="number" min="0" max="90" defaultValue={INVOICE_TERMS_DEFAULT_DAYS} style={{ ...inp, width: "100%", marginTop: 4 }} />
          </label>
        </div>
        <label>
          <span style={mono11}>Why this route (for the history)</span>
          <input name="note" placeholder="Client declined Direct Debit; invoiced monthly from Xero" style={{ ...inp, width: "100%", marginTop: 4 }} />
        </label>
        <div>
          <SubmitButton style={btn("var(--k-accent)", "var(--k-on-accent)")} pendingLabel="Switching…">
            Switch to monthly invoicing
          </SubmitButton>
        </div>
      </form>
    </details>
  );
}

function InvoicedPlanPanel({
  tenantId,
  sub,
  invoices,
  now,
}: {
  tenantId: string;
  sub: PlanSub;
  invoices: PlanInvoice[];
  now: Date;
}) {
  const from = sub.invoiced_from ?? null;
  const terms = sub.invoice_terms_days ?? INVOICE_TERMS_DEFAULT_DAYS;
  const next = from ? nextPeriodStart(from, now.toISOString().slice(0, 10)) : null;
  const mine = invoices.filter((i) => i.subscription_id === sub.id);
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--k-border)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p style={{ ...mono11, margin: 0, textTransform: "uppercase" }}>
          Invoiced monthly{from ? ` · from ${dateGB(from)}` : ""} · {terms}-day terms
          {next ? ` · next invoice ${dateGB(next)}` : ""}
        </p>
        <form action={runCarePlanInvoicingNow}>
          <input type="hidden" name="tenant_id" value={tenantId} />
          <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)")} pendingLabel="Checking…" title="Raise any period that has started, mirror Xero payments, send any reminder that is due">
            Check now
          </SubmitButton>
        </form>
      </div>
      {sub.invoice_note ? (
        <p style={{ fontFamily: T.sans, fontSize: "0.8rem", color: "var(--k-faint)", margin: "8px 0 0" }}>{sub.invoice_note}</p>
      ) : null}
      {mine.length === 0 ? (
        <p style={{ fontFamily: T.sans, fontSize: "0.82rem", color: "var(--k-faint)", margin: "10px 0 0" }}>
          No invoice raised yet — the first goes out on the first period start.
        </p>
      ) : (
        <table style={{ width: "100%", marginTop: 10, borderCollapse: "collapse", fontFamily: T.sans, fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ ...mono11, textTransform: "uppercase", fontSize: 10 }}>
              <th style={{ textAlign: "left", padding: "6px 0", fontWeight: 500 }}>Period</th>
              <th style={{ textAlign: "right", padding: "6px 0", fontWeight: 500 }}>Amount</th>
              <th style={{ textAlign: "left", padding: "6px 0 6px 16px", fontWeight: 500 }}>Due</th>
              <th style={{ textAlign: "left", padding: "6px 0 6px 16px", fontWeight: 500 }}>Status</th>
              <th style={{ textAlign: "right", padding: "6px 0", fontWeight: 500 }}></th>
            </tr>
          </thead>
          <tbody>
            {mine.map((inv) => {
              const late = inv.status === "open" ? daysOverdue(inv.due_at, now) : 0;
              const tone = inv.status === "paid" ? T.success : late > 0 ? T.danger : T.warning;
              const label = inv.status === "paid" ? `Paid${inv.paid_at ? ` ${dateGB(inv.paid_at)}` : ""}` : late > 0 ? `Overdue ${late}d` : inv.status === "open" ? "Open" : inv.status;
              return (
                <tr key={inv.id} style={{ borderTop: "1px solid var(--k-border)" }}>
                  <td style={{ padding: "8px 0", color: "var(--k-fg)" }}>{inv.period_start ? periodLabel(inv.period_start) : "—"}</td>
                  <td style={{ padding: "8px 0", textAlign: "right", color: "var(--k-fg)" }}>{gbp(Number(inv.amount))}</td>
                  <td style={{ padding: "8px 0 8px 16px", color: "var(--k-muted)" }}>{inv.due_at ? dateGB(inv.due_at) : "—"}</td>
                  <td style={{ padding: "8px 0 8px 16px" }}>
                    <span style={{ ...mono11, color: tone, textTransform: "uppercase" }}>{label}</span>
                    {inv.status === "open" && !inv.xero_invoice_id ? <span style={{ ...mono11, color: T.warning }}> · not in Xero</span> : null}
                  </td>
                  <td style={{ padding: "8px 0", textAlign: "right" }}>
                    {inv.hosted_invoice_url ? (
                      <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer" style={monoLink}>
                        Open ↗
                      </a>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/**
 * Care Plan tile — the client's chosen plan and where its Direct Debit is:
 * the choice + terms acceptance, the three contracted prices for their
 * bracket, sending the plan options, re-sending the authorisation link, the
 * subscription status and cancellation. The header chip is carePlanState()
 * — the same rule that colours the tile on the Dashboard grid.
 */
export const dynamic = "force-dynamic";

type HistoryRow = {
  id: string;
  action: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

/**
 * Every audit action that moves the care plan along — the tile's history.
 * Staff sends (this page, the Direct Debits board), the client's portal
 * choice + terms, and the GoCardless webhook's mandate / payment events.
 */
const CARE_HISTORY_ACTIONS = [
  "care_plan.plan_invite_sent",
  "care_plan.dd_setup_sent",
  "care_plan.dd_started",
  "care_plan.dd_activated",
  "care_plan.dd_cancelled",
  "care_plan.payment_failed",
  "care_plan.payment_recovered",
  "care_plan.terms_accepted",
  "care_plan.chosen",
  "subscription.signup_sent",
  "subscription.recorded_manually",
  "subscription.canceled",
  "build_credit.topup",
  "care_plan.invoicing_enabled",
  "care_plan.invoice_raised",
  "care_plan.invoice_reminder_sent",
  "care_plan.invoice_reminder_escalated",
  "care_plan.invoice_past_due",
  "care_plan.invoice_recovered",
  "invoice.paid_via_xero",
  "invoice.marked_paid",
];
const HISTORY_LABEL: Record<string, string> = {
  "care_plan.invoicing_enabled": "Switched to monthly invoicing",
  "care_plan.invoice_raised": "Monthly invoice raised",
  "care_plan.invoice_reminder_sent": "Invoice reminder sent",
  "care_plan.invoice_reminder_escalated": "Invoice reminders exhausted — over to staff",
  "care_plan.invoice_past_due": "Invoice 14 days overdue — plan past due",
  "care_plan.invoice_recovered": "Overdue invoice settled — plan active again",
  "invoice.paid_via_xero": "Invoice paid (seen in Xero)",
  "invoice.marked_paid": "Invoice marked paid",
  "care_plan.plan_invite_sent": "Plan options sent",
  "care_plan.dd_setup_sent": "Direct Debit link sent",
  "care_plan.dd_started": "Client started Direct Debit set-up",
  "care_plan.dd_activated": "Direct Debit mandate activated",
  "care_plan.dd_cancelled": "Direct Debit cancelled",
  "care_plan.payment_failed": "Direct Debit payment failed",
  "care_plan.payment_recovered": "Direct Debit payment recovered",
  "care_plan.terms_accepted": "Client accepted care-plan terms",
  "care_plan.chosen": "Client chose a plan",
  "subscription.signup_sent": "Card sign-up sent",
  "subscription.recorded_manually": "Standing order recorded",
  "subscription.canceled": "Plan cancelled",
  "build_credit.topup": "Build-item top-up granted",
};

/** Short, mono detail for a history row — only the metadata keys the emitters set. */
function historyDetail(action: string, meta: Record<string, unknown>): string {
  const planKey =
    typeof meta.plan === "string"
      ? meta.plan
      : typeof meta.choice === "string"
        ? meta.choice
        : null;
  const parts: (string | null)[] = [
    action === "care_plan.chosen" && planKey === "none"
      ? "no care plan for now"
      : planKey
        ? (carePlan(planKey)?.label ?? planKey)
        : null,
    typeof meta.amountPence === "number" ? gbp(meta.amountPence / 100) : null,
    typeof meta.email === "string" ? meta.email : null,
    typeof meta.delta === "number" ? `+${meta.delta} items` : null,
    typeof meta.cause === "string" ? meta.cause : null,
    typeof meta.chargeDate === "string" ? `charge ${dateGB(meta.chargeDate)}` : null,
    typeof meta.version === "string" ? `terms ${meta.version}` : null,
    meta.sent === false || meta.emailed === false ? "email not sent" : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "muted"> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  muted: "muted",
};

export default async function ClientCarePlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id: tenantId } = await params;
  const sp = (await searchParams) ?? {};
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const notice = pick(sp.notice);
  const error = pick(sp.error);
  if (!(await requireStaff()).ok) notFound();
  const now = new Date();

  // A monthly-invoiced plan is raised, reconciled and chased as this page
  // opens, within a budget, so it does not depend on the scheduler.
  await Promise.race([
    tickInvoicedPlans(createServiceClient(), { tenantId, now }).catch(() => null),
    new Promise((resolve) => setTimeout(resolve, 8000)),
  ]);

  const [{ tenant, project }, block] = await Promise.all([
    loadTenantAndProjects(tenantId),
    loadClientBlock(tenantId),
  ]);
  const projectId = project?.id ?? null;
  const supabase = await createClient();

  const noRows = Promise.resolve({ data: [] as Record<string, unknown>[] });
  const [
    { data: subs },
    { data: items },
    { data: invs },
    { data: historyRows },
    { data: creditRows },
    { data: planInvRows },
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, plan, mrr, status, provider, invoicing, invoiced_from, invoice_terms_days, invoice_note")
      .eq("tenant_id", tenantId)
      .neq("status", "canceled")
      .order("created_at", { ascending: false }),
    projectId
      ? supabase
          .from("project_items")
          .select("id, name, amount, status")
          .eq("project_id", projectId)
          .order("created_at")
      : noRows,
    projectId
      ? supabase
          .from("invoices")
          .select(
            "id, amount, status, type, hosted_invoice_url, project_item_count, created_at, paid_at, xero_invoice_id"
          )
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
      : noRows,
    // The audit trail is the only record of "options sent" / "link sent" —
    // listed here as the plan's history.
    supabase
      .from("audit_log")
      .select("id, action, created_at, metadata")
      .eq("tenant_id", tenantId)
      .in("action", CARE_HISTORY_ACTIONS)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("build_credit_events")
      .select("delta")
      .eq("tenant_id", tenantId)
      .eq("period", currentPeriodStart()),
    // Invoices raised by a monthly-invoiced plan (none carry a project).
    supabase
      .from("invoices")
      .select("id, amount, status, due_at, paid_at, period_start, hosted_invoice_url, xero_invoice_id, subscription_id")
      .eq("tenant_id", tenantId)
      .not("subscription_id", "is", null)
      .neq("status", "void")
      .order("period_start", { ascending: false })
      .limit(24),
  ]);
  const subList = (subs ?? []) as PlanSub[];
  const planInvoices = (planInvRows ?? []) as PlanInvoice[];
  const history = (historyRows ?? []) as HistoryRow[];
  const creditDelta = ((creditRows ?? []) as { delta: number }[]).reduce(
    (sum, e) => sum + (Number(e.delta) || 0),
    0
  );
  const itemList = (items ?? []) as Item[];
  const invoiceList = (invs ?? []) as Invoice[];

  // A care subscription is only billable MRR once it's actually active; an
  // 'incomplete' row means the sign-up was emailed but not yet completed.
  const activeSub =
    subList.find((s) => ["active", "trialing", "past_due"].includes(s.status)) ?? null;
  const pendingSub = subList.find((s) => s.status === "incomplete") ?? null;
  const mrr = subList
    .filter((s) => s.status === "active")
    .reduce((s, x) => s + Number(x.mrr), 0);

  const isAccepted = project?.proposal_status === "accepted";
  const balance = tenantBalance(
    project ? [{ id: project.id, proposal_status: project.proposal_status }] : [],
    itemList.map((i) => ({ project_id: projectId, amount: i.amount, status: i.status })),
    invoiceList.map((i) => ({
      project_id: projectId,
      amount: i.amount,
      status: i.status,
      type: i.type,
    }))
  );
  // Billing setup is gated on the client having agreed — but a portal
  // signature is only one form of that. A client who agreed offline and has
  // PAID us has plainly agreed, and gating on the signature alone left them
  // permanently unable to start a care plan. Money changing hands is evidence.
  const billingAgreed = isAccepted || balance.paidTotal > 0;
  // The client's contracted prices (scale band applied). Nothing can be sent
  // until the client is scored — that is the owner's "set the bracket first".
  const pricing = await contractedPrices(tenantId);
  const bandLabel = pricing.assessment?.scale_band
    ? SCALE_BAND_LABEL[pricing.assessment.scale_band]
    : null;
  const built = planChoiceOpen(project?.stage);

  const state = carePlanState({
    scored: pricing.scored,
    anyPriced: pricing.anyPriced,
    enterpriseReview:
      !!pricing.assessment?.enterprise_review_required && !pricing.anyPriced,
    stage: project?.stage ?? null,
    choice: tenant.care_plan_choice,
    subscriptionStatus:
      activeSub?.status ?? pendingSub?.status ?? block?.subscription?.status ?? null,
    subscriptionProvider:
      activeSub?.provider ??
      pendingSub?.provider ??
      block?.subscription?.provider ??
      null,
    optionsSentAt: block?.carePlan.optionsSentAt ?? null,
    ddLinkSentAt: block?.carePlan.ddLinkSentAt ?? null,
    planLabel: activeSub ? (carePlan(activeSub.plan)?.label ?? activeSub.plan) : null,
    mrr: activeSub ? Number(activeSub.mrr) : null,
  });

  const htid = <input type="hidden" name="tenant_id" value={tenantId} />;

  return (
    <TilePage
      tenantId={tenantId}
      tenantName={tenant.name}
      index="04"
      label="Care Plan"
      title={tenant.name}
      lead={state.sub}
      actions={
        <>
          <StatusChip tone={STATUS_TONE[state.tone]}>{state.label}</StatusChip>
          <Link href="/admin/billing/direct-debits" style={monoLink}>
            Direct Debits board →
          </Link>
        </>
      }
    >
      {notice || error ? (
        <p
          role="status"
          style={{
            fontFamily: T.mono,
            fontSize: 12,
            color: error ? T.danger : "var(--k-accent)",
            border: `1px solid color-mix(in oklab, ${error ? T.danger : "var(--k-accent)"} 35%, transparent)`,
            padding: "10px 14px",
            marginBottom: 16,
          }}
        >
          {error ?? notice}
        </p>
      ) : null}
      {/* Contracted prices — the three options the client sees, at their bracket. */}
      <Reveal>
        <section style={card}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 style={{ ...h2, marginBottom: 0 }}>Contracted prices</h2>
            <Link href={`/admin/clients/${tenantId}/pricing`} style={monoLink}>
              {pricing.scored ? "Re-score" : "Score client"} →
            </Link>
          </div>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.8rem",
              color: "var(--k-faint)",
              margin: "6px 0 12px",
            }}
          >
            {pricing.scored
              ? `Band: ${bandLabel ?? "Enterprise review"}${
                  pricing.assessment?.multiplier
                    ? ` ×${Number(pricing.assessment.multiplier)}`
                    : ""
                } · these are the prices the client sees and is charged.`
              : "Not scored yet — the client sees no plan options until you set their band."}
          </p>
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}
          >
            {pricing.sellable.map((s) => {
              const p = carePlan(s.planId);
              const chosen = tenant.care_plan_choice === s.planId;
              return (
                <div
                  key={s.planId}
                  style={{
                    background: "var(--k-bg)",
                    border: `1px solid ${chosen ? "var(--k-accent)" : "var(--k-border)"}`,
                    padding: "10px 12px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: T.mono,
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: chosen ? "var(--k-accent)" : "var(--k-muted)",
                    }}
                  >
                    {p?.label ?? s.planId}
                    {chosen ? " · chosen" : ""}
                  </div>
                  <div
                    style={{
                      fontFamily: T.display,
                      fontWeight: 700,
                      fontSize: "1.2rem",
                      color: s.priced ? "var(--k-fg)" : "var(--k-faint)",
                      marginTop: 4,
                    }}
                  >
                    {s.priced && s.mrr !== null ? `${gbp(s.mrr)}/mo` : "—"}
                  </div>
                  {s.note && (
                    <div
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.78rem",
                        color: "var(--k-faint)",
                        marginTop: 4,
                      }}
                    >
                      {s.note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Send the three priced options — the same action as the board. */}
          <form
            action={sendPlanInvite}
            className="flex items-center gap-2 flex-wrap"
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px solid var(--k-border)",
            }}
          >
            {htid}
            <input type="hidden" name="email" value={tenant.contact_email ?? ""} />
            <SubmitButton
              style={{
                ...btn(
                  pricing.anyPriced && built ? "var(--k-accent)" : "var(--k-surface)",
                  pricing.anyPriced && built ? "var(--k-on-accent)" : "var(--k-faint)"
                ),
                cursor: pricing.anyPriced && built ? "pointer" : "not-allowed",
              }}
              disabled={!pricing.anyPriced || !tenant.contact_email || !built}
              title={
                !built
                  ? "The client chooses after the build — opens once a project is live"
                  : pricing.anyPriced
                    ? "Email their three priced options with a link into the portal"
                    : "Score the client first"
              }
            >
              {built ? "Send plan options" : "Options open at go-live"}
            </SubmitButton>
            {/* See it before you send it. This opens the client's real plan
                chooser through the read-only "view as client" preview — the
                actual page at their actual prices, not a mock that can drift
                away from what they are emailed. A plain link, deliberately:
                it sits inside this form, and a <button> here would submit it
                and send the email instead. */}
            <a
              href={`/admin/clients/${tenantId}/preview?to=/portal/plan`}
              title="Open the client's plan chooser exactly as they will see it — read-only"
              style={{
                ...btn("var(--k-surface)", "var(--k-fg)"),
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Preview what they see →
            </a>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: "var(--k-faint)" }}>
              {block?.carePlan.optionsSentAt
                ? `Options last sent ${dateGB(block.carePlan.optionsSentAt)}`
                : "Options not sent yet"}
              {!tenant.contact_email ? " · no contact email on record" : ""}
            </span>
          </form>
        </section>
      </Reveal>

      {/* Care plan — recurring subscription via a Stripe Checkout sign-up the
          client completes (mirrors the build invoice: send → awaiting → active). */}
      <Reveal>
        <section style={card}>
          <div className="flex items-center justify-between">
            <h2 style={{ ...h2, marginBottom: 0 }}>Care plan</h2>
            {mrr > 0 && (
              <span
                style={{ fontFamily: T.mono, fontSize: 12, color: "var(--k-accent)" }}
              >
                {gbp(mrr)}/mo MRR
              </span>
            )}
          </div>

          {activeSub ? (
            <>
            <div
              className="flex items-center justify-between flex-wrap gap-2"
              style={{ marginTop: 14 }}
            >
              <span
                style={{ fontFamily: T.sans, fontSize: "0.9rem", color: "var(--k-fg)" }}
              >
                {carePlan(activeSub.plan)?.label ?? activeSub.plan}{" "}
                <span
                  style={{ color: "var(--k-muted)", fontFamily: T.mono, fontSize: 11 }}
                >
                  {gbp(Number(activeSub.mrr))}/mo
                </span>
              </span>
              <div className="flex items-center gap-3">
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: 11,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: activeSub.status === "active" ? T.success : T.warning,
                    background: `color-mix(in oklab, ${activeSub.status === "active" ? T.success : T.warning} 12%, transparent)`,
                    border: `1px solid color-mix(in oklab, ${activeSub.status === "active" ? T.success : T.warning} 40%, transparent)`,
                    borderRadius: 0,
                    padding: "6px 12px",
                  }}
                >
                  {activeSub.status === "active"
                    ? "Active ✓"
                    : activeSub.status.replace("_", " ")}
                </span>
                <form action={cancelSubscription}>
                  {htid}
                  <input type="hidden" name="id" value={activeSub.id} />
                  <SubmitButton style={btn("transparent", T.danger)}>Cancel</SubmitButton>
                </form>
              </div>
            </div>
            {activeSub.invoicing === "monthly" ? (
              <InvoicedPlanPanel tenantId={tenantId} sub={activeSub} invoices={planInvoices} now={now} />
            ) : null}
            </>
          ) : pendingSub ? (
            <div style={{ marginTop: 14 }}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span
                  style={{ fontFamily: T.sans, fontSize: "0.9rem", color: "var(--k-fg)" }}
                >
                  {carePlan(pendingSub.plan)?.label ?? pendingSub.plan}{" "}
                  <span
                    style={{ color: "var(--k-muted)", fontFamily: T.mono, fontSize: 11 }}
                  >
                    {gbp(Number(pendingSub.mrr))}/mo
                  </span>
                </span>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: 11,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: T.warning,
                    background: "color-mix(in oklab, " + T.warning + " 12%, transparent)",
                    border:
                      "1px solid color-mix(in oklab, " + T.warning + " 40%, transparent)",
                    borderRadius: 0,
                    padding: "6px 12px",
                  }}
                >
                  {pendingSub.provider === "gocardless"
                    ? "Direct Debit — awaiting authorisation"
                    : "Sign-up sent — awaiting completion"}
                </span>
              </div>
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.8rem",
                  color: "var(--k-faint)",
                  margin: "8px 0 12px",
                }}
              >
                {pendingSub.provider === "gocardless"
                  ? "The client has a GoCardless Direct Debit authorisation link. This flips to Active automatically once the mandate is confirmed."
                  : "The client's been emailed a secure card sign-up. This flips to Active automatically once they complete it."}
              </p>
              <form
                action={
                  pendingSub.provider === "gocardless"
                    ? sendDirectDebitSetup
                    : sendSubscriptionSignup
                }
              >
                {htid}
                <input type="hidden" name="plan" value={pendingSub.plan} />
                <SubmitButton
                  style={btn("var(--k-surface)", "var(--k-fg)")}
                  title={
                    pendingSub.provider === "gocardless"
                      ? "Emails a FRESH authorisation link — the previous link is cancelled at GoCardless and stops working"
                      : undefined
                  }
                >
                  {pendingSub.provider === "gocardless"
                    ? "Send new Direct Debit link"
                    : "Resend sign-up"}
                </SubmitButton>
              </form>
              <InvoiceSwitch tenantId={tenantId} planId={pendingSub.plan} mrr={Number(pendingSub.mrr) || null} />
            </div>
          ) : (
            <div style={{ marginTop: 14 }}>
              {tenant.care_plan_choice && (
                <p
                  style={{
                    fontFamily: T.mono,
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color:
                      tenant.care_plan_choice === "none" ? T.warning : "var(--k-accent)",
                    marginBottom: 8,
                  }}
                >
                  Client chose:{" "}
                  {tenant.care_plan_choice === "none"
                    ? "No care plan (for now)"
                    : (carePlan(tenant.care_plan_choice)?.label ??
                      tenant.care_plan_choice)}
                </p>
              )}
              {(() => {
                const chosen =
                  tenant.care_plan_choice && tenant.care_plan_choice !== "none"
                    ? carePlan(tenant.care_plan_choice)
                    : null;
                const chosenPrice = chosen ? pricing.prices[chosen.id] : null;
                const enterprise = pricing.prices.build_10;
                return (
                  <>
                    <p
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.82rem",
                        color: "var(--k-faint)",
                        marginBottom: 10,
                      }}
                    >
                      {chosen
                        ? `${chosen.label}${chosenPrice?.priced ? ` · ${gbp(chosenPrice.mrr!)}/mo` : ""} — chosen by the client${
                            tenant.care_plan_terms_accepted_at
                              ? `, terms agreed ${new Date(tenant.care_plan_terms_accepted_at).toLocaleDateString("en-GB")}`
                              : ""
                          }. Not set up yet — re-send the Direct Debit link if theirs went astray.`
                        : built
                          ? "The client picks their plan and agrees the terms in the portal — send them their options above."
                          : `The client chooses their plan once the system is live (stage: ${project?.stage ?? "—"}). Nothing to send yet.`}
                    </p>
                    {/* Only the client's own choice can be (re)started by staff;
                        Enterprise, agreed under its Order Form, is the exception. */}
                    <form
                      action={
                        isGoCardlessConfigured()
                          ? sendDirectDebitSetup
                          : sendSubscriptionSignup
                      }
                      className="flex items-center gap-2 flex-wrap"
                    >
                      {htid}
                      <input type="hidden" name="plan" value={chosen?.id ?? ""} />
                      {isGoCardlessConfigured() && (
                        <SubmitButton
                          formAction={sendDirectDebitSetup}
                          disabled={!billingAgreed || !chosen || !chosenPrice?.priced}
                          style={{
                            ...btn(
                              billingAgreed && chosen
                                ? "var(--k-accent)"
                                : "var(--k-surface)",
                              billingAgreed && chosen
                                ? "var(--k-on-accent)"
                                : "var(--k-faint)"
                            ),
                            cursor: billingAgreed && chosen ? "pointer" : "not-allowed",
                            opacity: billingAgreed && chosen ? 1 : 0.7,
                          }}
                          title={
                            chosen
                              ? "Email the client a fresh GoCardless authorisation link for the plan they chose"
                              : "The client hasn't chosen a plan yet"
                          }
                        >
                          Re-send Direct Debit link
                        </SubmitButton>
                      )}
                      <SubmitButton
                        formAction={sendSubscriptionSignup}
                        disabled={!billingAgreed || !chosen || !chosenPrice?.priced}
                        style={{
                          ...btn(
                            "var(--k-surface)",
                            chosen ? "var(--k-fg)" : "var(--k-faint)"
                          ),
                          cursor: billingAgreed && chosen ? "pointer" : "not-allowed",
                          opacity: billingAgreed && chosen ? 1 : 0.7,
                        }}
                        title={
                          chosen
                            ? "Card sign-up (Stripe) for the plan the client chose"
                            : "The client hasn't chosen a plan yet"
                        }
                      >
                        {isGoCardlessConfigured()
                          ? "Or send card sign-up (Stripe)"
                          : "Send care-plan sign-up"}
                      </SubmitButton>
                    </form>
                    {enterprise?.priced && isGoCardlessConfigured() && (
                      <form
                        action={sendDirectDebitSetup}
                        className="flex items-center gap-2 flex-wrap"
                        style={{ marginTop: 8 }}
                      >
                        {htid}
                        <input type="hidden" name="plan" value="build_10" />
                        <SubmitButton
                          disabled={!billingAgreed}
                          style={btn("var(--k-surface)", "var(--k-fg)")}
                          title="Enterprise is quoted and contracted by staff under its Order Form"
                        >
                          Send Enterprise Direct Debit ({gbp(enterprise.mrr!)}/mo, agreed)
                        </SubmitButton>
                      </form>
                    )}
                    {billingAgreed ? (
                      <InvoiceSwitch
                        tenantId={tenantId}
                        planId={chosen?.id ?? null}
                        mrr={chosenPrice?.priced ? (chosenPrice.mrr ?? null) : null}
                      />
                    ) : null}
                  </>
                );
              })()}
              {!billingAgreed && (
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.78rem",
                    color: "var(--k-faint)",
                    marginTop: 8,
                  }}
                >
                  Available once the client has signed the proposal, or paid anything
                  against it.
                </p>
              )}
              {/* GoCardless unconfigured is not the same as "no Direct Debit
                  offered" — say which, so a missing env var doesn't read as a
                  product decision. */}
              {!isGoCardlessConfigured() && (
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.78rem",
                    color: T.warning,
                    marginTop: 8,
                  }}
                >
                  Direct Debit is unavailable — GOCARDLESS_ACCESS_TOKEN isn&apos;t set on
                  this deployment, so only the Stripe card rail can be offered.
                </p>
              )}
              <p
                style={{
                  fontFamily: T.mono,
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  color: pricing.scored ? "var(--k-muted)" : T.warning,
                  marginTop: 10,
                }}
              >
                {pricing.scored
                  ? `Band: ${bandLabel ?? "Enterprise review"}${
                      pricing.assessment?.multiplier
                        ? ` ×${Number(pricing.assessment.multiplier)}`
                        : ""
                    } · prices above are what the client sees and is charged.`
                  : "Not scored yet — the client sees no plan options until you set their band."}{" "}
                <Link
                  href={`/admin/clients/${tenantId}/pricing`}
                  style={{ color: "var(--k-accent)", textDecoration: "underline" }}
                >
                  {pricing.scored ? "Re-score" : "Score client"}
                </Link>
                {" · "}
                <Link
                  href="/admin/billing/direct-debits"
                  style={{ color: "var(--k-accent)", textDecoration: "underline" }}
                >
                  Direct Debits board
                </Link>
              </p>
            </div>
          )}

          {/* Build-item allowance this month (folded in from the passport's
              // PLAN panel) — only plans that carry an allowance show a meter. */}
          {activeSub &&
            (() => {
              const plan = carePlan(activeSub.plan);
              if (!plan || plan.buildAllowance <= 0) return null;
              const left = remainingAllowance(plan, creditDelta);
              return (
                <div
                  className="flex items-center gap-3 flex-wrap"
                  style={{
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: "1px solid var(--k-border)",
                    fontFamily: T.mono,
                    fontSize: 11,
                    color: "var(--k-muted)",
                  }}
                >
                  <span
                    style={{
                      width: 120,
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
                        width: `${Math.min(100, Math.round((left / plan.buildAllowance) * 100))}%`,
                        background: left > 0 ? "var(--k-accent)" : T.warning,
                      }}
                    />
                  </span>
                  <span>
                    {left} of {plan.buildAllowance} build items left this month
                  </span>
                </div>
              );
            })()}

          {/* Terms — what the client agreed to, and when. */}
          <p
            style={{
              fontFamily: T.mono,
              fontSize: 11,
              color: tenant.care_plan_terms_accepted_at ? T.success : "var(--k-faint)",
              marginTop: 14,
              paddingTop: 12,
              borderTop: "1px solid var(--k-border)",
            }}
          >
            {tenant.care_plan_terms_accepted_at
              ? `✓ Care-plan terms accepted ${dateGB(tenant.care_plan_terms_accepted_at)}`
              : "Care-plan terms not yet accepted by the client."}{" "}
            <Link href={`/admin/clients/${tenantId}/docs`} style={monoLink}>
              Read receipts →
            </Link>
          </p>
        </section>
      </Reveal>

      {/* History — every send / choice / activation / payment / cancellation
          for this tenant, newest first, from the audit trail (the only record
          of "options sent"). Read-only. */}
      <Reveal>
        <Panel
          label="// HISTORY"
          title="History"
          style={{ marginBottom: 16 }}
          actions={
            <span style={{ fontFamily: T.mono, fontSize: 10, color: "var(--k-faint)" }}>
              audit trail · latest {history.length}
              {history.length === 20 ? "+" : ""}
            </span>
          }
        >
          {history.length === 0 ? (
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.85rem",
                color: "var(--k-faint)",
                margin: 0,
              }}
            >
              Nothing yet — the first plan-options email will appear here.
            </p>
          ) : (
            <div className="flex flex-col">
              {history.map((h, i) => {
                const detail = historyDetail(h.action, h.metadata ?? {});
                return (
                  <div
                    key={h.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
                    style={{
                      padding: "7px 0",
                      borderTop: i ? "1px solid var(--k-border)" : "none",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.86rem",
                        color: "var(--k-fg)",
                      }}
                    >
                      {HISTORY_LABEL[h.action] ?? h.action.replace(/[._]/g, " ")}
                      {detail && (
                        <span
                          style={{
                            fontFamily: T.mono,
                            fontSize: 11,
                            color: "var(--k-faint)",
                            marginLeft: 8,
                          }}
                        >
                          {detail}
                        </span>
                      )}
                    </span>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 11,
                        color: "var(--k-muted)",
                      }}
                      title={new Date(h.created_at).toLocaleString("en-GB")}
                    >
                      {dateGB(h.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </Reveal>
    </TilePage>
  );
}
