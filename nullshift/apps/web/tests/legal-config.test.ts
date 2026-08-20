import { describe, expect, it } from "vitest";
import {
  canSelfServe,
  orderFormBlockers,
  type OrderForm,
} from "@nullshift/content/legal/acceptance";
import { contentHash } from "@nullshift/content/legal/versions";
import {
  assertCookieInventory,
  CONSENT_DEFAULTS,
  COOKIE_INVENTORY,
} from "@nullshift/content/legal/cookies";
import { activeSubprocessors } from "@nullshift/content/legal/subprocessors";

/**
 * The legal spine, pinned. Each of these guards exists because failing it
 * silently is a legal exposure rather than a bug: a self-served contract that
 * should have had review, an analytics cookie firing without consent, a
 * hash that no longer matches the words someone signed.
 */

const base: OrderForm = {
  id: "of_1",
  client: {
    legalName: "Example Ltd",
    address: "1 Example St",
    billingEmail: "billing@example.com",
    legalEmail: "legal@example.com",
  },
  plan: "pro",
  scaleBand: "standard",
  pricingVersion: "NSI_v1_2026_08",
  monthlyFeeGbp: 80,
  vatTreatment: "plus_vat",
  billingDateRule: "1st of the month",
  scope: {
    businessOutcome: "Booking system",
    deliverables: [],
    included: [],
    excluded: [],
    acceptanceCriteria: [],
    clientDependencies: [],
  },
  technical: { backupPolicyId: "bk_standard" },
  compliance: {
    personalData: true,
    specialCategoryData: false,
    childrenLikely: false,
    territories: ["GB"],
    aiFeature: false,
    significantAutomatedDecision: false,
    paymentIntegration: false,
  },
  portfolioUse: false,
  applicableScheduleVersions: {},
};

const order = (over: Partial<OrderForm>): OrderForm => ({
  ...base,
  ...over,
  technical: { ...base.technical, ...(over.technical ?? {}) },
  compliance: { ...base.compliance, ...(over.compliance ?? {}) },
});

describe("order form blocking validations", () => {
  it("allows an ordinary Pro order to self-serve", () => {
    expect(canSelfServe(base)).toBe(true);
    expect(orderFormBlockers(base)).toEqual([]);
  });

  it("blocks significant automated decision-making", () => {
    const b = orderFormBlockers(
      order({ compliance: { ...base.compliance, significantAutomatedDecision: true } })
    );
    expect(b.map((x) => x.code)).toContain("ENTERPRISE_LEGAL_REVIEW_REQUIRED");
    expect(
      canSelfServe(
        order({ compliance: { ...base.compliance, significantAutomatedDecision: true } })
      )
    ).toBe(false);
  });

  it("blocks special-category data pending DPA/DPIA review", () => {
    const o = order({ compliance: { ...base.compliance, specialCategoryData: true } });
    expect(orderFormBlockers(o).map((x) => x.code)).toContain(
      "SPECIAL_CATEGORY_REVIEW_REQUIRED"
    );
    expect(canSelfServe(o)).toBe(false);
  });

  it("hard-blocks any architecture putting customer funds in a Nullshift account", () => {
    const o = order({
      compliance: { ...base.compliance, paymentIntegration: true },
      technical: {
        ...base.technical,
        paymentArchitecture: "nullshift_custody_PROHIBITED",
      },
    });
    expect(orderFormBlockers(o).map((x) => x.code)).toContain(
      "REGULATORY_PAYMENT_REVIEW_REQUIRED"
    );
    expect(canSelfServe(o)).toBe(false);
  });

  it("blocks a payment integration whose architecture was never classified", () => {
    const o = order({ compliance: { ...base.compliance, paymentIntegration: true } });
    expect(orderFormBlockers(o).map((x) => x.code)).toContain(
      "REGULATORY_PAYMENT_REVIEW_REQUIRED"
    );
  });

  it("blocks production personal data with no backup policy", () => {
    const o: OrderForm = { ...base, technical: {} };
    expect(orderFormBlockers(o).map((x) => x.code)).toContain("BACKUP_POLICY_REQUIRED");
  });

  it("flags EU/EEA AI features for Article 50 review without blocking self-serve", () => {
    const o = order({
      compliance: { ...base.compliance, aiFeature: true, territories: ["IE"] },
    });
    const flag = orderFormBlockers(o).find((x) => x.code === "EU_AI_ARTICLE_50_REVIEW");
    expect(flag).toBeDefined();
    expect(flag?.blocksSelfServe).toBe(false);
    expect(canSelfServe(o)).toBe(true);
  });

  it("always routes Enterprise to manual approval", () => {
    expect(canSelfServe(order({ plan: "enterprise" }))).toBe(false);
  });
});

