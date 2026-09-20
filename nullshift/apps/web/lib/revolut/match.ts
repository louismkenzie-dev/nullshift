/**
 * Bank-match suggestions — pure rules (brief §5.6 "suggested matches explain
 * their evidence; ambiguous matches require human review"; §10.1 "bank
 * movement is evidence, not an issuer").
 *
 * For each completed transaction the matcher proposes zero or more
 * suggestions. Every suggestion is `state: "suggested"`; nothing here (or
 * anywhere in the sync) confirms one. Confidence is a number in [0, 1]:
 *
 *   0.95  reference match  — amount equals an open/paid invoice AND the
 *         invoice reference (id prefix), obligation label or client name
 *         appears in the transaction reference / counterparty
 *   0.60  amount-only match — amount equals exactly one invoice due within
 *         ±14 days of the transaction (medium)
 *   0.40  amount-only match with several candidates (each listed)
 *   0.30  split — several open invoices sum to the transfer (low)
 *   0.90  GoCardless payout (reference contains "GoCardless")
 *   0.90  Stripe payout (reference or counterparty contains "Stripe")
 *   0.90  Revolut fee (type "fee", or negative fee-only leg)
 *
 * Money is integer minor units with an explicit currency. Reference text is
 * normalised to upper-case alphanumerics before comparison (same as
 * lib/billing/reconciliation.ts).
 */

