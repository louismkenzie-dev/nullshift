import { describe, expect, it } from "vitest";
import { hintFor, maskFor, validateRecord } from "@/lib/vault/records";

describe("business vault hints", () => {
  it("shows the last four characters of a long value", () => {
    expect(hintFor("1234567890")).toBe("7890");
    expect(maskFor(hintFor("1234567890"))).toBe("•••• 7890");
  });

  it("never hints a short value — a 4-digit PIN would be shown in full", () => {
    expect(hintFor("1234")).toBeNull();
    expect(hintFor("1234567")).toBeNull();
    expect(maskFor(null)).toBe("••••••••");
  });

  it("ignores surrounding whitespace when hinting", () => {
    expect(hintFor("  AB12345678  ")).toBe("5678");
  });
});

describe("business vault validation", () => {
  it("requires a name", () => {
    expect(validateRecord({ name: "  ", value: "x", isNew: true })).toMatch(/name/i);
  });

  it("requires a value on a new record but not on an edit", () => {
    expect(validateRecord({ name: "HMRC UTR", value: "", isNew: true })).toMatch(
      /value/i
    );
    expect(validateRecord({ name: "HMRC UTR", value: "", isNew: false })).toBeNull();
  });

  it("accepts a good record", () => {
    expect(
      validateRecord({ name: "HMRC UTR", value: "1234567890", isNew: true })
    ).toBeNull();
  });

  it("rejects an over-long name or value", () => {
    expect(validateRecord({ name: "a".repeat(121), value: "x", isNew: true })).toMatch(
      /name/i
    );
    expect(validateRecord({ name: "ok", value: "x".repeat(2001), isNew: true })).toMatch(
      /too long/i
    );
  });
});
