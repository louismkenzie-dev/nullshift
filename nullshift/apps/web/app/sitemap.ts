import type { MetadataRoute } from "next";

const BASE_URL = "https://nullshift.co.uk";

// Public, indexable routes only. Admin/portal/api/funnel/brief/onboard/etc. are
// intentionally excluded (and blocked in robots.ts).
const ROUTES = [
  "", // homepage
  "/about",
  "/work",
  "/pricing",
  "/systems-lab",
  "/faq",
  "/brand",
  "/book",
  "/legal",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified,
  }));
}
