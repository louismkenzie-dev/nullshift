/**
 * Sync arithmetic and the transaction → row mapping. Pure: the cron route
 * feeds it the connection row and the API pages; it never performs I/O.
 *
 *  - `syncWindow(lastSyncAt, now)` — import from (last sync − 2 days) so a
 *    transaction that completed late, or a page the previous run missed, is
 *    picked up; the upsert key makes the overlap harmless. First run: 90 days.
 *  - `needsRefresh(accessExpiresAt, now)` — refresh when the access token has
 *    fewer than 5 minutes left (Revolut access tokens live 40 minutes).
 *  - `toTransactionRows(tx, ...)` — one row per leg, signed minor units.
 *  - `connectionHealth(...)` — the page never says "healthy" unless the last
 *    sync succeeded within 2 hours.
 */

import type { RevolutTransaction } from "./client";

export const LOOKBACK_MS = 2 * 24 * 60 * 60 * 1000;
export const FIRST_SYNC_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;
export const REFRESH_SKEW_MS = 5 * 60 * 1000;
export const HEALTHY_WITHIN_MS = 2 * 60 * 60 * 1000;

export function syncWindow(
  lastSyncAt: string | null | undefined,
  now: Date = new Date()
): { from: Date; to: Date } {
  const to = now;
  const base = lastSyncAt ? new Date(lastSyncAt).getTime() : NaN;
  const from = Number.isFinite(base)
    ? new Date(Math.min(base - LOOKBACK_MS, to.getTime()))
    : new Date(to.getTime() - FIRST_SYNC_LOOKBACK_MS);
  return { from, to };
}

export function needsRefresh(
  accessExpiresAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!accessExpiresAt) return true;
  const t = new Date(accessExpiresAt).getTime();
  if (!Number.isFinite(t)) return true;
  return t - now.getTime() < REFRESH_SKEW_MS;
}

/** Decimal major units → integer minor units (2 dp), half-up, sign preserved. */
export function toMinor(amount: number): number {
  const sign = amount < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(amount) * 100 + 1e-9);
}

export type BankTransactionRow = {
  connection_id: string;
  provider: "revolut";
  environment: "production" | "sandbox";
  provider_tx_id: string;
  provider_leg_id: string;
  account_id: string;
  account_name: string | null;
  currency: string;
  amount_minor: number;
  fee_minor: number;
  state: "pending" | "completed" | "declined" | "failed" | "reverted";
  type: string;
  reference: string | null;
  counterparty_name: string | null;
  counterparty_account: string | null;
  created_at_provider: string;
  completed_at_provider: string | null;
  raw: Record<string, unknown>;
};

const STATES = new Set(["pending", "completed", "declined", "failed", "reverted"]);

export function toTransactionRows(
  tx: RevolutTransaction,
  ctx: {
    connectionId: string;
    environment: "production" | "sandbox";
    accountNames: ReadonlyMap<string, string>;
  }
): BankTransactionRow[] {
  const state = STATES.has(tx.state) ? (tx.state as BankTransactionRow["state"]) : "pending";
  return (tx.legs ?? []).map((leg) => ({
    connection_id: ctx.connectionId,
    provider: "revolut",
    environment: ctx.environment,
    provider_tx_id: tx.id,
    provider_leg_id: leg.leg_id,
    account_id: leg.account_id,
    account_name: ctx.accountNames.get(leg.account_id) ?? null,
    currency: (leg.currency ?? "GBP").toUpperCase(),
    amount_minor: toMinor(leg.amount ?? 0),
    fee_minor: toMinor(leg.fee ?? 0),
    state,
    type: tx.type ?? "unknown",
    reference: tx.reference ?? leg.description ?? null,
    counterparty_name: leg.counterparty?.name ?? tx.merchant?.name ?? null,
    counterparty_account: leg.counterparty?.account_id ?? null,
    created_at_provider: tx.created_at,
    completed_at_provider: tx.completed_at ?? null,
    // Raw payload is kept for evidence; it contains no token material.
    raw: { transaction: stripLegs(tx), leg },
  }));
}

function stripLegs(tx: RevolutTransaction): Record<string, unknown> {
  const { legs: _legs, ...rest } = tx;
  void _legs;
  return rest as Record<string, unknown>;
}

/** Model of an idempotent upsert: same key → one row, latest values win. */
export function mergeUpsert(
  existing: readonly BankTransactionRow[],
  incoming: readonly BankTransactionRow[]
): BankTransactionRow[] {
  const key = (r: BankTransactionRow) =>
    `${r.provider}|${r.environment}|${r.provider_tx_id}|${r.provider_leg_id}`;
  const map = new Map(existing.map((r) => [key(r), r]));
  for (const r of incoming) map.set(key(r), r);
  return [...map.values()];
}

export type ConnectionHealth =
  | { level: "healthy"; label: "Healthy"; detail: string }
  | { level: "stale"; label: "Stale"; detail: string }
  | { level: "error"; label: "Error"; detail: string }
  | { level: "never"; label: "Never synced"; detail: string }
  | { level: "disconnected"; label: "Not connected"; detail: string };

export function connectionHealth(
  c:
    | {
        status: "active" | "revoked";
        last_sync_at: string | null;
        last_sync_status: "ok" | "error" | null;
        last_error: string | null;
      }
    | null,
  now: Date = new Date()
): ConnectionHealth {
  if (!c || c.status !== "active")
    return { level: "disconnected", label: "Not connected", detail: "No active Revolut consent." };
  if (!c.last_sync_at)
    return { level: "never", label: "Never synced", detail: "The first sync has not run yet." };
  const age = now.getTime() - new Date(c.last_sync_at).getTime();
  if (c.last_sync_status === "error")
    return {
      level: "error",
      label: "Error",
      detail: c.last_error ?? "The last sync failed.",
    };
  if (age > HEALTHY_WITHIN_MS)
    return {
      level: "stale",
      label: "Stale",
      detail: `Last successful sync was ${Math.round(age / 3_600_000)} hours ago.`,
    };
  return { level: "healthy", label: "Healthy", detail: "Last sync succeeded within 2 hours." };
}
