/**
 * Nullshift Legal — the facts a business supplies, from which its Privacy
 * Notice, Cookie Policy and Website Terms are generated.
 *
 * Everything is a plain answer, not a legal concept. The generator turns
 * "we use Google Analytics" into the right clauses; the business never has to
 * know what a lawful basis is.
 */

export type LegalForm =
  | "limited_company"
  | "sole_trader"
  | "partnership"
  | "llp"
  | "charity"
  | "other";
export type Jurisdiction = "england_wales" | "scotland" | "northern_ireland";
export type Analytics = "none" | "ga4" | "plausible" | "fathom" | "matomo" | "other";
export type PaymentProvider =
  | "none"
  | "stripe"
  | "paypal"
  | "square"
  | "gocardless"
  | "other";

export type LegalFacts = {
  // Who
  legalName: string;
  tradingName: string;
  legalForm: LegalForm;
  companyNumber: string;
  registeredAddress: string;
  jurisdiction: Jurisdiction;
  websiteUrl: string;
  contactEmail: string;
  contactPhone: string;
  icoRegistration: string;
  vatNumber: string;
  // What the site does
  describeBusiness: string;
  contactForms: boolean;
  newsletter: boolean;
  newsletterTool: string;
  userAccounts: boolean;
  onlineBookings: boolean;
  bookingTool: string;
  onlinePayments: PaymentProvider;
  sellsGoods: boolean;
  analytics: Analytics;
  marketingCookies: boolean;
  marketingTools: string;
  embeddedMedia: boolean;
  liveChat: boolean;
  liveChatTool: string;
  hosting: string;
  otherProcessors: string;
  // Sensitive
  under18s: boolean;
  healthData: boolean;
  internationalTransfers: boolean;
  retentionMonths: number;
  cctv: boolean;
  // Documents
  includePrivacy: boolean;
  includeCookies: boolean;
  includeTerms: boolean;
};

export const EMPTY_FACTS: LegalFacts = {
  legalName: "",
  tradingName: "",
  legalForm: "limited_company",
  companyNumber: "",
  registeredAddress: "",
  jurisdiction: "england_wales",
  websiteUrl: "",
  contactEmail: "",
  contactPhone: "",
  icoRegistration: "",
  vatNumber: "",
  describeBusiness: "",
  contactForms: true,
  newsletter: false,
  newsletterTool: "",
  userAccounts: false,
  onlineBookings: false,
  bookingTool: "",
  onlinePayments: "none",
  sellsGoods: false,
  analytics: "none",
  marketingCookies: false,
  marketingTools: "",
  embeddedMedia: false,
  liveChat: false,
  liveChatTool: "",
  hosting: "",
  otherProcessors: "",
  under18s: false,
  healthData: false,
  internationalTransfers: false,
  retentionMonths: 24,
  cctv: false,
  includePrivacy: true,
  includeCookies: true,
  includeTerms: true,
};

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const bool = (v: unknown) => v === true || v === "true" || v === "on" || v === "1";
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : fallback;

/** Coerce a FormData-ish record into LegalFacts. Never throws. */
export function parseFacts(
  raw: Record<string, unknown>,
  previous: LegalFacts = EMPTY_FACTS
): LegalFacts {
  const r = raw;
  const retention = Number(r.retentionMonths);
  return {
    legalName: str(r.legalName, 120) || previous.legalName,
    tradingName: str(r.tradingName, 120),
    legalForm: oneOf(
      r.legalForm,
      [
        "limited_company",
        "sole_trader",
        "partnership",
        "llp",
        "charity",
        "other",
      ] as const,
      previous.legalForm
    ),
    companyNumber: str(r.companyNumber, 20),
    registeredAddress: str(r.registeredAddress, 300),
    jurisdiction: oneOf(
      r.jurisdiction,
      ["england_wales", "scotland", "northern_ireland"] as const,
      previous.jurisdiction
    ),
    websiteUrl: str(r.websiteUrl, 200),
    contactEmail: str(r.contactEmail, 200),
    contactPhone: str(r.contactPhone, 40),
    icoRegistration: str(r.icoRegistration, 20),
    vatNumber: str(r.vatNumber, 20),
    describeBusiness: str(r.describeBusiness, 300),
    contactForms: bool(r.contactForms),
    newsletter: bool(r.newsletter),
    newsletterTool: str(r.newsletterTool, 80),
    userAccounts: bool(r.userAccounts),
    onlineBookings: bool(r.onlineBookings),
    bookingTool: str(r.bookingTool, 80),
    onlinePayments: oneOf(
      r.onlinePayments,
      ["none", "stripe", "paypal", "square", "gocardless", "other"] as const,
      "none"
    ),
    sellsGoods: bool(r.sellsGoods),
    analytics: oneOf(
      r.analytics,
      ["none", "ga4", "plausible", "fathom", "matomo", "other"] as const,
      "none"
    ),
    marketingCookies: bool(r.marketingCookies),
    marketingTools: str(r.marketingTools, 160),
    embeddedMedia: bool(r.embeddedMedia),
    liveChat: bool(r.liveChat),
    liveChatTool: str(r.liveChatTool, 80),
    hosting: str(r.hosting, 120),
    otherProcessors: str(r.otherProcessors, 400),
    under18s: bool(r.under18s),
    healthData: bool(r.healthData),
    internationalTransfers: bool(r.internationalTransfers),
    retentionMonths:
      Number.isFinite(retention) && retention >= 1 && retention <= 120
        ? Math.round(retention)
        : previous.retentionMonths,
    cctv: bool(r.cctv),
    includePrivacy:
      r.includePrivacy === undefined ? previous.includePrivacy : bool(r.includePrivacy),
    includeCookies:
      r.includeCookies === undefined ? previous.includeCookies : bool(r.includeCookies),
    includeTerms:
      r.includeTerms === undefined ? previous.includeTerms : bool(r.includeTerms),
  };
}

/** What is still missing before the documents can be published. */
export function factsProblems(f: LegalFacts): string[] {
  const out: string[] = [];
  if (!f.legalName) out.push("Legal name of the business");
  if (!f.registeredAddress) out.push("Registered or trading address");
  if (!f.contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contactEmail))
    out.push("A valid contact email");
  if (!f.websiteUrl) out.push("Website address");
  if ((f.legalForm === "limited_company" || f.legalForm === "llp") && !f.companyNumber)
    out.push("Company number");
  if (f.healthData)
    out.push(
      "Health data needs a solicitor's review — the generator will add a placeholder clause"
    );
  return out;
}

export const LEGAL_FORM_LABEL: Record<LegalForm, string> = {
  limited_company: "a limited company",
  sole_trader: "a sole trader",
  partnership: "a partnership",
  llp: "a limited liability partnership",
  charity: "a registered charity",
  other: "an organisation",
};

export const JURISDICTION_LABEL: Record<Jurisdiction, string> = {
  england_wales: "England and Wales",
  scotland: "Scotland",
  northern_ireland: "Northern Ireland",
};
