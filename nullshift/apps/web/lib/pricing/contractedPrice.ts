import { BASE_PLAN_PRICE, ceilToFive, type ScaleBand } from "./nsi";
import type { CarePlan } from "@/lib/carePlans";

/**
 * Pure pricing resolution — what a client pays for a given plan, derived from
 * their latest scale assessment. No I/O, so it is unit-tested and shared by the
 * portal chooser (display), the Direct Debit starter (charge), Stripe checkout
 * and the admin surfaces. The rule the whole feature rests on: the figure the
 * client SEES is the figure this function returns, and the figure they are
 * CHARGED is the same call.
 */

export type AssessmentRow = {
  id: string;
  /** scale_assessments.plan — core | pro | max | enterprise. */
  plan: string;
  scale_band: ScaleBand | null;
  multiplier: number | string | null;
  direct_cost_floor: number | string | null;
  recommended_mrr: number | string | null;
  override_mrr: number | string | null;
  agreed_mrr: number | string | null;
  enterprise_review_required: boolean;
  pricing_version: string;
  created_at?: string;
  /**
   * Hand-set prices per plan (keyed by nsi plan id: core / pro / max), each
   * with the reason the client is shown. Wins over everything but an agreed
   * figure for the exact plan.
   */
  plan_prices?: Record<
    string,
    { mrr: number | string | null; reason?: string | null }
  > | null;
};

export type PriceSource =
  | "agreed" // signed-off figure for this exact plan
  | "override" // deliberate commercial override for this exact plan
  | "formula" // the formula's recommended figure for this exact plan
  | "derived" // this band's multiplier applied to a sibling plan's base price
  | "base" // no assessment on file — catalogue "from" price, NOT chargeable
  | "unpriced"; // Enterprise review / missing multiplier — needs a person

export type PlanPrice = {
  planId: string;
  label: string;
  mrr: number | null;
  source: PriceSource;
  /** True only when the figure may be shown to a client and charged. */
  priced: boolean;
  band: ScaleBand | null;
  multiplier: number | null;
  pricingVersion: string | null;
  assessmentId: string | null;
  /** Client-facing reason for a hand-set price; null when the formula priced it. */
  note: string | null;
};

const num = (v: number | string | null | undefined): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);

export function priceFromAssessment(
  row: AssessmentRow | null,
  plan: CarePlan
): PlanPrice {
  const base = {
    planId: plan.id,
    label: plan.label,
    band: (row?.scale_band as ScaleBand | null) ?? null,
    multiplier: num(row?.multiplier),
    pricingVersion: row?.pricing_version ?? null,
    assessmentId: row?.id ?? null,
    note: null as string | null,
  };

  // Not scored yet: the catalogue figure is informational only. Nothing may be
  // offered or charged off it — the owner sets the bracket first.
  if (!row) return { ...base, mrr: plan.mrr, source: "base", priced: false };

  const exact = row.plan === plan.nsiPlan;
  const agreed = num(row.agreed_mrr);
  const override = num(row.override_mrr);

  // A figure a human signed off for THIS plan always wins — including for
  // Enterprise, which is the only way an Enterprise plan ever gets a price.
  if (exact && agreed !== null)
    return { ...base, mrr: agreed, source: "agreed", priced: true };

  // A price set by hand for this plan, with the reason the client sees.
  const handSet = row.plan_prices?.[plan.nsiPlan];
  const handMrr = num(handSet?.mrr ?? null);
  if (handMrr !== null && handMrr >= 0)
    return {
      ...base,
      mrr: handMrr,
      source: "override",
      priced: true,
      note: handSet?.reason?.trim() || null,
    };

  if (exact && override !== null)
    return { ...base, mrr: override, source: "override", priced: true };

  if (plan.quotedOnly) return { ...base, mrr: null, source: "unpriced", priced: false };

  // The formula declined to price this client (Enterprise trigger / 85+) or
  // never produced a band — a person has to look.
  const multiplier = num(row.multiplier);
  if (row.enterprise_review_required || multiplier === null)
    return { ...base, mrr: null, source: "unpriced", priced: false };

  const recommended = num(row.recommended_mrr);
  if (exact && recommended !== null)
    return { ...base, mrr: recommended, source: "formula", priced: true };

  // Sibling plan: the same band multiplier and margin floor applied to that
  // plan's base price — exactly nsi.ts's final step, evaluated for this plan.
  const basePrice = BASE_PLAN_PRICE[plan.nsiPlan as keyof typeof BASE_PLAN_PRICE];
  if (basePrice === undefined)
    return { ...base, mrr: null, source: "unpriced", priced: false };
  const floor = num(row.direct_cost_floor) ?? 0;
  const derived = ceilToFive(Math.max(basePrice * multiplier, floor));
  return { ...base, mrr: derived, source: "derived", priced: true };
}
