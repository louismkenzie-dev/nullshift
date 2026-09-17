/**
 * Deterministic estimator (brief §6.2 formulas, §6.3 four outputs).
 *
 *   base_delivery_cost          = Σ(work_package_hours × loaded_role_cost) + contractors + attributable_project_costs
 *   risk_adjusted_delivery_cost = base_delivery_cost + explicit_contingency + warranty_reserve   (each counted once)
 *   build_price_floor           = risk_adjusted_delivery_cost / (1 − minimum_margin)   → rounded UP to the increment
 *   build_target_price          = risk_adjusted_delivery_cost / (1 − target_margin)    → rounded UP to the increment
 *   monthly_cost_to_serve       = infrastructure + support/maintenance labour + allocated operating + operating risk reserve
 *   run_price_floor / target    = monthly_cost_to_serve / (1 − minimum_run_margin | target_run_margin)
 *   forecast_contribution       = approved_net_selling_price − estimated_cost
 *   forecast_contribution_margin= forecast_contribution / approved_net_selling_price
 *
 * All arithmetic is on integer minor units. Unknown inputs are never coerced to
 * zero: a material Unknown makes BUILD "insufficient_confidence" and RUN's
 * totals null. There is no cap anywhere; large estimates escalate instead.
 * The same input and policy always produce a deep-equal, frozen result.
 */
import type { CommercialPolicy } from "./policy";
import { roleRate } from "./policy";
import { basisLabel, catalogueById } from "./catalogue";
import type {
  BuildOutput,
  CostDriver,
  Contribution,
  EstimateInput,
  EstimateResult,
  GrowOutput,
  Maybe,
  PackageCost,
  PolicySnapshot,
  RunOutput,
  Scenario,
  ScenarioName,
  TransactOutput,
  Confidence,
} from "./types";
import { isKnown } from "./types";

/* ── Arithmetic helpers ─────────────────────────────────────────────────── */

/** Rounds a minor amount UP to the next multiple of `increment` (never down). */
export function ceilToIncrement(minor: number, incrementMinor: number): number {
  if (incrementMinor <= 0) return Math.ceil(minor);
  return Math.ceil(minor / incrementMinor) * incrementMinor;
}

/** Price that yields `marginPct` contribution margin on `costMinor`: cost / (1 − m). Exact, rounded up to the minor unit. */
export function priceForMargin(costMinor: number, marginPct: number): number {
  if (marginPct >= 100) throw new RangeError("margin must be below 100%");
  return Math.ceil((costMinor * 100) / (100 - marginPct));
}

/** Contribution margin for a price and cost, one decimal place. Null when price is zero (undefined, not invalid). */
export function marginPctOf(priceMinor: number, costMinor: number): number | null {
  if (priceMinor === 0) return null;
  return Math.round(((priceMinor - costMinor) / priceMinor) * 1000) / 10;
}

/** 75% markup (×1.75) is a 42.9% margin, not a 75% margin. */
export function marginFromMarkup(markupPct: number): number {
  return Math.round((markupPct / (100 + markupPct)) * 1000) / 10;
}

/** 42.9% margin is a 75% markup: m / (1 − m). */
export function markupFromMargin(marginPct: number): number {
  if (marginPct >= 100) throw new RangeError("margin must be below 100%");
  return Math.round((marginPct / (100 - marginPct)) * 1000) / 10;
}

/** Splits `totalMinor` across percentage milestones so the parts sum exactly (remainder to the last). */
export function allocateMilestones(
  totalMinor: number,
  milestones: readonly { label: string; pct: number }[]
): { label: string; pct: number; minor: number }[] {
  if (milestones.length === 0) return [];
  const out = milestones.map((m) => ({
    label: m.label,
    pct: m.pct,
    minor: Math.floor((totalMinor * m.pct) / 100),
  }));
  const allocated = out.reduce((n, m) => n + m.minor, 0);
  out[out.length - 1] = {
    ...out[out.length - 1],
    minor: out[out.length - 1].minor + (totalMinor - allocated),
  };
  return out;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as object))
      deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

