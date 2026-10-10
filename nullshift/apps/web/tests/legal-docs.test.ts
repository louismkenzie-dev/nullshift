import { describe, expect, it } from "vitest";
import {
  EMPTY_FACTS,
  factsProblems,
  parseFacts,
  type LegalFacts,
} from "@/lib/legal-docs/facts";
import {
  canonicalBundle,
  cookiePolicy,
  enabledDocs,
  generateDoc,
  privacyNotice,
  websiteTerms,
} from "@/lib/legal-docs/generate";

const base: LegalFacts = {
  ...EMPTY_FACTS,
  legalName: "Acme Plumbing Ltd",
  tradingName: "Acme",
  companyNumber: "12345678",
  registeredAddress: "1 High Street, Norwich NR1 1AA",
  websiteUrl: "www.acme.co.uk",
  contactEmail: "hello@acme.co.uk",
  icoRegistration: "ZA000000",
};

describe("legal docs generator", () => {
  it("names the controller correctly", () => {
    const d = privacyNotice(base, "https://x/l/acme");
    const text = JSON.stringify(d);
    expect(text).toContain("Acme Plumbing Ltd, trading as Acme");
    expect(text).toContain("company number 12345678");
    expect(text).toContain("ZA000000");
  });

  it("adds analytics consent wording only for cookie-based analytics", () => {
    const ga = cookiePolicy({ ...base, analytics: "ga4" });
    const pl = cookiePolicy({ ...base, analytics: "plausible" });
    expect(JSON.stringify(ga)).toContain("Only with your consent");
    expect(JSON.stringify(pl)).toContain("does not use cookies");
  });

  it("flags health data with a placeholder clause", () => {
    const d = privacyNotice({ ...base, healthData: true }, "https://x");
    expect(d.sections.some((s) => s.n === "3A")).toBe(true);
    expect(
      factsProblems({ ...base, healthData: true }).some((p) => p.includes("solicitor"))
    ).toBe(true);
  });

  it("uses the chosen jurisdiction in the terms", () => {
    expect(JSON.stringify(websiteTerms({ ...base, jurisdiction: "scotland" }))).toContain(
      "law of Scotland"
    );
  });

  it("respects which documents are enabled", () => {
    expect(enabledDocs({ ...base, includeCookies: false })).toEqual(["privacy", "terms"]);
  });

  it("canonical bundle is deterministic and changes with facts", () => {
    const a = canonicalBundle(base, "https://x");
    const b = canonicalBundle(base, "https://x");
    const c = canonicalBundle({ ...base, newsletter: true }, "https://x");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("parseFacts coerces form values and keeps previous when missing", () => {
    const f = parseFacts(
      { newsletter: "on", retentionMonths: "36", legalForm: "nonsense" },
      base
    );
    expect(f.newsletter).toBe(true);
    expect(f.retentionMonths).toBe(36);
    expect(f.legalForm).toBe("limited_company");
    expect(f.legalName).toBe("Acme Plumbing Ltd");
  });

  it("every doc has numbered sections", () => {
    for (const k of ["privacy", "cookies", "terms"] as const) {
      const d = generateDoc(k, base, "https://x");
      expect(d.sections.length).toBeGreaterThan(3);
      d.sections.forEach((s) => expect(s.n).toBeTruthy());
    }
  });
});
