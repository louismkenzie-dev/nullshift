/**
 * Commercial review controls (brief §6.4).
 *
 * Severity
 * - "block":  the estimate cannot be approved to issue until resolved.
 * - "review": a named person must look (escalation, override, draft policy).
 * - "info":   shown so nothing is hidden (discount effect, draft catalogue).
 *
 * Large estimates escalate; they are never capped. A zero selling price is
 * reported as "no price", never as an invalid margin.
 */
import type { CommercialPolicy } from "./policy";
import { HANDOVER_FEE, catalogueById } from "./catalogue";
import type { EstimateInput, EstimateResult } from "./types";
import { isKnown } from "./types";

export type Severity = "block" | "review" | "info";

export type ValidationIssue = {
  readonly code: string;
  readonly severity: Severity;
  readonly message: string;
  /** Where the number came from or what it does to contribution. */
  readonly effect?: string;
};

const finiteNonNeg = (n: number): boolean => Number.isFinite(n) && n >= 0;
const isMinor = (n: number): boolean => finiteNonNeg(n) && Number.isInteger(n);

export function validatePolicy(policy: CommercialPolicy): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const pair = (label: string, min: number, target: number) => {
    if (
      !finiteNonNeg(min) ||
      !finiteNonNeg(target) ||
      !(min <= target) ||
      !(target < 100)
    )
      out.push({
        code: "policy_margin_range",
        severity: "block",
        message: `${label}: margins must satisfy 0 ≤ minimum (${min}) ≤ target (${target}) < 100`,
      });
  };
  pair("Build", policy.minMarginPct, policy.targetMarginPct);
  pair("Run", policy.minRunMarginPct, policy.targetRunMarginPct);
  if (!isMinor(policy.roundingIncrementMinor) || policy.roundingIncrementMinor === 0)
    out.push({
      code: "policy_increment",
      severity: "block",
      message: "Build rounding increment must be a positive integer of minor units",
    });
  if (
    !isMinor(policy.runRoundingIncrementMinor) ||
    policy.runRoundingIncrementMinor === 0
  )
    out.push({
      code: "policy_increment",
      severity: "block",
      message: "Run rounding increment must be a positive integer of minor units",
    });
  if (!isMinor(policy.approvalThresholdMinor))
    out.push({
      code: "policy_threshold",
      severity: "block",
      message: "Approval threshold must be a nonnegative integer of minor units",
    });
  for (const r of policy.roleRates)
    if (!isMinor(r.loadedMinorPerHour))
      out.push({
        code: "policy_rate",
        severity: "block",
        message: `Role rate ${r.id} must be a nonnegative integer of minor units per hour`,
      });
  if (policy.state === "draft")
    out.push({
      code: "policy_draft",
      severity: "review",
      message: `${policy.id} is a draft policy (effective ${policy.effectiveDate}); no real offer can be issued from it`,
    });
  return out;
}

