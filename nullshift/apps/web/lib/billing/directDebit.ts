import { C, FONT, button, esc, wrap } from "@/lib/emailLayout";

/**
 * Direct Debit guard rails — pure rules (no I/O).
 *
 * The one invariant on the GoCardless rail: money leaves a client's account
 * under their mandate ONLY as the plan we hold for them — our subscription, at
 * the contracted amount. Anything else is "off plan":
 *
 *   • a one-off payment created in the GoCardless dashboard or by another
 *     integration (no subscription link, or a subscription we do not hold);
 *   • the plan subscription collecting a different amount (amended outside
 *     the system, or our price changed without amending GoCardless);
 *   • a payment under a different mandate for the same client.
 *
 * An off-plan payment is never booked as the plan (no "Max care plan —
 * October" invoice, nothing in Xero). It opens an urgent finance exception
 * and staff hear about it at once — while it can still be cancelled when
 * GoCardless tells us early enough (`payments.created` arrives days before
 * the bank submission).
 *
 * `directDebitFindings` is the same check run the other way round: from what
 * GoCardless says is live (subscription amount, mandate state, the payments
 * actually taken) against what we hold, so an amendment that never produced
 * a webhook still surfaces on the next page open or sweep.
 */

export type PlanSubscription = {
  id: string;
  tenantId: string;
  plan: string | null;
  /** Contracted monthly amount in pounds — the only amount allowed to collect. */
  mrr: number;
  status: string;
  gcSubscriptionId: string | null;
  gcMandateId: string | null;
};

/** A GoCardless payment as the rules see it (webhook read or mandate listing). */
export type Collection = {
  id: string;
  status: string;
  amountPence: number;
  chargeDate: string | null;
  createdAt?: string | null;
  description?: string | null;
  subscriptionId: string | null;
  mandateId: string | null;
};

export type LiveSubscription = {
  id: string;
  status: string;
  amountPence: number;
  upcomingPayments: { chargeDate: string; amountPence: number }[];
};

export type LiveMandate = {
  id: string;
  status: string;
  nextPossibleChargeDate: string | null;
};

export type LiveDirectDebit = {
  subscription: LiveSubscription | null;
  mandate: LiveMandate | null;
  payments: Collection[];
};

