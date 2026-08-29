import { createServiceClient } from "@nullshift/db";
import { carePlan } from "@/lib/carePlans";

/**
 * What a specific tenant is actually charged per month.
 *
 * The plan catalogue holds the base "from" price; the Scale Scoring Formula
 * decides the real rate. Any flow that bills a client — Direct Debit set-up,
 * subscription rows, proposal figures — must resolve through here so a Scale-
 * band client is never quietly charged the Standard from-price.
 *
 * Precedence, most specific first:
 *   1. agreed_mrr   — the figure signed off with the client
 *   2. override_mrr — a deliberate commercial override (carries a reason)
 *   3. recommended_mrr — the formula's output
 *   4. the plan's base price — no assessment on file yet
 */
export async function contractedMrr(
  tenantId: string,
  planId: string
): Promise<{ mrr: number; source: "agreed" | "override" | "formula" | "base" }> {
  const base = carePlan(planId)?.mrr ?? 0;
  if (!tenantId) return { mrr: base, source: "base" };

  const service = createServiceClient();
  const { data } = await service
    .from("scale_assessments")
    .select("agreed_mrr, override_mrr, recommended_mrr, plan")
    .eq("tenant_id", tenantId)
    .eq("plan", planId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { mrr: base, source: "base" };
  if (data.agreed_mrr != null) return { mrr: Number(data.agreed_mrr), source: "agreed" };
  if (data.override_mrr != null)
    return { mrr: Number(data.override_mrr), source: "override" };
  if (data.recommended_mrr != null)
    return { mrr: Number(data.recommended_mrr), source: "formula" };
  return { mrr: base, source: "base" };
}