export function snapshotPolicy(policy: CommercialPolicy): PolicySnapshot {
  const roleRates: Record<string, number> = {};
  for (const r of policy.roleRates) roleRates[r.id] = r.loadedMinorPerHour;
  return {
    id: policy.id,
    effectiveDate: policy.effectiveDate,
    state: policy.state,
    targetMarginPct: policy.targetMarginPct,
    minMarginPct: policy.minMarginPct,
    targetRunMarginPct: policy.targetRunMarginPct,
    minRunMarginPct: policy.minRunMarginPct,
    roundingIncrementMinor: policy.roundingIncrementMinor,
    runRoundingIncrementMinor: policy.runRoundingIncrementMinor,
    approvalThresholdMinor: policy.approvalThresholdMinor,
    contingencyMethod: policy.contingencyMethod,
    warrantyReserveRule: policy.warrantyReserveRule,
    roleRates,
  };
}

/* ── BUILD ───────────────────────────────────────────────────────────────── */

type UnknownItem = { label: string; reason: string };

function collectBuildUnknowns(
  input: EstimateInput,
  policy: CommercialPolicy
): UnknownItem[] {
  const out: UnknownItem[] = [];
  for (const f of input.facts)
    if (f.material && !isKnown(f.value))
      out.push({ label: f.label, reason: f.value.reason });
  for (const p of input.packages) {
    if (!isKnown(p.hours))
      out.push({ label: `${p.name} — hours`, reason: p.hours.reason });
    else if (!roleRate(policy, p.roleId))
      out.push({
        label: `${p.name} — role rate`,
        reason: `No loaded rate for role "${p.roleId}" in ${policy.id}`,
      });
  }
  if (!isKnown(input.contractors))
    out.push({ label: "Contractors", reason: input.contractors.reason });
  if (!isKnown(input.attributableProjectCosts))
    out.push({
      label: "Attributable project costs",
      reason: input.attributableProjectCosts.reason,
    });
  return out;
}

function scenario(
  name: ScenarioName,
  input: EstimateInput,
  policy: CommercialPolicy
): Scenario {
  const packages: PackageCost[] = input.packages.map((p) => {
    if (!isKnown(p.hours)) throw new Error("scenario() called with unknown hours");
    const rate = roleRate(policy, p.roleId);
    if (!rate) throw new Error(`scenario() called with unknown role ${p.roleId}`);
    const hours = p.hours.value[name];
    const labourMinor = Math.round(hours * rate.loadedMinorPerHour);
    return {
      packageId: p.id,
      name: p.name,
      roleId: p.roleId,
      hours,
      rateMinorPerHour: rate.loadedMinorPerHour,
      labourMinor,
      externalMinor: p.externalCosts.minor,
      totalMinor: labourMinor + p.externalCosts.minor,
    };
  });
  const hours = packages.reduce((n, p) => n + p.hours, 0);
  const labourMinor = packages.reduce((n, p) => n + p.labourMinor, 0);
  const externalMinor = packages.reduce((n, p) => n + p.externalMinor, 0);
  const contractorsMinor = isKnown(input.contractors) ? input.contractors.value.minor : 0;
  const attributableProjectCostsMinor = isKnown(input.attributableProjectCosts)
    ? input.attributableProjectCosts.value.minor
    : 0;
  const baseDeliveryCostMinor =
    labourMinor + externalMinor + contractorsMinor + attributableProjectCostsMinor;
  const contingencyMinor = Math.ceil(
    (baseDeliveryCostMinor * input.contingencyPct) / 100
  );
  const warrantyCovered = input.packages.some((p) => p.coversWarranty);
  const warrantyReserveMinor = warrantyCovered ? 0 : input.warrantyReserve.minor;
  const riskAdjustedDeliveryCostMinor =
    baseDeliveryCostMinor + contingencyMinor + warrantyReserveMinor;
  const floorExactMinor = priceForMargin(
    riskAdjustedDeliveryCostMinor,
    policy.minMarginPct
  );
  const targetExactMinor = priceForMargin(
    riskAdjustedDeliveryCostMinor,
    policy.targetMarginPct
  );
  return {
    name,
    hours,
    packages,
    labourMinor,
    externalMinor,
    contractorsMinor,
    attributableProjectCostsMinor,
    baseDeliveryCostMinor,
    contingencyMinor,
    warrantyReserveMinor,
    riskAdjustedDeliveryCostMinor,
    floorExactMinor,
    targetExactMinor,
    floorMinor: ceilToIncrement(floorExactMinor, policy.roundingIncrementMinor),
    targetMinor: ceilToIncrement(targetExactMinor, policy.roundingIncrementMinor),
  };
}