/** Pounds → pence, the only comparison currency. 0 when the MRR is unknown. */
export function expectedPence(mrr: number | string | null | undefined): number {
  const n = Number(mrr);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

export function gbpPence(pence: number): string {
  const pounds = pence / 100;
  return (
    "£" +
    pounds.toLocaleString("en-GB", {
      minimumFractionDigits: Number.isInteger(pounds) ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}

export type OffPlanReason = "amount" | "subscription" | "mandate";

export type Verdict =
  | { kind: "plan"; expectedPence: number }
  | { kind: "off_plan"; reason: OffPlanReason; expectedPence: number };

export const OFF_PLAN_REASON_TEXT: Record<OffPlanReason, string> = {
  amount: "the amount is not the contracted plan amount",
  subscription: "it did not come from the plan's GoCardless subscription",
  mandate: "it was taken under a different mandate",
};

/**
 * Is this payment the plan? Mandate first (a payment under another mandate is
 * never ours), then the subscription link (a one-off has none; another
 * subscription is not ours), then the amount. When we do not hold a
 * subscription id (a legacy row) only the amount can be checked.
 */
export function classifyCollection(p: Collection, sub: PlanSubscription): Verdict {
  const expected = expectedPence(sub.mrr);
  if (sub.gcMandateId && p.mandateId && p.mandateId !== sub.gcMandateId)
    return { kind: "off_plan", reason: "mandate", expectedPence: expected };
  if (sub.gcSubscriptionId && p.subscriptionId !== sub.gcSubscriptionId)
    return { kind: "off_plan", reason: "subscription", expectedPence: expected };
  if (p.amountPence !== expected)
    return { kind: "off_plan", reason: "amount", expectedPence: expected };
  return { kind: "plan", expectedPence: expected };
}

/* ── GoCardless payment statuses ─────────────────────────────────────────── */

/** Not yet sent to the bank: can still be cancelled. */
export const CANCELLABLE_STATUSES = ["pending_customer_approval", "pending_submission"] as const;
/** Sent to the bank, not yet collected: too late to cancel, too early to refund. */
export const IN_FLIGHT_STATUSES = ["submitted"] as const;
/** Money has left the client's account. */
export const COLLECTED_STATUSES = ["confirmed", "paid_out"] as const;
/** Never collected (or reversed): nothing to do. */
export const DEAD_STATUSES = ["cancelled", "customer_approval_denied", "failed", "charged_back"] as const;

export const isCancellable = (status: string) =>
  (CANCELLABLE_STATUSES as readonly string[]).includes(status);
export const isInFlight = (status: string) => (IN_FLIGHT_STATUSES as readonly string[]).includes(status);
export const isCollected = (status: string) => (COLLECTED_STATUSES as readonly string[]).includes(status);
export const isDead = (status: string) => (DEAD_STATUSES as readonly string[]).includes(status);

/* ── Findings ────────────────────────────────────────────────────────────── */

export type FindingCode =
  | "amount_drift"
  | "subscription_inactive"
  | "mandate_inactive"
  | "off_plan_pending"
  | "off_plan_in_flight"
  | "off_plan_collected";

export type Finding = {
  code: FindingCode;
  severity: "urgent" | "normal";
  title: string;
  detail: string;
  /** For the off-plan codes: the payment concerned. */
  paymentId?: string;
  amountPence?: number;
  expectedPence?: number;
  reason?: OffPlanReason;
  chargeDate?: string | null;
  /** Off-plan and not yet submitted: "Cancel this collection" applies. */
  cancellable?: boolean;
};

export const DEFAULT_LOOKBACK_DAYS = 120;

/** Statuses in which a GoCardless subscription will keep collecting. */
const LIVE_SUBSCRIPTION_STATUSES = ["active", "pending_customer_approval", "customer_approval_denied"];
/** Statuses in which a mandate can still be charged. */
const LIVE_MANDATE_STATUSES = ["pending_customer_approval", "pending_submission", "submitted", "active"];

const dateGB = (iso: string | null | undefined): string => {
  if (!iso) return "an unknown date";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

function withinLookback(p: Collection, now: Date, lookbackDays: number): boolean {
  const ref = p.chargeDate ?? p.createdAt ?? null;
  if (!ref) return true;
  const t = new Date(ref).getTime();
  if (!Number.isFinite(t)) return true;
  // Scheduled (future) payments always count; past ones only within the window.
  return t >= now.getTime() - lookbackDays * 86_400_000;
}

/**
 * Everything wrong with a client's Direct Debit, urgent first. Empty means
 * "GoCardless agrees with us": the subscription collects the contracted
 * amount, the mandate is live, and every recent payment is the plan.
 */
export function directDebitFindings(input: {
  sub: PlanSubscription;
  live: LiveDirectDebit;
  now: Date;
  lookbackDays?: number;
}): Finding[] {
  const { sub, live, now } = input;
  const lookback = input.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const expected = expectedPence(sub.mrr);
  const out: Finding[] = [];

  if (live.subscription && live.subscription.amountPence !== expected) {
    const next = live.subscription.upcomingPayments[0] ?? null;
    out.push({
      code: "amount_drift",
      severity: "urgent",
      title: `Direct Debit is set to collect ${gbpPence(live.subscription.amountPence)} — the plan is ${gbpPence(expected)}`,
      detail: `GoCardless subscription ${live.subscription.id} ${
        next ? `will take ${gbpPence(next.amountPence)} on ${dateGB(next.chargeDate)}` : "is not scheduled to take anything"
      }; the contracted plan is ${gbpPence(expected)} a month. The amount was changed outside this system. Correct it in GoCardless (or cancel the subscription and send a fresh Direct Debit link) before the next charge.`,
      amountPence: live.subscription.amountPence,
      expectedPence: expected,
    });
  }

  if (
    live.subscription &&
    !LIVE_SUBSCRIPTION_STATUSES.includes(live.subscription.status) &&
    ["active", "trialing", "past_due"].includes(sub.status)
  ) {
    out.push({
      code: "subscription_inactive",
      severity: "normal",
      title: `GoCardless subscription is ${live.subscription.status.replace(/_/g, " ")}`,
      detail: `We hold the plan as ${sub.status}, but GoCardless reports the subscription ${live.subscription.id} as ${live.subscription.status}. Nothing will be collected until it is replaced — send a fresh Direct Debit link or switch the client to monthly invoicing.`,
    });
  }

  if (live.mandate && !LIVE_MANDATE_STATUSES.includes(live.mandate.status)) {
    out.push({
      code: "mandate_inactive",
      severity: "normal",
      title: `Mandate is ${live.mandate.status.replace(/_/g, " ")}`,
      detail: `GoCardless reports mandate ${live.mandate.id} as ${live.mandate.status}: no further collection is possible under it. The client needs a fresh Direct Debit link (or monthly invoicing).`,
    });
  }

  for (const p of live.payments) {
    if (isDead(p.status)) continue;
    if (!withinLookback(p, now, lookback)) continue;
    const verdict = classifyCollection(p, sub);
    if (verdict.kind === "plan") continue;
    const why = OFF_PLAN_REASON_TEXT[verdict.reason];
    const base = {
      severity: "urgent" as const,
      paymentId: p.id,
      amountPence: p.amountPence,
      expectedPence: verdict.expectedPence,
      reason: verdict.reason,
      chargeDate: p.chargeDate,
    };
    if (isCancellable(p.status)) {
      out.push({
        ...base,
        code: "off_plan_pending",
        cancellable: true,
        title: `Off-plan collection of ${gbpPence(p.amountPence)} scheduled for ${dateGB(p.chargeDate)}`,
        detail: `Payment ${p.id} is not the plan: ${why} (plan ${gbpPence(verdict.expectedPence)}). It has not reached the bank yet — cancel it now and it never leaves the client's account.${p.description ? ` GoCardless describes it as "${p.description}".` : ""}`,
      });
    } else if (isInFlight(p.status)) {
      out.push({
        ...base,
        code: "off_plan_in_flight",
        cancellable: false,
        title: `Off-plan collection of ${gbpPence(p.amountPence)} submitted to the bank`,
        detail: `Payment ${p.id} is not the plan: ${why} (plan ${gbpPence(verdict.expectedPence)}). It is already with the bank, so it cannot be cancelled; refund it from GoCardless once it clears.${p.description ? ` GoCardless describes it as "${p.description}".` : ""}`,
      });
    } else if (isCollected(p.status)) {
      out.push({
        ...base,
        code: "off_plan_collected",
        cancellable: false,
        title: `${gbpPence(p.amountPence)} was collected on ${dateGB(p.chargeDate)} — not the plan`,
        detail: `Payment ${p.id} is not the plan: ${why} (plan ${gbpPence(verdict.expectedPence)}). It was NOT booked as the care plan. Refund it (or the difference) from GoCardless, or invoice what it was for, then mark this handled.${p.description ? ` GoCardless describes it as "${p.description}".` : ""}`,
      });
    }
  }

  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "urgent" ? -1 : 1));
}

/* ── Staff alert ─────────────────────────────────────────────────────────── */

/**
 * The email staff get the moment an off-plan collection or an amount drift is
 * found. One email per newly opened exception; the exception itself is the
 * record.
 */
export function directDebitAlertEmail(opts: {
  tenantName: string;
  findings: Finding[];
  carePlanUrl: string;
  dashboardUrl: string | null;
}): { subject: string; html: string; text: string } {
  const { tenantName, findings, carePlanUrl, dashboardUrl } = opts;
  const lead = findings[0];
  const subject = lead
    ? `Direct Debit alert — ${tenantName}: ${lead.title}`
    : `Direct Debit alert — ${tenantName}`;
  const items = findings
    .map(
      (f) => `<tr><td style="padding:12px 14px;border-top:1px solid ${C.border}">
        <p style="margin:0;font-family:${FONT};font-size:14px;font-weight:600;color:${C.fg}">${esc(f.title)}</p>
        <p style="margin:6px 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${C.muted}">${esc(f.detail)}</p>
        ${f.cancellable ? `<p style="margin:6px 0 0;font-family:${FONT};font-size:13px;font-weight:600;color:${C.primary}">Can still be cancelled from the care-plan page.</p>` : ""}
      </td></tr>`
    )
    .join("");
  const inner = `
    <tr><td style="padding:22px 32px 0">
      <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#B42318">Direct Debit alert</p>
      <h1 style="margin:0;font-family:${FONT};font-weight:700;font-size:24px;line-height:1.2;letter-spacing:-0.02em;color:${C.fg}">${esc(tenantName)}</h1>
      <p style="margin:12px 0 0;font-family:${FONT};font-size:14px;line-height:1.65;color:${C.muted}">GoCardless disagrees with the plan we hold for this client. Nothing below has been booked as the care plan, and no Xero invoice was raised for it.</p>
    </td></tr>
    <tr><td style="padding:16px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.surface2}" style="background-color:${C.surface2};border:1px solid ${C.border}">${items}</table>
    </td></tr>
    <tr><td style="padding:22px 32px 6px">${button(carePlanUrl, "Open the care-plan page →")}</td></tr>
    ${dashboardUrl ? `<tr><td style="padding:0 32px 8px"><p style="margin:8px 0 0;font-family:${FONT};font-size:12px;color:${C.faint}">GoCardless: <a href="${esc(dashboardUrl)}" style="color:${C.primary}">${esc(dashboardUrl)}</a></p></td></tr>` : ""}`;
  const html = wrap(inner, subject, "Nullshift admin — Direct Debit guard rail. Sent once per new exception.");
  const text = `Direct Debit alert — ${tenantName}

${findings.map((f) => `• ${f.title}\n  ${f.detail}${f.cancellable ? "\n  Can still be cancelled from the care-plan page." : ""}`).join("\n\n")}

Care-plan page: ${carePlanUrl}${dashboardUrl ? `\nGoCardless: ${dashboardUrl}` : ""}`;
  return { subject, html, text };
}
