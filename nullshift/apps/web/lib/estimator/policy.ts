/**
 * Commercial policy (brief §6.1 "Commercial policy", §6.4 versioning).
 *
 * A policy is versioned, dated and either draft or published. The estimator
 * copies the policy it was given into the result as an immutable snapshot, so
 * publishing a new policy changes NEW assessments only; an existing result keeps
 * the numbers it was computed with.
 *
 * Every constant here is a HYPOTHETICAL PLACEHOLDER (brief §2.2, decision 18.2).
 * Nothing in this file is an approved rate, margin or threshold.
 */

export type PolicyState = "draft" | "published";

export type ContingencyMethod = "percent_of_base_delivery_cost";
export type WarrantyReserveRule = "explicit_reserve_unless_covered_by_work_package";

export type RoleRate = {
  readonly id: string;
  readonly label: string;
  /** Loaded internal cost per hour, integer minor units. Internal only; never a sales rate. */
  readonly loadedMinorPerHour: number;
  readonly note: string;
};

export type CommercialPolicy = {
  readonly id: string;
  readonly effectiveDate: string; // ISO date
  readonly state: PolicyState;
  readonly currency: "GBP";
  readonly targetMarginPct: number;
  readonly minMarginPct: number;
  readonly targetRunMarginPct: number;
  readonly minRunMarginPct: number;
  /** Build floors and targets round UP to this increment. */
  readonly roundingIncrementMinor: number;
  /** Monthly run floors and targets round UP to this increment. */
  readonly runRoundingIncrementMinor: number;
  /** Targets above this escalate for review. There is no cap. */
  readonly approvalThresholdMinor: number;
  /** Scenario spread (high−low)/base above this is "excessive uncertainty". */
  readonly maxSpreadPct: number;
  readonly contingencyMethod: ContingencyMethod;
  readonly warrantyReserveRule: WarrantyReserveRule;
  readonly quoteValidityDays: number;
  readonly roleRates: readonly RoleRate[];
  readonly notes: readonly string[];
};

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/** The one seeded policy. Draft: it cannot back a real offer until published. */
export const POLICY_2026_09_DRAFT: CommercialPolicy = deepFreeze({
  id: "POLICY_2026_09_DRAFT",
  effectiveDate: "2026-09-17",
  state: "draft",
  currency: "GBP",
  targetMarginPct: 50,
  minMarginPct: 40,
  targetRunMarginPct: 60,
  minRunMarginPct: 50,
  roundingIncrementMinor: 10_000, // £100
  runRoundingIncrementMinor: 500, // £5
  approvalThresholdMinor: 2_500_000, // £25,000 target escalates for review; never capped
  maxSpreadPct: 60,
  contingencyMethod: "percent_of_base_delivery_cost",
  warrantyReserveRule: "explicit_reserve_unless_covered_by_work_package",
  quoteValidityDays: 30,
  roleRates: [
    {
      id: "lead",
      label: "Lead (design, review, PM)",
      loadedMinorPerHour: 6_000,
      note: "Hypothetical placeholder — not an approved rate",
    },
    {
      id: "engineer",
      label: "Engineer",
      loadedMinorPerHour: 4_500,
      note: "Hypothetical placeholder — not an approved rate",
    },
    {
      id: "designer",
      label: "UI / brand designer",
      loadedMinorPerHour: 5_000,
      note: "Hypothetical placeholder — not an approved rate",
    },
    {
      id: "support",
      label: "Support and maintenance",
      loadedMinorPerHour: 4_000,
      note: "Hypothetical placeholder — not an approved rate",
    },
  ],
  notes: [
    "All rates, margins, thresholds and increments are hypothetical (brief §2.2; decision 18.2).",
    "Contribution excludes allocated overhead unless a cost-to-serve line includes it; it is not net profit.",
    "Warranty reserve is counted once: skipped when a work package already covers warranty.",
  ],
});

export const POLICIES: readonly CommercialPolicy[] = Object.freeze([
  POLICY_2026_09_DRAFT,
]);

export const policyById = (id: string): CommercialPolicy | undefined =>
  POLICIES.find((p) => p.id === id);

export const roleRate = (
  policy: CommercialPolicy,
  roleId: string
): RoleRate | undefined => policy.roleRates.find((r) => r.id === roleId);
