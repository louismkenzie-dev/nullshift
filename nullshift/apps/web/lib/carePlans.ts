/**
 * Recurring plans — the four service levels. Single source of truth for the
 * base "from" price and exactly what each level covers. Shared by the admin
 * billing cockpit, the client hub (proposing a plan), the client portal
 * (showing + accepting it) and the Direct Debit / Stripe subscription flows.
 *
 * Plan ids are stored in subscriptions.plan (text, checked by
 * subscriptions_plan_check in migration 0014) — they are DB values, so they
 * keep their original names even though the levels are sold as Core / Pro /
 * Max / Enterprise.
 *
 * `mrr` here is the BASE "from" price only — what a Standard-band client pays.
 * The amount a given client is actually charged comes from the Scale Scoring
 * Formula (lib/pricing/nsi.ts): base × scale multiplier, floored by margin on
 * attributable vendor cost. Use contractedMrr() in lib/pricing/contracted.ts
 * to resolve the real figure for a tenant; never bill straight off `mrr`
 * without checking for an assessment first.
 *
 * Recurring fees buy the platform, service level and technical partnership.
 * New capabilities are ALWAYS separately quoted fixed-price projects — no plan
 * includes development, which is why every buildAllowance here is 0. Never
 * describe any level as unlimited development or a developer on demand.
 */
/** The pricing engine's vocabulary (nsi.ts, scale_assessments.plan). */
export type NsiPlan = "core" | "pro" | "max" | "enterprise";

export type CarePlan = {
  id: string;
  label: string;
  /**
   * The same level in the Scale Scoring Formula's vocabulary. subscriptions.plan
   * and tenants.care_plan_choice store `id`; scale_assessments.plan stores this.
   * The bridge lives here so no query ever compares the two by accident.
   */
  nsiPlan: NsiPlan;
  /** Base "from" price per month, before the client's scale multiplier. */
  mrr: number;
  /** Quoted individually rather than sold at a list price. */
  quotedOnly?: boolean;
  /**
   * Build items included per month. 0 on every standard level: feature work is
   * a separately quoted fixed-price project, not a retainer entitlement. Only a
   * bespoke Enterprise agreement with reserved capacity sets this per client.
   */
  buildAllowance: number;
  /** One-line summary of the level. */
  blurb: string;
  /** Exactly what the level covers — listed in the proposal document. */
  features: string[];
};

export type RetainerPlan = CarePlan;

export const CARE_PLANS: CarePlan[] = [
  {
    id: "hosting",
    nsiPlan: "core",
    label: "Core",
    mrr: 40,
    buildAllowance: 0,
    blurb: "Keep it live — hosting, maintenance and support for a stable system.",
    features: [
      "Managed hosting, deployment, domain/DNS and SSL",
      "Dedicated production database (paid Supabase plan included)",
      "Routine maintenance, daily backups and service monitoring",
      "Fault investigation and fixes against the signed-off scope",
      "Standard support queue — response target 2 UK business days",
      "Guidance on using the system you already have",
    ],
  },
  {
    id: "hosting_api",
    nsiPlan: "pro",
    label: "Pro",
    mrr: 80,
    buildAllowance: 0,
    blurb: "Run it properly — managed AI/API and email infrastructure, faster support.",
    features: [
      "Everything in Core",
      "Managed AI-agent/API infrastructure, within the normal usage band",
      "Managed transactional email infrastructure and delivery diagnostics",
      "Enhanced monitoring of API failures, email delivery and key integrations",
      "Priority support queue — response target 1 UK business day",
      "Configuration support for existing features, workflows and integrations",
    ],
  },
  {
    id: "build_3",
    nsiPlan: "max",
    label: "Max",
    mrr: 120,
    buildAllowance: 0,
    blurb: "Have a technical partner — a named owner, proactive review and priority.",
    features: [
      "Everything in Pro",
      "A named technical owner who knows your system and its history",
      "Priority queue — response target 4 UK business hours",
      "Quarterly roadmap review of goals, constraints and priorities",
      "Monthly platform health review with concise recommendations",
      "Feature discovery and technical scoping included — no consultancy fee",
      "Priority scheduling for accepted feature projects",
    ],
  },
  {
    id: "build_10",
    nsiPlan: "enterprise",
    label: "Enterprise",
    mrr: 120,
    quotedOnly: true,
    buildAllowance: 0,
    blurb:
      "Make it business-critical — custom service, infrastructure and commercial terms.",
    features: [
      "Everything in Max",
      "Contracted uptime and response SLAs",
      "Security reviews, procurement support and change management",
      "Dedicated environments and higher infrastructure allowances",
      "Custom service cadence and dedicated support model",
      "Optional retained development capacity, priced as reserved capacity",
    ],
  },
];

export const RETAINER_PLANS = CARE_PLANS;

/** The three levels a client may choose for themselves. Enterprise is quoted. */
export const SELLABLE_PLANS: CarePlan[] = CARE_PLANS.filter((p) => !p.quotedOnly);

/** Reverse lookup from the pricing engine's vocabulary. */
export function carePlanForNsi(nsi: string | null | undefined): CarePlan | null {
  return CARE_PLANS.find((p) => p.nsiPlan === nsi) ?? null;
}

export function nsiPlanOf(planId: string | null | undefined): NsiPlan | null {
  return CARE_PLANS.find((p) => p.id === planId)?.nsiPlan ?? null;
}

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
