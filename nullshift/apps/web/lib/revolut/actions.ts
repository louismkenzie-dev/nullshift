"use server";

/**
 * Staff decisions on bank-match suggestions and the disconnect action.
 *
 * Confirming a match:
 *   - kind 'invoice' with an obligation → record the bank movement as a
 *     provider_payments row (provider 'bank', id = the bank transaction id)
 *     and a payment_allocations row per obligation via the Phase 4
 *     allocation helpers (spreadPayment / allocationCeiling). The database
 *     trigger remains the authority on the ceiling.
 *   - anything else → record the decision only.
 *   Never edits invoices.status (brief §10.1: the bank line is evidence; the
 *   invoice's own rail decides when it is paid).
 *
 * Every decision writes audit_log. requireStaff() gates everything.
 */

import { revalidatePath } from "next/cache";
import { requireStaff } from "@nullshift/auth/guards";
import { createClient, createServiceClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { allocationCeiling, spreadPayment, type OpenDebt } from "@/lib/billing/allocation";
import { revokeConnection } from "./store";

export type DecisionResult =
  | { ok: true; allocations: number }
  | { ok: false; reason: "forbidden" | "not_found" | "already_decided" | "invalid" | "db_error"; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type MatchRow = {
  id: string;
  transaction_id: string;
  kind: "invoice" | "collection" | "payout" | "fee" | "other";
  invoice_id: string | null;
  obligation_id: string | null;
  split_invoice_ids: string[];
  confidence: number;
  explanation: string;
  state: "suggested" | "confirmed" | "rejected";
};

type TxRow = {
  id: string;
  environment: "production" | "sandbox";
  provider_tx_id: string;
  provider_leg_id: string;
  amount_minor: number;
  currency: string;
  state: string;
  reference: string | null;
  counterparty_name: string | null;
  completed_at_provider: string | null;
};

async function loadMatch(matchId: string): Promise<{ match: MatchRow; tx: TxRow } | null> {
  const supabase = await createClient();
  const { data: match } = await supabase.from("bank_matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) return null;
  const m = match as MatchRow;
  const { data: tx } = await supabase.from("bank_transactions").select("*").eq("id", m.transaction_id).maybeSingle();
  if (!tx) return null;
  return { match: m, tx: tx as TxRow };
}

export async function confirmMatch(matchId: string): Promise<DecisionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, reason: "forbidden", message: "Staff only." };
  if (!UUID.test(matchId)) return { ok: false, reason: "invalid", message: "Bad match id." };
  const loaded = await loadMatch(matchId);
  if (!loaded) return { ok: false, reason: "not_found", message: "Suggestion not found." };
  const { match, tx } = loaded;
  if (match.state !== "suggested")
    return { ok: false, reason: "already_decided", message: `Already ${match.state}.` };
  if (tx.state !== "completed")
    return { ok: false, reason: "invalid", message: "Only a completed transaction can be matched." };

  const supabase = await createClient();
  const now = new Date().toISOString();
  const allocationIds: string[] = [];
  let tenantId: string | null = null;

  if (match.kind === "invoice" && tx.amount_minor > 0) {
    const invoiceIds = [match.invoice_id, ...(match.split_invoice_ids ?? [])].filter((x): x is string => !!x);
    const { data: invs } = await supabase
      .from("invoices")
      .select("id, tenant_id, obligation_id, amount, due_at")
      .in("id", invoiceIds);
    const invoices = (invs ?? []) as { id: string; tenant_id: string; obligation_id: string | null; amount: string | number; due_at: string | null }[];
    if (invoices.length !== invoiceIds.length)
      return { ok: false, reason: "not_found", message: "An invoice in this suggestion no longer exists." };
    tenantId = invoices[0]?.tenant_id ?? null;

    const withObligation = invoices.filter((i) => i.obligation_id);
    if (withObligation.length) {
      const obligationIds = withObligation.map((i) => i.obligation_id as string);
      const { data: obs } = await supabase
        .from("billing_obligations")
        .select("id, tenant_id, amount_gross_minor, currency, due_at")
        .in("id", obligationIds);
      const obligations = (obs ?? []) as { id: string; tenant_id: string; amount_gross_minor: number; currency: string; due_at: string | null }[];
      if (obligations.some((o) => o.currency !== tx.currency))
        return { ok: false, reason: "invalid", message: "Obligation currency differs from the bank transaction." };

      // Existing allocations against these obligations reduce what is owed.
      const { data: existingAllocs } = await supabase
        .from("payment_allocations")
        .select("obligation_id, amount_minor, kind, provider, provider_payment_id")
        .in("obligation_id", obligationIds);
      const allocs = (existingAllocs ?? []) as { obligation_id: string; amount_minor: number; kind: string; provider: string; provider_payment_id: string }[];
      const settled = new Map<string, number>();
      for (const a of allocs) if (a.kind === "payment") settled.set(a.obligation_id, (settled.get(a.obligation_id) ?? 0) + a.amount_minor);

      const debts: OpenDebt[] = obligations.map((o) => ({
        obligationId: o.id,
        remainingMinor: o.amount_gross_minor - (settled.get(o.id) ?? 0),
        currency: o.currency,
        dueAt: o.due_at,
      }));
      const spread = spreadPayment(tx.amount_minor, tx.currency, debts);
      if (!spread.ok)
        return { ok: false, reason: "invalid", message: spread.problems.map((p) => p.detail).join(" ") };
      if (spread.value.allocations.length === 0)
        return { ok: false, reason: "invalid", message: "Nothing remains owed on the matched obligation(s)." };

      // Record the bank movement as the provider payment (idempotent on
      // provider + provider_payment_id) via the service client: staff RLS
      // covers reads, the ledger write is a trusted server action.
      const service = createServiceClient();
      const providerPaymentId = `revolut:${tx.environment}:${tx.provider_tx_id}:${tx.provider_leg_id}`;
      const { error: ppErr } = await service.from("provider_payments").upsert(
        {
          tenant_id: tenantId,
          provider: "bank",
          provider_payment_id: providerPaymentId,
          kind: "payment",
          amount_minor: tx.amount_minor,
          currency: tx.currency,
          environment: tx.environment === "production" ? "live" : "test",
          received_at: tx.completed_at_provider ?? now,
          evidence: { source: "revolut_bank_feed", bank_transaction_id: tx.id, reference: tx.reference, counterparty: tx.counterparty_name, match_id: match.id },
          created_by: staff.userId,
        },
        { onConflict: "provider,provider_payment_id", ignoreDuplicates: true }
      );
      if (ppErr) return { ok: false, reason: "db_error", message: ppErr.message };

      const alreadyAgainstPayment = allocs.filter((a) => a.provider === "bank" && a.provider_payment_id === providerPaymentId);
      let running = 0;
      for (const a of spread.value.allocations) {
        const ceiling = allocationCeiling(
          { provider: "bank", providerPaymentId, kind: "payment", amountMinor: tx.amount_minor, currency: tx.currency },
          alreadyAgainstPayment.map((x) => ({ ...x, providerPaymentId: x.provider_payment_id })),
          running + a.amountMinor
        );
        if (!ceiling.allowed) return { ok: false, reason: "invalid", message: ceiling.reason ?? "Over-allocation." };
        running += a.amountMinor;
        const inv = withObligation.find((i) => i.obligation_id === a.obligationId);
        const { data: row, error } = await service
          .from("payment_allocations")
          .upsert(
            {
              tenant_id: tenantId,
              invoice_id: inv?.id ?? null,
              obligation_id: a.obligationId,
              provider: "bank",
              provider_payment_id: providerPaymentId,
              kind: "payment",
              amount_minor: a.amountMinor,
              currency: tx.currency,
              allocated_at: now,
              evidence: { source: "revolut_bank_feed", match_id: match.id, explanation: match.explanation, confidence: match.confidence, decided_by: staff.userId },
              created_by: staff.userId,
            },
            { onConflict: "provider,provider_payment_id,kind,obligation_id", ignoreDuplicates: true }
          )
          .select("id")
          .maybeSingle();
        if (error) return { ok: false, reason: "db_error", message: error.message };
        if (row) allocationIds.push((row as { id: string }).id);
      }
    }
  }

  const { data: updated, error: uErr } = await supabase
    .from("bank_matches")
    .update({ state: "confirmed", decided_by: staff.userId, decided_at: now, allocation_ids: allocationIds })
    .eq("id", match.id)
    .eq("state", "suggested")
    .select("id");
  if (uErr) return { ok: false, reason: "db_error", message: uErr.message };
  if (!updated?.length) return { ok: false, reason: "already_decided", message: "Decided elsewhere." };

  await logAudit({
    action: "bank_match.confirmed",
    target: `bank_match:${match.id}`,
    tenantId,
    metadata: { transaction_id: tx.id, kind: match.kind, invoice_id: match.invoice_id, split_invoice_ids: match.split_invoice_ids, confidence: match.confidence, allocation_ids: allocationIds, amount_minor: tx.amount_minor, currency: tx.currency },
  });
  revalidatePath("/admin/bank");
  return { ok: true, allocations: allocationIds.length };
}

export async function rejectMatch(matchId: string): Promise<DecisionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, reason: "forbidden", message: "Staff only." };
  if (!UUID.test(matchId)) return { ok: false, reason: "invalid", message: "Bad match id." };
  const loaded = await loadMatch(matchId);
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
  return { ok: true, allocations: 0 };
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
