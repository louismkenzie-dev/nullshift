/**
 * Retainer plans — the four ongoing subscription tiers. Single source of truth
 * for pricing, entitlements and monthly build-item allowances. Shared by the
 * admin billing cockpit, the client hub (proposing a plan), the client portal
 * (showing + accepting it) and the Stripe subscription flow.
 *
 * Plan ids are stored in subscriptions.plan (text, checked by
 * subscriptions_plan_check in migration 0014).
 */
export type CarePlan = {
  id: string;
  label: string;
  mrr: number;
  /** Build items included per month (0 = none). */
  buildAllowance: number;
  /** One-line summary of the plan. */
  blurb: string;
  /** Exactly what the plan covers — listed in the proposal document. */
  features: string[];
};

export type RetainerPlan = CarePlan;

export const CARE_PLANS: CarePlan[] = [
  {
    id: "hosting",
    label: "Hosting",
    mrr: 40,
    buildAllowance: 0,
    blurb: "Keeps your system online, secure and backed up.",
    features: [
      "Managed hosting and SSL",
      "Dedicated production database (paid Supabase plan included)",
      "Daily backups and platform updates",
      "Security patches & dependency updates",
      "Bug fixes for anything we built",
    ],
  },
  {
    id: "hosting_api",
    label: "Hosting + API",
    mrr: 80,
    buildAllowance: 0,
    blurb: "Everything in Hosting, with your system's API usage included.",
    features: [
      "Everything in Hosting",
      "Transactional email sending (Resend) included",
      "AI usage (OpenAI) included",
      "Third-party API monitoring & key management",
      "Monthly usage report",
    ],
  },
  {
    id: "build_3",
    label: "Build 3",
    mrr: 120,
    buildAllowance: 3,
    blurb: "Hosting + API, plus 3 build items delivered every month.",
    features: [
      "Everything in Hosting + API",
      "3 build items included each month",
      "Priority turnaround on requests",
      "Improvements proposed from your system's real usage",
    ],
  },
  {
    id: "build_10",
    label: "Build 10",
    mrr: 180,
    buildAllowance: 10,
    blurb: "Our top tier — 10 build items a month keeps your system evolving.",
    features: [
      "Everything in Hosting + API",
      "10 build items included each month",
      "Priority turnaround on requests",
      "Direct line for urgent issues",
      "Quarterly roadmap review",
    ],
  },
];

export const RETAINER_PLANS = CARE_PLANS;

export const CARE_PLAN_MRR: Record<string, number> = Object.fromEntries(
  CARE_PLANS.map((p) => [p.id, p.mrr])
);

export function carePlan(id: string | null | undefined): CarePlan | null {
  return CARE_PLANS.find((p) => p.id === id) ?? null;
}

export const retainerPlan = carePlan;

/** First day of the month a date falls in, as YYYY-MM-01 (build-credit period key). */
export function currentPeriodStart(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Remaining build items for a tenant this period:
 * plan allowance + sum of build_credit_events.delta for the period
 * (consumptions are negative deltas, top-ups/rollovers positive).
 */
export function remainingAllowance(
  plan: CarePlan | null,
  periodDeltaSum: number
): number {
  return Math.max(0, (plan?.buildAllowance ?? 0) + periodDeltaSum);
}
