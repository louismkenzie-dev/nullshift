/**
 * Application fees collected via Stripe Connect — pure aggregation.
 *
 * One row in (connect_application_fees) per Stripe Application Fee object.
 * Everything here is arithmetic and grouping over rows already in our DB;
 * the Stripe-facing ingestion (webhook + reconciliation) lives in
 * connectFeeSync.ts, which is the only thing that writes those rows.
 */

export type FeeRow = {
  id: string;
  tenant_id: string | null;
  stripe_account_id: string;
  amount: number; // pence, gross fee
  amount_refunded: number; // pence
  currency: string;
  livemode: boolean;
  stripe_created_at: string; // ISO
  /** The connected account's own business label, cached at sync time. */
  stripe_account_name?: string | null;
};

/** What Nullshift actually kept, after any refund of the fee itself. */
export const netFeePence = (row: Pick<FeeRow, "amount" | "amount_refunded">): number =>
  Math.max(0, row.amount - row.amount_refunded);

export type FeeTotals = {
  grossPence: number;
  refundedPence: number;
  netPence: number;
  count: number;
};

const emptyTotals = (): FeeTotals => ({
  grossPence: 0,
  refundedPence: 0,
  netPence: 0,
  count: 0,
});

function addRow(t: FeeTotals, row: FeeRow): FeeTotals {
  return {
    grossPence: t.grossPence + row.amount,
    refundedPence: t.refundedPence + row.amount_refunded,
    netPence: t.netPence + netFeePence(row),
    count: t.count + 1,
  };
}

/**
 * Totals across the given rows. Test-mode fees are excluded by default — they
 * are not real revenue and must never inflate the headline figure; pass
 * `includeTestMode: true` to see them (used only to surface a "N test fees
 * exist" note, never folded into the real total).
 */
export function totalFees(
  rows: FeeRow[],
  opts: { includeTestMode?: boolean; since?: Date } = {}
): FeeTotals {
  const since = opts.since;
  return rows
    .filter((r) => opts.includeTestMode || r.livemode)
    .filter((r) => !since || new Date(r.stripe_created_at) >= since)
    .reduce(addRow, emptyTotals());
}

export type TenantFeeBreakdown = {
  tenantId: string | null;
  tenantName: string;
  stripeAccountId: string;
  /** Stripe's own label for the account — how an unmatched one is recognised. */
  stripeAccountName: string | null;
  totals: FeeTotals;
  lastCollectedAt: string | null;
};

/**
 * Group live-mode fees by tenant (falling back to the raw connected account
 * id, labelled "Unmatched account", for a row whose tenant link has broken —
 * so a real collected fee can never just disappear from the breakdown).
 * Sorted by net amount collected, highest first.
 */
export function breakdownByTenant(
  rows: FeeRow[],
  tenantNames: Map<string, string>
): TenantFeeBreakdown[] {
  const groups = new Map<string, TenantFeeBreakdown>();
  for (const row of rows) {
    if (!row.livemode) continue;
    const key = row.tenant_id ?? `account:${row.stripe_account_id}`;
    const existing = groups.get(key);
    const name = row.tenant_id
      ? (tenantNames.get(row.tenant_id) ?? "Unknown client")
      : (row.stripe_account_name ?? `Unmatched account (${row.stripe_account_id})`);
    if (existing) {
      existing.totals = addRow(existing.totals, row);
      if (row.stripe_created_at > (existing.lastCollectedAt ?? ""))
        existing.lastCollectedAt = row.stripe_created_at;
      if (!existing.stripeAccountName && row.stripe_account_name)
        existing.stripeAccountName = row.stripe_account_name;
    } else {
      groups.set(key, {
        tenantId: row.tenant_id,
        tenantName: name,
        stripeAccountId: row.stripe_account_id,
        stripeAccountName: row.stripe_account_name ?? null,
        totals: addRow(emptyTotals(), row),
        lastCollectedAt: row.stripe_created_at,
      });
    }
  }
  return [...groups.values()].sort((a, b) => b.totals.netPence - a.totals.netPence);
}

/** How many rows are test-mode — surfaced as a note, never mixed into a real total. */
export const testModeCount = (rows: FeeRow[]): number =>
  rows.filter((r) => !r.livemode).length;

/** "£12.34" — matches the plain £-formatting used across the ops hub. */
export const gbpFromPence = (pence: number): string =>
  "£" +
  (pence / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Start of the current calendar month, for the "this month" figure. */
export function startOfMonth(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
