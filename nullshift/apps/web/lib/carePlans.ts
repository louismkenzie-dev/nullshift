/**
 * Care plans — the ongoing subscription tiers offered as part of a proposal.
 * Shared by the admin client hub (proposing a plan) and the client portal
 * (showing + accepting it). MRR figures here are the single source of truth.
 */
export type CarePlan = {
  id: string;
  label: string;
  mrr: number;
  /** One-line summary of the plan. */
  blurb: string;
  /** Exactly what the plan covers — listed in the proposal document. */
  features: string[];
};

export const CARE_PLANS: CarePlan[] = [
  {
    id: "care_basic",
    label: "Care Basic",
    mrr: 49,
    blurb: "Keeps your system online, secure and up to date.",
    features: [
      "Managed hosting, SSL and daily backups",
      "Security patches & dependency updates",
      "Uptime monitoring with alerting",
      "Up to 1 hour of content or small changes each month",
      "Email support (within 2 business days)",
    ],
  },
  {
    id: "care_pro",
    label: "Care Pro",
    mrr: 149,
    blurb: "Everything in Basic, plus hands-on improvements every month.",
    features: [
      "Everything in Care Basic",
      "Up to 4 hours of changes & enhancements each month",
      "Priority support (next business day)",
      "Monthly performance & SEO health check",
      "A quarterly strategy call to plan what's next",
    ],
  },
  {
    id: "transaction",
    label: "Transaction",
    mrr: 39,
    blurb: "A lean base for transaction-led sites — we keep checkout flowing.",
    features: [
      "Managed hosting, SSL and daily backups",
      "Uptime + payments monitoring (Stripe)",
      "Checkout / booking issue triage",
      "Security patches & dependency updates",
      "Email support (within 2 business days)",
    ],
  },
];

export const CARE_PLAN_MRR: Record<string, number> = Object.fromEntries(
  CARE_PLANS.map((p) => [p.id, p.mrr])
);

export function carePlan(id: string | null | undefined): CarePlan | null {
  return CARE_PLANS.find((p) => p.id === id) ?? null;
}
