import { describe, it, expect } from "vitest";
import {
  CHANGE_ORDER_FLOW,
  canTransition,
  changeOrderReadiness,
  classificationMeta,
  isBuildState,
  requiresChangeOrder,
  staffTransitions,
  WORK_CLASSIFICATIONS,
  type ChangeOrderStatus,
} from "@nullshift/content/legal/work";
import {
  ACCEPTANCE_CONFIRMATIONS,
  canSelfServe,
  orderFormBlockers,
  type OrderForm,
} from "@nullshift/content/legal/acceptance";
import {
  COOKIE_INVENTORY,
  CONSENT_DEFAULTS,
  optionalCategories,
  assertCookieInventory,
} from "@nullshift/content/legal/cookies";
import { contentHash } from "@nullshift/content/legal/versions";
import {
  EMAIL_PURPOSES,
  PURPOSE_RULE,
  emailPurpose,
} from "@nullshift/content/legal/email";

/**
 * The test cases the implementation specification names in §21, expressed
 * against the code that is supposed to make them true.
 *
 * These are deliberately about the RULES, not the screens. A UI can be
 * rearranged; what must not change is that additional development needs a
 * Change Order, that acceptance needs all three confirmations, and that
 * nothing optional is on by default.
 */

const baseOrder: OrderForm = {
  id: "of_1",
  client: {
    legalName: "Example Trading Ltd",
    address: "1 Example Street",
    billingEmail: "billing@example.com",
    legalEmail: "legal@example.com",
  },
  plan: "core",
  scaleBand: "standard",
  pricingVersion: "NSI_v1_2026_08",
  monthlyFeeGbp: 40,
  vatTreatment: "not_vat_registered",
  billingDateRule: "Monthly in advance",
  scope: {
    businessOutcome: "Bookings that work",
    deliverables: [],
    included: [],
    excluded: [],
    acceptanceCriteria: [],
    clientDependencies: [],
  },
  technical: { backupPolicyId: "bk-standard" },
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

const order = (patch: Partial<OrderForm>): OrderForm => ({
  ...baseOrder,
  ...patch,
  compliance: { ...baseOrder.compliance, ...(patch.compliance ?? {}) },
  technical: { ...baseOrder.technical, ...(patch.technical ?? {}) },
});

/* ── §8 Support vs Additional Development ──────────────────────── */

describe("work classification (§8)", () => {
  it("treats a broken existing capability as support", () => {
    const support = classificationMeta("support");
    expect(support.requiresChangeOrder).toBe(false);
    // The worked example from the spec, straight out of the copy staff read.
    expect(support.examples.some((e) => /erroring|stopped/i.test(e))).toBe(true);
    expect(requiresChangeOrder("support")).toBe(false);
  });

  it("treats adding seat selection as additional development needing a Change Order", () => {
    const dev = classificationMeta("additional_development");
    expect(dev.examples.some((e) => /seat selection/i.test(e))).toBe(true);
    expect(requiresChangeOrder("additional_development")).toBe(true);
  });

  it("does not let a mixed ticket carry the new capability in on the fix", () => {
    expect(requiresChangeOrder("mixed")).toBe(true);
  });

  it("never blocks a security incident behind a Change Order", () => {
    expect(requiresChangeOrder("security_incident")).toBe(false);
  });

  it("treats a usage spike as a pricing review, not development", () => {
    const usage = classificationMeta("usage_review");
    expect(usage.requiresChangeOrder).toBe(false);
    expect(usage.meaning).toMatch(/pricing conversation/i);
  });

  it("leaves an unclassified ticket unblocked here — the UI asks first", () => {
    expect(requiresChangeOrder(null)).toBe(false);
    expect(requiresChangeOrder(undefined)).toBe(false);
  });

  it("describes every classification it offers", () => {
    for (const w of WORK_CLASSIFICATIONS) {
      expect(w.label.length).toBeGreaterThan(0);
      expect(w.meaning.length).toBeGreaterThan(20);
      expect(w.examples.length).toBeGreaterThan(0);
    }
  });
});

/* ── §9 Change Order state machine ─────────────────────────────── */

describe("change order flow (§9)", () => {
  it("runs the states the spec names, in order", () => {
    const path: ChangeOrderStatus[] = [
      "draft",
      "client_review",
      "accepted",
      "in_build",
      "delivered",
      "accepted_complete",
    ];
    for (let i = 0; i < path.length - 1; i++)
      expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
  });

  it("cannot jump from draft straight into build", () => {
    expect(canTransition("draft", "in_build")).toBe(false);
    expect(canTransition("draft", "accepted")).toBe(false);
  });

  it("never offers staff the client's decision", () => {
    const fromReview = staffTransitions("client_review");
    expect(fromReview).not.toContain("accepted");
    expect(fromReview).not.toContain("rejected");
    // Withdrawing and superseding stay with staff.
    expect(fromReview).toContain("withdrawn");
  });

  it("treats build, delivered and signed-off as work-has-started states", () => {
    expect(isBuildState("in_build")).toBe(true);
    expect(isBuildState("delivered")).toBe(true);
    expect(isBuildState("accepted_complete")).toBe(true);
    expect(isBuildState("client_review")).toBe(false);
  });

  it("has no way out of a terminal state", () => {
    for (const terminal of ["accepted_complete", "withdrawn"] as ChangeOrderStatus[])
      expect(CHANGE_ORDER_FLOW[terminal]).toEqual([]);
  });

  it("will not send a change to a client without a recurring-fee answer", () => {
    const missing = changeOrderReadiness({
      description: "Add seat selection",
      businessOutcome: "Customers pick their seats",
      acceptanceCriteria: ["A customer can choose a seat and it is held"],
      recurringFeeDelta: null,
    });
    expect(missing.some((m) => /recurring/i.test(m))).toBe(true);
  });

  it("accepts zero as an answer — it is not the same as unanswered", () => {
    const missing = changeOrderReadiness({
      description: "Add seat selection",
      businessOutcome: "Customers pick their seats",
      acceptanceCriteria: ["A customer can choose a seat and it is held"],
      recurringFeeDelta: 0,
    });
    expect(missing).toEqual([]);
  });

  it("insists on acceptance criteria so 'done' is not an opinion", () => {
    const missing = changeOrderReadiness({
      description: "Add seat selection",
      businessOutcome: "Customers pick their seats",
      acceptanceCriteria: [],
      recurringFeeDelta: 0,
    });
    expect(missing.some((m) => /acceptance criterion/i.test(m))).toBe(true);
  });
});

/* ── §5 Contract acceptance ────────────────────────────────────── */

describe("contract acceptance (§5)", () => {
  it("requires authority, business purpose and having read the terms", () => {
    const ids = ACCEPTANCE_CONFIRMATIONS.map((c) => c.id);
    expect(ids).toContain("authority");
    expect(ids).toContain("business_purpose");
    expect(ids).toContain("read_terms");
    expect(ids).toHaveLength(3);
  });

  it("names the client in the authority confirmation rather than saying 'the company'", () => {
    const authority = ACCEPTANCE_CONFIRMATIONS.find((c) => c.id === "authority")!;
    expect(authority.label).toContain("{client}");
  });

  it("never bundles marketing consent into acceptance", () => {
    const text = ACCEPTANCE_CONFIRMATIONS.map((c) => c.label).join(" ").toLowerCase();
    expect(text).not.toMatch(/marketing|newsletter|updates by email|offers/);
  });

  it("hashes the words, not the version string", () => {
    const a = contentHash("Clause 1. The Supplier shall do the thing.");
    const b = contentHash("Clause 1. The Supplier shall do  the   thing.");
    const c = contentHash("Clause 1. The Supplier shall not do the thing.");
    // Reformatting is not a change of meaning; a "not" is.
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

/* ── §6 / §14 blocking validations ─────────────────────────────── */

describe("order form blockers (§6, §13, §14)", () => {
  it("lets an ordinary Core order self-serve", () => {
    expect(canSelfServe(baseOrder)).toBe(true);
    expect(orderFormBlockers(baseOrder)).toEqual([]);
  });

  it("blocks self-serve on significant automated decisions", () => {
    const o = order({ compliance: { ...baseOrder.compliance, significantAutomatedDecision: true } });
    expect(canSelfServe(o)).toBe(false);
    expect(orderFormBlockers(o).map((b) => b.code)).toContain(
      "ENTERPRISE_LEGAL_REVIEW_REQUIRED"
    );
  });

  it("blocks self-serve on special-category data", () => {
    const o = order({ compliance: { ...baseOrder.compliance, specialCategoryData: true } });
    expect(canSelfServe(o)).toBe(false);
  });

  it("blocks a payment integration whose architecture has not been classified", () => {
    const o = order({ compliance: { ...baseOrder.compliance, paymentIntegration: true } });
    expect(orderFormBlockers(o).map((b) => b.code)).toContain(
      "REGULATORY_PAYMENT_REVIEW_REQUIRED"
    );
  });

  it("blocks Nullshift custody of customer funds outright", () => {
    const o = order({
      compliance: { ...baseOrder.compliance, paymentIntegration: true },
      technical: { ...baseOrder.technical, paymentArchitecture: "nullshift_custody_PROHIBITED" },
    });
    const blocker = orderFormBlockers(o).find(
      (b) => b.code === "REGULATORY_PAYMENT_REVIEW_REQUIRED"
    );
    expect(blocker?.blocksSelfServe).toBe(true);
    expect(blocker?.detail).toMatch(/Nullshift-controlled account/i);
  });

  it("clears the payment blocker once the architecture is a direct-to-client one", () => {
    const o = order({
      compliance: { ...baseOrder.compliance, paymentIntegration: true },
      technical: { ...baseOrder.technical, paymentArchitecture: "processor_direct_to_client" },
    });
    expect(canSelfServe(o)).toBe(true);
  });

  it("blocks launch when personal data is stored with no backup policy", () => {
    const o = order({ technical: { backupPolicyId: undefined } });
    expect(orderFormBlockers(o).map((b) => b.code)).toContain("BACKUP_POLICY_REQUIRED");
  });

  it("flags EU AI Act Article 50 without blocking the order", () => {
    const o = order({
      compliance: { ...baseOrder.compliance, aiFeature: true, territories: ["GB", "IE"] },
    });
    const flag = orderFormBlockers(o).find((b) => b.code === "EU_AI_ARTICLE_50_REVIEW");
    expect(flag?.blocksSelfServe).toBe(false);
    expect(canSelfServe(o)).toBe(true);
  });

  it("does not raise the Article 50 flag for a UK-only AI feature", () => {
    const o = order({ compliance: { ...baseOrder.compliance, aiFeature: true } });
    expect(orderFormBlockers(o).map((b) => b.code)).not.toContain("EU_AI_ARTICLE_50_REVIEW");
  });

  it("always requires manual approval for Enterprise", () => {
    expect(canSelfServe(order({ plan: "enterprise" }))).toBe(false);
  });

  it("reports every reason at once rather than the first", () => {
    const o = order({
      plan: "enterprise",
      compliance: { ...baseOrder.compliance, specialCategoryData: true },
      technical: { backupPolicyId: undefined },
    });
    expect(orderFormBlockers(o).length).toBeGreaterThanOrEqual(3);
  });
});

/* ── §10 Consent ───────────────────────────────────────────────── */

describe("cookie consent (§10)", () => {
  it("defaults every optional category off", () => {
    expect(CONSENT_DEFAULTS.functional).toBe(false);
    expect(CONSENT_DEFAULTS.analytics).toBe(false);
    expect(CONSENT_DEFAULTS.marketing).toBe(false);
    expect(CONSENT_DEFAULTS.necessary).toBe(true);
  });

  it("sets nothing optional today, which is why no banner is shown", () => {
    expect(optionalCategories()).toEqual([]);
    expect(COOKIE_INVENTORY.every((c) => c.category === "necessary")).toBe(true);
  });

  it("records a rationale for every documented exception", () => {
    expect(assertCookieInventory([])).toEqual([]);
  });

  it("fails when an analytics integration exists but is not in the inventory", () => {
    const problems = assertCookieInventory(["Google Analytics"]);
    expect(problems.length).toBe(1);
    expect(problems[0]).toMatch(/not in the cookie inventory/i);
  });
});

/* ── §15 Email purpose ─────────────────────────────────────────── */

describe("email purpose (§15)", () => {
  it("offers exactly the three purposes the spec names", () => {
    expect(EMAIL_PURPOSES.map((p) => p.id)).toEqual([
      "transactional",
      "service_relationship",
      "marketing",
    ]);
  });

  it("only requires a recorded permission for marketing", () => {
    expect(emailPurpose("transactional").needsMarketingPermission).toBe(false);
    expect(emailPurpose("service_relationship").needsMarketingPermission).toBe(false);
    expect(emailPurpose("marketing").needsMarketingPermission).toBe(true);
  });

  it("only requires an unsubscribe route for marketing", () => {
    // A password reset with an unsubscribe link is a support ticket waiting to
    // happen; a newsletter without one is unlawful.
    expect(emailPurpose("transactional").needsUnsubscribe).toBe(false);
    expect(emailPurpose("marketing").needsUnsubscribe).toBe(true);
  });

  it("puts a price change notice on the service-relationship side, not marketing", () => {
    const service = emailPurpose("service_relationship");
    expect(service.examples.some((e) => /price change/i.test(e))).toBe(true);
    expect(service.basis).toMatch(/live agreement/i);
  });

  it("says plainly that an account is not marketing consent", () => {
    expect(PURPOSE_RULE).toMatch(/not consent to be marketed to/i);
  });
});
