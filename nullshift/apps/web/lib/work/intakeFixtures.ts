/**
 * Fixtures for the work-intake prototype page (/admin/next/delivery/intake).
 *
 * Fictional clients only (names/ids from lib/next/fixtures.ts, never edited
 * here). Nothing in this module reads a database. Every request below is a
 * deliberately hard §7 case: the label disagrees with the facts, warranty
 * without Run, expired warranty, our own failed deliverable, a mixed request,
 * an urgent covered incident, a fee-schedule query.
 */
import { clientById } from "@/lib/next/fixtures";
import {
  coverageFor,
  planLinkedItems,
  suggestClassification,
  type ClassificationSuggestion,
  type CoverageResult,
  type Entitlements,
  type LinkedItemPlan,
  type RequestFacts,
} from "./classify";
import type { NextActionRow } from "@/lib/nextActions/model";

const clientName = (id: string): string => clientById(id)?.legalName ?? id;

/**
 * Fixture tenant ids in UUID form so the next-action model's validation runs
 * against them in the what-if. They exist in no database.
 */
export const FIXTURE_TENANT_IDS: Record<string, string> = {
  northline: "00000000-0000-4000-8000-00000000a001",
  harbour: "00000000-0000-4000-8000-00000000a002",
  cedar: "00000000-0000-4000-8000-00000000a003",
  orbit: "00000000-0000-4000-8000-00000000a004",
  morrow: "00000000-0000-4000-8000-00000000a005",
  fieldstone: "00000000-0000-4000-8000-00000000a006",
  atlas: "00000000-0000-4000-8000-00000000a009",
  legacy: "00000000-0000-4000-8000-00000000a008",
};

export const fixtureClientForTenant = (tenantId: string): string | undefined =>
  Object.entries(FIXTURE_TENANT_IDS).find(([, v]) => v === tenantId)?.[0];

export type IntakeRequest = {
  id: string;
  clientId: string;
  client: string;
  title: string;
  description: string;
  clientLabel: string;
  facts: RequestFacts;
  entitlements: Entitlements;
  /** Why this case is in the fixture set. */
  lesson: string;
  receivedAt: string;
  via: "portal" | "email" | "phone" | "monitor";
};

const base = (
  id: string,
  clientId: string,
  rest: Omit<IntakeRequest, "id" | "clientId" | "client">
): IntakeRequest => ({ id, clientId, client: clientName(clientId), ...rest });

