/**
 * Cross-app URLs. The admin hub and client portal are SEPARATE Next apps on
 * their own subdomains, so links from the marketing site must be absolute.
 * Override per environment (e.g. Vercel preview URLs) via the env vars; the
 * production subdomains are the defaults.
 */
export const ADMIN_URL =
  process.env.NEXT_PUBLIC_ADMIN_URL || "https://admin.nullshift.co.uk";

export const PORTAL_URL =
  process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nullshift.co.uk";