export function validateInput(input: EstimateInput): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const money = (label: string, minor: number) => {
    if (!isMinor(minor))
      out.push({
        code: "value_nonneg_finite",
        severity: "block",
        message: `${label} must be a finite, nonnegative integer of minor units (got ${minor})`,
      });
  };
  for (const p of input.packages) {
    if (isKnown(p.hours)) {
      const { low, base, high } = p.hours.value;
      for (const [k, v] of Object.entries({ low, base, high }))
        if (!finiteNonNeg(v))
          out.push({
            code: "value_nonneg_finite",
            severity: "block",
            message: `${p.name}: ${k} hours must be finite and nonnegative`,
          });
      if (!(low <= base && base <= high))
        out.push({
          code: "range_order",
          severity: "block",
          message: `${p.name}: hours must satisfy low (${low}) ≤ base (${base}) ≤ high (${high})`,
        });
    }
    money(`${p.name} external costs`, p.externalCosts.minor);
    if (p.externalCosts.currency !== input.currency)
      out.push({
        code: "currency_mismatch",
        severity: "block",
        message: `${p.name}: external costs in ${p.externalCosts.currency}; estimate is ${input.currency} and no conversion policy exists`,
      });
  }
  if (isKnown(input.contractors)) money("Contractors", input.contractors.value.minor);
  if (isKnown(input.attributableProjectCosts))
    money("Attributable project costs", input.attributableProjectCosts.value.minor);
  if (!finiteNonNeg(input.contingencyPct) || input.contingencyPct >= 100)
    out.push({
      code: "value_nonneg_finite",
      severity: "block",
      message: "Contingency must be a finite percentage in [0, 100)",
    });
  money("Warranty reserve", input.warrantyReserve.minor);
  const warrantyPackages = input.packages.filter((p) => p.coversWarranty).length;
  if (warrantyPackages > 1)
    out.push({
      code: "warranty_double_count",
      severity: "block",
      message:
        "More than one work package claims to cover warranty; warranty must be counted once",
    });
  if (isKnown(input.selling.listPrice))
    money("List price", input.selling.listPrice.value.minor);
  for (const d of input.selling.discounts) {
    money(`Discount "${d.label}"`, d.amount.minor);
    if (!d.reason.trim())
      out.push({
        code: "discount_reason",
        severity: "block",
        message: `Discount "${d.label}" has no reason`,
      });
  }
  const pctSum = input.build.milestones.reduce((n, m) => n + m.pct, 0);
  if (input.build.milestones.length > 0 && pctSum !== 100)
    out.push({
      code: "milestones_sum",
      severity: "block",
      message: `Milestone percentages sum to ${pctSum}, not 100`,
    });
  for (const line of input.run.costToServe) {
    if (line.kind === "money") {
      if (isKnown(line.monthly))
        money(`Cost-to-serve "${line.name}"`, line.monthly.value.minor);
    } else if (isKnown(line.hoursPerMonth) && !finiteNonNeg(line.hoursPerMonth.value))
      out.push({
        code: "value_nonneg_finite",
        severity: "block",
        message: `Cost-to-serve "${line.name}": hours must be finite and nonnegative`,
      });
  }
  if (isKnown(input.transact.feeBps) && !isMinor(input.transact.feeBps.value))
    out.push({
      code: "value_nonneg_finite",
      severity: "block",
      message: "Application fee must be a nonnegative integer of basis points",
    });
  for (const g of input.grow)
    if (!catalogueById(g.catalogueItemId))
      out.push({
        code: "catalogue_unknown_item",
        severity: "block",
        message: `Grow item "${g.catalogueItemId}" is not in the catalogue`,
      });
  return out;
}

