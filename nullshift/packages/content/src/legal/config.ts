/**
 * Central legal configuration — the single source of truth for Nullshift's
 * legal identity, contact routes and document versions.
 *
 * Legal identity must never be duplicated into components. Every page, PDF,
 * email footer and contract renders from HERE, so a change to the registered
 * office or a policy version propagates everywhere at once and cannot drift.
 *
 * Implementation spec §3. The defaults below reflect Nullshift's currently
 * published details; they are still checked against the live corporate record
 * as part of the legal release checklist (§20).
 *
 * `effectiveDate` deliberately has NO fallback. A draft must not become binding
 * merely because code was deployed — see assertLegalConfig() and
 * `bindingAcceptanceEnabled()`.
 */

export type LegalEntityConfig = {
  legalName: string;
  tradingName: string;
  companyNumber: string | null;
  /** Recorded explicitly when the entity is NOT a registered company. */
  legalForm: "limited_company" | "sole_trader" | "partnership" | "other";
  jurisdiction: string;
  registeredOffice: string | null;
  vatNumber: string | null;
  /** Set when Nullshift is not VAT registered — required if vatNumber is null. */
  vatStatus: "registered" | "not_registered" | "unverified";
  /** ICO data-protection register entry. */
  icoRegistration: string | null;
};

const env = (k: string): string | undefined => {
  const v = process.env[k];
  return v && v.trim() ? v.trim() : undefined;
};

export const legalConfig = {
  entity: {
    legalName: env("NEXT_PUBLIC_LEGAL_NAME") ?? "Nullshift Development Ltd",
    tradingName: "Nullshift",
    companyNumber: env("NEXT_PUBLIC_COMPANY_NUMBER") ?? "17284213",
    legalForm: "limited_company",
    jurisdiction: env("NEXT_PUBLIC_COMPANY_JURISDICTION") ?? "England and Wales",
    registeredOffice:
      env("NEXT_PUBLIC_REGISTERED_OFFICE") ??
      "66 Paul Street, London, England, United Kingdom, EC2A 4NA",
    // Nullshift is not VAT registered (confirmed 20 August 2026). A VAT number
    // is never invented: if registration happens, set both env vars together.
    vatNumber: env("NEXT_PUBLIC_VAT_NUMBER") ?? null,
    vatStatus:
      (env("NEXT_PUBLIC_VAT_STATUS") as LegalEntityConfig["vatStatus"]) ??
      "not_registered",
    icoRegistration: env("NEXT_PUBLIC_ICO_REGISTRATION") ?? "ZC214743",
  } as LegalEntityConfig,

  contact: {
    general: env("NEXT_PUBLIC_GENERAL_EMAIL") ?? "louis@nullshift.co.uk",
    legal: env("NEXT_PUBLIC_LEGAL_EMAIL") ?? "louis@nullshift.co.uk",
    privacy: env("NEXT_PUBLIC_PRIVACY_EMAIL") ?? "louis@nullshift.co.uk",
    /** No fallback — an unmonitored support address is worse than none. */
    support: env("NEXT_PUBLIC_SUPPORT_EMAIL") ?? null,
    billing: env("NEXT_PUBLIC_BILLING_EMAIL") ?? null,
  },

  legal: {
    publicPolicyVersion: "PUBLIC_2026_08_v1",
    clientAgreementVersion: "MSA_2026_08_v1",
    pricingVersion: "NSI_v1_2026_08",
    /**
     * The date the pack takes effect. Set to 20 August 2026 on the owner's
     * express instruction — see LEGAL-RELEASE.md, which records that the
     * solicitor review the source documents call for had not been completed
     * at that point.
     *
     * Clearing this (or the env var) puts the whole pack back into DRAFT:
     * public pages show a "not yet in force" notice and binding acceptance is
     * disabled. That remains the switch for taking it out of force.
     */
    effectiveDate: env("NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE") ?? "20 August 2026",
    governingLaw: "England and Wales",
  },

  routes: {
    centre: "/legal",
    websiteTerms: "/legal/website-terms",
    privacy: "/legal/privacy",
    cookies: "/legal/cookies",
    subprocessors: "/legal/subprocessors",
    acceptableUse: "/legal/acceptable-use",
    ai: "/legal/ai",
    clientServices: "/legal/client-services",
    dataComplaint: "/legal/data-complaint",
    cookieSettings: "/cookie-settings",
  },
} as const;

