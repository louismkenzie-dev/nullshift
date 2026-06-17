/**
 * Platform fee maths for the clinic patient-payment "skim" (brief §7).
 *
 * Model: patients pay through the clinic's own connected Stripe account; Nullshift
 * takes an `application_fee_amount` of 2% of each payment, with a £39/month
 * minimum reconciled monthly (we charge the shortfall if 2% of the month's volume
 * is less than £39). All amounts are in PENCE (Stripe's smallest unit) to avoid
 * floating-point drift.
 */

export const TRANSACTION_FEE_RATE = 0.02; // 2%
export const MONTHLY_FLOOR_PENCE = 3900; // £39.00

/** Per-payment application fee (pence), 2% rounded to the nearest penny. */
export function applicationFeePence(amountPence: number): number {
  if (!Number.isFinite(amountPence) || amountPence <= 0) return 0;
  return Math.round(amountPence * TRANSACTION_FEE_RATE);
}

/**
 * Monthly reconciliation: given the total of all per-payment 2% fees collected in
 * a month, return the extra to charge so Nullshift earns at least the £39 floor.
 */
export function monthlyShortfallPence(collectedFeePence: number): number {
  const collected = Math.max(0, collectedFeePence || 0);
  return Math.max(0, MONTHLY_FLOOR_PENCE - collected);
}

/** Effective monthly platform revenue for a clinic given its payment volume. */
export function monthlyPlatformRevenuePence(monthlyVolumePence: number): number {
  const twoPct = applicationFeePence(monthlyVolumePence);
  return Math.max(twoPct, MONTHLY_FLOOR_PENCE);
}
