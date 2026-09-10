import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { CONNECTED_ACCOUNT_RE } from "@nullshift/billing/connect";
import { siteUrl } from "@/lib/portalLinks";

/**
 * The Nullshift half of the Stripe Connect OAuth handshake: who is allowed to
 * start it, and how the `state` round-trip is made tamper-proof.
 *
 * Two signed values, one HMAC key, no extra tables:
 *
 * 1. The START LINK. A client connecting their Stripe account is usually not
 *    logged into anything of ours — the link is emailed to whoever runs their
 *    Stripe account. So the link carries `?tenant=<uuid>&sig=<hmac>`: without a
 *    valid signature the route refuses, which is what stops a stranger who
 *    guesses a tenant id from attaching THEIR Stripe account to a client's
 *    record. Staff clicking Connect in the ops hub are authorised by their
 *    session instead and need no signature.
 *
 * 2. The STATE TOKEN. A signed, expiring payload naming the tenant, a random
 *    nonce, where the flow started and (optionally) the account id we expect
 *    back. It travels to Stripe as `state` AND is set as an httpOnly cookie;
 *    the callback requires both, byte-identical, before it will spend the
 *    authorization code. An attacker cannot forge the pair — they have neither
 *    the HMAC key nor a way to write the victim's cookie — so a planted
 *    callback URL cannot bind an account to a client behind their back.
 *
 * Everything here is pure and server-only (node:crypto, secrets from env), so
 * it unit-tests without a database, a browser or Stripe.
 */

/** Carries the state token across the redirect to Stripe and back. */
export const CONNECT_STATE_COOKIE = "ns_stripe_connect_state";

/** Path the cookie is scoped to — the callback lives under it, nothing else does. */
export const CONNECT_STATE_COOKIE_PATH = "/api/stripe";

/** Long enough to sign into Stripe and authorise, short enough to be worthless if leaked. */
export const CONNECT_STATE_TTL_MS = 15 * 60 * 1000;

export const TENANT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * HMAC key for both signatures. A dedicated STRIPE_CONNECT_STATE_SECRET is
 * preferred; the platform secret key is the fallback so the flow works the
 * moment Stripe is configured, with no extra env var to forget. Either way it
 * is server-only and never leaves this module — only digests do.
 */
export function connectSigningSecret(): string | null {
  return process.env.STRIPE_CONNECT_STATE_SECRET || process.env.STRIPE_SECRET_KEY || null;
}

/**
 * Where Stripe sends the client back. Must match a redirect URI registered on
 * the platform's Connect settings EXACTLY, so it is pinnable via env for
 * previews and local dev rather than derived and hoped for.
 */
export function connectRedirectUri(): string {
  const pinned = process.env.STRIPE_CONNECT_REDIRECT_URI;
  if (pinned) return pinned.replace(/\/$/, "");
  return `${siteUrl()}/api/stripe/oauth/callback`;
}

function hmac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Constant-time compare of two ASCII digests. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// ── 1. the start link ────────────────────────────────────────────

/** Signature proving a `/api/stripe/connect?tenant=…` link was minted by us. */
export function signTenantLink(tenantId: string, secret: string): string {
  return hmac(`stripe-connect-start:${tenantId}`, secret);
}

export function verifyTenantLink(
  tenantId: string,
  sig: string | null | undefined,
  secret: string
): boolean {
  if (!sig) return false;
  return safeEqual(signTenantLink(tenantId, secret), sig);
}

/**
 * The link staff copy out of the ops hub and email to the client. `expect` is
 * optional and advisory: when the account id is known up front, the callback
 * reports whether Stripe returned that exact account — it never restricts
 * which account may connect.
 */
export function buildConnectStartUrl(opts: {
  tenantId: string;
  secret: string;
  expectedAccountId?: string | null;
  base?: string;
}): string {
  const base = (opts.base ?? siteUrl()).replace(/\/$/, "");
  const q = new URLSearchParams({
    tenant: opts.tenantId,
    sig: signTenantLink(opts.tenantId, opts.secret),
  });
  if (opts.expectedAccountId && CONNECTED_ACCOUNT_RE.test(opts.expectedAccountId)) {
    q.set("expect", opts.expectedAccountId);
  }
  return `${base}/api/stripe/connect?${q.toString()}`;
}

/** The client's confirmation page, signed the same way so it can read real state. */
export function buildConnectedPageUrl(opts: {
  tenantId: string;
  secret: string;
  base?: string;
}): string {
  const base = (opts.base ?? siteUrl()).replace(/\/$/, "");
  const q = new URLSearchParams({
    tenant: opts.tenantId,
    sig: signTenantLink(opts.tenantId, opts.secret),
  });
  return `${base}/stripe/connected?${q.toString()}`;
}

