import { describe, expect, it } from "vitest";
import {
  formatNumber,
  parseItems,
  proposalContentHash,
  totals,
  type ProposalContent,
} from "@/lib/studio/money";

describe("studio money", () => {
  it("parses items, dropping blanks and clamping", () => {
    const items = parseItems([
      { description: " Design ", qty: "2", unitPence: "150000" },
      { description: "", qty: 1, unitPence: 5 },
      { description: "x", qty: -3, unitPence: "abc" },
    ]);
    expect(items).toEqual([
      { description: "Design", qty: 2, unitPence: 150000 },
      { description: "x", qty: 1, unitPence: 0 },
    ]);
  });
  it("totals with VAT in whole pence", () => {
    expect(totals([{ description: "a", qty: 1.5, unitPence: 10000 }], 20)).toEqual({
      subtotal: 15000,
      vat: 3000,
      total: 18000,
    });
    expect(totals([{ description: "a", qty: 1, unitPence: 999 }], 0)).toEqual({
      subtotal: 999,
      vat: 0,
      total: 999,
    });
  });
  it("numbers are zero padded", () => {
    expect(formatNumber("INV-", 7)).toBe("INV-0007");
    expect(formatNumber("P-", 12345)).toBe("P-12345");
  });
  it("hash is stable across key order and changes with content", () => {
    const a: ProposalContent = {
      number: "P-0001",
      title: "T",
      intro: "",
      scope: "s",
      items: [{ description: "d", qty: 1, unitPence: 100 }],
      terms: "t",
      validUntil: null,
      vatPct: 0,
      issuer: { name: "A", email: "a@a" },
      client: { name: "C", company: "", email: "c@c" },
    };
    const b = {
      ...a,
      client: { email: "c@c", company: "", name: "C" },
    } as ProposalContent;
    expect(proposalContentHash(a)).toBe(proposalContentHash(b));
    expect(proposalContentHash({ ...a, terms: "t2" })).not.toBe(proposalContentHash(a));
  });
});
