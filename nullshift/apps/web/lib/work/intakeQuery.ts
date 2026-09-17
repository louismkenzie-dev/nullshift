/**
 * Reads the intake page's "what-if" GET form. With `q=1` present the facts and
 * entitlements come from the query string (checkbox present = true); otherwise
 * the selected fixture request is used untouched. Pure; no I/O.
 */
import type { Entitlements, RequestFacts } from "./classify";
import type { IntakeRequest } from "./intakeFixtures";

export type SearchParams = Record<string, string | string[] | undefined>;

export const FACT_KEYS: Record<keyof RequestFacts, string> = {
  existingCapability: "f_existing",
  reproducibleFailure: "f_failure",
  newCapability: "f_new",
  assistance: "f_assist",
  routineMaintenance: "f_maint",
  contentOrTraining: "f_content",
  dataOrIntegration: "f_data",
  transaction: "f_txn",
  ownDeliverableFailure: "f_own",
  urgent: "f_urgent",
};

export const FACT_LABELS: Record<keyof RequestFacts, string> = {
  existingCapability: "Concerns a capability in accepted, implemented scope",
  reproducibleFailure: "That capability reproducibly fails to perform as agreed",
  newCapability: "Asks for a new or materially changed capability",
  assistance: "Assistance using the existing system within its design",
  routineMaintenance: "Routine security / dependency / compatibility task",
  contentOrTraining: "Content, training or consulting (outside the software)",
  dataOrIntegration: "Migration, new connection, rollout or extra operational scope",
  transaction: "Concerns the agreed percentage-fee model",
  ownDeliverableFailure: "Corrects Nullshift's own failed contracted deliverable",
  urgent: "Urgent: service down or materially degraded now",
};

export const ENT_BOOL_KEYS = {
  managedActive: "e_managed",
  warrantyActive: "e_warranty",
  warrantyExpired: "e_expired",
  expresslyIncluded: "e_included",
  evidenceSufficient: "e_evidence",
  feeScheduleAccepted: "e_fee",
} as const;

export const ENT_LABELS: Record<keyof typeof ENT_BOOL_KEYS, string> = {
  managedActive: "Accepted Run / Managed Platform schedule in force",
  warrantyActive: "Build warranty in force for the affected version",
  warrantyExpired: "A build warranty existed and has expired",
  expresslyIncluded: "Governing agreement expressly includes this class",
  evidenceSufficient: "Evidence sufficient (reproduction, agreed behaviour, version)",
  feeScheduleAccepted: "Accepted percentage-fee schedule for this connected account",
};

export const ENT_TEXT_KEYS = {
  managedAgreement: "e_managed_ref",
  warrantyAgreement: "e_warranty_ref",
  feeScheduleAgreement: "e_fee_ref",
} as const;

export type IntakeQuery = {
  fromQuery: boolean;
  requestId: string;
  title: string;
  description: string;
  clientLabel: string;
  facts: RequestFacts;
  entitlements: Entitlements;
  /** Next-action what-if fields. */
  nextAction: { text: string; owner: string; dueAt: string; asked: boolean };
};

const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const on = (sp: SearchParams, key: string): boolean => {
  const v = first(sp[key]);
  return v === "1" || v === "on" || v === "true";
};

const text = (sp: SearchParams, key: string, max = 600): string =>
  (first(sp[key]) ?? "").toString().slice(0, max);

export function readIntakeQuery(sp: SearchParams, fallback: IntakeRequest): IntakeQuery {
  const fromQuery = on(sp, "q");
  const nextAction = {
    asked: on(sp, "na"),
    text: text(sp, "na_text", 280),
    owner: text(sp, "na_owner", 80),
    dueAt: text(sp, "na_due", 10),
  };

  if (!fromQuery) {
    return {
      fromQuery: false,
      requestId: fallback.id,
      title: fallback.title,
      description: fallback.description,
      clientLabel: fallback.clientLabel,
      facts: { ...fallback.facts },
      entitlements: { ...fallback.entitlements },
      nextAction,
    };
  }

  const facts: RequestFacts = {};
  for (const k of Object.keys(FACT_KEYS) as (keyof RequestFacts)[]) {
    if (on(sp, FACT_KEYS[k])) facts[k] = true;
  }
  const entitlements: Entitlements = {
    managedActive: on(sp, ENT_BOOL_KEYS.managedActive),
    managedAgreement: text(sp, ENT_TEXT_KEYS.managedAgreement, 120) || null,
    warrantyActive: on(sp, ENT_BOOL_KEYS.warrantyActive),
    warrantyAgreement: text(sp, ENT_TEXT_KEYS.warrantyAgreement, 120) || null,
    warrantyExpired: on(sp, ENT_BOOL_KEYS.warrantyExpired),
    expresslyIncluded: on(sp, ENT_BOOL_KEYS.expresslyIncluded),
    evidenceSufficient: on(sp, ENT_BOOL_KEYS.evidenceSufficient),
    ownDeliverableFailure: facts.ownDeliverableFailure === true,
    feeScheduleAccepted: on(sp, ENT_BOOL_KEYS.feeScheduleAccepted),
    feeScheduleAgreement: text(sp, ENT_TEXT_KEYS.feeScheduleAgreement, 120) || null,
  };

  return {
    fromQuery: true,
    requestId: fallback.id,
    title: text(sp, "title", 200) || fallback.title,
    description: text(sp, "description", 1000),
    clientLabel: text(sp, "label", 40),
    facts,
    entitlements,
    nextAction,
  };
}
