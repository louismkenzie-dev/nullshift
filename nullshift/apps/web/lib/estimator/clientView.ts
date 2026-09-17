/**
 * Client-facing projection of an estimate (brief §6.6 last bullets).
 *
 * Contains no internal rates, hours, costs, floors, targets or margins. Totals
 * keep tax, one-off, recurring, usage and percentage fees separate. A deferred
 * run package is stated as deferred; no chargeable amount is manufactured.
 */
import type { EstimateInput, EstimateResult } from "./types";
import { isKnown } from "./types";

export type ClientView = {
  readonly currency: string;
  readonly build: {
    readonly priced: boolean;
    readonly priceMinor: number | null;
    readonly milestones: readonly {
      readonly label: string;
      readonly pct: number;
      readonly minor: number;
    }[];
    readonly exclusions: readonly string[];
    readonly assumptions: readonly string[];
    readonly acceptanceCriteria: readonly string[];
    readonly validityDays: number;
    readonly statement: string;
  };
  readonly run: { readonly statement: string; readonly usageLimits: readonly string[] };
  readonly grow: readonly {
    readonly name: string;
    readonly basis: string;
    readonly fromMinor: number | null;
    readonly label: "draft suggestion";
  }[];
  readonly transact: { readonly statement: string };
  readonly totals: {
    readonly oneOffMinor: number | null;
    readonly recurringMonthlyMinor: number | null;
    readonly usageBasis: readonly string[];
    readonly percentageFeesBps: readonly number[];
    readonly taxMinor: null;
    readonly taxNote: "Tax basis: decision pending; amounts exclude tax";
  };
};

export function toClientView(result: EstimateResult, input: EstimateInput): ClientView {
  const b = result.build;
  const priced = b.state === "priced" && b.approvedNetMinor !== null;
  const priceMinor = priced && b.state === "priced" ? b.approvedNetMinor : null;
  return {
    currency: result.currency,
    build: {
      priced,
      priceMinor,
      milestones: priced && b.state === "priced" ? b.milestones : [],
      exclusions: input.build.exclusions,
      assumptions: input.build.assumptions,
      acceptanceCriteria: input.build.acceptanceCriteria,
      validityDays: input.build.validityDays,
      statement: priced
        ? "Fixed scoped Build price for the included deliverables"
        : b.state === "insufficient_confidence"
          ? "No Build price yet: a discovery phase or reviewed provisional estimate is needed first"
          : "Build price awaiting approval",
    },
    run: { statement: result.run.statement, usageLimits: result.run.usageLimits },
    grow: result.grow.map((g) => ({
      name: g.name,
      basis: g.basis,
      fromMinor: g.fromMinor,
      label: "draft suggestion" as const,
    })),
    transact: { statement: result.transact.statement },
    totals: {
      oneOffMinor: priceMinor,
      recurringMonthlyMinor: null, // never manufactured: set only from an issued schedule, not from the estimator
      usageBasis: result.grow
        .filter((g) => /usage/.test(g.basis))
        .map((g) => `${g.name}: ${g.basis}`),
      percentageFeesBps:
        isKnown(result.transact.feeBps) &&
        isKnown(result.transact.applicable) &&
        result.transact.applicable.value
          ? [result.transact.feeBps.value]
          : [],
      taxMinor: null,
      taxNote: "Tax basis: decision pending; amounts exclude tax",
    },
  };
}
