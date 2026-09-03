import "server-only";

import { legalConfig } from "@nullshift/content/legal/config";
import { currentVersionSet, contentHash } from "@nullshift/content/legal/versions";
import {
  canonicalText,
  ACCEPTABLE_USE,
  AI_SCHEDULE,
  PRIVACY_NOTICE,
  COOKIE_POLICY,
  WEBSITE_TERMS,
} from "@nullshift/content/legal/text";
import {
  SERVICE_TERMS_VERSION,
  SERVICE_TERMS_ACKNOWLEDGEMENTS,
} from "@nullshift/content/serviceTerms";
import {
  orderFormBlockers,
  canSelfServe,
  type Blocker,
  type OrderForm,
  type PaymentArchitecture,
} from "@nullshift/content/legal/acceptance";

/**
 * Order Form ⇄ database plumbing (spec §5, §6, §14).
 *
 * The database stores an Order Form as typed columns plus three JSONB blobs;
 * the validation logic in `@nullshift/content/legal/acceptance` works on a
 * plain object. This module is the single place the two shapes meet, so a
 * blocker can never be missed because one screen read `technical.payment...`
 * and another read the column.
 */

export type OrderFormRow = {
  id: string;
  tenant_id: string;
  project_id: string | null;
  reference: string;
  status:
    | "draft"
    | "client_review"
    | "accepted"
    | "rejected"
    | "withdrawn"
    | "superseded";
  client_legal_name: string;
  client_company_number: string | null;
  client_address: string;
  client_billing_email: string;
  client_legal_email: string;
  plan: "core" | "pro" | "max" | "enterprise";
  scale_band: OrderForm["scaleBand"];
  pricing_version: string;
  monthly_fee: number | string;
  vat_treatment: "plus_vat" | "vat_included" | "not_vat_registered";
  billing_date_rule: string;
  usage_allowance: OrderForm["usageAllowance"] | null;
  project_fee: number | string | null;
  mobilisation_fee: number | string | null;
  invoice_schedule: string[] | null;
  scope: Partial<OrderForm["scope"]> | null;
  technical: Partial<OrderForm["technical"]> | null;
  compliance: Partial<OrderForm["compliance"]> | null;
  payment_architecture: PaymentArchitecture | null;
  payment_review_ref: string | null;
  payment_reviewed_at: string | null;
  portfolio_use: boolean;
  schedule_versions: Record<string, string> | null;
  scale_assessment_id: string | null;
  superseded_by: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  /** Author for the second-person review gate (migration 0030 / 0049). */
  created_by?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
};

const num = (v: number | string | null | undefined): number | undefined =>
  v === null || v === undefined ? undefined : Number(v);

/** DB row → the shape the blocking validations understand. */
export function toOrderForm(row: OrderFormRow): OrderForm {
  const scope = row.scope ?? {};
  const technical = row.technical ?? {};
  const compliance = row.compliance ?? {};
  return {
    id: row.id,
    client: {
      legalName: row.client_legal_name,
      companyNumber: row.client_company_number ?? undefined,
      address: row.client_address,
      billingEmail: row.client_billing_email,
      legalEmail: row.client_legal_email,
    },
    plan: row.plan,
    scaleBand: row.scale_band,
    pricingVersion: row.pricing_version,
    monthlyFeeGbp: Number(row.monthly_fee),
    vatTreatment: row.vat_treatment,
    billingDateRule: row.billing_date_rule,
    usageAllowance: row.usage_allowance ?? undefined,
    projectFeeGbp: num(row.project_fee),
    mobilisationFeeGbp: num(row.mobilisation_fee),
    invoiceSchedule: row.invoice_schedule ?? [],
    scope: {
      businessOutcome: scope.businessOutcome ?? "",
      deliverables: scope.deliverables ?? [],
      included: scope.included ?? [],
      excluded: scope.excluded ?? [],
      acceptanceCriteria: scope.acceptanceCriteria ?? [],
      clientDependencies: scope.clientDependencies ?? [],
      targetWindow: scope.targetWindow,
    },
    technical: {
      ...technical,
      // The column is authoritative; the JSONB copy is a convenience that can
      // drift, and a drifting payment architecture is exactly the thing §14
      // exists to prevent.
      paymentArchitecture: row.payment_architecture ?? undefined,
    },
    compliance: {
      personalData: compliance.personalData ?? false,
      specialCategoryData: compliance.specialCategoryData ?? false,
      childrenLikely: compliance.childrenLikely ?? false,
      territories: compliance.territories ?? [],
      aiFeature: compliance.aiFeature ?? false,
      significantAutomatedDecision: compliance.significantAutomatedDecision ?? false,
      paymentIntegration: compliance.paymentIntegration ?? false,
      accessibilityTarget: compliance.accessibilityTarget,
      sectorRegulation: compliance.sectorRegulation,
    },
    portfolioUse: row.portfolio_use,
    applicableScheduleVersions: row.schedule_versions ?? {},
  };
}