export function validateResult(
  input: EstimateInput,
  policy: CommercialPolicy,
  result: EstimateResult
): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const b = result.build;
  if (b.state === "insufficient_confidence") {
    out.push({
      code: "insufficient_confidence",
      severity: "block",
      message: `Unknown inputs (${b.unknowns.map((u) => u.label).join("; ")}) are not treated as zero. ${b.requirement}.`,
    });
  } else {
    if (result.confidence === "low")
      out.push({
        code: "excessive_uncertainty",
        severity: "block",
        message: `Scenario spread ${b.spreadPct}% exceeds the policy limit of ${policy.maxSpreadPct}%; paid discovery or a reviewed provisional estimate is required`,
      });
    if (b.escalation.required)
      out.push({
        code: "escalate_large_estimate",
        severity: "review",
        message: `Target ${fmt(b.targetMinor)} exceeds the review threshold ${fmt(policy.approvalThresholdMinor)}; escalated for review, not capped`,
      });
    const c = b.contribution;
    if (!c) {
      out.push({
        code: "no_price_proposed",
        severity: "review",
        message:
          "No selling price proposed yet; floor and target are internal until a price is put forward",
      });
    } else {
      if (c.netSellingPriceMinor === 0)
        out.push({
          code: "zero_price",
          severity: "review",
          message:
            "Net selling price is zero: contribution margin is undefined (not an error); nothing can be issued at zero without approval",
        });
      if (c.netSellingPriceMinor < b.floorMinor) {
        const hasApprover = Boolean(input.selling.approvedBy?.trim());
        const hasReason = Boolean(input.selling.overrideReason?.trim());
        if (hasApprover && hasReason)
          out.push({
            code: "below_floor_override",
            severity: "review",
            message: `Net price ${fmt(c.netSellingPriceMinor)} is below the floor ${fmt(b.floorMinor)}; overridden by ${input.selling.approvedBy} — ${input.selling.overrideReason}`,
            effect: `Forecast margin ${c.marginPct ?? "undefined"}% vs minimum ${policy.minMarginPct}%`,
          });
        else
          out.push({
            code: "below_floor",
            severity: "block",
            message: `Net price ${fmt(c.netSellingPriceMinor)} is below the floor ${fmt(b.floorMinor)} (${policy.minMarginPct}% minimum margin); an authorised approver and a reason are required`,
            effect: `Missing: ${[!hasApprover && "approver", !hasReason && "reason"].filter(Boolean).join(" and ")}`,
          });
      } else if (c.netSellingPriceMinor < b.targetMinor) {
        out.push({
          code: "below_target",
          severity: "info",
          message: `Net price ${fmt(c.netSellingPriceMinor)} is above the floor but below the target ${fmt(b.targetMinor)}`,
          effect: `Forecast margin ${c.marginPct}% vs target ${policy.targetMarginPct}%`,
        });
      }
      if (c.discountsMinor > 0)
        out.push({
          code: "discount_effect",
          severity: "info",
          message: `Discounts of ${fmt(c.discountsMinor)} reduce forecast contribution from ${fmt(c.beforeDiscounts.contributionMinor)} to ${fmt(c.contributionMinor)}`,
          effect: `Margin ${pct(c.beforeDiscounts.marginPct)} → ${pct(c.marginPct)}`,
        });
      if (input.selling.overrideReason && c.netSellingPriceMinor >= b.floorMinor)
        out.push({
          code: "override_unneeded",
          severity: "info",
          message:
            "An override reason is recorded although the price is at or above the floor",
        });
    }
  }
  const r = result.run;
  if (r.route === "managed") {
    if (r.lines.length === 0)
      out.push({
        code: "missing_costs",
        severity: "block",
        message:
          "Managed route with no cost-to-serve lines: recurring costs are missing, not zero",
      });
    else if (r.unknowns.length > 0)
      out.push({
        code: "run_unknown",
        severity: "block",
        message: `Cost-to-serve has Unknown lines (${r.unknowns.map((u) => u.label).join("; ")}); no run floor can be shown`,
      });
    if (r.deferred)
      out.push({
        code: "run_package_deferred",
        severity: "info",
        message:
          "Package choice deferred: the client document says so explicitly and no monthly amount is manufactured",
      });
    else if (isKnown(r.packageChoice) && r.targetMinor !== null) {
      const c = catalogueById(r.packageChoice.value);
      if (
        c?.fromMinor !== null &&
        c?.fromMinor !== undefined &&
        r.floorMinor !== null &&
        c.fromMinor < r.floorMinor
      )
        out.push({
          code: "run_package_below_floor",
          severity: "block",
          message: `${c.name} draft price ${fmt(c.fromMinor)}/month is below the run floor ${fmt(r.floorMinor)}/month`,
          effect:
            "Draft catalogue price fails this client's cost-to-serve; re-evaluate before any offer",
        });
    }
  }
  if (r.route === "independent")
    out.push({
      code: "handover_tax_pending",
      severity: "block",
      message: `Independent handover fee ${fmt(HANDOVER_FEE.minor)} is confirmed but its tax basis, payment timing and scope are pending; issuance is blocked`,
    });
  if (result.grow.length > 0)
    out.push({
      code: "catalogue_draft",
      severity: "info",
      message: `${result.grow.length} Grow item(s) come from the draft, non-chargeable catalogue; "from" amounts are minimums, not guarantees`,
    });
  if (result.transact.scenarios.length > 0)
    out.push({
      code: "transact_speculative",
      severity: "info",
      message:
        "Application-fee volume figures are scenarios, not earned revenue, and are excluded from contribution",
    });
  if (
    isKnown(result.transact.applicable) &&
    result.transact.applicable.value &&
    !result.transact.processorFeesSeparate
  )
    out.push({
      code: "processor_fees_mixed",
      severity: "block",
      message: "Processor fees must be separated from the application fee",
    });
  return out;
}

/** All §6.4 controls for one estimate. Deterministic and ordered: policy, input, then result. */
export function validateEstimate(
  input: EstimateInput,
  policy: CommercialPolicy,
  result: EstimateResult
): ValidationIssue[] {
  return [
    ...validatePolicy(policy),
    ...validateInput(input),
    ...validateResult(input, policy, result),
  ];
}

export const hasBlockers = (issues: readonly ValidationIssue[]): boolean =>
  issues.some((i) => i.severity === "block");
export const needsReview = (issues: readonly ValidationIssue[]): boolean =>
  issues.some((i) => i.severity === "review");

function fmt(minor: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}
function pct(p: number | null): string {
  return p === null ? "undefined" : `${p}%`;
}
