/**
 * FICTIONAL DEMO DATA for the delivery slice (acceptance, checklists,
 * handover). Nothing here is a real client, a real price or an approved price
 * list; the £600 independent handover fee carries the tax basis "pending
 * decision" (decision 18.3). Ids are fixed UUIDs that can never collide with a
 * live row by accident (they start with `f1c7`). Names come from
 * `@/lib/next/fixtures` (read only); that module is never edited from here.
 */

import { clientById } from "@/lib/next/fixtures";
import type { BuildAcceptance, DeliverableEvidence } from "./types";
import {
  generateInitialChecklist,
  generateLaterChecklist,
  generateHandoverChecklist,
} from "./checklists";

export const FIXTURE_IDS = {
  tenants: {
    northline: "f1c70000-0000-4000-8000-000000000001",
    harbour: "f1c70000-0000-4000-8000-000000000002",
    orbit: "f1c70000-0000-4000-8000-000000000003",
  },
  projects: {
    northline: "f1c70000-0000-4000-8000-000000000101",
    harbour: "f1c70000-0000-4000-8000-000000000102",
    orbit: "f1c70000-0000-4000-8000-000000000103",
  },
  arrangements: {
    orbit: "f1c70000-0000-4000-8000-000000000203",
  },
  users: {
    harbourSignatory: "f1c70000-0000-4000-8000-000000000301",
  },
} as const;

export const FIXTURE_SCOPE = {
  northline: "order_form:OF-FX-2026-0011",
  harbour: "order_form:OF-FX-2026-0007",
  orbit: "order_form:OF-FX-2026-0003",
} as const;

const named = (id: string) => clientById(id)?.legalName ?? id;

export const FIXTURE_DELIVERABLES: DeliverableEvidence[] = [
  {
    deliverable: "Booking flow with deposit capture",
    criteria: "A customer can book, pay a deposit and receive a confirmation email.",
    met: true,
    evidence: "Test bookings BK-1041–BK-1046 on the review environment",
    client_comment: "Works on phone and desktop.",
  },
  {
    deliverable: "Staff rota and availability",
    criteria: "Staff can set availability; bookings respect it.",
    met: true,
    evidence: "Rota screen walkthrough 22 Sep",
    client_comment: "",
  },
  {
    deliverable: "Customer reminders",
    criteria: "24-hour and 2-hour reminders send by email and SMS.",
    met: false,
    evidence: "SMS reminder not received in test run 3",
    client_comment: "Email works; SMS does not.",
  },
];

/** Harbour (fixture): clean acceptance by the signatory through the portal. */
export const FIXTURE_ACCEPTANCE_HARBOUR: BuildAcceptance = {
  id: "f1c70000-0000-4000-8000-000000000401",
  tenant_id: FIXTURE_IDS.tenants.harbour,
  project_id: FIXTURE_IDS.projects.harbour,
  scope_version_ref: FIXTURE_SCOPE.harbour,
  accepted_by_user: FIXTURE_IDS.users.harbourSignatory,
  accepted_by_name: `Signatory, ${named("harbour")}`,
  accepted_role: "client_signatory",
  method: "portal",
  accepted_at: "2026-09-10T14:05:00Z",
  evidence: FIXTURE_DELIVERABLES.map((d) => ({ ...d, met: true, client_comment: "" })),
  partial: false,
  disputed: false,
  defects_outstanding: [],
  notes: null,
  recorded_by: null,
};

/** Northline (fixture): accepted with exceptions — SMS reminders outstanding. */
export const FIXTURE_ACCEPTANCE_NORTHLINE_PARTIAL: BuildAcceptance = {
  id: "f1c70000-0000-4000-8000-000000000402",
  tenant_id: FIXTURE_IDS.tenants.northline,
  project_id: FIXTURE_IDS.projects.northline,
  scope_version_ref: FIXTURE_SCOPE.northline,
  accepted_by_user: null,
  accepted_by_name: `Signatory, ${named("northline")}`,
  accepted_role: "staff",
  method: "email",
  accepted_at: "2026-09-16T09:30:00Z",
  evidence: FIXTURE_DELIVERABLES,
  partial: true,
  disputed: false,
  defects_outstanding: [
    {
      ref: "D1",
      summary: "SMS reminders not sending from the review environment",
      owner: "nullshift",
    },
  ],
  notes:
    "Accepted with exceptions by email from the signatory on 16 Sep; email ref FX-MAIL-2211.",
  recorded_by: "f1c70000-0000-4000-8000-000000000999",
};

export const FIXTURE_INITIAL_NORTHLINE = generateInitialChecklist({
  projectId: FIXTURE_IDS.projects.northline,
  tenantId: FIXTURE_IDS.tenants.northline,
  companyDetailsSubmitted: true,
  agreementAccepted: true,
  depositPaid: true,
  assetsProvided: true,
  kickoffConfirmed: true,
});

export const FIXTURE_LATER_NORTHLINE = generateLaterChecklist({
  projectId: FIXTURE_IDS.projects.northline,
  tenantId: FIXTURE_IDS.tenants.northline,
  route: "managed",
  buildAccepted: false,
  buildAcceptedPartial: true,
});

export const FIXTURE_LATER_HARBOUR = generateLaterChecklist({
  projectId: FIXTURE_IDS.projects.harbour,
  tenantId: FIXTURE_IDS.tenants.harbour,
  route: "managed",
  buildAccepted: true,
  scheduleAccepted: true,
  mandateAuthorised: true,
  activated: false,
});

export const FIXTURE_LATER_ORBIT = generateLaterChecklist({
  projectId: FIXTURE_IDS.projects.orbit,
  tenantId: FIXTURE_IDS.tenants.orbit,
  arrangementId: FIXTURE_IDS.arrangements.orbit,
  route: "independent",
  buildAccepted: true,
});

export const FIXTURE_HANDOVER_ORBIT = generateHandoverChecklist({
  tenantId: FIXTURE_IDS.tenants.orbit,
  arrangementId: FIXTURE_IDS.arrangements.orbit,
  hasApplicationFee: false,
});

/** The £600 independent handover fee, as a fixture: amount fixed, tax basis pending. */
export const FIXTURE_HANDOVER_FEE = {
  amountMinor: 60000,
  currency: "GBP" as const,
  taxBasis: "pending decision" as const,
  status: "draft / sandbox — not an approved price list",
};
