/**
 * Signed OAuth `state` for the Facebook Login round trip. Same construction
 * as lib/revolut/state.ts: a random nonce, the acting staff user, an expiry,
 * HMAC-SHA256 over the payload. Anything wrong reads as null.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SOCIAL_STATE_TTL_MS = 15 * 60 * 1000;

export type SocialState = { u: string; n: string; e: number; p: "instagram" };

const hmac = (payload: string, secret: string): string =>
  createHmac("sha256", secret).update(payload).digest("base64url");

const safeEqual = (a: string, b: string): boolean => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
};

export function mintSocialState(
  userId: string,
  secret: string,
  now = Date.now()
): string {
  const state: SocialState = {
    u: userId,
    n: randomBytes(24).toString("base64url"),
    e: now + SOCIAL_STATE_TTL_MS,
    p: "instagram",
  };
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  return `${payload}.${hmac(payload, secret)}`;
}

export function readSocialState(
  token: string | null | undefined,
  secret: string,
  now = Date.now()
): SocialState | null {
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
  const s = parsed as Partial<SocialState>;
  if (typeof s.u !== "string" || s.u.length < 8) return null;
  if (typeof s.n !== "string" || s.n.length < 16) return null;
  if (typeof s.e !== "number" || !Number.isFinite(s.e) || s.e <= now) return null;
  if (s.p !== "instagram") return null;
  return { u: s.u, n: s.n, e: s.e, p: s.p };
}

/** The HMAC secret: SOCIAL_OAUTH_STATE_SECRET, falling back to the token key. */
export function socialStateSecret(): string | null {
  return (
    process.env.SOCIAL_OAUTH_STATE_SECRET ||
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY ||
    null
  );
}