// ── 2. the state token ───────────────────────────────────────────

/** Where the flow was started — decides where the callback lands the browser. */
export type ConnectOrigin = "admin" | "link";

export type ConnectState = {
  /** tenant */
  t: string;
  /** nonce */
  n: string;
  /** expires at (ms since epoch) */
  e: number;
  /** origin */
  o: ConnectOrigin;
  /** expected connected-account id, when the flow was started with one */
  x?: string;
};

export function mintConnectState(
  input: { tenantId: string; origin: ConnectOrigin; expectedAccountId?: string | null },
  secret: string,
  now: number = Date.now()
): string {
  const state: ConnectState = {
    t: input.tenantId,
    n: randomBytes(32).toString("base64url"),
    e: now + CONNECT_STATE_TTL_MS,
    o: input.origin,
  };
  if (input.expectedAccountId && CONNECTED_ACCOUNT_RE.test(input.expectedAccountId)) {
    state.x = input.expectedAccountId;
  }
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  return `${payload}.${hmac(payload, secret)}`;
}

/**
 * Verify a state token and return its payload, or null for anything at all
 * wrong with it — malformed, wrong signature, expired, or carrying a tenant id
 * that isn't a uuid. Callers treat null as "refuse and start again".
 */
export function readConnectState(
  token: string | null | undefined,
  secret: string,
  now: number = Date.now()
): ConnectState | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!safeEqual(hmac(payload, secret), sig)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const s = parsed as Partial<ConnectState>;
  if (typeof s.t !== "string" || !TENANT_ID_RE.test(s.t)) return null;
  if (typeof s.n !== "string" || s.n.length < 16) return null;
  if (typeof s.e !== "number" || !Number.isFinite(s.e) || s.e <= now) return null;
  if (s.o !== "admin" && s.o !== "link") return null;
  const expected =
    typeof s.x === "string" && CONNECTED_ACCOUNT_RE.test(s.x) ? s.x : undefined;
  return { t: s.t, n: s.n, e: s.e, o: s.o, ...(expected ? { x: expected } : {}) };
}

// ── expected-account check ───────────────────────────────────────

export type ExpectedAccountMatch = "match" | "mismatch" | "unset";

/**
 * Did Stripe hand back the account this onboarding was aiming at? Advisory
 * only: a mismatch is reported loudly and recorded, never used to reject a
 * connection — a client is entitled to connect whichever of their accounts
 * they signed in with, and silently discarding that would leave staff staring
 * at a client who "completed the flow" with nothing to show for it.
 */
export function expectedAccountMatch(
  returnedAccountId: string,
  expectedAccountId: string | null | undefined
): ExpectedAccountMatch {
  if (!expectedAccountId) return "unset";
  return returnedAccountId === expectedAccountId ? "match" : "mismatch";
}

// ── outcome codes ────────────────────────────────────────────────

/**
 * Every way the handshake can end, named once. The ops-hub banner and the
 * client's confirmation page both read these, so the two screens can never
 * describe the same failure differently — and a redirect carrying an
 * unrecognised code falls back to the generic message rather than rendering
 * whatever a URL happened to contain.
 */
export const CONNECT_OUTCOMES = {
  connected: "Stripe account connected.",
  not_configured: "Stripe Connect is not configured on this deployment.",
  missing_tenant: "No client was named in the connection link.",
  unknown_client: "That client no longer exists.",
  link_invalid:
    "This Stripe connection link is not valid — ask Nullshift for a fresh one.",
  state_invalid:
    "We could not verify this connection came from Nullshift. Start the connection again.",
  access_denied: "The Stripe connection was cancelled before it completed.",
  missing_code:
    "Stripe did not return an authorisation code. Start the connection again.",
  expired_code:
    "That Stripe authorisation had already been used or expired. Start the connection again.",
  no_account_id: "Stripe authorised the connection but returned no account id.",
  stripe_error: "Stripe refused the connection. Start the connection again.",
  account_taken: "That Stripe account is already connected to a different client.",
  persist_failed:
    "Stripe connected, but saving the connection failed. Contact Nullshift.",
} as const;

export type ConnectOutcome = keyof typeof CONNECT_OUTCOMES;

export function connectOutcomeMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return (
    (CONNECT_OUTCOMES as Record<string, string>)[code] ?? CONNECT_OUTCOMES.stripe_error
  );
}

export function isConnectOutcome(
  code: string | null | undefined
): code is ConnectOutcome {
  return !!code && code in CONNECT_OUTCOMES;
}
