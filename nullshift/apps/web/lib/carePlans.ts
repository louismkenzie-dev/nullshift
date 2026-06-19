/**
 * Care plans — the ongoing subscription tiers offered as part of a proposal.
 * Shared by the admin client hub (proposing a plan) and the client portal
 * (showing + accepting it). MRR figures here are the single source of truth.
 */
export type CarePlan = { id: string; label: string; mrr: number };

export const CARE_PLANS: CarePlan[] = [
  { id: "care_basic", label: "Care Basic", mrr: 49 },
  { id: "care_pro", label: "Care Pro", mrr: 149 },
  { id: "transaction", label: "Transaction", mrr: 39 },
];

export const CARE_PLAN_MRR: Record<string, number> = Object.fromEntries(
  CARE_PLANS.map((p) => [p.id, p.mrr])
);

export function carePlan(id: string | null | undefined): CarePlan | null {
  return CARE_PLANS.find((p) => p.id === id) ?? null;
}