export const INTAKE_REQUESTS: IntakeRequest[] = [
  base("req-harbour-12", "harbour", {
    title: "Waiver PDF fails to generate for groups over 12",
    description:
      "Since Tuesday any booking with more than 12 people shows 'could not generate' when we click Download waiver. Smaller groups work.",
    clientLabel: "bug",
    facts: { existingCapability: true, reproducibleFailure: true },
    entitlements: {
      managedActive: false,
      warrantyActive: true,
      warrantyAgreement: "Order Form v1 · build warranty to 9 Nov 2026",
      evidenceSufficient: true,
    },
    lesson: "Warranty applies without Run: no Managed schedule, still included.",
    receivedAt: "16 Sep 2026",
    via: "portal",
  }),
  base("req-morrow-33", "morrow", {
    title: "Booking page doesn't let customers choose a specific table",
    description:
      "Customers keep asking to pick the window tables. The booking form has no way to do it, which is a bug for us.",
    clientLabel: "bug",
    facts: { newCapability: true },
    entitlements: {
      managedActive: true,
      managedAgreement: "Service schedule v1 · Core",
      warrantyActive: false,
      evidenceSufficient: true,
    },
    lesson: "Called a bug, is a feature: table selection was never in accepted scope.",
    receivedAt: "15 Sep 2026",
    via: "email",
  }),
  base("req-legacy-05", "legacy", {
    title: "Change the invoice so the totals add up",
    description:
      "Line items total £412 but the invoice footer says £418. Please change the footer calculation.",
    clientLabel: "change",
    facts: { existingCapability: true, reproducibleFailure: true },
    entitlements: {
      managedActive: false,
      warrantyActive: false,
      warrantyExpired: true,
      evidenceSufficient: true,
    },
    lesson:
      "Called a change, is a defect; but the warranty has expired and there is no Run — needs review, not free support.",
    receivedAt: "14 Sep 2026",
    via: "email",
  }),
  base("req-cedar-09", "cedar", {
    title: "How do we export job sheets to CSV?",
    description: "Is there a way to get last month's job sheets into a spreadsheet?",
    clientLabel: "question",
    facts: { existingCapability: true, assistance: true },
    entitlements: {
      managedActive: false,
      warrantyActive: true,
      warrantyAgreement: "Order Form v1 · build warranty",
      evidenceSufficient: true,
    },
    lesson: "Warranty covers defects, not assistance; without Run this needs review.",
    receivedAt: "16 Sep 2026",
    via: "portal",
  }),
  base("req-orbit-06", "orbit", {
    title: "Imported course prices are 10% out",
    description:
      "The migration you ran imported every course at the pre-April price. We need the current list re-imported.",
    clientLabel: "request",
    facts: { dataOrIntegration: true, ownDeliverableFailure: true },
    entitlements: {
      managedActive: false,
      warrantyActive: true,
      warrantyAgreement: "Order Form v1 · scope item 7 (data migration)",
      evidenceSufficient: true,
      ownDeliverableFailure: true,
    },
    lesson:
      "Correcting Nullshift's own failed contracted migration is not a new charge because the category is data.",
    receivedAt: "13 Sep 2026",
    via: "phone",
  }),
  base("req-morrow-31", "morrow", {
    title: "Runtime deprecation notice from hosting provider",
    description: "Provider email: Node 20 runtime retired on 30 Sep 2026.",
    clientLabel: "—",
    facts: { routineMaintenance: true },
    entitlements: {
      managedActive: true,
      managedAgreement: "Service schedule v1 · Core",
      warrantyActive: false,
      evidenceSufficient: true,
    },
    lesson: "Routine compatibility work included under Run.",
    receivedAt: "12 Sep 2026",
    via: "monitor",
  }),
  base("req-atlas-02", "atlas", {
    title: "Import legacy job data from four spreadsheets",
    description: "Part of the build as far as we are concerned.",
    clientLabel: "part of the build",
    facts: { dataOrIntegration: true },
    entitlements: {
      managedActive: false,
      warrantyActive: false,
      evidenceSufficient: false,
    },
    lesson: "No accepted scope yet: volume unknown, coverage cannot be decided.",
    receivedAt: "11 Sep 2026",
    via: "email",
  }),
  base("req-fieldstone-18", "fieldstone", {
    title: "Application fee on last payout looks different from the schedule",
    description: "Payout of 9 Sep shows 2.4%; schedule says 2%.",
    clientLabel: "billing query",
    facts: { transaction: true },
    entitlements: {
      managedActive: true,
      managedAgreement: "Service schedule v1 · Pro",
      warrantyActive: false,
      evidenceSufficient: true,
      feeScheduleAccepted: true,
      feeScheduleAgreement: "Order Form v1 · fee schedule 2.00%",
    },
    lesson:
      "Transaction queries go to Finance under the accepted fee schedule, not through Run/Grow.",
    receivedAt: "10 Sep 2026",
    via: "portal",
  }),
  base("req-northline-21", "northline", {
    title: "Checkout returns 500 for every customer since 09:40",
    description: "No one can pay. Started after the provider's outage notice.",
    clientLabel: "urgent",
    facts: { existingCapability: true, reproducibleFailure: true, urgent: true },
    entitlements: {
      managedActive: true,
      managedAgreement: "Service schedule v1 · Pro",
      warrantyActive: true,
      warrantyAgreement: "Order Form v2 · build warranty",
      evidenceSufficient: true,
    },
    lesson:
      "Urgent covered incident: incident lane, not held behind the open Grow quote for the reporting dashboard.",
    receivedAt: "17 Sep 2026 09:52",
    via: "monitor",
  }),
];

export const intakeRequestById = (id: string): IntakeRequest | undefined =>
  INTAKE_REQUESTS.find((r) => r.id === id);

