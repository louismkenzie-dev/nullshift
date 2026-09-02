import { createServiceClient } from "@nullshift/db";
import { CARE_PLANS, SELLABLE_PLANS, carePlan } from "@/lib/carePlans";
import {
  priceFromAssessment,
  type AssessmentRow,
  type PlanPrice,
} from "./contractedPrice";

/**
 * What a specific tenant is actually charged per month — server side.
 *
 * The plan catalogue holds the base "from" price; the Scale Scoring Formula
 * decides the real rate. Any flow that bills a client — Direct Debit set-up,
 * subscription rows, Stripe checkout — must resolve through here so a
 * Scale-band client is never quietly charged the Standard from-price, and a
 * client is never charged a figure they were not shown.
 *
 * Precedence per plan (see contractedPrice.ts):
 *   agreed_mrr → override_mrr → recommended_mrr (exact plan) → derived from the
 *   band multiplier (sibling plans) → unpriced. With no assessment on file the
 *   base price is returned with `priced: false` — visible to staff, never
 *   offered to or charged from a client.
 *
 * Note the vocabulary bridge: scale_assessments.plan is core/pro/max/enterprise
 * while subscriptions.plan is hosting/hosting_api/build_3/build_10. Every
 * comparison goes through CarePlan.nsiPlan; nothing here filters by plan id.
 */

export type ContractedPrices = {
  assessment: AssessmentRow | null;
  /** One entry per catalogue plan, keyed by subscriptions.plan id. */
  prices: Record<string, PlanPrice>;
  /** The three client-choosable plans, in catalogue order. */
  sellable: PlanPrice[];
  /** True when at least one sellable plan may be offered. */
  anyPriced: boolean;
  scored: boolean;
};

const ASSESSMENT_COLUMNS =
  "id, plan, scale_band, multiplier, direct_cost_floor, recommended_mrr, override_mrr, agreed_mrr, enterprise_review_required, pricing_version, created_at";

export async function latestAssessment(tenantId: string): Promise<AssessmentRow | null> {
  if (!tenantId) return null;
  const service = createServiceClient();
  const { data } = await service
    .from("scale_assessments")
    .select(ASSESSMENT_COLUMNS)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as AssessmentRow | null) ?? null;
}

export function pricesFromAssessment(row: AssessmentRow | null): ContractedPrices {
  const prices: Record<string, PlanPrice> = {};
  for (const p of CARE_PLANS) prices[p.id] = priceFromAssessment(row, p);
  const sellable = SELLABLE_PLANS.map((p) => prices[p.id]!);
  return {
    assessment: row,
    prices,
    sellable,
    anyPriced: sellable.some((s) => s.priced),
    scored: !!row,
  };
}

export async function contractedPrices(tenantId: string): Promise<ContractedPrices> {
  return pricesFromAssessment(await latestAssessment(tenantId));
}

/**
 * Single-plan convenience with the historical shape plus `priced`. Callers that
 * bill MUST refuse when `priced` is false.
 */
export async function contractedMrr(
  tenantId: string,
  planId: string
): Promise<PlanPrice & { mrr: number }> {
  const plan = carePlan(planId);
  const fallback: PlanPrice & { mrr: number } = {
    planId,
    label: plan?.label ?? planId,
    mrr: plan?.mrr ?? 0,
    source: "base",
    priced: false,
    band: null,
    multiplier: null,
    pricingVersion: null,
    assessmentId: null,
  };
  if (!plan) return fallback;
  const price = priceFromAssessment(await latestAssessment(tenantId), plan);
  return { ...price, mrr: price.mrr ?? plan.mrr };
}
