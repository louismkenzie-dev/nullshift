import { describe, expect, it } from "vitest";
import {
  AUTO_CONFIRM_CONFIDENCE,
  canAutoConfirm,
  shouldAutoConfirm,
  suggestForTransaction,
  uniqueReferenceHit,
  type InvoiceCandidate,
  type MatchableTransaction,
} from "@/lib/revolut/match";
import { invoiceRef } from "@nullshift/ui/format";

/**
 * Bank-transfer invoices reconcile themselves: the invoice carries a unique
 * payment reference (NS-<client>-<invoice>), the client quotes it, the sync
 * matches it and confirms without a person. Everything else still waits.
 */

const tenantId = "2e458eb1-2217-40d2-a52e-9bdfc32c797e";
const invoiceId = "89fab7a3-df30-4c9f-8213-7d13ebdef6ff";
const reference = invoiceRef(tenantId, invoiceId); // NS-2E458EB1-89FAB7

const inv = (over: Partial<InvoiceCandidate> = {}): InvoiceCandidate => ({
  id: invoiceId,
  tenantId,
  tenantName: "The Dance Exclusive",
  references: [reference, invoiceId.slice(0, 8)],
  paymentReference: reference,
  rail: "transfer",
  amountMinor: 18000,
  currency: "GBP",
  status: "open",
  dueAt: "2026-10-15T00:00:00Z",
  obligationId: null,
  ...over,
});
const tx = (over: Partial<MatchableTransaction> = {}): MatchableTransaction => ({
  id: "tx-1",
  amountMinor: 18000,
  feeMinor: 0,
  currency: "GBP",
  state: "completed",
  type: "transfer",
  reference: null,
  counterpartyName: null,
  completedAt: "2026-10-12T10:00:00Z",
  createdAt: "2026-10-12T10:00:00Z",
  ...over,
});

describe("payment reference", () => {
  it("is NS-<client>-<invoice>, unique per invoice", () => {
    expect(reference).toBe("NS-2E458EB1-89FAB7");
    expect(invoiceRef(tenantId, "516b6c81-0000-0000-0000-000000000000")).toBe("NS-2E458EB1-516B6C");
  });

  it("is recognised however the bank mangles it", () => {
    expect(uniqueReferenceHit(tx({ reference: "NS-2E458EB1-89FAB7" }), inv())).toBe(reference);
    expect(uniqueReferenceHit(tx({ reference: "ns 2e458eb1 89fab7 dance" }), inv())).toBe(reference);
    expect(uniqueReferenceHit(tx({ reference: "Inv NS2E458EB189FAB7" }), inv())).toBe(reference);
    expect(uniqueReferenceHit(tx({ reference: "89fab7a3" }), inv())).toBe("89fab7a3");
  });

  it("never matches on the client's name alone", () => {
    expect(uniqueReferenceHit(tx({ counterpartyName: "THE DANCE EXCLUSIVE" }), inv())).toBeNull();
    expect(uniqueReferenceHit(tx({ reference: "NS-2E458EB1" }), inv())).toBeNull();
  });
});

describe("automatic confirmation", () => {
  it("marks an exact reference + amount on an open transfer invoice for auto-confirm at 0.99", () => {
    const [s] = suggestForTransaction(tx({ reference: "NS-2E458EB1-89FAB7" }), [inv()]);
    expect(s).toMatchObject({ kind: "invoice", invoiceId, confidence: AUTO_CONFIRM_CONFIDENCE, autoConfirm: true, state: "suggested" });
    expect(s.explanation).toContain('quotes its payment reference "NS-2E458EB1-89FAB7"');
    expect(s.explanation).toContain("Confirmed automatically");
  });

  it("keeps a name-only match at 0.95 and waiting for a person", () => {
    const [s] = suggestForTransaction(tx({ counterpartyName: "THE DANCE EXCLUSIVE" }), [inv()]);
    expect(s).toMatchObject({ confidence: 0.95, autoConfirm: false });
    expect(s.explanation).toContain('names "The Dance Exclusive"');
  });

  it("never auto-confirms a paid invoice, a card or Direct Debit invoice, or a wrong amount", () => {
    const quoted = tx({ reference: "NS-2E458EB1-89FAB7" });
    expect(suggestForTransaction(quoted, [inv({ status: "paid" })])[0]).toMatchObject({ autoConfirm: false, confidence: AUTO_CONFIRM_CONFIDENCE });
    expect(suggestForTransaction(quoted, [inv({ rail: "card" })])[0]).toMatchObject({ autoConfirm: false });
    expect(suggestForTransaction(quoted, [inv({ rail: "direct_debit" })])[0]).toMatchObject({ autoConfirm: false });
    const wrong = suggestForTransaction(tx({ reference: "NS-2E458EB1-89FAB7", amountMinor: 17000 }), [inv()]);
    expect(wrong.every((s) => !s.autoConfirm)).toBe(true);
  });

  it("never auto-confirms when another invoice also fits the transfer", () => {
    const other = inv({
      id: "516b6c81-0000-0000-0000-000000000000",
      references: ["NS-2E458EB1-516B6C", "516b6c81"],
      paymentReference: "NS-2E458EB1-516B6C",
    });
    // The counterparty names the client, so both invoices are "named" at the
    // same amount; only one quotes its reference, yet with a competitor the
    // decision stays with a person.
    const out = suggestForTransaction(tx({ reference: "NS-2E458EB1-89FAB7", counterpartyName: "THE DANCE EXCLUSIVE" }), [inv(), other]);
    expect(out).toHaveLength(2);
    expect(out.every((s) => !s.autoConfirm)).toBe(true);
    expect(shouldAutoConfirm(inv(), reference, 2)).toBe(false);
    expect(shouldAutoConfirm(inv(), reference, 1)).toBe(true);
    expect(shouldAutoConfirm(inv({ rail: undefined }), reference, 1)).toBe(true);
  });

  it("the matcher itself still only ever emits suggested", () => {
    expect(canAutoConfirm()).toBe(false);
    const all = suggestForTransaction(tx({ reference: "NS-2E458EB1-89FAB7" }), [inv()]);
    expect(all.every((s) => s.state === "suggested")).toBe(true);
  });
});