export type MatchableTransaction = {
  id: string;
  amountMinor: number;
  feeMinor: number;
  currency: string;
  state: string;
  type: string;
  reference: string | null;
  counterpartyName: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type InvoiceCandidate = {
  id: string;
  tenantId: string;
  tenantName: string;
  /** Anything a payer might quote: an id prefix, an obligation label. */
  references: readonly string[];
  amountMinor: number;
  currency: string;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  dueAt: string | null;
  obligationId: string | null;
};

export type MatchKind = "invoice" | "collection" | "payout" | "fee" | "other";

export type Suggestion = {
  transactionId: string;
  kind: MatchKind;
  invoiceId: string | null;
  obligationId: string | null;
  /** Additional invoice ids for a split; empty otherwise. */
  splitInvoiceIds: string[];
  confidence: number;
  explanation: string;
  /** Stable per (transaction, rule) so a re-run upserts rather than duplicates. */
  ruleKey: string;
  state: "suggested";
};

export const normaliseRef = (s: string | null | undefined): string =>
  (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const AMOUNT_ONLY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_SUBSET_CANDIDATES = 12;

const isInbound = (t: MatchableTransaction) => t.amountMinor > 0;
const isCompleted = (t: MatchableTransaction) => t.state === "completed";

const haystack = (t: MatchableTransaction): string =>
  normaliseRef(`${t.reference ?? ""} ${t.counterpartyName ?? ""}`);

/** Which of the invoice's references (or client name) the transaction text names. */
export function referenceHit(t: MatchableTransaction, inv: InvoiceCandidate): string | null {
  const hay = haystack(t);
  if (hay.length < 4) return null;
  for (const r of inv.references) {
    const n = normaliseRef(r);
    if (n.length >= 4 && hay.includes(n)) return r;
  }
  const name = normaliseRef(inv.tenantName);
  if (name.length >= 4 && hay.includes(name)) return inv.tenantName;
  return null;
}

function withinDueWindow(t: MatchableTransaction, inv: InvoiceCandidate): boolean {
  if (!inv.dueAt) return false;
  const at = new Date(t.completedAt ?? t.createdAt).getTime();
  const due = new Date(inv.dueAt).getTime();
  return Number.isFinite(at) && Number.isFinite(due) && Math.abs(at - due) <= AMOUNT_ONLY_WINDOW_MS;
}

function subsetSums(pool: readonly InvoiceCandidate[], target: number): InvoiceCandidate[][] {
  const c = pool.slice(0, MAX_SUBSET_CANDIDATES);
  const found: InvoiceCandidate[][] = [];
  const n = c.length;
  for (let mask = 1; mask < 1 << n; mask += 1) {
    if ((mask & (mask - 1)) === 0) continue;
    let total = 0;
    for (let i = 0; i < n; i += 1) if (mask & (1 << i)) total += c[i].amountMinor;
    if (total === target) found.push(c.filter((_, i) => mask & (1 << i)));
  }
  return found;
}

const money = (minor: number, ccy: string) =>
  `${(minor / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${ccy}`;

/** Suggestions for ONE transaction. Empty when nothing fits. */
export function suggestForTransaction(
  t: MatchableTransaction,
  invoices: readonly InvoiceCandidate[]
): Suggestion[] {
  if (!isCompleted(t)) return [];
  const out: Suggestion[] = [];
  const hay = haystack(t);
  const base = { transactionId: t.id, state: "suggested" as const, splitInvoiceIds: [] as string[] };

  // Provider payouts and fees first: they are not client invoices.
  if (isInbound(t) && hay.includes("GOCARDLESS")) {
    out.push({
      ...base,
      kind: "payout",
      invoiceId: null,
      obligationId: null,
      confidence: 0.9,
      explanation: `Inbound ${money(t.amountMinor, t.currency)} whose reference/counterparty contains "GoCardless": a Direct Debit payout. Reconcile against the GoCardless payout report, not an invoice.`,
      ruleKey: "payout:gocardless",
    });
    return out;
  }
  if (isInbound(t) && hay.includes("STRIPE")) {
    out.push({
      ...base,
      kind: "payout",
      invoiceId: null,
      obligationId: null,
      confidence: 0.9,
      explanation: `Inbound ${money(t.amountMinor, t.currency)} whose reference/counterparty contains "Stripe": a card payout. Reconcile against the Stripe payout, not an invoice.`,
      ruleKey: "payout:stripe",
    });
    return out;
  }
  if (t.type.toLowerCase() === "fee" || (!isInbound(t) && t.feeMinor !== 0 && t.amountMinor === -Math.abs(t.feeMinor))) {
    out.push({
      ...base,
      kind: "fee",
      invoiceId: null,
      obligationId: null,
      confidence: 0.9,
      explanation: `Revolut fee of ${money(Math.abs(t.amountMinor), t.currency)} (transaction type "${t.type}").`,
      ruleKey: "fee:revolut",
    });
    return out;
  }

  if (!isInbound(t)) return out;

  const pool = invoices.filter(
    (i) => i.currency === t.currency && (i.status === "open" || i.status === "paid") && i.amountMinor > 0
  );
  if (pool.length === 0) return out;

  // High: amount equals AND reference/name names the invoice.
  const exact = pool.filter((i) => i.amountMinor === t.amountMinor);
  const named = exact
    .map((i) => ({ i, hit: referenceHit(t, i) }))
    .filter((x): x is { i: InvoiceCandidate; hit: string } => x.hit !== null);
  for (const { i, hit } of named) {
    out.push({
      ...base,
      kind: "invoice",
      invoiceId: i.id,
      obligationId: i.obligationId,
      confidence: 0.95,
      explanation: `Amount ${money(t.amountMinor, t.currency)} equals invoice ${i.id.slice(0, 8)} for ${i.tenantName}${i.status === "paid" ? " (already marked paid)" : ""}, and the transaction names "${hit}".`,
      ruleKey: `invoice:ref:${i.id}`,
    });
  }
  if (named.length) return out;

  // Medium: amount-only within the due window.
  const amountOnly = exact.filter((i) => withinDueWindow(t, i));
  if (amountOnly.length === 1) {
    const i = amountOnly[0];
    out.push({
      ...base,
      kind: "invoice",
      invoiceId: i.id,
      obligationId: i.obligationId,
      confidence: 0.6,
      explanation: `Amount ${money(t.amountMinor, t.currency)} equals invoice ${i.id.slice(0, 8)} for ${i.tenantName}, due ${i.dueAt?.slice(0, 10)}, and no other invoice in this currency; the reference does not name it.`,
      ruleKey: `invoice:amount:${i.id}`,
    });
    return out;
  }
  if (amountOnly.length > 1) {
    for (const i of amountOnly) {
      out.push({
        ...base,
        kind: "invoice",
        invoiceId: i.id,
        obligationId: i.obligationId,
        confidence: 0.4,
        explanation: `Amount ${money(t.amountMinor, t.currency)} equals ${amountOnly.length} invoices due in the same window; this one is ${i.id.slice(0, 8)} for ${i.tenantName}. Choose which the transfer settles.`,
        ruleKey: `invoice:amount:${i.id}`,
      });
    }
    return out;
  }

  // Low: several open invoices sum to one transfer.
  const openPool = pool.filter((i) => i.status === "open");
  const subsets = subsetSums(openPool, t.amountMinor);
  if (subsets.length >= 1) {
    const s = subsets[0];
    out.push({
      ...base,
      kind: "invoice",
      invoiceId: s[0].id,
      obligationId: s[0].obligationId,
      splitInvoiceIds: s.slice(1).map((i) => i.id),
      confidence: 0.3,
      explanation: `Amount ${money(t.amountMinor, t.currency)} equals the sum of ${s.length} open invoices (${s.map((i) => `${i.id.slice(0, 8)} ${i.tenantName}`).join(" + ")})${subsets.length > 1 ? `; ${subsets.length} combinations fit` : ""}. Several invoices in one transfer — verify with the payer before confirming.`,
      ruleKey: `invoice:split:${s.map((i) => i.id).sort().join("+")}`,
    });
  }
  return out;
}

/** Suggestions across many transactions (unmatched, completed only). */
export function suggestMatches(
  transactions: readonly MatchableTransaction[],
  invoices: readonly InvoiceCandidate[],
  alreadyDecided: ReadonlySet<string> = new Set()
): Suggestion[] {
  const out: Suggestion[] = [];
  for (const t of transactions) {
    if (alreadyDecided.has(t.id)) continue;
    out.push(...suggestForTransaction(t, invoices));
  }
  return out;
}

/** The matcher can only ever emit `suggested`; pinned by a test. */
export const canAutoConfirm = (): false => false;
