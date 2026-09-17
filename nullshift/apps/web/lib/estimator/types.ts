/**
 * Estimator types (brief §6). Pure data — no database, no provider SDKs.
 *
 * Conventions
 * - Money is an integer count of minor units with an explicit currency. Never a
 *   float of pounds.
 * - Anything the business has not told us is `Unknown`, never zero. A material
 *   unknown makes the whole estimate "insufficient confidence" and requires paid
 *   discovery or a reviewed provisional estimate before any price is shown.
 * - Internal estimate, floor, target, recommended price and approved price are
 *   separate fields and are never merged.
 */

export type Currency = "GBP";

export type Money = { readonly minor: number; readonly currency: Currency };

export const money = (minor: number, currency: Currency = "GBP"): Money => ({
  minor,
  currency,
});

/** Unknown is a first-class value: it carries the reason and is never coerced to 0. */
export type Unknown = { readonly known: false; readonly reason: string };
export type Known<T> = { readonly known: true; readonly value: T };
export type Maybe<T> = Known<T> | Unknown;

export const known = <T>(value: T): Known<T> => ({ known: true, value });
export const unknown = (reason: string): Unknown => ({ known: false, reason });
export const isKnown = <T>(m: Maybe<T>): m is Known<T> => m.known;

export type Confidence = "low" | "medium" | "high";

export type HourRange = {
  readonly low: number;
  readonly base: number;
  readonly high: number;
};

/** A delivery work package (§6.1). Internal hours cost the work; they are never sold. */
export type WorkPackage = {
  readonly id: string;
  readonly name: string;
  /** Key into the policy's loaded role rates. */
  readonly roleId: string;
  readonly owner: string;
  readonly hours: Maybe<HourRange>;
  /** Contractor or third-party cost attributable to this package alone. */
  readonly externalCosts: Money;
  readonly assumptions: readonly string[];
  readonly source: string;
  readonly confidence: Confidence;
  /** True when this package already provides the warranty period, so no separate reserve is added. */
  readonly coversWarranty?: boolean;
};

export type CostToServeCategory =
  | "infrastructure"
  | "database_storage"
  | "messaging"
  | "apis_ai"
  | "monitoring_backups"
  | "support_labour"
  | "integration_management"
  | "allocated_operating"
  | "risk_provision";

export type CostSensitivity = "fixed" | "usage";
export type Payer = "nullshift" | "client_direct";

/** One recurring cost-to-serve line. Labour lines cost hours at the policy rate. */
export type CostToServeLine =
  | {
      readonly kind: "money";
      readonly id: string;
      readonly name: string;
      readonly category: CostToServeCategory;
      readonly monthly: Maybe<Money>;
      readonly sensitivity: CostSensitivity;
      readonly payer: Payer;
      readonly note?: string;
    }
  | {
      readonly kind: "labour";
      readonly id: string;
      readonly name: string;
      readonly category: "support_labour" | "integration_management";
      readonly hoursPerMonth: Maybe<number>;
      readonly roleId: string;
      readonly sensitivity: CostSensitivity;
      readonly note?: string;
    };

export type ServiceRoute = "managed" | "independent" | "unresolved";

/** §6.3 RUN: recommendation, issued offer, accepted price and active billing are distinct. */
export type RunStage =
  | "recommendation"
  | "issued_offer"
  | "accepted_price"
  | "active_billing";

export type Discount = {
  readonly label: string;
  readonly amount: Money;
  readonly reason: string;
};

export type Milestone = { readonly label: string; readonly pct: number };

/** A material fact about the business or scope. Unknown material facts block pricing. */
export type Fact = {
  readonly key: string;
  readonly label: string;
  readonly value: Maybe<string | number>;
  readonly material: boolean;
};

export type EstimateInput = {
  readonly id: string;
  readonly currency: Currency;
  readonly policyId: string;
  readonly facts: readonly Fact[];
  readonly packages: readonly WorkPackage[];
  /** Contractors not attributable to a single package. */
  readonly contractors: Maybe<Money>;
  /** Licences, devices, travel and similar project costs. */
  readonly attributableProjectCosts: Maybe<Money>;
  /** Explicit contingency as a percentage of base delivery cost (policy decides method). */
  readonly contingencyPct: number;
  /** Warranty reserve; ignored (counted once) when a package covers warranty. */
  readonly warrantyReserve: Money;
  readonly build: {
    readonly milestones: readonly Milestone[];
    readonly validityDays: number;
    readonly exclusions: readonly string[];
    readonly assumptions: readonly string[];
    readonly acceptanceCriteria: readonly string[];
    readonly optionalDiscoveryItemId?: string;
  };
  readonly selling: {
    /** The price put forward for approval (list, before discounts). Unknown when nothing is proposed. */
    readonly listPrice: Maybe<Money>;
    readonly discounts: readonly Discount[];
    readonly approvedBy?: string;
    readonly overrideReason?: string;
  };
  readonly run: {
    readonly route: ServiceRoute;
    readonly stage: RunStage;
    /** Catalogue package id, or Unknown when the choice is deferred. */
    readonly packageChoice: Maybe<string>;
    readonly costToServe: readonly CostToServeLine[];
    readonly usageLimits: readonly string[];
  };
  readonly grow: readonly { readonly catalogueItemId: string; readonly note?: string }[];
  readonly transact: {
    readonly applicable: Maybe<boolean>;
    /** Application fee in basis points; separately agreed, never derived. */
    readonly feeBps: Maybe<number>;
    readonly processorFeesSeparate: boolean;
    readonly chargeArchitecture?: string;
    readonly volumeScenarios: readonly {
      readonly label: string;
      readonly monthlyVolume: Money;
    }[];
  };
};

