/**
 * Guided result → the persisted quote version's content (0057 jsonb payloads).
 * Pure. The Studio re-prices the saved packages with the same policy on every
 * load, so what is written here must reproduce the guided numbers: role labels
 * are the Studio's ("Lead" / "Engineer" / "Designer"), contingency and warranty
 * reserve are copied across, and the constraints line avoids the word
 * "unknown" that the fixture adapter reads as a material Unknown.
 */
import type { QuoteVersionContent } from "@/lib/commercial/types";
import {
  DEFAULT_MILESTONES,
  constraintsLine,
  includedLines,
  runStateFor,
  usersLine,
  type GuidedInput,
  type GuidedResult,
} from "./guided";
import type { CommercialPolicy } from "./policy";
import { CURRENT_POLICY } from "./policy";

export function guidedQuoteContent(
  input: GuidedInput,
  result: GuidedResult,
  policy: CommercialPolicy = CURRENT_POLICY
): QuoteVersionContent {
  const outcomes = includedLines(input);
  return {
    brief: {
      outcomes: outcomes.length ? outcomes : ["Scope to be agreed"],
      users: usersLine(input),
      constraints: constraintsLine(input),
      confidence: result.confidence,
    },
    scope: {
      included: outcomes,
      excluded: [
        "Content writing and photography",
        "Third-party subscription fees (paid by the client directly)",
        "Anything not listed above",
      ],
      acceptance: [],
    },
    estimate: {
      packages: result.build.drivers.map((d) => ({
        name: d.label,
        low: d.hours.low,
        base: d.hours.base,
        high: d.hours.high,
        role: d.role,
      })),
      contingency_pct: result.build.contingencyPct,
      warranty_reserve_minor: result.build.warrantyReserveMinor,
    },
    commercial: {
      build_price_minor: result.build.recommendedMinor,
      milestones: DEFAULT_MILESTONES.map((m) => ({ ...m })),
      route: "managed",
      run_state: runStateFor(result),
      grow_options: [],
      transact:
        input.features.includes("payments") || input.features.includes("memberships")
          ? "Applicable; application fee not yet agreed. Processor fees separate."
          : "Not applicable — no client payment platform fee in this project",
    },
    internal: {
      risk_adjusted_cost_minor: result.estimateResult.build.state === "priced"
        ? result.estimateResult.build.internalEstimateMinor
        : 0,
      min_margin_pct: policy.minMarginPct,
      target_margin_pct: policy.targetMarginPct,
      approved_price_minor: 0,
      approver: "—",
      checks: [],
      guided_input: input,
    },
  };
}