function drivers(base: Scenario, input: EstimateInput): CostDriver[] {
  const total = base.riskAdjustedDeliveryCostMinor;
  const share = (minor: number) =>
    total > 0 ? Math.round((minor / total) * 1000) / 10 : 0;
  const out: CostDriver[] = base.packages.map((p) => ({
    label: p.name,
    kind: "package" as const,
    minor: p.labourMinor,
    sharePct: share(p.labourMinor),
    explanation: `${p.hours} h × ${p.roleId} loaded rate`,
  }));
  if (base.externalMinor > 0)
    out.push({
      label: "Package external costs",
      kind: "external",
      minor: base.externalMinor,
      sharePct: share(base.externalMinor),
      explanation: "Third-party costs attributed to packages",
    });
  if (base.contractorsMinor > 0)
    out.push({
      label: "Contractors",
      kind: "contractors",
      minor: base.contractorsMinor,
      sharePct: share(base.contractorsMinor),
      explanation: "Contractors not tied to one package",
    });
  if (base.attributableProjectCostsMinor > 0)
    out.push({
      label: "Attributable project costs",
      kind: "project_costs",
      minor: base.attributableProjectCostsMinor,
      sharePct: share(base.attributableProjectCostsMinor),
      explanation: "Licences, devices, travel",
    });
  out.push({
    label: `Contingency ${input.contingencyPct}%`,
    kind: "contingency",
    minor: base.contingencyMinor,
    sharePct: share(base.contingencyMinor),
    explanation: "Residual delivery risk not covered by any package estimate",
  });
  out.push({
    label: "Warranty reserve",
    kind: "warranty",
    minor: base.warrantyReserveMinor,
    sharePct: share(base.warrantyReserveMinor),
    explanation:
      base.warrantyReserveMinor === 0 && input.warrantyReserve.minor > 0
        ? "Not added: a work package already covers the warranty period"
        : "Provision for covered defects after acceptance",
  });
  return out.sort((a, b) => b.minor - a.minor);
}

function contribution(
  input: EstimateInput,
  estimatedCostMinor: number
): Contribution | null {
  if (!isKnown(input.selling.listPrice)) return null;
  const listPriceMinor = input.selling.listPrice.value.minor;
  const discountsMinor = input.selling.discounts.reduce((n, d) => n + d.amount.minor, 0);
  const netSellingPriceMinor = Math.max(0, listPriceMinor - discountsMinor);
  const contributionMinor = netSellingPriceMinor - estimatedCostMinor;
  return {
    netSellingPriceMinor,
    listPriceMinor,
    discountsMinor,
    estimatedCostMinor,
    contributionMinor,
    marginPct: marginPctOf(netSellingPriceMinor, estimatedCostMinor),
    beforeDiscounts: {
      contributionMinor: listPriceMinor - estimatedCostMinor,
      marginPct: marginPctOf(listPriceMinor, estimatedCostMinor),
    },
  };
}

function overallConfidence(
  input: EstimateInput,
  spreadPct: number,
  policy: CommercialPolicy
): Confidence {
  if (spreadPct > policy.maxSpreadPct) return "low";
  const order: Confidence[] = ["low", "medium", "high"];
  let worst: Confidence = "high";
  for (const p of input.packages)
    if (order.indexOf(p.confidence) < order.indexOf(worst)) worst = p.confidence;
  return worst;
}

