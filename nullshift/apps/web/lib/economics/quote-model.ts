export type QuoteInputs = {
  userRoles: number;
  integrations: number;
  paymentFlows: number;
  adminWorkflows: number;
  aiFeatures: number;
  authComplexity: 0 | 1 | 2 | 3;
  bookingOrScheduling: boolean;
  subscriptionBilling: boolean;
  dataMigration: boolean;
  expectedMonthlyTransactions: number;
  expectedMonthlyActiveUsers: number;
  clientChangeRisk: 0 | 1 | 2 | 3;
};

export type QuoteAssessment = {
  complexityScore: number;
  riskLevel: "low" | "medium" | "high";
  recommendedBuildFee: number;
  recommendedMonthlyFee: number;
  recommendedTransactionFeeBps: number;
  predictedSupportHours: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const roundTo = (value: number, increment: number) =>
  Math.round(value / increment) * increment;

/**
 * Nullshift Quote Intelligence v1.
 *
 * This is intentionally deterministic and explainable. It gives the team a
 * consistent commercial baseline now; coefficients can later be trained from
 * actual project outcomes once enough time/cost history exists.
 */
export function assessQuote(input: QuoteInputs): QuoteAssessment {
  const transactionLoad = Math.min(input.expectedMonthlyTransactions / 500, 6);
  const userLoad = Math.min(input.expectedMonthlyActiveUsers / 250, 5);

  const rawComplexity =
    8 +
    input.userRoles * 4 +
    input.integrations * 6 +
    input.paymentFlows * 8 +
    input.adminWorkflows * 3 +
    input.aiFeatures * 7 +
    input.authComplexity * 5 +
    (input.bookingOrScheduling ? 8 : 0) +
    (input.subscriptionBilling ? 10 : 0) +
    (input.dataMigration ? 6 : 0) +
    transactionLoad +
    userLoad +
    input.clientChangeRisk * 4;

  const complexityScore = Math.round(clamp(rawComplexity, 0, 100));

  const predictedSupportHours = Number(
    clamp(
      0.8 +
        complexityScore * 0.045 +
        input.integrations * 0.35 +
        input.paymentFlows * 0.45 +
        input.clientChangeRisk * 0.7 +
        (input.subscriptionBilling ? 0.8 : 0),
      1,
      16
    ).toFixed(1)
  );

  const baseBuild =
    1400 +
    complexityScore * 52 +
    input.integrations * 280 +
    input.paymentFlows * 350 +
    input.aiFeatures * 300 +
    (input.dataMigration ? 450 : 0);

  const recommendedBuildFee = roundTo(clamp(baseBuild, 1800, 15000), 100);

  // Monthly pricing is cost-to-serve first, then margin. The model assumes an
  // internal labour cost of roughly £40/hr and adds infrastructure/risk cover.
  const costToServe = predictedSupportHours * 40 + 35 + complexityScore * 1.1;
  const recommendedMonthlyFee = roundTo(clamp(costToServe * 1.75, 80, 900), 10);

  let recommendedTransactionFeeBps = 0;
  if (input.paymentFlows > 0) {
    if (input.expectedMonthlyTransactions < 100) recommendedTransactionFeeBps = 150;
    else if (input.expectedMonthlyTransactions < 500) recommendedTransactionFeeBps = 125;
    else if (input.expectedMonthlyTransactions < 2000) recommendedTransactionFeeBps = 100;
    else recommendedTransactionFeeBps = 75;
  }

  const riskPoints =
    input.clientChangeRisk * 2 +
    input.integrations +
    input.paymentFlows +
    (input.subscriptionBilling ? 2 : 0) +
    (input.dataMigration ? 1 : 0);

  const riskLevel: QuoteAssessment["riskLevel"] =
    riskPoints >= 10 || complexityScore >= 78
      ? "high"
      : riskPoints >= 6 || complexityScore >= 55
        ? "medium"
        : "low";

  return {
    complexityScore,
    riskLevel,
    recommendedBuildFee,
    recommendedMonthlyFee,
    recommendedTransactionFeeBps,
    predictedSupportHours,
  };
}
