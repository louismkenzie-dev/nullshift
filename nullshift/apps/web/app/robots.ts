import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/portal/",
        "/proposal/",
        "/onboard",
        "/client-signup",
        "/error",
        "/api/",
      ],
    },
    sitemap: "https://nullshift.co.uk/sitemap.xml",
  };
}
