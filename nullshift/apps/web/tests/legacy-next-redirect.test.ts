import { describe, expect, it } from "vitest";
import { legacyNextTarget } from "@/lib/next/legacyRedirect";

describe("/admin/next/* redirect map", () => {
  it("sends the old root to Today", () => {
    expect(legacyNextTarget(undefined)).toBe("/admin");
    expect(legacyNextTarget([])).toBe("/admin");
  });
  it("maps the ops areas one-to-one and keeps the remaining path", () => {
    expect(legacyNextTarget(["sales"])).toBe("/admin/sales");
    expect(legacyNextTarget(["quotes", "q-northline-v2"])).toBe(
      "/admin/quotes/q-northline-v2"
    );
    expect(legacyNextTarget(["clients", "northline"])).toBe("/admin/clients/northline");
    expect(legacyNextTarget(["finance", "invoices", "inv-1"])).toBe(
      "/admin/finance/invoices/inv-1"
    );
    expect(legacyNextTarget(["settings"])).toBe("/admin/settings");
  });
  it("renames the portal prototype to portal-preview", () => {
    expect(legacyNextTarget(["portal"])).toBe("/admin/portal-preview");
    expect(legacyNextTarget(["portal", "checklist", "2"])).toBe(
      "/admin/portal-preview/checklist/2"
    );
  });
  it("preserves the query string", () => {
    expect(legacyNextTarget(["sales"], "tab=quotes")).toBe("/admin/sales?tab=quotes");
    expect(legacyNextTarget(["portal"], "client=harbour&wide=1")).toBe(
      "/admin/portal-preview?client=harbour&wide=1"
    );
  });
});
