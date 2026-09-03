import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { T } from "@nullshift/ui/tokens";
import { carePlan, currentPeriodStart, remainingAllowance } from "@/lib/carePlans";
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
  loadTenantAndProjects,
  monoLink,
  type Invoice,
  type Item,
  type Sub,
} from "../_shared";

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
];
const HISTORY_LABEL: Record<string, string> = {
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tenantId } = await params;
  if (!(await requireStaff()).ok) notFound();
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
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, plan, mrr, status, provider")
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
  ]);
  const subList = (subs ?? []) as Sub[];
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
