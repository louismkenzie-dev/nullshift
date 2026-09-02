import { describe, expect, it } from "vitest";
import { buildPortalResetUrl, safePortalNext } from "../lib/portalLinks";

describe("safePortalNext", () => {
  it("defaults to the portal home", () => {
    expect(safePortalNext(undefined)).toBe("/portal");
    expect(safePortalNext("")).toBe("/portal");
    expect(safePortalNext(null)).toBe("/portal");
  });
  it("keeps portal-internal paths, with query strings", () => {
    expect(safePortalNext("/portal/plan")).toBe("/portal/plan");
    expect(safePortalNext("/portal/plan?dd=authorised")).toBe(
      "/portal/plan?dd=authorised"
    );
    expect(safePortalNext("/portal")).toBe("/portal");
  });
  it("refuses anything that could leave the portal", () => {
    expect(safePortalNext("https://evil.example.com")).toBe("/portal");
    expect(safePortalNext("//evil.example.com/portal")).toBe("/portal");
    expect(safePortalNext("/admin")).toBe("/portal");
    expect(safePortalNext("/portalx/steal")).toBe("/portal");
    expect(safePortalNext("/portal/plan\r\nLocation: x")).toBe("/portal");
  });
});

describe("buildPortalResetUrl", () => {
  it("carries the hashed token and type to our own reset page", () => {
    const url = buildPortalResetUrl({
      hashedToken: "abc123",
      type: "recovery",
      base: "https://nullshift.co.uk",
    });
    expect(url).toBe(
      "https://nullshift.co.uk/portal/reset?token_hash=abc123&type=recovery"
    );
  });
  it("adds a sanitised next only when it is not the default", () => {
    expect(
      buildPortalResetUrl({
        hashedToken: "t",
        type: "invite",
        next: "/portal/plan",
        base: "https://nullshift.co.uk/",
      })
    ).toBe(
      "https://nullshift.co.uk/portal/reset?token_hash=t&type=invite&next=%2Fportal%2Fplan"
    );
    expect(
      buildPortalResetUrl({
        hashedToken: "t",
        type: "invite",
        next: "https://x",
        base: "https://n.co",
      })
    ).toBe("https://n.co/portal/reset?token_hash=t&type=invite");
  });
});
