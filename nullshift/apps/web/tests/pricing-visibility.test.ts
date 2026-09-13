import { describe, expect, it } from "vitest";
import {
  visibleLinks,
  visibleRoutes,
  pricingRobots,
  showsFigures,
  pricingHref,
} from "@/lib/pricingVisibility";

const NAV = [
  { label: "What we build", href: "/#capabilities" },
  { label: "Client stories", href: "/client-stories" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
];

describe("visibleLinks", () => {
  it("keeps every link when pricing is public", () => {
    expect(visibleLinks(NAV, true)).toHaveLength(4);
  });

  it("drops only the pricing link when it is withheld", () => {
    const out = visibleLinks(NAV, false);
    expect(out.map((l) => l.href)).toEqual([
      "/#capabilities",
      "/client-stories",
      "/about",
    ]);
  });

  it("drops anchors into the pricing page too", () => {
    const out = visibleLinks([{ href: "/pricing#plans" }, { href: "/about" }], false);
    expect(out.map((l) => l.href)).toEqual(["/about"]);
  });

  it("never mutates the caller's array", () => {
    const src = [...NAV];
    visibleLinks(src, false);
    expect(src).toHaveLength(4);
  });

  it("leaves a route that merely starts with the same letters alone", () => {
    const out = visibleLinks([{ href: "/pricing-guide" }], false);
    expect(out.map((l) => l.href)).toEqual(["/pricing-guide"]);
  });
});

describe("visibleRoutes", () => {
  it("removes /pricing from the sitemap while it is withheld", () => {
    expect(visibleRoutes(["", "/about", "/pricing", "/faq"], false)).toEqual([
      "",
      "/about",
      "/faq",
    ]);
  });

  it("leaves the sitemap whole when pricing is public", () => {
    expect(visibleRoutes(["", "/pricing"], true)).toEqual(["", "/pricing"]);
  });
});

describe("pricingRobots", () => {
  it("asks search engines to drop the page while figures are withheld", () => {
    expect(pricingRobots(false)).toEqual({ index: false, follow: true });
  });

  it("adds no directive when pricing is public", () => {
    expect(pricingRobots(true)).toBeUndefined();
  });
});

describe("figures and links follow the same switch", () => {
  it("withholds ladders and redirects pricing links together", () => {
    expect(showsFigures(false)).toBe(false);
    expect(pricingHref(false)).toBe("/book");
  });

  it("shows ladders and links to the page when public", () => {
    expect(showsFigures(true)).toBe(true);
    expect(pricingHref(true)).toBe("/pricing");
  });
});