export type ReleaseState = {
  blockers: Blocker[];
  /** Hard blockers only — the ones that stop self-serve acceptance. */
  hardBlockers: Blocker[];
  selfServe: boolean;
  /**
   * §14: a custody architecture blocks production release outright until a
   * regulatory-legal approval reference is manually attached.
   */
  productionBlocked: boolean;
  productionBlockReason: string | null;
};

export function releaseState(row: OrderFormRow): ReleaseState {
  const order = toOrderForm(row);
  const blockers = orderFormBlockers(order);
  const hardBlockers = blockers.filter((b) => b.blocksSelfServe);

  const custody = row.payment_architecture === "nullshift_custody_PROHIBITED";
  const approved = !!row.payment_review_ref?.trim() && !!row.payment_reviewed_at;

  return {
    blockers,
    hardBlockers,
    selfServe: canSelfServe(order),
    productionBlocked: custody && !approved,
    productionBlockReason: custody
      ? approved
        ? null
        : "REGULATORY_PAYMENT_REVIEW_REQUIRED — customer funds would pass through a Nullshift-controlled account. Production release is blocked until a regulatory-legal approval reference is attached."
      : null,
  };
}

/* ── What an acceptance must capture (§5) ──────────────────────── */

export const PAYMENT_ARCHITECTURE_LABEL: Record<PaymentArchitecture, string> = {
  processor_direct_to_client:
    "Processor pays the client directly — Nullshift never touches the money",
  stripe_connect_direct_charge: "Stripe Connect, direct charge to the client's account",
  stripe_connect_destination_charge_reviewed:
    "Stripe Connect, destination charge (reviewed)",
  other_reviewed: "Other architecture, reviewed and documented",
  nullshift_custody_PROHIBITED:
    "Funds received into a Nullshift account — PROHIBITED without regulatory approval",
};

/**
 * The exact documents incorporated into an agreement, with the hash of the
 * wording as it stands right now. Stored on acceptance so the client's
 * signature is tied to words, not to a version string that could be edited.
 */
export function incorporatedDocuments() {
  const v = currentVersionSet();
  return {
    versions: {
      msaVersion: v.msaVersion,
      dpaVersion: v.dpaVersion,
      aiScheduleVersion: v.aiScheduleVersion,
      paymentsScheduleVersion: v.paymentsScheduleVersion,
      aupVersion: v.aupVersion,
      pricingVersion: v.pricingVersion,
    },
    hashes: {
      SERVICE_TERMS: contentHash(
        [SERVICE_TERMS_VERSION, ...SERVICE_TERMS_ACKNOWLEDGEMENTS].join("\n")
      ),
      AUP: contentHash(canonicalText(ACCEPTABLE_USE)),
      AI: contentHash(canonicalText(AI_SCHEDULE)),
      PRIVACY: contentHash(canonicalText(PRIVACY_NOTICE)),
      COOKIES: contentHash(canonicalText(COOKIE_POLICY)),
      WEBSITE_TERMS: contentHash(canonicalText(WEBSITE_TERMS)),
    } as Record<string, string>,
    links: [
      { label: "Service & Support Terms", href: legalConfig.routes.clientServices },
      { label: "Acceptable Use Policy", href: legalConfig.routes.acceptableUse },
      { label: "AI Services Schedule", href: legalConfig.routes.ai },
      { label: "Privacy Notice", href: legalConfig.routes.privacy },
      { label: "Cookie Policy", href: legalConfig.routes.cookies },
      { label: "Subprocessors", href: legalConfig.routes.subprocessors },
    ],
  };
}
