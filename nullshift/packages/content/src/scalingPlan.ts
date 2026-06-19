/**
 * buildScalingPlan — the "Get my free plan" lead magnet, reframed as a free
 * SCALING PLAN: a consultation-style prospectus generated deterministically from
 * the funnel answers. Hybrid engine: composable per-answer blocks (from the
 * authored content bank, covering every combination) overridden by a hand-crafted
 * HERO plan when the industry×pain combo matches. No Nullshift pricing — the build
 * is scoped and priced with the prospect on a call; this is an indicative prospectus.
 */
import { SCALING_CONTENT } from "./scalingPlanContent";
import { buildBlueprint, type Segment } from "./blueprint";
import { estimateSavings, type Savings } from "./savings";

export type SaasItem = { name: string; note: string };
export type TitledItem = { title: string; detail: string };

export type VerticalContent = {
  id: string;
  diagnosis: string;
  saasToCut: SaasItem[];
  automations: TitledItem[];
  elements: TitledItem[];
  opportunities: TitledItem[];
  opsTrap: string;
};
export type PainContent = { id: string; fix: string; detail: string };
export type GoalContent = { id: string; approach: string };
export type SpendBandContent = { id: string; framing: string };
export type HeroPlan = {
  verticalId: string;
  painId: string;
  title: string;
  narrative: string;
  highlights: string[];
};

export type ScalingContent = {
  verticals: Record<string, VerticalContent>;
  pains: PainContent[];
  goals: GoalContent[];
  spendBands: SpendBandContent[];
  heroPlans: HeroPlan[];
};

/** A module in the system mock (no price — the mock is "what it could look like"). */
export type ScalingModule = { name: string; asset: string };

export type ScalingPlan = {
  vertical: string;
  isClinic: boolean;
  businessLabel: string;
  /** Flagship narrative for top combos, when one matches (hybrid override). */
  hero: HeroPlan | null;
  diagnosis: string;
  saasToCut: SaasItem[];
  build: TitledItem[];
  automations: TitledItem[];
  opportunities: TitledItem[];
  opsTrap: string;
  pain: PainContent | null;
  goal: GoalContent | null;
  spendFraming: string | null;
  savings: Savings;
  timelineWeeks: string;
  /** Modules for the (non-AI) system mock. */
  modules: ScalingModule[];
  segment: Segment;
};

export type ScalingAnswers = Record<string, string>;

const CLINIC_VERTICALS = new Set(["clinic"]);

export function buildScalingPlan(
  a: ScalingAnswers,
  opts: { segment: Segment; businessName?: string }
): ScalingPlan {
  const vertical = a.industry || "default";
  const isClinic = CLINIC_VERTICALS.has(vertical);
  const businessLabel =
    opts.businessName?.trim() || (isClinic ? "Your clinic" : "Your business");

  const v = SCALING_CONTENT.verticals[vertical] ?? SCALING_CONTENT.verticals.default;

  const hero =
    SCALING_CONTENT.heroPlans.find(
      (h) => h.verticalId === vertical && h.painId === a.admin_pain
    ) ?? null;

  const pain = SCALING_CONTENT.pains.find((p) => p.id === a.admin_pain) ?? null;
  const goal = SCALING_CONTENT.goals.find((g) => g.id === a.need) ?? null;
  const spendFraming =
    SCALING_CONTENT.spendBands.find((s) => s.id === a.software_spend)?.framing ?? null;

  const savings = estimateSavings({
    spendBand: a.software_spend,
    practitionerBand: a.practitioners,
    isClinic,
  });

  // Reuse the deterministic module selection for the system mock (drop price).
  const bp = buildBlueprint(a, {
    segment: opts.segment,
    businessName: opts.businessName,
  });

  return {
    vertical,
    isClinic,
    businessLabel,
    hero,
    diagnosis: v.diagnosis,
    saasToCut: v.saasToCut,
    build: v.elements,
    automations: v.automations,
    opportunities: v.opportunities,
    opsTrap: v.opsTrap,
    pain,
    goal,
    spendFraming,
    savings,
    timelineWeeks: bp.timelineWeeks,
    modules: bp.modules.map((m) => ({ name: m.name, asset: m.asset })),
    segment: opts.segment,
  };
}
