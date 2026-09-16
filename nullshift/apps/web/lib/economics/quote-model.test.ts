import { describe, expect, it } from "vitest";
import { assessQuote, type QuoteInputs } from "./quote-model";

const base: QuoteInputs = {
  userRoles: 2,
  integrations: 1,
  paymentFlows: 0,
  adminWorkflows: 2,
  aiFeatures: 0,
  authComplexity: 1,
  bookingOrScheduling: false,
  subscriptionBilling: false,
  dataMigration: false,
  expectedMonthlyTransactions: 0,
  expectedMonthlyActiveUsers: 100,
  clientChangeRisk: 1,
};

describe("assessQuote", () => {
  it("keeps recommendations inside commercial guardrails", () => {
    const result = assessQuote(base);
    expect(result.complexityScore).toBeGreaterThanOrEqual(0);
    expect(result.complexityScore).toBeLessThanOrEqual(100);
    expect(result.recommendedBuildFee).toBeGreaterThanOrEqual(1800);
    expect(result.recommendedMonthlyFee).toBeGreaterThanOrEqual(80);
    expect(result.predictedSupportHours).toBeGreaterThanOrEqual(1);
  });

  it("raises price and support expectations as complexity increases", () => {
    const simple = assessQuote(base);
    const complex = assessQuote({
      ...base,
      userRoles: 5,
      integrations: 5,
      paymentFlows: 2,
      adminWorkflows: 6,
      aiFeatures: 2,
      authComplexity: 3,
      bookingOrScheduling: true,
      subscriptionBilling: true,
      dataMigration: true,
      expectedMonthlyTransactions: 1500,
      expectedMonthlyActiveUsers: 2000,
      clientChangeRisk: 3,
    });

    expect(complex.complexityScore).toBeGreaterThan(simple.complexityScore);
    expect(complex.recommendedBuildFee).toBeGreaterThan(simple.recommendedBuildFee);
    expect(complex.recommendedMonthlyFee).toBeGreaterThan(simple.recommendedMonthlyFee);
    expect(complex.predictedSupportHours).toBeGreaterThan(simple.predictedSupportHours);
  });

  it("uses lower transaction percentages at higher transaction volume", () => {
    const lowVolume = assessQuote({ ...base, paymentFlows: 1, expectedMonthlyTransactions: 50 });
    const highVolume = assessQuote({ ...base, paymentFlows: 1, expectedMonthlyTransactions: 3000 });
    expect(lowVolume.recommendedTransactionFeeBps).toBe(150);
    expect(highVolume.recommendedTransactionFeeBps).toBe(75);
  });
});
