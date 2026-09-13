import type { MetadataRoute } from "next";
import { visibleRoutes } from "@/lib/pricingVisibility";

const BASE_URL = "https://nullshift.co.uk";

// Public, indexable routes only. /pricing drops out of this list whenever it
// carries no figures — see lib/pricingVisibility.
// Original note: Admin/portal/api/funnel/brief/onboard/etc. are
// intentionally excluded (and blocked in robots.ts).
const ALL_ROUTES = [
  "", // homepage
  "/about",
  "/pricing",
  "/start",
  "/client-stories",
  "/faq",
  "/brand",
  "/book",
  "/legal",
];

const ROUTES = visibleRoutes(ALL_ROUTES);

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified,
  }));
}