/* ── Output ─────────────────────────────────────────────────────────────── */

export type ScenarioName = "low" | "base" | "high";

export type PackageCost = {
  readonly packageId: string;
  readonly name: string;
  readonly roleId: string;
  readonly hours: number;
  readonly rateMinorPerHour: number;
  readonly labourMinor: number;
  readonly externalMinor: number;
  readonly totalMinor: number;
};

export type Scenario = {
  readonly name: ScenarioName;
  readonly hours: number;
  readonly packages: readonly PackageCost[];
  readonly labourMinor: number;
  readonly externalMinor: number;
  readonly contractorsMinor: number;
  readonly attributableProjectCostsMinor: number;
  readonly baseDeliveryCostMinor: number;
  readonly contingencyMinor: number;
  readonly warrantyReserveMinor: number;
  readonly riskAdjustedDeliveryCostMinor: number;
  /** Exact (unrounded) floor and target; the rounded ones are always ≥ these. */
  readonly floorExactMinor: number;
  readonly targetExactMinor: number;
  readonly floorMinor: number;
  readonly targetMinor: number;
};

export type CostDriver = {
  readonly label: string;
  readonly kind:
    | "package"
    | "external"
    | "contingency"
    | "warranty"
    | "contractors"
    | "project_costs";
  readonly minor: number;
  readonly sharePct: number;
  readonly explanation: string;
};

export type Contribution = {
  readonly netSellingPriceMinor: number;
  readonly listPriceMinor: number;
  readonly discountsMinor: number;
  readonly estimatedCostMinor: number;
  readonly contributionMinor: number;
  /** Null when the net selling price is zero: undefined, not invalid. */
  readonly marginPct: number | null;
  /** The same figures before discounts so the discount's effect is visible. */
  readonly beforeDiscounts: {
    readonly contributionMinor: number;
    readonly marginPct: number | null;
  };
};

export type BuildOutput =
  | {
      readonly state: "insufficient_confidence";
      readonly currency: Currency;
      readonly unknowns: readonly { readonly label: string; readonly reason: string }[];
      readonly requirement: string;
      readonly scenarios: null;
      readonly milestones: readonly { readonly label: string; readonly pct: number }[];
      readonly validityDays: number;
    }
  | {
      readonly state: "priced";
      readonly currency: Currency;
      readonly scenarios: Readonly<Record<ScenarioName, Scenario>>;
      readonly drivers: readonly CostDriver[];
      /** Internal estimate = base risk-adjusted delivery cost. Never shown to clients. */
      readonly internalEstimateMinor: number;
      readonly floorMinor: number;
      readonly targetMinor: number;
      readonly recommendedMinor: number;
      readonly approvedNetMinor: number | null;
      readonly contribution: Contribution | null;
      readonly milestones: readonly {
        readonly label: string;
        readonly pct: number;
        readonly minor: number;
      }[];
      readonly validityDays: number;
      readonly escalation: { readonly required: boolean; readonly reason: string };
      readonly spreadPct: number;
    };

export type RunOutput = {
  readonly route: ServiceRoute;
  readonly stage: RunStage;
  readonly currency: Currency;
  readonly packageChoice: Maybe<string>;
  readonly lines: readonly {
    readonly id: string;
    readonly name: string;
    readonly category: CostToServeCategory;
    readonly sensitivity: CostSensitivity;
    readonly payer: Payer;
    readonly monthly: Maybe<number>;
  }[];
  /** Null when any Nullshift-paid line is Unknown. */
  readonly monthlyCostToServeMinor: number | null;
  readonly fixedMinor: number | null;
  readonly usageSensitiveMinor: number | null;
  /** Lines the client pays the provider for directly: listed, not costed to Nullshift. */
  readonly clientDirectMinor: number | null;
  readonly floorMinor: number | null;
  readonly targetMinor: number | null;
  readonly unknowns: readonly { readonly label: string; readonly reason: string }[];
  readonly usageLimits: readonly string[];
  /** True when the package choice is deferred: no chargeable amount is manufactured. */
  readonly deferred: boolean;
  readonly statement: string;
};

export type GrowOutput = readonly {
  readonly catalogueItemId: string;
  readonly name: string;
  readonly basis: string;
  readonly fromMinor: number | null;
  readonly toMinor: number | null;
  readonly state: "draft";
  readonly note?: string;
}[];

export type TransactOutput = {
  readonly applicable: Maybe<boolean>;
  readonly feeBps: Maybe<number>;
  readonly processorFeesSeparate: boolean;
  readonly chargeArchitecture: string;
  readonly scenarios: readonly {
    readonly label: string;
    readonly monthlyVolumeMinor: number;
    readonly feeMinor: number;
    readonly note: "scenario, not earned revenue";
  }[];
  readonly countsTowardsContribution: false;
  readonly statement: string;
};

export type PolicySnapshot = {
  readonly id: string;
  readonly effectiveDate: string;
  readonly state: "draft" | "published";
  readonly targetMarginPct: number;
  readonly minMarginPct: number;
  readonly targetRunMarginPct: number;
  readonly minRunMarginPct: number;
  readonly roundingIncrementMinor: number;
  readonly runRoundingIncrementMinor: number;
  readonly approvalThresholdMinor: number;
  readonly contingencyMethod: string;
  readonly warrantyReserveRule: string;
  readonly roleRates: Readonly<Record<string, number>>;
};

export type EstimateResult = {
  readonly inputId: string;
  readonly currency: Currency;
  readonly policy: PolicySnapshot;
  readonly confidence: Confidence | "insufficient";
  readonly discoveryRequired: boolean;
  readonly build: BuildOutput;
  readonly run: RunOutput;
  readonly grow: GrowOutput;
  readonly transact: TransactOutput;
};
