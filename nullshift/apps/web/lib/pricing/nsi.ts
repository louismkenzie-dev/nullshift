/**
 * Nullshift Scale Index (NSI) — the recurring-pricing engine.
 *
 * Implements the Scale Scoring Formula spec. The public site advertises one
 * "from" price per plan (Core £40 / Pro £80 / Max £120); this engine turns a
 * client's scale, commercial importance and technical load into the rate they
 * are actually quoted, so a small local business stays at the from-price while
 * a larger or more business-critical organisation pays materially more for the
 * same service level.
 *
 *   final_mrr = ceil_to_5( max( base_plan × scale_multiplier,
 *                               direct_vendor_cost / 0.25 ) )
 *
 * The cost floor targets a minimum 75% gross margin on attributable vendor
 * spend, so a usage spike can never leave a plan underwater regardless of NSI.
 *
 * Everything here is pure and side-effect free — the admin surface scores,
 * displays and stores; this module only calculates. Every result carries the
 * pricing version so a future formula change can never rewrite historic quotes.
 */

export const PRICING_VERSION = "NSI_v1_2026_08";

/** The public "from" prices. Enterprise is always quoted individually. */
export const BASE_PLAN_PRICE = { core: 40, pro: 80, max: 120 } as const;

/** Minimum gross margin retained on attributable third-party vendor cost. */
const COST_FLOOR_DIVISOR = 0.25;

export type PlanId = "core" | "pro" | "max" | "enterprise";

export type PlatformRole =
  | "informational"
  | "lead_gen"
  | "operational"
  | "transaction_critical";

export type RiskFlags = {
  /** Payments, inventory/seat allocation or another financially consequential transaction. */
  payments: boolean;
  /** Authentication plus meaningful customer PII or permission-sensitive data. */
  authenticatedPii: boolean;
  /** Three or more external integrations required for normal operation. */
  threePlusIntegrations: boolean;
  /** Automation or AI materially affecting communication, decisions or fulfilment. */
  operationalAi: boolean;
  /** Custom admin tooling, multiple roles or multi-stage workflows — elevated regression risk. */
  complexAdminWorkflows: boolean;
};

export type EnterpriseFlags = {
  /** 100,000+ MAU or equivalent exceptional transaction volume. */
  highMau: boolean;
  /** £500+/month attributable vendor cost. */
  highVendorCost: boolean;
  /** 24/7, weekend, sub-hour or financially backed SLA required. */
  specialSla: boolean;
  /** Regulated/sensitive data, security reviews or procurement questionnaires. */
  regulatedSecurity: boolean;
  /** Multi-country, multi-entity, white-label/reseller or many client organisations. */
  multiEntity: boolean;
  /** Reserved development capacity, change-control boards, dedicated environments. */
  reservedCapacity: boolean;
  /** Failure would create unusually large financial, legal or reputational exposure. */
  exceptionalExposure: boolean;
};

export type ScaleInput = {
  plan: PlanId;
  monthlyActiveUsers: number | null;
  monthlySessions: number | null;
  platformRole: PlatformRole;
  annualTurnoverGbp: number | null;
  employeeCount: number | null;
  /** Attributable recurring vendor spend — hosting, DB, storage, AI/API, email, monitoring. */
  directMonthlyVendorCostGbp: number | null;
  internalActiveUsers: number | null;
  locationsOrUnits: number | null;
  riskFlags: RiskFlags;
  enterpriseFlags: EnterpriseFlags;
};

export type ScaleBand = "standard" | "growth" | "established" | "scale" | "critical";

export type ComponentScores = {
  audience: number;
  commercialCriticality: number;
  technicalLoad: number;
  organisationReach: number;
  complexityRisk: number;
};

export type ScaleResult = {
  pricingVersion: string;
  plan: PlanId;
  nsi: number;
  componentScores: ComponentScores;
  /** null when the quote is a mandatory manual Enterprise review. */
  scaleBand: ScaleBand | null;
  multiplier: number | null;
  basePlanPrice: number | null;
  scaledPlanPrice: number | null;
  directCostFloor: number | null;
  /** null when Enterprise review is required or vendor cost is unknown. */
  recommendedMrr: number | null;
  enterpriseReviewRequired: boolean;
  /** "low" when audience data was missing entirely. */
  dataQuality: "ok" | "low";
  /** Human-readable reasons the record needs a person to look at it. */
  reviewFlags: string[];
};

/* ── Band tables ─────────────────────────────────────────────────── */

/** Points from the first band whose threshold the value meets, walking down. */
function bandPoints(value: number, bands: [min: number, points: number][]): number {
  for (const [min, points] of bands) if (value >= min) return points;
  return 0;
}

