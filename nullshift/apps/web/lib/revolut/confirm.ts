import { createServiceClient } from "@nullshift/db";
import { logAudit, logAuditAsService } from "@nullshift/db/audit";
import { allocationCeiling, spreadPayment, type OpenDebt } from "@/lib/billing/allocation";
import { markInvoicePaidOutOfBand } from "@/lib/markInvoicePaid";

/**
 * Confirming a bank-match suggestion — ONE implementation, two callers:
 *
 *   • staff, from the Bank page (lib/revolut/actions.ts): reads with the
 *     signed-in client (RLS), decided_by = the person;
 *   • the sync, for a suggestion the matcher marked `autoConfirm` (the
 *     transfer quotes the invoice's own payment reference, exact amount, open
 *     transfer-rail invoice): reads with the service client, decided_by null,
 *     audit `bank_match.auto_confirmed`.
 *
 * What confirming does:
 *   - kind 'invoice' with an obligation → the bank movement becomes a
 *     provider_payments row (provider 'bank') and payment_allocations per
 *     obligation via the allocation helpers; the DB trigger stays the
 *     authority on the ceiling.
 *   - an open invoice collected by bank transfer (no card or Direct Debit
 *     rail) → marked paid, Xero payment mirrored: confirming its transfer IS
 *     the payment decision.
 *   - anything else → the decision is recorded only.
 */

type Service = ReturnType<typeof createServiceClient>;

export type DecisionResult =
  | { ok: true; allocations: number; paidInvoiceIds: string[] }
  | { ok: false; reason: "forbidden" | "not_found" | "already_decided" | "invalid" | "db_error"; message: string };

