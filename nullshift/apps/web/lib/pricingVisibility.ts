import { PRICING_PUBLIC } from "@nullshift/content/pricing";

/* ════════════════════════════════════════════════════════════════
   Where published prices are allowed to appear.

   The switch itself lives with the content (PRICING_PUBLIC). These are
   the pure rules that act on it, so the surfaces that have to agree —
   nav, footer, sitemap, robots — can be tested rather than hand-checked
   one page at a time. A figure withheld from /pricing but still sitting
   in the footer link, the sitemap or Google's index is not withheld.
   ════════════════════════════════════════════════════════════════ */

/** Any link whose href is the pricing page, in whatever shape the caller uses. */
export type MaybePricingLink = { href: string };

const isPricingHref = (href: string) =>
  href === "/pricing" || href.startsWith("/pricing#");

/**
 * Drop the pricing link from a nav/footer group while prices are withheld.
 * Every other link is returned untouched, in order.
 */
export function visibleLinks<L extends MaybePricingLink>(
  links: readonly L[],
  pricingPublic: boolean = PRICING_PUBLIC
): L[] {
  return pricingPublic ? [...links] : links.filter((l) => !isPricingHref(l.href));
}

/** Sitemap routes, minus /pricing while it carries no figures and is noindex. */
export function visibleRoutes(
  routes: readonly string[],
  pricingPublic: boolean = PRICING_PUBLIC
): string[] {
  return pricingPublic ? [...routes] : routes.filter((r) => !isPricingHref(r));
}

/**
 * Robots directive for /pricing. While the page shows no figures we ask search
 * engines to drop it, so the old rates stop being served from their cache —
 * follow stays on so the links out of it still count.
 */
export function pricingRobots(pricingPublic: boolean = PRICING_PUBLIC) {
  return pricingPublic ? undefined : { index: false, follow: true };
}

/** True when a price ladder (tiers, setup + monthly) may be rendered. */
export function showsFigures(pricingPublic: boolean = PRICING_PUBLIC): boolean {
  return pricingPublic;
}

/**
 * Where a "see our pricing" link should point. With the page holding no
 * figures, send people to the quote conversation instead of a dead end.
 */
export function pricingHref(pricingPublic: boolean = PRICING_PUBLIC): string {
  return pricingPublic ? "/pricing" : "/book";
}