describe("document hashing", () => {
  it("is stable across insignificant whitespace but changes with wording", () => {
    expect(contentHash("1.1 The  Client   agrees.")).toBe(
      contentHash("1.1 The Client agrees.")
    );
    expect(contentHash("1.1 The Client agrees.")).not.toBe(
      contentHash("1.1 The Client does not agree.")
    );
  });
});

describe("cookies", () => {
  it("defaults every optional category to off", () => {
    expect(CONSENT_DEFAULTS).toEqual({
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
    });
  });

  it("records a rationale for every claimed exception", () => {
    for (const e of COOKIE_INVENTORY) {
      if (e.legalMode === "documented_exception")
        expect(e.exceptionRationale, e.nameOrPattern).toBeTruthy();
    }
    expect(assertCookieInventory([])).toEqual([]);
  });

  it("fails when an integration ships that the inventory doesn't know about", () => {
    expect(assertCookieInventory(["Google Analytics"])).toHaveLength(1);
  });
});

describe("subprocessor register", () => {
  it("never publishes an invented legal name — unverified entries say so", () => {
    for (const s of activeSubprocessors()) {
      if (!s.verified) expect(s.legalName).toBeNull();
      expect(s.tradingName).toBeTruthy();
    }
  });
});

describe("prohibited marketing claims (§16)", () => {
  it("never appears in public pricing, plan or service-terms copy", async () => {
    const { PROHIBITED_CLAIMS, PRICING_LEGAL_COPY } =
      await import("@nullshift/content/legal/text");
    const { PRICING_TIERS, PRICING_FAQS, PRICING_CONSTANTS } =
      await import("@nullshift/content/pricing");
    const { CARE_PLANS } = await import("@/lib/carePlans");
    const { SERVICE_TERMS_ACKNOWLEDGEMENTS } =
      await import("@nullshift/content/serviceTerms");
    // The §8/§9 copy is customer-facing too: staff read the classifier rule
    // and clients read the Change Order labels, so a stray "unlimited" there
    // would be exactly as much of a promise as one on the pricing page.
    const { WORK_CLASSIFICATIONS, CLASSIFIER_RULE, CHANGE_ORDER_LABEL } =
      await import("@nullshift/content/legal/work");
    const { EMAIL_PURPOSES, PURPOSE_RULE } =
      await import("@nullshift/content/legal/email");
    const { SUPPORT_BOUNDARY, SUPPORT_EXAMPLES } =
      await import("@nullshift/content/pricing");

    const corpus = JSON.stringify({
      PRICING_TIERS,
      PRICING_FAQS,
      PRICING_CONSTANTS,
      CARE_PLANS,
      SERVICE_TERMS_ACKNOWLEDGEMENTS,
      PRICING_LEGAL_COPY,
      WORK_CLASSIFICATIONS,
      CLASSIFIER_RULE,
      CHANGE_ORDER_LABEL,
      EMAIL_PURPOSES,
      PURPOSE_RULE,
      SUPPORT_BOUNDARY,
      SUPPORT_EXAMPLES,
    }).toLowerCase();

    for (const claim of PROHIBITED_CLAIMS) {
      // "It does not include unlimited development" is a denial, not a claim —
      // only flag the phrase where it is NOT immediately negated.
      const idx = corpus.indexOf(claim);
      if (idx === -1) continue;
      const preceding = corpus.slice(Math.max(0, idx - 40), idx);
      expect(
        /\b(no|not|never|without|does not|doesn't)\b[^.]*$/.test(preceding),
        `"${claim}" appears in customer-facing copy without being negated`
      ).toBe(true);
    }
  });
});
