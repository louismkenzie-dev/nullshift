import { describe, expect, it } from "vitest";
import {
  normaliseWebsite,
  partnerApplicationLabels,
  partnerApplicationRow,
  validatePartnerApplication,
} from "@/lib/partnerApplication";

const valid = {
  agencyName: "Sunday Commerce",
  website: "sundaycommerce.com",
  country: "United Kingdom",
  contactName: "Jordan Example",
  role: "Founder",
  email: "Jordan@Example.com",
  agencyType: "growth_consultancy",
  teamSize: "2-5",
  modelInterest: "white_label",
  clientTypes: "E-commerce brands, £1–5m turnover",
  message: "We have two clients who need a portal this quarter.",
};

describe("validatePartnerApplication", () => {
  it("accepts a complete application and normalises email + website", () => {
    const result = validatePartnerApplication(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.email).toBe("jordan@example.com");
    expect(result.data.website).toBe("https://sundaycommerce.com");
    expect(result.data.agencyName).toBe("Sunday Commerce");
  });

  it("accepts the optional fields blank", () => {
    const result = validatePartnerApplication({
      ...valid,
      website: "",
      role: "",
      clientTypes: "",
      message: "",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an empty body with one error per required field", () => {
    const result = validatePartnerApplication({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(
      [
        "agencyName",
        "agencyType",
        "contactName",
        "country",
        "email",
        "modelInterest",
        "teamSize",
      ].sort()
    );
  });

  it("rejects values outside the option lists", () => {
    const result = validatePartnerApplication({
      ...valid,
      agencyType: "hedge_fund",
      teamSize: "lots",
      modelInterest: "equity",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.agencyType).toBeTruthy();
    expect(result.errors.teamSize).toBeTruthy();
    expect(result.errors.modelInterest).toBeTruthy();
  });

  it("rejects a malformed email and a non-http website", () => {
    const result = validatePartnerApplication({
      ...valid,
      email: "not-an-email",
      website: "javascript:alert(1)",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.email).toBe("Enter a valid email address.");
    expect(result.errors.website).toBeTruthy();
  });

  it("rejects control characters and over-long text", () => {
    const result = validatePartnerApplication({
      ...valid,
      agencyName: "Bad\u0000Name",
      message: "x".repeat(4001),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.agencyName).toBe("Please remove unsupported characters.");
    expect(result.errors.message).toBe("Please use no more than 4000 characters.");
  });

  it("ignores non-object input and non-string fields", () => {
    expect(validatePartnerApplication(null).ok).toBe(false);
    expect(validatePartnerApplication([1, 2]).ok).toBe(false);
    const result = validatePartnerApplication({ ...valid, agencyName: 42 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.agencyName).toBeTruthy();
  });

  it("drops unknown keys so only our columns reach the database", () => {
    const result = validatePartnerApplication({ ...valid, status: "accepted", id: "x" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect("status" in result.data).toBe(false);
    const row = partnerApplicationRow(result.data, "192.0.2.1");
    expect(row.status).toBe("new");
    expect(row.model_interest).toBe("white_label");
    expect(row.created_ip).toBe("192.0.2.1");
  });
});

describe("normaliseWebsite", () => {
  it("adds https and strips a trailing slash", () => {
    expect(normaliseWebsite("www.agency.co.uk/")).toBe("https://www.agency.co.uk");
    expect(normaliseWebsite("http://agency.io/about")).toBe("http://agency.io/about");
  });
  it("returns an empty string for blank and null for junk", () => {
    expect(normaliseWebsite("   ")).toBe("");
    expect(normaliseWebsite("agency")).toBeNull();
    expect(normaliseWebsite("ftp://agency.com")).toBeNull();
    expect(normaliseWebsite("https://user:pw@agency.com")).toBeNull();
  });
});

describe("partnerApplicationLabels", () => {
  it("maps option values to their public labels", () => {
    const result = validatePartnerApplication(valid);
    if (!result.ok) throw new Error("expected valid");
    const labels = partnerApplicationLabels(result.data);
    expect(labels.agencyType).toBe("Growth or business consultancy");
    expect(labels.teamSize).toBe("2–5 people");
    expect(labels.modelInterest).toContain("White-label");
  });
});

describe("partnerPlanPrices", () => {
  it("derives the white-label prices from the public ladder, rounded up", async () => {
    const { partnerPlanPrices, partnerPrice } = await import("@/lib/partnerPricing");
    expect(partnerPrice(149)).toBe(112);
    expect(partnerPrice(249)).toBe(187);
    expect(partnerPrice(399)).toBe(300);
    const plans = partnerPlanPrices();
    expect(plans.map((p) => p.id)).toEqual(["core", "pro", "max"]);
    expect(plans.map((p) => p.partner)).toEqual([112, 187, 300]);
  });
});
