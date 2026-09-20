/**
 * Client assertion for the Revolut Business API (certificate-based OAuth).
 *
 * Per the Business API "Make your first API request" guide: the assertion is
 * an RS256 JWT signed with the private key whose public half was uploaded to
 * Revolut Business, with
 *
 *   iss  the domain (no scheme) that hosts the redirect URI (REVOLUT_ISSUER)
 *   sub  the client id Revolut issued for the certificate (REVOLUT_CLIENT_ID)
 *   aud  "https://revolut.com" (fixed, both environments)
 *   iat  now
 *   exp  at most 40 minutes after iat (Revolut rejects longer assertions)
 *
 * Pure: signing uses node:crypto only; nothing here performs I/O.
 */

import { createSign } from "node:crypto";

export const REVOLUT_JWT_AUDIENCE = "https://revolut.com";
/** Revolut's documented ceiling for the assertion lifetime. */
export const MAX_ASSERTION_TTL_SECONDS = 40 * 60;
/** What we actually use: comfortably inside the ceiling. */
export const DEFAULT_ASSERTION_TTL_SECONDS = 20 * 60;

export type AssertionClaims = {
  iss: string;
  sub: string;
  aud: typeof REVOLUT_JWT_AUDIENCE;
  iat: number;
  exp: number;
};

const b64url = (input: Buffer | string): string =>
  (typeof input === "string" ? Buffer.from(input, "utf8") : input).toString("base64url");

export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssertionError";
  }
}

/** iss must be a bare host: no scheme, no path, no port. */
export function normaliseIssuer(issuer: string | undefined | null): string {
  const v = (issuer ?? "").trim().toLowerCase();
  if (!v) throw new AssertionError("REVOLUT_ISSUER is not set.");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(v))
    throw new AssertionError(
      "REVOLUT_ISSUER must be a bare domain (e.g. nullshift.co.uk), not a URL."
    );
  return v;
}

/** Build the claims without signing (unit-tested on its own). */
export function buildAssertionClaims(input: {
  issuer: string;
  clientId: string;
  nowSeconds?: number;
  ttlSeconds?: number;
}): AssertionClaims {
  const iss = normaliseIssuer(input.issuer);
  const sub = (input.clientId ?? "").trim();
  if (!sub) throw new AssertionError("REVOLUT_CLIENT_ID is not set.");
  const iat = Math.floor(input.nowSeconds ?? Date.now() / 1000);
  const ttl = input.ttlSeconds ?? DEFAULT_ASSERTION_TTL_SECONDS;
  if (!Number.isInteger(ttl) || ttl <= 0 || ttl > MAX_ASSERTION_TTL_SECONDS)
    throw new AssertionError(
      `Assertion lifetime must be 1–${MAX_ASSERTION_TTL_SECONDS} seconds.`
    );
  return { iss, sub, aud: REVOLUT_JWT_AUDIENCE, iat, exp: iat + ttl };
}

/** RS256-sign the claims with a PEM private key. */
export function signAssertion(claims: AssertionClaims, privateKeyPem: string): string {
  const pem = (privateKeyPem ?? "").replace(/\\n/g, "\n").trim();
  if (!pem.includes("PRIVATE KEY")) throw new AssertionError("REVOLUT_PRIVATE_KEY is not a PEM private key.");
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify(claims));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const sig = signer.sign(pem);
  return `${header}.${payload}.${b64url(sig)}`;
}

/** Decode (without verifying) — for tests and diagnostics only. */
export function decodeAssertion(jwt: string): { header: Record<string, unknown>; claims: AssertionClaims } {
  const [h, p] = jwt.split(".");
  return {
    header: JSON.parse(Buffer.from(h, "base64url").toString("utf8")),
    claims: JSON.parse(Buffer.from(p, "base64url").toString("utf8")),
  };
}

/** Convenience used by the client: env → signed assertion. */
export function buildClientAssertion(env: {
  issuer: string;
  clientId: string;
  privateKeyPem: string;
  nowSeconds?: number;
}): string {
  return signAssertion(buildAssertionClaims(env), env.privateKeyPem);
}
