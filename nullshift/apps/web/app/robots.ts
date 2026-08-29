import type { MetadataRoute } from "next";

const PRIVATE = ["/admin/", "/portal/", "/client-signup", "/error", "/api/"];

// AI assistant / answer-engine crawlers, explicitly welcomed on the public
// site (same private-area rules as everyone else). Being crawlable by these
// is what puts Nullshift in AI chat answers — the wildcard already allows
// them, but naming them makes the policy unambiguous and survives any future
// tightening of the wildcard rule.
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "meta-externalagent",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: PRIVATE,
      })),
    ],
    sitemap: "https://nullshift.co.uk/sitemap.xml",
  };
}