function build(
  input: EstimateInput,
  policy: CommercialPolicy
): { build: BuildOutput; confidence: Confidence | "insufficient" } {
  const unknowns = collectBuildUnknowns(input, policy);
  if (unknowns.length > 0) {
    return {
      confidence: "insufficient",
      build: {
        state: "insufficient_confidence",
        currency: input.currency,
        unknowns,
        requirement:
          "Paid discovery or a reviewed provisional estimate is required before a Build price is shown",
        scenarios: null,
        milestones: input.build.milestones.map((m) => ({ label: m.label, pct: m.pct })),
        validityDays: input.build.validityDays,
      },
    };
  }
  const low = scenario("low", input, policy);
  const base = scenario("base", input, policy);
  const high = scenario("high", input, policy);
  const spreadPct =
    base.riskAdjustedDeliveryCostMinor > 0
      ? Math.round(
          ((high.riskAdjustedDeliveryCostMinor - low.riskAdjustedDeliveryCostMinor) /
            base.riskAdjustedDeliveryCostMinor) *
            1000
        ) / 10
      : 0;
  const contrib = contribution(input, base.riskAdjustedDeliveryCostMinor);
  const approvedNetMinor =
    contrib && input.selling.approvedBy ? contrib.netSellingPriceMinor : null;
  const escalate = base.targetMinor > policy.approvalThresholdMinor;
  return {
    confidence: overallConfidence(input, spreadPct, policy),
    build: {
      state: "priced",
      currency: input.currency,
      scenarios: { low, base, high },
      drivers: drivers(base, input),
      internalEstimateMinor: base.riskAdjustedDeliveryCostMinor,
      floorMinor: base.floorMinor,
      targetMinor: base.targetMinor,
      recommendedMinor: base.targetMinor,
      approvedNetMinor,
      contribution: contrib,
      milestones: allocateMilestones(
        contrib?.netSellingPriceMinor ?? 0,
        input.build.milestones
      ),
      validityDays: input.build.validityDays,
      escalation: {
        required: escalate,
        reason: escalate
          ? `Target exceeds the review threshold; escalated for review, not capped`
          : "Within the review threshold",
      },
      spreadPct,
    },
  };
}

/* ── RUN ─────────────────────────────────────────────────────────────────── */

function run(input: EstimateInput, policy: CommercialPolicy): RunOutput {
  const unknowns: UnknownItem[] = [];
  const lines: RunOutput["lines"][number][] = [];
  let fixed = 0;
  let usage = 0;
  let clientDirect = 0;
  for (const line of input.run.costToServe) {
    let monthly: Maybe<number>;
    let payer: RunOutput["lines"][number]["payer"] = "nullshift";
    if (line.kind === "money") {
      payer = line.payer;
      monthly = isKnown(line.monthly)
        ? { known: true, value: line.monthly.value.minor }
        : line.monthly;
    } else {
      const rate = roleRate(policy, line.roleId);
      if (!rate)
        monthly = { known: false, reason: `No loaded rate for role "${line.roleId}"` };
      else if (!isKnown(line.hoursPerMonth)) monthly = line.hoursPerMonth;
      else
        monthly = {
          known: true,
          value: Math.round(line.hoursPerMonth.value * rate.loadedMinorPerHour),
        };
    }
    lines.push({
      id: line.id,
      name: line.name,
      category: line.category,
      sensitivity: line.sensitivity,
      payer,
      monthly,
    });
    if (!isKnown(monthly)) {
      unknowns.push({ label: line.name, reason: monthly.reason });
      continue;
    }
    if (payer === "client_direct") clientDirect += monthly.value;
    else if (line.sensitivity === "usage") usage += monthly.value;
    else fixed += monthly.value;
  }
  // No lines at all means the recurring costs are MISSING, not zero: totals stay null.
  const complete = unknowns.length === 0 && lines.length > 0;
  const total = complete ? fixed + usage : null;
  const deferred = !isKnown(input.run.packageChoice);
  const floor =
    total === null
      ? null
      : ceilToIncrement(
          priceForMargin(total, policy.minRunMarginPct),
          policy.runRoundingIncrementMinor
        );
  const target =
    total === null
      ? null
      : ceilToIncrement(
          priceForMargin(total, policy.targetRunMarginPct),
          policy.runRoundingIncrementMinor
        );
  const statement =
    input.run.route === "independent"
      ? "Independent handover: no recurring service; the handover fee is a separate confirmed decision with tax basis pending"
      : input.run.route === "unresolved"
        ? "Service route not yet elected; no recurring amount is proposed"
        : deferred
          ? "Managed route elected; the package and its monthly price are deferred to a service schedule — no chargeable amount is manufactured"
          : `Managed route with the ${catalogueById(input.run.packageChoice.value)?.name ?? input.run.packageChoice.value} candidate package (draft catalogue); recommendation only until issued, accepted and activated separately`;
  return {
    route: input.run.route,
    stage: input.run.stage,
    currency: input.currency,
    packageChoice: input.run.packageChoice,
    lines,
    monthlyCostToServeMinor: total,
    fixedMinor: complete ? fixed : null,
    usageSensitiveMinor: complete ? usage : null,
    clientDirectMinor: complete ? clientDirect : null,
    floorMinor: floor,
    targetMinor: target,
    unknowns,
    usageLimits: input.run.usageLimits,
    deferred,
    statement,
  };
}