export type AssessedRequest = IntakeRequest & {
  suggestion: ClassificationSuggestion;
  coverage: CoverageResult;
};

export function assess(r: IntakeRequest): AssessedRequest {
  const suggestion = suggestClassification({
    title: r.title,
    description: r.description,
    clientLabel: r.clientLabel,
    facts: r.facts,
  });
  return {
    ...r,
    suggestion,
    coverage: coverageFor(suggestion.workClass, r.entitlements),
  };
}

/* ── Mixed request (§7 split) ─────────────────────────────────────────── */

export const MIXED_REQUEST: IntakeRequest = base("req-cedar-07", "cedar", {
  title: "Quote PDF shows the wrong VAT line and we want a discount-code field",
  description:
    "Two things: the VAT line on quotes is showing the old rate (that's wrong), and can we add a discount-code box to the quote form?",
  clientLabel: "change",
  facts: { existingCapability: true, reproducibleFailure: true, newCapability: true },
  entitlements: {
    managedActive: false,
    warrantyActive: true,
    warrantyAgreement: "Order Form v1 · build warranty — scope item 5",
    evidenceSufficient: true,
  },
  lesson:
    "Mixed: covered restoration and new capability become linked items; the restoration is never gated on the quote.",
  receivedAt: "15 Sep 2026",
  via: "portal",
});

export function mixedPlan(): LinkedItemPlan {
  const s = suggestClassification({
    title: MIXED_REQUEST.title,
    description: MIXED_REQUEST.description,
    clientLabel: MIXED_REQUEST.clientLabel,
    facts: MIXED_REQUEST.facts,
  });
  const plan = planLinkedItems(MIXED_REQUEST.title, s, MIXED_REQUEST.entitlements);
  if (!plan) throw new Error("fixture: mixed request did not produce a split");
  return plan;
}

/* ── Next-action strip fixtures (§5.4) ────────────────────────────────── */

const T = "2026-09-";
const ts = (d: number, h = 9) =>
  `${T}${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00Z`;

export const NEXT_ACTION_FIXTURES: NextActionRow[] = [
  {
    id: "na-cedar-1",
    tenant_id: FIXTURE_TENANT_IDS.cedar,
    project_id: null,
    text: "Confirm reproduction of the VAT line on staging",
    owner: "Louis",
    owner_user: null,
    due_at: "2026-09-12",
    state: "done",
    source: "manual",
    created_by: null,
    completed_at: ts(12, 16),
    superseded_by_id: null,
    created_at: ts(10),
    updated_at: ts(12, 16),
  },
  {
    id: "na-cedar-2",
    tenant_id: FIXTURE_TENANT_IDS.cedar,
    project_id: null,
    text: "Send Cedar the discount-code quote",
    owner: "Louis",
    owner_user: null,
    due_at: "2026-09-16",
    state: "superseded",
    source: "manual",
    created_by: null,
    completed_at: null,
    superseded_by_id: "na-cedar-3",
    created_at: ts(13),
    updated_at: ts(15, 11),
  },
  {
    id: "na-cedar-3",
    tenant_id: FIXTURE_TENANT_IDS.cedar,
    project_id: null,
    text: "Release VAT-line restoration (wq-cedar-07a), then issue the discount-code quote",
    owner: "Louis",
    owner_user: null,
    due_at: "2026-09-19",
    state: "open",
    source: "manual",
    created_by: null,
    completed_at: null,
    superseded_by_id: null,
    created_at: ts(15, 11),
    updated_at: ts(15, 11),
  },
  {
    id: "na-harbour-1",
    tenant_id: FIXTURE_TENANT_IDS.harbour,
    project_id: null,
    text: "Confirm waiver fix released to production and close req-harbour-12",
    owner: "Unassigned",
    owner_user: null,
    due_at: "2026-09-15",
    state: "open",
    source: "automation:request-submitted",
    created_by: null,
    completed_at: null,
    superseded_by_id: null,
    created_at: ts(16, 8),
    updated_at: ts(16, 8),
  },
];

/** Today, for the fixture's overdue check. Fixed so the page is deterministic. */
export const FIXTURE_TODAY = "2026-09-17";
