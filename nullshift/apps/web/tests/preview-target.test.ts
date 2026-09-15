import { describe, expect, it } from "vitest";
import { safePreviewTarget, PREVIEW_HOME } from "@/lib/previewTarget";

describe("safePreviewTarget", () => {
  it("allows the portal front door", () => {
    expect(safePreviewTarget("/portal")).toBe("/portal");
  });

  it("allows a portal sub-path", () => {
    expect(safePreviewTarget("/portal/plan")).toBe("/portal/plan");
    expect(safePreviewTarget("/portal/plan/confirm")).toBe("/portal/plan/confirm");
  });

  it("carries a query string and hash through", () => {
    expect(safePreviewTarget("/portal/plan?price=1#terms")).toBe(
      "/portal/plan?price=1#terms"
    );
  });

  it("falls back to the portal when nothing is asked for", () => {
    expect(safePreviewTarget(null)).toBe(PREVIEW_HOME);
    expect(safePreviewTarget(undefined)).toBe(PREVIEW_HOME);
    expect(safePreviewTarget("")).toBe(PREVIEW_HOME);
  });

  it("refuses to leave the site", () => {
    for (const evil of [
      "https://evil.example/portal",
      "http://evil.example",
      "//evil.example",
      "//evil.example/portal",
      "/\\evil.example",
      "/portal\\..\\admin",
    ]) {
      expect(safePreviewTarget(evil)).toBe(PREVIEW_HOME);
    }
  });

  it("refuses paths outside the portal", () => {
    expect(safePreviewTarget("/admin")).toBe(PREVIEW_HOME);
    expect(safePreviewTarget("/admin/vault")).toBe(PREVIEW_HOME);
    expect(safePreviewTarget("/")).toBe(PREVIEW_HOME);
  });

  it("is not fooled by a path that merely starts with the same letters", () => {
    expect(safePreviewTarget("/portal-admin")).toBe(PREVIEW_HOME);
    expect(safePreviewTarget("/portalx")).toBe(PREVIEW_HOME);
  });

  it("refuses traversal and smuggled control characters", () => {
    expect(safePreviewTarget("/portal/../admin")).toBe(PREVIEW_HOME);
    expect(safePreviewTarget("/portal/plan\nLocation: https://evil")).toBe(PREVIEW_HOME);
    expect(safePreviewTarget("/portal\r/plan")).toBe(PREVIEW_HOME);
  });

  it("does not let a query string smuggle a disallowed path", () => {
    // The path is /portal, which is allowed; the query is just carried.
    expect(safePreviewTarget("/portal?next=/admin")).toBe("/portal?next=/admin");
    // But a disallowed path is still refused however the query is dressed up.
    expect(safePreviewTarget("/admin?x=/portal")).toBe(PREVIEW_HOME);
  });
});
