/**
 * Contract acceptance evidence and Order Form validation (spec §5, §6).
 *
 * The point of this module is evidential: after the fact, Nullshift must be
 * able to show WHO accepted, WHAT exact wording they accepted (version + hash),
 * that they confirmed authority to bind, and that they did so for business
 * purposes. Anything less and the agreement is hard to rely on.
 *
 * The blocking validations exist because some deals must not be self-served at
 * all — significant automated decision-making, special-category data, and any
 * payment architecture that would put customer money in a Nullshift account.
 */

export type Plan = "core" | "pro" | "max" | "enterprise";
export type ScaleBandName =
  | "standard"
  | "growth"
  | "established"
  | "scale"
  | "critical"
  | "enterprise";

export type ContractAcceptance = {
  id: string;
  clientId: string;
  orderFormId: string;
  acceptedByName: string;
  acceptedByTitle: string;
  acceptedByEmail: string;
  authorityConfirmed: boolean;
  businessPurposeConfirmed: boolean;
  msaVersion: string;
  dpaVersion?: string;
  aiScheduleVersion?: string;
  paymentsScheduleVersion?: string;
  aupVersion: string;
  pricingVersion: string;
  /** documentType → sha256 of the exact text shown at acceptance. */
  documentHashes: Record<string, string>;
  acceptedAtUtc: string;
  /**
   * Personal data. Captured as evidence of acceptance; retention must be
   * justified and time-limited under the retention policy — not kept forever
   * by default.
   */
  ipAddress?: string;
  userAgent?: string;
  acceptanceMethod: "esign" | "clickwrap" | "manual_upload";
  signedArtifactPath: string;
};

/** The three confirmations, unchecked by default, never bundled with marketing. */
export const ACCEPTANCE_CONFIRMATIONS = [
  {
    id: "authority",
    field: "authorityConfirmed",
    /** {client} is replaced with the Client's legal name. */
    label: "I am authorised to bind {client}.",
  },
  {
    id: "business_purpose",
    field: "businessPurposeConfirmed",
    label: "The Client is entering this agreement for business purposes.",
  },
  {
    id: "read_terms",
    field: "termsRead",
    label: "I have read and agree to the Order Form and incorporated legal terms.",
  },
] as const;

export type OrderForm = {
  id: string;
  client: {
    legalName: string;
    companyNumber?: string;
    address: string;
    billingEmail: string;
    legalEmail: string;
  };
  plan: Plan;
  scaleBand: ScaleBandName;
  pricingVersion: string;
  monthlyFeeGbp: number;
  vatTreatment: "plus_vat" | "vat_included" | "not_vat_registered";
  billingDateRule: string;
  usageAllowance?: {
    type: "vendor_cost" | "units" | "spend_cap" | "fair_use";
    value: number | string;
  };
  projectFeeGbp?: number;
  mobilisationFeeGbp?: number;
  invoiceSchedule?: string[];
  scope: {
    businessOutcome: string;
    deliverables: string[];
    included: string[];
    excluded: string[];
    acceptanceCriteria: string[];
    clientDependencies: string[];
    targetWindow?: string;
  };
  technical: {
    hostingProvider?: string;
    databaseProvider?: string;
    emailProvider?: string;
    aiProviders?: string[];
    paymentProvider?: string;
    paymentArchitecture?: PaymentArchitecture;
    integrations?: string[];
    backupPolicyId?: string;
  };
  compliance: {
    personalData: boolean;
    specialCategoryData: boolean;
    childrenLikely: boolean;
    territories: string[];
    aiFeature: boolean;
    significantAutomatedDecision: boolean;
    paymentIntegration: boolean;
    accessibilityTarget?: string;
    sectorRegulation?: string;
  };
  portfolioUse: boolean;
  applicableScheduleVersions: Record<string, string>;
};

/** Allowed payment architectures (§14). Custody is prohibited, not merely discouraged. */
export type PaymentArchitecture =
  | "processor_direct_to_client"
  | "stripe_connect_direct_charge"
  | "stripe_connect_destination_charge_reviewed"
  | "other_reviewed"
  | "nullshift_custody_PROHIBITED";

export type Blocker = {
  code:
    | "ENTERPRISE_LEGAL_REVIEW_REQUIRED"
    | "SPECIAL_CATEGORY_REVIEW_REQUIRED"
    | "REGULATORY_PAYMENT_REVIEW_REQUIRED"
    | "BACKUP_POLICY_REQUIRED"
    | "EU_AI_ARTICLE_50_REVIEW";
  /** Whether self-serve acceptance / production launch is blocked outright. */
  blocksSelfServe: boolean;
  detail: string;
};

const EU_EEA = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LI",
  "LT",
  "LU",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "IS",
  "EU",
  "EEA",
]);

/**
 * Blocking validations (§6, §13, §14). Returns every reason this Order Form
 * cannot be self-served, rather than the first — a client should be told the
 * whole story at once, and staff need the full list to route the review.
 */
export function orderFormBlockers(order: OrderForm): Blocker[] {
  const b: Blocker[] = [];
  const { compliance, technical, plan } = order;

  if (compliance.significantAutomatedDecision)
    b.push({
      code: "ENTERPRISE_LEGAL_REVIEW_REQUIRED",
      blocksSelfServe: true,
      detail:
        "The system makes decisions with legal or similarly significant effects on individuals. Enterprise legal review is required before acceptance.",
    });

  if (compliance.specialCategoryData)
    b.push({
      code: "SPECIAL_CATEGORY_REVIEW_REQUIRED",
      blocksSelfServe: true,
      detail:
        "Special-category data is in scope. A DPA, security review and DPIA assessment are required before launch.",
    });

  if (technical.paymentArchitecture === "nullshift_custody_PROHIBITED")
    b.push({
      code: "REGULATORY_PAYMENT_REVIEW_REQUIRED",
      blocksSelfServe: true,
      detail:
        "Customer funds would be received into a Nullshift-controlled account. Production deployment is blocked pending regulatory-legal approval.",
    });

  if (compliance.paymentIntegration && !technical.paymentArchitecture)
    b.push({
      code: "REGULATORY_PAYMENT_REVIEW_REQUIRED",
      blocksSelfServe: true,
      detail:
        "A payment integration is in scope but the payment architecture has not been classified.",
    });

  if (plan === "enterprise")
    b.push({
      code: "ENTERPRISE_LEGAL_REVIEW_REQUIRED",
      blocksSelfServe: true,
      detail: "Enterprise orders require manual approval.",
    });

  if (compliance.personalData && !technical.backupPolicyId)
    b.push({
      code: "BACKUP_POLICY_REQUIRED",
      blocksSelfServe: true,
      detail:
        "The system stores production personal data but no backup policy is recorded. Launch is blocked until one is attached or an exception is documented.",
    });

  if (
    compliance.aiFeature &&
    compliance.territories.some((t) => EU_EEA.has(t.toUpperCase()))
  )
    b.push({
      code: "EU_AI_ARTICLE_50_REVIEW",
      blocksSelfServe: false,
      detail:
        "An AI Feature is offered in the EU/EEA. Flag for EU AI Act Article 50 transparency review.",
    });

  return b;
}

/** Self-serve acceptance is permitted only when nothing hard-blocks it. */
export const canSelfServe = (order: OrderForm): boolean =>
  !orderFormBlockers(order).some((x) => x.blocksSelfServe);
