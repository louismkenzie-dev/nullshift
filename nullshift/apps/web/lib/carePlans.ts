/**
 * Retainer plans — the four ongoing subscription tiers. Single source of truth
 * for pricing, entitlements and monthly build-item allowances. Shared by the
 * admin billing cockpit, the client hub (proposing a plan), the client portal
 * (showing + accepting it) and the Stripe subscription flow.
 *
 * Plan ids are stored in subscriptions.plan (text, checked by
 * subscriptions_plan_check in migration 0014) — they are DB values, so they
 * keep their original names even though the tiers are now sold as Core / Pro /
 * Max / Enterprise.
 *
 * `mrr` here is the STANDARD CONTRACTED amount we charge and bill on. The
 * public ladder in packages/content/src/pricing.ts advertises the "from"
 * floor for each tier, which is at or below these figures; Enterprise is
 * quoted per client, and `mrr` is its default starting point.
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
    label: "Core",
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
    label: "Pro",
    mrr: 80,
    buildAllowance: 0,
    blurb: "Everything in Core, with your system's API usage included.",
    features: [
      "Everything in Core",
      "Transactional email sending (Resend) included",
      "AI usage (OpenAI) included",
      "Third-party API monitoring & key management",
      "Monthly usage report",
    ],
  },
  {
    id: "build_3",
    label: "Max",
    mrr: 120,
    buildAllowance: 3,
    blurb: "Everything in Pro, plus 3 design and build revisions every month.",
    features: [
      "Everything in Pro",
      "3 design and build revisions each month",
      "Priority turnaround on requests",
      "Improvements proposed from your system's real usage",
    ],
  },
  {
    id: "build_10",
    label: "Enterprise",
    mrr: 180,
    buildAllowance: 10,
    blurb:
      "Our top tier — dedicated capacity, contracted response times and a roadmap we run to.",
    features: [
      "Everything in Max",
      "10 design and build revisions each month",
      "Dedicated build capacity, scoped to you",
      "Contracted response times (SLA)",
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