/** A. Audience / usage — 0–25. MAU preferred; sessions are the fallback. */
export function audiencePoints(
  mau: number | null,
  sessions: number | null
): { points: number; dataQuality: "ok" | "low" } {
  if (mau !== null && mau >= 0) {
    return {
      points: bandPoints(mau, [
        [50_000, 25],
        [10_000, 17],
        [2_000, 10],
        [500, 5],
        [0, 0],
      ]),
      dataQuality: "ok",
    };
  }
  if (sessions !== null && sessions >= 0) {
    return {
      points: bandPoints(sessions, [
        [200_000, 25],
        [50_000, 17],
        [10_000, 10],
        [2_500, 5],
        [0, 0],
      ]),
      dataQuality: "ok",
    };
  }
  // Neither figure available — score nothing and mark the record.
  return { points: 0, dataQuality: "low" };
}

/** B1. Platform role — 0–15. */
export function platformRolePoints(role: PlatformRole): number {
  return { informational: 0, lead_gen: 5, operational: 10, transaction_critical: 15 }[
    role
  ];
}

/**
 * B2. Organisation scale — 0–10. Turnover is the primary signal; employee count
 * is the documented fallback. Never inferred: with neither, this scores 0 and
 * the record is flagged for manual review rather than guessed at.
 */
export function organisationScalePoints(
  turnover: number | null,
  employees: number | null
): { points: number; inferred: boolean } {
  if (turnover !== null && turnover >= 0) {
    return {
      points: bandPoints(turnover, [
        [20_000_000, 10],
        [5_000_000, 8],
        [2_000_000, 6],
        [750_000, 4],
        [250_000, 2],
        [0, 0],
      ]),
      inferred: false,
    };
  }
  if (employees !== null && employees >= 0) {
    return {
      points: bandPoints(employees, [
        [201, 10],
        [51, 8],
        [16, 6],
        [6, 4],
        [3, 2],
        [0, 0],
      ]),
      inferred: false,
    };
  }
  return { points: 0, inferred: true };
}

/** C. Technical load — 0–20, from attributable monthly vendor cost. */
export function technicalLoadPoints(cost: number | null): number {
  if (cost === null || cost < 0) return 0;
  return bandPoints(cost, [
    [250, 20],
    [100, 16],
    [50, 12],
    [25, 8],
    [10, 4],
    [0, 0],
  ]);
}

/** D. Organisation reach — 0–15. The HIGHER of the two signals, never the sum. */
export function organisationReachPoints(
  internalUsers: number | null,
  locations: number | null
): number {
  const byUsers =
    internalUsers === null
      ? 0
      : bandPoints(internalUsers, [
          [51, 15],
          [16, 10],
          [6, 6],
          [3, 3],
          [0, 0],
        ]);
  const byLocations =
    locations === null
      ? 0
      : bandPoints(locations, [
          [16, 15],
          [6, 10],
          [3, 6],
          [2, 3],
          [0, 0],
        ]);
  return Math.max(byUsers, byLocations);
}

/** E. Complexity & risk — exactly 3 points per flag, capped at 15. */
export function complexityRiskPoints(flags: RiskFlags): number {
  const set = Object.values(flags).filter(Boolean).length;
  return Math.min(15, set * 3);
}

/** Score → commercial band + multiplier. 85+ is a mandatory Enterprise quote. */
export function scaleBandFor(
  nsi: number
): { band: ScaleBand; multiplier: number } | null {
  if (nsi < 30) return { band: "standard", multiplier: 1.0 };
  if (nsi < 45) return { band: "growth", multiplier: 1.5 };
  if (nsi < 60) return { band: "established", multiplier: 2.5 };
  if (nsi < 75) return { band: "scale", multiplier: 4.0 };
  if (nsi < 85) return { band: "critical", multiplier: 5.5 };
  return null;
}

export const SCALE_BAND_LABEL: Record<ScaleBand, string> = {
  standard: "Standard",
  growth: "Growth",
  established: "Established",
  scale: "Scale",
  critical: "Critical",
};

/** Round up to the next £5 — every quoted rate lands on a clean figure. */
export const ceilToFive = (n: number) => Math.ceil(n / 5) * 5;

/**
 * Score a client and price them. Returns the full audit trail — component
 * scores, band, multiplier, cost floor and recommended MRR — not just a number,
 * so a quote can always be explained back to the client.
 */
