/**
 * Estimator fixtures: the adapter from the Quote Studio fixture shape
 * (`@/lib/next/fixtures` — read-only; never edited here) to an EstimateInput,
 * plus fictional cost-to-serve lines. Fixture only; no database.
 */
import type { Quote } from "@/lib/next/fixtures";
import type { CommercialPolicy } from "./policy";
import type { CostToServeLine, EstimateInput, Fact, WorkPackage } from "./types";
import { known, money, unknown } from "./types";

const ROLE_BY_FIXTURE: Readonly<Record<string, string>> = {
  Lead: "lead",
  Engineer: "engineer",
  Designer: "designer",
};

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** Fictional recurring cost-to-serve per fixture client (managed route only). */
const COST_TO_SERVE: Readonly<Record<string, readonly CostToServeLine[]>> = {
  northline: [
    {
      kind: "money",
      id: "hosting",
      name: "Hosting and compute",
      category: "infrastructure",
      monthly: known(money(2_800)),
      sensitivity: "fixed",
      payer: "nullshift",
    },
    {
      kind: "money",
      id: "database",
      name: "Database and storage",
      category: "database_storage",
      monthly: known(money(1_500)),
      sensitivity: "fixed",
      payer: "nullshift",
    },
    {
      kind: "money",
      id: "email",
      name: "Transactional email",
      category: "messaging",
      monthly: known(money(600)),
      sensitivity: "usage",
      payer: "nullshift",
      note: "~400 bookings/month",
    },
    {
      kind: "money",
      id: "monitoring",
      name: "Monitoring and backups",
      category: "monitoring_backups",
      monthly: known(money(400)),
      sensitivity: "fixed",
      payer: "nullshift",
    },
    {
      kind: "money",
      id: "payments",
      name: "Payment processor account",
      category: "apis_ai",
      monthly: known(money(0)),
      sensitivity: "usage",
      payer: "client_direct",
      note: "Client pays the processor directly",
    },
    {
      kind: "labour",
      id: "support",
      name: "Support and maintenance labour",
      category: "support_labour",
      hoursPerMonth: known(1.5),
      roleId: "support",
      sensitivity: "fixed",
    },
    {
      kind: "money",
      id: "operating",
      name: "Allocated operating costs",
      category: "allocated_operating",
      monthly: known(money(1_000)),
      sensitivity: "fixed",
      payer: "nullshift",
    },
    {
      kind: "money",
      id: "risk",
      name: "Operating risk reserve",
      category: "risk_provision",
      monthly: known(money(800)),
      sensitivity: "fixed",
      payer: "nullshift",
    },
  ],
};

const GROW_BY_NAME: Readonly<Record<string, string>> = {
  "Team training session": "team-training",
  "Branded walkthrough videos (pack of five)": "video-pack-five",
};

export function estimateInputFromQuote(
  q: Quote,
  policy: CommercialPolicy
): EstimateInput {
  const lowConfidence = q.brief.confidence === "low";
  const packages: WorkPackage[] = q.estimate.packages.map((p) => {
    const roleId = ROLE_BY_FIXTURE[p.role];
    const unknownRole = !roleId;
    return {
      id: slug(p.name),
      name: p.name,
      roleId: roleId ?? "unknown",
      owner: p.role,
      hours: unknownRole
        ? unknown(
            `Blended "${p.role}" role has no loaded rate and the scope is provisional`
          )
        : known({ low: p.low, base: p.base, high: p.high }),
      externalCosts: money(0),
      assumptions: [],
      source: "Fixture estimate",
      confidence: q.brief.confidence,
    };
  });
  const facts: Fact[] = [
    {
      key: "users",
      label: "Users and volumes",
      value: known(q.brief.users),
      material: true,
    },
    {
      key: "migration",
      label: "Migration volume and quality",
      value: /unknown/i.test(q.brief.constraints)
        ? unknown(q.brief.constraints)
        : known(q.scope.included.find((s) => /import|migration/i.test(s)) ?? "None"),
      material: true,
    },
    {
      key: "deadline",
      label: "Deadline",
      value: known(q.brief.constraints),
      material: false,
    },
  ];
  const approved = q.internal.approvedPriceGbp > 0 && q.internal.approver !== "—";
  return {
    id: q.id,
    currency: "GBP",
    policyId: policy.id,
    facts,
    packages,
    contractors: known(money(0)),
    attributableProjectCosts: known(money(0)),
    contingencyPct: q.estimate.contingencyPct,
    warrantyReserve: money(q.estimate.warrantyReserveGbp * 100),
    build: {
      milestones: q.commercial.milestones,
      validityDays: policy.quoteValidityDays,
      exclusions: q.scope.excluded,
      assumptions: [q.brief.constraints],
      acceptanceCriteria: q.scope.acceptance,
      optionalDiscoveryItemId: lowConfidence ? "paid-discovery" : undefined,
    },
    selling: {
      listPrice: approved
        ? known(money(q.internal.approvedPriceGbp * 100))
        : unknown("No price proposed yet"),
      discounts: [],
      approvedBy: approved ? q.internal.approver : undefined,
      overrideReason: q.internal.overrideReason,
    },
    run: {
      route: q.commercial.route,
      stage: "recommendation",
      packageChoice: unknown("Package to be agreed after build acceptance"),
      costToServe:
        q.commercial.route === "managed" ? (COST_TO_SERVE[q.clientId] ?? []) : [],
      usageLimits:
        q.commercial.route === "managed"
          ? [
              "Email: 2,000 messages/month included (draft)",
              "Storage: 5 GB included (draft)",
            ]
          : [],
    },
    grow: q.commercial.growOptions.map((g) => ({
      catalogueItemId: GROW_BY_NAME[g.name] ?? slug(g.name),
    })),
    transact: {
      applicable: /not applicable/i.test(q.commercial.transact)
        ? known(false)
        : /unknown/i.test(q.commercial.transact)
          ? unknown("Payment flows not yet described")
          : known(true),
      feeBps: unknown("Not agreed"),
      processorFeesSeparate: true,
      volumeScenarios: [],
    },
  };
}
