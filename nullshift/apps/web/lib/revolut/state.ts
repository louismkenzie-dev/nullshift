/**
 * Signed OAuth `state` for the Revolut consent round trip. Mirrors the
 * Stripe Connect state token (lib/billing/stripeConnect.ts): a random nonce,
 * the acting staff user, an expiry, HMAC-SHA256 over the payload. Anything
 * wrong with the token reads as null and the callback refuses.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const REVOLUT_STATE_TTL_MS = 15 * 60 * 1000;

export type RevolutState = {
  /** acting staff user id */
  u: string;
  /** nonce */
  n: string;
  /** expiry (ms since epoch) */
  e: number;
  /** environment the consent was started for */
  v: "production" | "sandbox";
};

const hmac = (payload: string, secret: string): string =>
  createHmac("sha256", secret).update(payload).digest("base64url");

const safeEqual = (a: string, b: string): boolean => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
};

export function mintState(
  input: { userId: string; environment: RevolutState["v"] },
  secret: string,
  now: number = Date.now()
): string {
  const state: RevolutState = {
    u: input.userId,
    n: randomBytes(24).toString("base64url"),
    e: now + REVOLUT_STATE_TTL_MS,
    v: input.environment,
  };
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  return `${payload}.${hmac(payload, secret)}`;
}

export function readState(
  token: string | null | undefined,
  secret: string,
  now: number = Date.now()
): RevolutState | null {
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
  const s = parsed as Partial<RevolutState>;
  if (typeof s.u !== "string" || s.u.length < 8) return null;
  if (typeof s.n !== "string" || s.n.length < 16) return null;
  if (typeof s.e !== "number" || !Number.isFinite(s.e) || s.e <= now) return null;
  if (s.v !== "production" && s.v !== "sandbox") return null;
  return { u: s.u, n: s.n, e: s.e, v: s.v };
}