export type MatchRow = {
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

export type TxRow = {
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

export async function loadMatchWith(reader: Service, matchId: string): Promise<{ match: MatchRow; tx: TxRow } | null> {
  const { data: match } = await reader.from("bank_matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) return null;
  const m = match as MatchRow;
  const { data: tx } = await reader.from("bank_transactions").select("*").eq("id", m.transaction_id).maybeSingle();
  if (!tx) return null;
  return { match: m, tx: tx as TxRow };
}

export async function applyMatchConfirmation(opts: {
  /** Reads and the bank_matches decision: the staff client, or the service client for the sync. */
  reader: Service;
  service: Service;
  match: MatchRow;
  tx: TxRow;
  /** auth.users id of the person, null for the sync. */
  decidedBy: string | null;
  via: "staff" | "auto";
}): Promise<DecisionResult> {
  const { reader, service, match, tx, decidedBy, via } = opts;
  if (match.state !== "suggested") return { ok: false, reason: "already_decided", message: `Already ${match.state}.` };
  if (tx.state !== "completed") return { ok: false, reason: "invalid", message: "Only a completed transaction can be matched." };

  const now = new Date().toISOString();
  const allocationIds: string[] = [];
  const paidInvoiceIds: string[] = [];
  let tenantId: string | null = null;

  if (match.kind === "invoice" && tx.amount_minor > 0) {
    const invoiceIds = [match.invoice_id, ...(match.split_invoice_ids ?? [])].filter((x): x is string => !!x);
    const { data: invs } = await reader
      .from("invoices")
      .select("id, tenant_id, obligation_id, amount, due_at, status, stripe_invoice_id, gc_payment_id, subscription_id")
      .in("id", invoiceIds);
    const invoices = (invs ?? []) as {
      id: string;
      tenant_id: string;
      obligation_id: string | null;
      amount: string | number;
      due_at: string | null;
      status: string;
      stripe_invoice_id: string | null;
      gc_payment_id: string | null;
      subscription_id: string | null;
    }[];
    if (invoices.length !== invoiceIds.length)
      return { ok: false, reason: "not_found", message: "An invoice in this suggestion no longer exists." };
    tenantId = invoices[0]?.tenant_id ?? null;

    const withObligation = invoices.filter((i) => i.obligation_id);
    if (withObligation.length) {
      const obligationIds = withObligation.map((i) => i.obligation_id as string);
      const { data: obs } = await reader
        .from("billing_obligations")
        .select("id, tenant_id, amount_gross_minor, currency, due_at")
        .in("id", obligationIds);
      const obligations = (obs ?? []) as { id: string; tenant_id: string; amount_gross_minor: number; currency: string; due_at: string | null }[];
      if (obligations.some((o) => o.currency !== tx.currency))
        return { ok: false, reason: "invalid", message: "Obligation currency differs from the bank transaction." };

      const { data: existingAllocs } = await reader
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
      if (!spread.ok) return { ok: false, reason: "invalid", message: spread.problems.map((p) => p.detail).join(" ") };
      if (spread.value.allocations.length === 0)
        return { ok: false, reason: "invalid", message: "Nothing remains owed on the matched obligation(s)." };

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
          evidence: { source: "revolut_bank_feed", bank_transaction_id: tx.id, reference: tx.reference, counterparty: tx.counterparty_name, match_id: match.id, via },
          created_by: decidedBy,
        },
        { onConflict: "provider,provider_payment_id", ignoreDuplicates: true }
      );
      if (ppErr) return { ok: false, reason: "db_error", message: ppErr.message };

      const alreadyAgainstPayment = allocs.filter((a) => a.provider === "bank" && a.provider_payment_id === providerPaymentId);
      let running = 0;
      for (const a of spread.value.allocations) {
        const ceiling = allocationCeiling(
          { provider: "bank", providerPaymentId, kind: "payment", amountMinor: tx.amount_minor, currency: tx.currency },
          alreadyAgainstPayment.map((x) => ({ provider: x.provider, providerPaymentId: x.provider_payment_id, kind: x.kind, amountMinor: x.amount_minor })),
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
              evidence: { source: "revolut_bank_feed", match_id: match.id, explanation: match.explanation, confidence: match.confidence, decided_by: decidedBy, via },
              created_by: decidedBy,
            },
            { onConflict: "provider,provider_payment_id,kind,obligation_id", ignoreDuplicates: true }
          )
          .select("id")
          .maybeSingle();
        if (error) return { ok: false, reason: "db_error", message: error.message };
        if (row) allocationIds.push((row as { id: string }).id);
      }
    }

    // An invoice collected by bank transfer (a monthly-invoiced care plan, a
    // build or one-off invoice with no card or Direct Debit rail) has the
    // bank as its rail: confirming its transfer IS the payment decision, so
    // it is marked paid here, with the Xero mirror. Card and Direct Debit
    // invoices are left to their own rails.
    const transferPaid = invoices.filter(
      (i) => i.status === "open" && !i.stripe_invoice_id && !i.gc_payment_id && (i.subscription_id || !i.obligation_id)
    );
    for (const inv of transferPaid) {
      const r = await markInvoicePaidOutOfBand({
        tenantId: inv.tenant_id,
        invoiceId: inv.id,
        via: via === "auto" ? "bank_transfer_auto" : "bank_transfer",
        asService: via === "auto",
        evidence: { bank_transaction_id: tx.id, reference: tx.reference, match_id: match.id },
      });
      if (r.ok) paidInvoiceIds.push(inv.id);
    }
  }

  const { data: updated, error: uErr } = await reader
    .from("bank_matches")
    .update({ state: "confirmed", decided_by: decidedBy, decided_at: now, allocation_ids: allocationIds })
    .eq("id", match.id)
    .eq("state", "suggested")
    .select("id");
  if (uErr) return { ok: false, reason: "db_error", message: uErr.message };
  if (!updated?.length) return { ok: false, reason: "already_decided", message: "Decided elsewhere." };

  const audit = {
    action: via === "auto" ? "bank_match.auto_confirmed" : "bank_match.confirmed",
    target: `bank_match:${match.id}`,
    tenantId,
    metadata: {
      transaction_id: tx.id,
      kind: match.kind,
      invoice_id: match.invoice_id,
      split_invoice_ids: match.split_invoice_ids,
      confidence: match.confidence,
      allocation_ids: allocationIds,
      paid_invoice_ids: paidInvoiceIds,
      amount_minor: tx.amount_minor,
      currency: tx.currency,
      reference: tx.reference,
      via,
    },
  };
  if (via === "auto") await logAuditAsService(audit);
  else await logAudit(audit);
  return { ok: true, allocations: allocationIds.length, paidInvoiceIds };
}
