import { describe, expect, it } from "vitest";
import { carePlanInvoiceLine } from "@/lib/carePlanInvoice";

describe("care plan invoice line", () => {
  it("names the plan and the collection month", () => {
    expect(carePlanInvoiceLine("hosting_api", "2026-09-05")).toBe(
      "Pro care plan — September 2026"
    );
    expect(carePlanInvoiceLine("hosting", "2026-12-28T10:00:00Z")).toBe(
      "Core care plan — December 2026"
    );
    expect(carePlanInvoiceLine("build_3", "2027-01-02")).toBe(
      "Max care plan — January 2027"
    );
  });

  it("falls back sensibly when the plan or date is unknown", () => {
    expect(carePlanInvoiceLine("not-a-plan", "2026-09-05")).toBe(
      "Care care plan — September 2026"
    );
    const now = new Date();
    expect(carePlanInvoiceLine("hosting", "garbage")).toContain(
      String(now.getUTCFullYear())
    );
    expect(carePlanInvoiceLine("hosting", null)).toMatch(
      /^Core care plan — [A-Z][a-z]+ \d{4}$/
    );
  });
});
