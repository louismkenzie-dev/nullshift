/**
 * Subprocessor and material service provider register (spec §12).
 *
 * The ONE authoritative list. The public page renders active entries only; the
 * client portal renders the same data plus notice history.
 *
 * Entries marked `verified: false` carry details that have NOT been confirmed
 * against the actual contracted arrangement (legal trading name, processing
 * location, transfer mechanism). The public page shows those explicitly as
 * unverified rather than presenting a guess as fact — the source document is
 * emphatic that supplier names and locations must not be invented.
 *
 * Adding a material new processor that touches Client Data requires client
 * notice at least 14 days before it takes effect (see `SUBPROCESSOR_NOTICE`).
 */

export type SubprocessorPlan = "core" | "pro" | "max" | "enterprise" | "website";

export type Subprocessor = {
  id: string;
  /** Registered legal name. Leave null and set verified:false until confirmed. */
  legalName: string | null;
  tradingName: string;
  purpose: string;
  dataCategories: string[];
  processingCountries: string[];
  /** e.g. UK adequacy, IDTA, SCCs. Null until the actual mechanism is confirmed. */
  transferMechanism: string | null;
  appliesTo: SubprocessorPlan[];
  effectiveFrom: string;
  retiredAt?: string;
  privacyUrl?: string;
  dpaUrl?: string;
  /** False until legal name, location and transfer mechanism are confirmed. */
  verified: boolean;
};

export const SUBPROCESSOR_REGISTER: Subprocessor[] = [
  {
    id: "vercel",
    legalName: null,
    tradingName: "Vercel",
    purpose: "Application hosting, edge delivery and deployment",
    dataCategories: ["Client Data in transit", "request and security logs"],
    processingCountries: ["VERIFY"],
    transferMechanism: null,
    appliesTo: ["core", "pro", "max", "enterprise", "website"],
    effectiveFrom: "2026-01-01",
    privacyUrl: "https://vercel.com/legal/privacy-policy",
    dpaUrl: "https://vercel.com/legal/dpa",
    verified: false,
  },
  {
    id: "supabase",
    legalName: null,
    tradingName: "Supabase",
    purpose: "Managed database, authentication and file storage",
    dataCategories: ["Client Data", "authentication records", "stored files"],
    processingCountries: ["VERIFY"],
    transferMechanism: null,
    appliesTo: ["core", "pro", "max", "enterprise"],
    effectiveFrom: "2026-01-01",
    privacyUrl: "https://supabase.com/privacy",
    dpaUrl: "https://supabase.com/legal/dpa",
    verified: false,
  },
  {
    id: "stripe",
    legalName: null,
    tradingName: "Stripe",
    purpose: "Payment processing and connected-account integration",
    dataCategories: [
      "payment and transaction metadata",
      "billing contact details",
      "card data handled by the processor, never by Nullshift",
    ],
    processingCountries: ["VERIFY"],
    transferMechanism: null,
    appliesTo: ["core", "pro", "max", "enterprise"],
    effectiveFrom: "2026-01-01",
    privacyUrl: "https://stripe.com/privacy",
    dpaUrl: "https://stripe.com/legal/dpa",
    verified: false,
  },
  {
    id: "gocardless",
    legalName: null,
    tradingName: "GoCardless",
    purpose: "Direct Debit collection for recurring plans",
    dataCategories: ["bank mandate details", "payment metadata"],
    processingCountries: ["VERIFY"],
    transferMechanism: null,
    appliesTo: ["core", "pro", "max", "enterprise"],
    effectiveFrom: "2026-01-01",
    privacyUrl: "https://gocardless.com/privacy/",
    verified: false,
  },
  {
    id: "resend",
    legalName: null,
    tradingName: "Resend",
    purpose: "Transactional email delivery",
    dataCategories: ["email address", "message content and delivery metadata"],
    processingCountries: ["VERIFY"],
    transferMechanism: null,
    appliesTo: ["pro", "max", "enterprise", "website"],
    effectiveFrom: "2026-01-01",
    privacyUrl: "https://resend.com/legal/privacy-policy",
    dpaUrl: "https://resend.com/legal/dpa",
    verified: false,
  },
  {
    id: "anthropic",
    legalName: null,
    tradingName: "Anthropic",
    purpose: "AI model inference for AI Features and internal agent workflows",
    dataCategories: ["configured AI Inputs and Outputs"],
    processingCountries: ["VERIFY"],
    transferMechanism: null,
    appliesTo: ["pro", "max", "enterprise"],
    effectiveFrom: "2026-01-01",
    privacyUrl: "https://www.anthropic.com/legal/privacy",
    verified: false,
  },
  {
    id: "xero",
    legalName: null,
    tradingName: "Xero",
    purpose: "Accounting records and invoice mirroring",
    dataCategories: ["billing contact details", "invoice and payment records"],
    processingCountries: ["VERIFY"],
    transferMechanism: null,
    appliesTo: ["core", "pro", "max", "enterprise"],
    effectiveFrom: "2026-01-01",
    privacyUrl: "https://www.xero.com/uk/legal/privacy/",
    verified: false,
  },
];

/** Active entries only — what the public register renders. */
export const activeSubprocessors = (): Subprocessor[] =>
  SUBPROCESSOR_REGISTER.filter((s) => !s.retiredAt);

/** True while any entry still needs its details confirmed (blocks release §20). */
export const hasUnverifiedSubprocessors = (): boolean =>
  activeSubprocessors().some((s) => !s.verified);

export const SUBPROCESSOR_NOTICE = {
  noticeDays: 14,
  statement:
    "Where we add or replace a material subprocessor that processes Client Data, we give affected clients at least 14 days' notice before the change takes effect, wherever practicable, and provide a route to object. Updating this page is not by itself contractual notice where the agreement requires direct notice.",
};
