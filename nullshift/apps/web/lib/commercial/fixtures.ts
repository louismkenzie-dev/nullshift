/**
 * Fixture quote versions for the /admin/next/quotes listing while
 * `commercialV2` is off. Names and ids are borrowed from lib/next/fixtures.ts
 * (never edited here) so the Studio links resolve; the rows are shaped like
 * the 0057 listing so the page renders one way for both sources.
 *
 * All values are fictional and in integer minor units. Not an approved price
 * list (brief §6.5).
 */
import { QUOTES } from "@/lib/next/fixtures";
import type {
  OpportunityRow,
  QuoteRow,
  QuoteVersionListItem,
  QuoteVersionRow,
  QuoteVersionStatus,
} from "./types";

const T0 = "2026-09-16T14:02:00.000Z";

function opportunity(
  id: string,
  legalName: string,
  stage: OpportunityRow["stage"]
): OpportunityRow {
  return {
    id: `opp-${id}`,
    tenant_id: null,
    legal_name: legalName,
    trading_name: null,
    contact_name: null,
    contact_email: `${id}@example.test`,
    contact_phone: null,
    stage,
    owner: "Louis",
    next_action: null,
    next_action_due: null,
    probability_pct: null,
    source: "fixture",
    decision_rationale: null,
    created_by: null,
    created_at: T0,
    updated_at: T0,
  };
}

function quote(
  id: string,
  opportunityId: string,
  project: string,
  current: string | null
): QuoteRow {
  return {
    id: `quote-${id}`,
    opportunity_id: opportunityId,
    tenant_id: null,
    project_label: project,
    current_version_id: current,
    created_at: T0,
    updated_at: T0,
  };
}

function version(
  id: string,
  quoteId: string,
  no: number,
  status: QuoteVersionStatus,
  buildPriceMinor: number,
  extra: Partial<QuoteVersionRow> = {}
): QuoteVersionRow {
  return {
    id,
    quote_id: quoteId,
    version_no: no,
    status,
    currency: "GBP",
    expires_at: null,
    brief: {},
    scope: {},
    estimate: {},
    commercial: { build_price_minor: buildPriceMinor, route: "unresolved" },
    internal: {},
    policy_version: "policy-draft-2026-09",
    formula_version: "formula-draft-1",
    author: null,
    issued_at: null,
    accepted_at: null,
    superseded_by: null,
    created_at: T0,
    updated_at: T0,
    ...extra,
  };
}

const byId = new Map(QUOTES.map((q) => [q.id, q]));
const northline = byId.get("q-northline-v2");
const atlas = byId.get("q-atlas-v1");

const oppNorthline = opportunity(
  "northline",
  northline?.client ?? "Northline Studios Ltd",
  "quote_in_review"
);
const oppAtlas = opportunity(
  "atlas",
  atlas?.client ?? "Atlas Operations Ltd",
  "discovery"
);

const quoteNorthline = quote(
  "northline",
  oppNorthline.id,
  northline?.project ?? "Studio bookings platform",
  "q-northline-v1"
);
const quoteAtlas = quote(
  "atlas",
  oppAtlas.id,
  atlas?.project ?? "Operations platform (multi-site)",
  null
);

/** Listing rows, newest version first per quote. */
export const FIXTURE_QUOTE_VERSIONS: QuoteVersionListItem[] = [
  {
    version: version(
      "q-northline-v2",
      quoteNorthline.id,
      2,
      "internal_review",
      1_480_000,
      {
        updated_at: "2026-09-16T14:02:00.000Z",
        internal: {
          risk_adjusted_cost_minor: 690_000,
          min_margin_pct: 40,
          target_margin_pct: 50,
          approved_price_minor: 1_480_000,
          approver: "—",
          checks: [],
        },
      }
    ),
    quote: quoteNorthline,
    opportunity: oppNorthline,
  },
  {
    version: version("q-northline-v1", quoteNorthline.id, 1, "superseded", 1_480_000, {
      issued_at: "2026-08-28T09:00:00.000Z",
      accepted_at: "2026-09-02T10:30:00.000Z",
      expires_at: "2026-09-27T09:00:00.000Z",
      superseded_by: "q-northline-v2",
      updated_at: "2026-09-16T09:15:00.000Z",
    }),
    quote: quoteNorthline,
    opportunity: oppNorthline,
  },
  {
    version: version("q-atlas-v1", quoteAtlas.id, 1, "draft", 0, {
      updated_at: "2026-09-17T11:40:00.000Z",
    }),
    quote: quoteAtlas,
    opportunity: oppAtlas,
  },
];

/** Ids that have a Quote Studio fixture page behind them. */
export const FIXTURE_STUDIO_IDS: ReadonlySet<string> = new Set(QUOTES.map((q) => q.id));
