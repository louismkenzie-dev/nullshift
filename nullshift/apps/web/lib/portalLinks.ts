/**
 * Pure helpers for the portal's set-your-password links. Kept free of server
 * imports so they can be unit-tested and shared by every place that mints a
 * link (self-serve forgot, admin invite, admin reset, the Direct Debits board).
 *
 * Why a token_hash link and not Supabase's action_link: the browser client is
 * PKCE-only (@supabase/ssr hard-codes flowType "pkce") and rejects the implicit
 * `#access_token=` fragment that admin-generated action_links redirect with, so
 * the old /portal/reset page never received a session. Carrying the hashed
 * token to our own page and verifying it SERVER-SIDE (auth.verifyOtp) sidesteps
 * the browser entirely: the session arrives as cookies, exactly like a login.
 */

export type PortalLinkType = "invite" | "recovery";

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://nullshift.co.uk").replace(
    /\/$/,
    ""
  );
}

/**
 * Only ever send a client somewhere inside their own portal. Anything else —
 * an absolute URL, a protocol-relative `//host`, a non-portal path, control
 * characters — collapses to the portal home.
 */
export function safePortalNext(next: string | null | undefined): string {
  if (!next) return "/portal";
  const trimmed = next.trim();
  if (!trimmed.startsWith("/portal")) return "/portal";
  if (trimmed.startsWith("//") || /[\r\n\\]/.test(trimmed)) return "/portal";
  // "/portalx" would pass the prefix test — require a boundary.
  const rest = trimmed.slice("/portal".length);
  if (rest && !/^[/?#]/.test(rest)) return "/portal";
  return trimmed;
}

/** The link we email: our reset page, carrying the hashed token to verify. */
export function buildPortalResetUrl(opts: {
  hashedToken: string;
  type: PortalLinkType;
  next?: string | null;
  base?: string;
}): string {
  const base = (opts.base ?? siteUrl()).replace(/\/$/, "");
  const params = new URLSearchParams({ token_hash: opts.hashedToken, type: opts.type });
  const next = safePortalNext(opts.next);
  if (next !== "/portal") params.set("next", next);
  return `${base}/portal/reset?${params.toString()}`;
}
