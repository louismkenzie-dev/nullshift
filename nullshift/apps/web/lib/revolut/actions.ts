"use server";

/**
 * Staff decisions on bank-match suggestions and the disconnect action.
 *
 * Confirming a match runs the ONE confirmation implementation in
 * ./confirm.ts (shared with the sync's automatic confirmation of exact
 * payment-reference matches): provider_payments + payment_allocations for an
 * obligation-backed invoice, mark-paid + Xero mirror for a transfer-rail
 * invoice, the decision only for anything else.
 *
 * Every decision writes audit_log. requireStaff() gates everything.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@nullshift/auth/guards";
import { createClient, createServiceClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { applyMatchConfirmation, loadMatchWith, type DecisionResult } from "./confirm";
import { revokeConnection, runSync, type SyncOutcome } from "./store";

export type { DecisionResult } from "./confirm";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function confirmMatch(matchId: string): Promise<DecisionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, reason: "forbidden", message: "Staff only." };
  if (!UUID.test(matchId)) return { ok: false, reason: "invalid", message: "Bad match id." };
  const reader = await createClient();
  const loaded = await loadMatchWith(reader, matchId);
  if (!loaded) return { ok: false, reason: "not_found", message: "Suggestion not found." };
  const result = await applyMatchConfirmation({
    reader,
    service: createServiceClient(),
    match: loaded.match,
    tx: loaded.tx,
    decidedBy: staff.userId,
    via: "staff",
  });
  revalidatePath("/admin/bank");
  return result;
}

export async function rejectMatch(matchId: string): Promise<DecisionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, reason: "forbidden", message: "Staff only." };
  if (!UUID.test(matchId)) return { ok: false, reason: "invalid", message: "Bad match id." };
  const loaded = await loadMatchWith(await createClient(), matchId);
  if (!loaded) return { ok: false, reason: "not_found", message: "Suggestion not found." };
  if (loaded.match.state !== "suggested")
    return { ok: false, reason: "already_decided", message: `Already ${loaded.match.state}.` };
  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("bank_matches")
    .update({ state: "rejected", decided_by: staff.userId, decided_at: new Date().toISOString() })
    .eq("id", matchId)
    .eq("state", "suggested")
    .select("id");
  if (error) return { ok: false, reason: "db_error", message: error.message };
  if (!updated?.length) return { ok: false, reason: "already_decided", message: "Decided elsewhere." };
  await logAudit({
    action: "bank_match.rejected",
    target: `bank_match:${matchId}`,
    metadata: { transaction_id: loaded.tx.id, kind: loaded.match.kind, invoice_id: loaded.match.invoice_id },
  });
  revalidatePath("/admin/bank");
  return { ok: true, allocations: 0, paidInvoiceIds: [] };
}

/** Form-action wrappers (a <form action> must return void). */
export async function confirmMatchForm(formData: FormData): Promise<void> {
  await confirmMatch(String(formData.get("matchId") ?? ""));
}
export async function rejectMatchForm(formData: FormData): Promise<void> {
  await rejectMatch(String(formData.get("matchId") ?? ""));
}

export async function disconnectRevolut(connectionId: string): Promise<{ ok: boolean; message?: string }> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, message: "Staff only." };
  if (!UUID.test(connectionId)) return { ok: false, message: "Bad connection id." };
  await revokeConnection(connectionId, staff.userId);
  await logAudit({ action: "revolut.disconnected", target: `revolut_connection:${connectionId}` });
  revalidatePath("/admin/bank");
  return { ok: true };
}
export async function disconnectRevolutForm(formData: FormData): Promise<void> {
  await disconnectRevolut(String(formData.get("connectionId") ?? ""));
}

/**
 * Pull the feed now. The scheduled import is a Vercel cron, and crons have
 * not been running on this project, so staff can run the same sync by hand
 * (and the Bank page runs it on load when the feed is stale). Nothing here
 * differs from the cron: refresh the token if needed, import the window,
 * upsert, suggest matches. Never moves money.
 */
export async function syncRevolutNow(): Promise<SyncOutcome> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, connectionId: null, error: "Staff only." };
  const outcome = await runSync();
  await logAudit({
    action: "revolut.sync_requested",
    target: outcome.connectionId ? `revolut_connection:${outcome.connectionId}` : "revolut",
    metadata: outcome.ok
      ? { ok: true, transactions: outcome.transactions, legs: outcome.legs, suggestions: outcome.suggestions, autoConfirmed: outcome.autoConfirmed }
      : { ok: false, error: "error" in outcome ? outcome.error : outcome.skipped },
  });
  revalidatePath("/admin/bank");
  return outcome;
}
export async function syncRevolutNowForm(): Promise<void> {
  const outcome = await syncRevolutNow();
  redirect(
    outcome.ok
      ? `/admin/bank?notice=synced&n=${outcome.transactions}&m=${outcome.suggestions}&a=${outcome.autoConfirmed}`
      : `/admin/bank?notice=sync_failed&detail=${encodeURIComponent("error" in outcome ? outcome.error : outcome.skipped)}`
  );
}
