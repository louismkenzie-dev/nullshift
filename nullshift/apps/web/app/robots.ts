import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/portal/",
        "/learn/login",
        "/proposal/",
        "/onboard",
        "/client-signup",
        "/brief",
        "/error",
        "/api/",
      ],
    },
    sitemap: "https://nullshift.co.uk/sitemap.xml",
  };
}