export function calculateScalePricing(input: ScaleInput): ScaleResult {
  const reviewFlags: string[] = [];

  const audience = audiencePoints(input.monthlyActiveUsers, input.monthlySessions);
  if (audience.dataQuality === "low")
    reviewFlags.push("No usage data — audience scored 0. Confirm MAU or sessions.");

  const role = platformRolePoints(input.platformRole);
  const orgScale = organisationScalePoints(input.annualTurnoverGbp, input.employeeCount);
  if (orgScale.inferred)
    reviewFlags.push(
      "No turnover or employee count — organisation scale scored 0 rather than inferred."
    );

  const technicalLoad = technicalLoadPoints(input.directMonthlyVendorCostGbp);
  const organisationReach = organisationReachPoints(
    input.internalActiveUsers,
    input.locationsOrUnits
  );
  const complexityRisk = complexityRiskPoints(input.riskFlags);

  const componentScores: ComponentScores = {
    audience: audience.points,
    commercialCriticality: role + orgScale.points,
    technicalLoad,
    organisationReach,
    complexityRisk,
  };
  const nsi = Math.min(
    100,
    componentScores.audience +
      componentScores.commercialCriticality +
      componentScores.technicalLoad +
      componentScores.organisationReach +
      componentScores.complexityRisk
  );

  const triggered = Object.entries(input.enterpriseFlags)
    .filter(([, on]) => on)
    .map(([k]) => k);
  const enterpriseReviewRequired =
    input.plan === "enterprise" || triggered.length > 0 || nsi >= 85;

  const base: Omit<
    ScaleResult,
    "scaleBand" | "multiplier" | "basePlanPrice" | "scaledPlanPrice" | "recommendedMrr"
  > = {
    pricingVersion: PRICING_VERSION,
    plan: input.plan,
    nsi,
    componentScores,
    directCostFloor:
      input.directMonthlyVendorCostGbp === null
        ? null
        : input.directMonthlyVendorCostGbp / COST_FLOOR_DIVISOR,
    enterpriseReviewRequired,
    dataQuality: audience.dataQuality,
    reviewFlags,
  };

  if (enterpriseReviewRequired) {
    if (nsi >= 85) reviewFlags.push(`NSI ${nsi} is in the Enterprise band (85+).`);
    for (const t of triggered) reviewFlags.push(`Enterprise trigger: ${t}.`);
    return {
      ...base,
      scaleBand: null,
      multiplier: null,
      basePlanPrice: null,
      scaledPlanPrice: null,
      recommendedMrr: null,
    };
  }

  const banded = scaleBandFor(nsi)!;
  const basePlanPrice = BASE_PLAN_PRICE[input.plan as keyof typeof BASE_PLAN_PRICE];
  const scaledPlanPrice = basePlanPrice * banded.multiplier;

  // Missing vendor cost blocks auto-pricing — the margin floor cannot be
  // calculated safely, so a person confirms the figure before we quote.
  if (base.directCostFloor === null) {
    reviewFlags.push(
      "No vendor cost recorded — the margin floor cannot be calculated, so no price is recommended."
    );
    return {
      ...base,
      scaleBand: banded.band,
      multiplier: banded.multiplier,
      basePlanPrice,
      scaledPlanPrice,
      recommendedMrr: null,
    };
  }

  const recommendedMrr = ceilToFive(Math.max(scaledPlanPrice, base.directCostFloor));
  if (base.directCostFloor > scaledPlanPrice)
    reviewFlags.push(
      "Vendor cost sets the price, not the scale band — check whether this client belongs in a higher band."
    );

  return {
    ...base,
    scaleBand: banded.band,
    multiplier: banded.multiplier,
    basePlanPrice,
    scaledPlanPrice,
    recommendedMrr,
  };
}

/** Blank input — the starting point for a new assessment form. */
export const EMPTY_SCALE_INPUT: ScaleInput = {
  plan: "core",
  monthlyActiveUsers: null,
  monthlySessions: null,
  platformRole: "informational",
  annualTurnoverGbp: null,
  employeeCount: null,
  directMonthlyVendorCostGbp: null,
  internalActiveUsers: null,
  locationsOrUnits: null,
  riskFlags: {
    payments: false,
    authenticatedPii: false,
    threePlusIntegrations: false,
    operationalAi: false,
    complexAdminWorkflows: false,
  },
  enterpriseFlags: {
    highMau: false,
    highVendorCost: false,
    specialSla: false,
    regulatedSecurity: false,
    multiEntity: false,
    reservedCapacity: false,
    exceptionalExposure: false,
  },
};

export const RISK_FLAG_LABEL: Record<keyof RiskFlags, string> = {
  payments: "Takes payments or allocates inventory/seats/availability",
  authenticatedPii: "Authentication plus customer PII or permission-sensitive data",
  threePlusIntegrations: "Depends on 3+ external integrations to operate",
  operationalAi: "AI/automation materially affects communication or fulfilment",
  complexAdminWorkflows: "Custom admin, multiple roles or multi-stage workflows",
};

export const ENTERPRISE_FLAG_LABEL: Record<keyof EnterpriseFlags, string> = {
  highMau: "100,000+ MAU or equivalent transaction volume",
  highVendorCost: "£500+/month attributable vendor cost",
  specialSla: "24/7, weekend, sub-hour or financially backed SLA",
  regulatedSecurity: "Regulated data, security review or procurement questionnaire",
  multiEntity: "Multi-country, multi-entity, white-label or multi-client platform",
  reservedCapacity: "Reserved development capacity or formal change control",
  exceptionalExposure: "Failure would create unusually large exposure for Nullshift",
};

export const PLATFORM_ROLE_LABEL: Record<PlatformRole, string> = {
  informational: "Informational / brochure",
  lead_gen: "Lead generation / customer information",
  operational: "Operationally important",
  transaction_critical: "Revenue / transaction critical",
};