/* ── GROW / TRANSACT ─────────────────────────────────────────────────────── */

function grow(input: EstimateInput): GrowOutput {
  return input.grow.map((g) => {
    const c = catalogueById(g.catalogueItemId);
    return {
      catalogueItemId: g.catalogueItemId,
      name: c?.name ?? g.catalogueItemId,
      basis: c ? basisLabel(c.basis) : "unknown basis",
      fromMinor: c?.fromMinor ?? null,
      toMinor: c?.toMinor ?? null,
      state: "draft" as const,
      ...(g.note ? { note: g.note } : {}),
    };
  });
}

function transact(input: EstimateInput): TransactOutput {
  const t = input.transact;
  const feeKnown = isKnown(t.feeBps) && isKnown(t.applicable) && t.applicable.value;
  const scenarios =
    feeKnown && isKnown(t.feeBps)
      ? t.volumeScenarios.map((s) => ({
          label: s.label,
          monthlyVolumeMinor: s.monthlyVolume.minor,
          feeMinor: Math.floor(
            (s.monthlyVolume.minor * (t.feeBps as { value: number }).value) / 10_000
          ),
          note: "scenario, not earned revenue" as const,
        }))
      : [];
  const statement = !isKnown(t.applicable)
    ? `Unknown — ${t.applicable.reason}`
    : !t.applicable.value
      ? "Not applicable — no client payment platform fee in this project"
      : !isKnown(t.feeBps)
        ? `Applicable; fee not yet agreed — ${t.feeBps.reason}`
        : `Application fee ${t.feeBps.value} bps, separately agreed; processor fees ${t.processorFeesSeparate ? "separate" : "NOT separated (review)"}`;
  return {
    applicable: t.applicable,
    feeBps: t.feeBps,
    processorFeesSeparate: t.processorFeesSeparate,
    chargeArchitecture: t.chargeArchitecture ?? "Not specified",
    scenarios,
    countsTowardsContribution: false,
    statement,
  };
}

/* ── Entry point ─────────────────────────────────────────────────────────── */

export function calculateEstimate(
  input: EstimateInput,
  policy: CommercialPolicy
): EstimateResult {
  if (input.currency !== policy.currency)
    throw new RangeError(
      `Currency ${input.currency} does not match policy currency ${policy.currency}; no conversion policy exists`
    );
  const b = build(input, policy);
  const r = run(input, policy);
  const result: EstimateResult = {
    inputId: input.id,
    currency: input.currency,
    policy: snapshotPolicy(policy),
    confidence: b.confidence,
    discoveryRequired: b.confidence === "insufficient" || b.confidence === "low",
    build: b.build,
    run: r,
    grow: grow(input),
    transact: transact(input),
  };
  return deepFreeze(result);
}
