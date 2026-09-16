import { describe, expect, it } from "vitest";
import { assessQuote } from "@/lib/economics/quote-model";

describe("quote intelligence model", () => {
  it("prices a simple low-risk system below a complex payments platform", () => {
    const simple = assessQuote({
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
      clientChangeRisk: 0,
    });

    const complex = assessQuote({
      userRoles: 5,
      integrations: 5,
      paymentFlows: 3,
      adminWorkflows: 8,
      aiFeatures: 2,
      authComplexity: 3,
      bookingOrScheduling: true,
      subscriptionBilling: true,
      dataMigration: true,
      expectedMonthlyTransactions: 3000,
      expectedMonthlyActiveUsers: 2500,
      clientChangeRisk: 3,
    });

    expect(simple.complexityScore).toBeLessThan(complex.complexityScore);
    expect(simple.recommendedBuildFee).toBeLessThan(complex.recommendedBuildFee);
    expect(simple.recommendedMonthlyFee).toBeLessThan(complex.recommendedMonthlyFee);
    expect(simple.predictedSupportHours).toBeLessThan(complex.predictedSupportHours);
    expect(complex.riskLevel).toBe("high");
  });

  it("uses a volume discount for transaction fees", () => {
    const base = {
      userRoles: 3,
      integrations: 2,
      paymentFlows: 1,
      adminWorkflows: 3,
      aiFeatures: 0,
      authComplexity: 2 as const,
      bookingOrScheduling: true,
      subscriptionBilling: false,
      dataMigration: false,
      expectedMonthlyActiveUsers: 250,
      clientChangeRisk: 1 as const,
    };

    const lowVolume = assessQuote({ ...base, expectedMonthlyTransactions: 50 });
    const highVolume = assessQuote({ ...base, expectedMonthlyTransactions: 2500 });

    expect(lowVolume.recommendedTransactionFeeBps).toBe(150);
    expect(highVolume.recommendedTransactionFeeBps).toBe(75);
  });

  it("never recommends a transaction fee when there is no payment flow", () => {
    const result = assessQuote({
      userRoles: 2,
      integrations: 1,
      paymentFlows: 0,
      adminWorkflows: 2,
      aiFeatures: 0,
      authComplexity: 1,
      bookingOrScheduling: false,
      subscriptionBilling: false,
      dataMigration: false,
      expectedMonthlyTransactions: 5000,
      expectedMonthlyActiveUsers: 100,
      clientChangeRisk: 1,
    });

    expect(result.recommendedTransactionFeeBps).toBe(0);
  });
});
