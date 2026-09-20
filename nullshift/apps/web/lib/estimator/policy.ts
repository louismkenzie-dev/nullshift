/**
 * Commercial policy (brief §6.1 "Commercial policy", §6.4 versioning).
 *
 * A policy is versioned, dated and either draft or published. The estimator
 * copies the policy it was given into the result as an immutable snapshot, so
 * publishing a new policy changes NEW assessments only; an existing result keeps
 * the numbers it was computed with.
 *
 * POLICY_2026_09_v1 is PUBLISHED (owner decision, 20 Sep 2026): its run-price
 * bases are the approved NSI_v2 from-prices (Core £149 / Pro £249 / Max £399).
 * The role rates, margins and thresholds remain the working figures carried
 * over from the draft; they are marked as such on each line.
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

/** Monthly run-package bases in minor units, keyed by the NSI plan id. */
export type RunPackageBases = Readonly<{ core: number; pro: number; max: number }>;

/**
 * The published monthly from-prices for the three managed tiers, in pence.
 * MUST equal BASE_PLAN_PRICE in lib/pricing/nsi.ts × 100 — a test pins it.
 */
export const RUN_PACKAGE_BASE_MINOR: RunPackageBases = Object.freeze({
  core: 14_900,
  pro: 24_900,
  max: 39_900,
});

export type CommercialPolicy = {
  readonly id: string;
  readonly effectiveDate: string; // ISO date
  readonly state: PolicyState;
  readonly currency: "GBP";
  /** Monthly from-prices the managed tiers are quoted from (minor units). */
  readonly runPackageBaseMinor: RunPackageBases;
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

/** The published policy: the quoting model for every NEW client from 20 Sep 2026. */
export const POLICY_2026_09_v1: CommercialPolicy = deepFreeze({
  id: "POLICY_2026_09_v1",
  effectiveDate: "2026-09-20",
  state: "published",
  currency: "GBP",
  runPackageBaseMinor: RUN_PACKAGE_BASE_MINOR,
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
      note: "Working figure carried over from the draft — review before relying on it",
    },
    {
      id: "engineer",
      label: "Engineer",
      loadedMinorPerHour: 4_500,
      note: "Working figure carried over from the draft — review before relying on it",
    },
    {
      id: "designer",
      label: "UI / brand designer",
      loadedMinorPerHour: 5_000,
      note: "Working figure carried over from the draft — review before relying on it",
    },
    {
      id: "support",
      label: "Support and maintenance",
      loadedMinorPerHour: 4_000,
      note: "Working figure carried over from the draft — review before relying on it",
    },
  ],
  notes: [
    "Run-package bases are the published NSI_v2 from-prices: Core £149, Pro £249, Max £399 per month, scaled by the client's band.",
    "Role rates, margins, thresholds and increments are working figures carried over from the September draft.",
    "Contribution excludes allocated overhead unless a cost-to-serve line includes it; it is not net profit.",
    "Warranty reserve is counted once: skipped when a work package already covers warranty.",
  ],
});

/**
 * @deprecated The draft was promoted in place. Kept so existing imports and
 * stored policy ids keep resolving; new code should name POLICY_2026_09_v1.
 */
export const POLICY_2026_09_DRAFT = POLICY_2026_09_v1;
/** The draft's id, still accepted by policyById() for results stored under it. */
export const POLICY_2026_09_DRAFT_ID = "POLICY_2026_09_DRAFT";

export const POLICIES: readonly CommercialPolicy[] = Object.freeze([POLICY_2026_09_v1]);

/** The policy every new estimate is priced under. */
export const CURRENT_POLICY: CommercialPolicy = POLICY_2026_09_v1;

export const policyById = (id: string): CommercialPolicy | undefined =>
  POLICIES.find((p) => p.id === id) ??
  (id === POLICY_2026_09_DRAFT_ID ? POLICY_2026_09_v1 : undefined);

export const roleRate = (
  policy: CommercialPolicy,
  roleId: string
): RoleRate | undefined => policy.roleRates.find((r) => r.id === roleId);