/* ── Build / release guards (spec §3) ──────────────────────────── */

export type LegalConfigProblem = { field: string; detail: string };

/**
 * Everything that must be present before legal pages may be served in
 * production. Returns the problems rather than throwing, so a build script can
 * print them all at once and a page can render a banner from the same source.
 */
export function legalConfigProblems(): LegalConfigProblem[] {
  const p: LegalConfigProblem[] = [];
  const { entity, contact, legal } = legalConfig;

  if (!entity.legalName)
    p.push({ field: "legalName", detail: "Contracting entity name is required." });
  if (entity.legalForm === "limited_company" && !entity.companyNumber)
    p.push({
      field: "companyNumber",
      detail:
        "Company number is required for a limited company. If Nullshift is not a limited company, set legalForm explicitly.",
    });
  if (!entity.jurisdiction)
    p.push({ field: "jurisdiction", detail: "Country of incorporation is required." });
  if (!entity.registeredOffice)
    p.push({ field: "registeredOffice", detail: "Registered office is required." });
  if (entity.vatStatus === "unverified")
    p.push({
      field: "vatStatus",
      detail:
        "VAT status is unverified. Set NEXT_PUBLIC_VAT_STATUS to 'registered' (with NEXT_PUBLIC_VAT_NUMBER) or 'not_registered'.",
    });
  if (entity.vatStatus === "registered" && !entity.vatNumber)
    p.push({ field: "vatNumber", detail: "VAT number is required when VAT registered." });

  if (!contact.legal)
    p.push({ field: "contact.legal", detail: "Legal email is required." });
  if (!contact.privacy)
    p.push({ field: "contact.privacy", detail: "Privacy email is required." });

  if (!legal.effectiveDate)
    p.push({
      field: "effectiveDate",
      detail:
        "NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE is unset. The legal text is a DRAFT: set this only after solicitor review. Binding acceptance stays disabled until it is set.",
    });
  if (
    !legal.publicPolicyVersion ||
    !legal.clientAgreementVersion ||
    !legal.pricingVersion
  )
    p.push({ field: "versions", detail: "All policy versions must be set." });

  return p;
}

/**
 * True once the legal pack has an effective date — i.e. a solicitor has
 * signed it off and it is intended to bind. Contract acceptance flows MUST
 * check this before recording a binding acceptance (spec §5, and the pack's
 * own "solicitor review required before first use" instruction).
 */
export function bindingAcceptanceEnabled(): boolean {
  return !!legalConfig.legal.effectiveDate;
}

/** The statutory company disclosure for the footer and legal pages (§ footer block). */
export function statutoryDisclosure(): string {
  const { entity } = legalConfig;
  const bits = [
    `${entity.legalName}${entity.tradingName && entity.tradingName !== entity.legalName ? `, trading as ${entity.tradingName}` : ""}`,
    entity.companyNumber ? `company number ${entity.companyNumber}` : null,
    entity.registeredOffice ? `registered office ${entity.registeredOffice}` : null,
    entity.vatStatus === "registered" && entity.vatNumber
      ? `VAT ${entity.vatNumber}`
      : entity.vatStatus === "not_registered"
        ? "not VAT registered"
        : null,
    entity.icoRegistration ? `ICO ${entity.icoRegistration}` : null,
  ].filter(Boolean);
  return bits.join(" · ");
}

/** Display date for a policy — or an explicit draft marker when unreviewed. */
export function effectiveDateLabel(): string {
  return legalConfig.legal.effectiveDate ?? "Draft — not yet in force";
}
