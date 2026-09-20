/**
 * Token encryption at rest — AES-256-GCM with node:crypto, keyed by
 * REVOLUT_TOKEN_ENCRYPTION_KEY (32 bytes as 64 hex characters).
 *
 * Wire format: `v1.<iv>.<tag>.<ciphertext>` with each part base64url. A
 * 12-byte random IV per encryption; the auth tag covers the ciphertext and
 * the associated data (the connection id), so a ciphertext copied from one
 * connection row to another fails to decrypt.
 *
 * Pure apart from randomness; no I/O, no logging. Tokens must never be
 * logged or returned to the browser — callers get plaintext only in server
 * code that is about to use it against the Revolut API.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALG = "aes-256-gcm";
const IV_BYTES = 12;
const VERSION = "v1";

export class TokenCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenCryptoError";
  }
}

/** Parse the hex key; refuses anything that is not exactly 32 bytes. */
export function parseEncryptionKey(hex: string | undefined | null): Buffer {
  const trimmed = (hex ?? "").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed))
    throw new TokenCryptoError(
      "REVOLUT_TOKEN_ENCRYPTION_KEY must be 32 bytes as 64 hex characters."
    );
  return Buffer.from(trimmed, "hex");
}

export function encryptToken(plaintext: string, key: Buffer, aad: string): string {
  if (key.length !== 32) throw new TokenCryptoError("Key must be 32 bytes.");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALG, key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    data.toString("base64url"),
  ].join(".");
}

export function decryptToken(ciphertext: string, key: Buffer, aad: string): string {
  if (key.length !== 32) throw new TokenCryptoError("Key must be 32 bytes.");
  const parts = ciphertext.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION)
    throw new TokenCryptoError("Unrecognised ciphertext format.");
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const data = Buffer.from(parts[3], "base64url");
  if (iv.length !== IV_BYTES || tag.length !== 16)
    throw new TokenCryptoError("Unrecognised ciphertext format.");
  try {
    const decipher = createDecipheriv(ALG, key, iv);
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    throw new TokenCryptoError("Token could not be decrypted (wrong key or tampered).");
  }
}

/** Strip anything that looks like a token or bearer value from an error message. */
export function sanitiseError(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/(access_token|refresh_token|client_assertion|code)("?\s*[:=]\s*"?)[A-Za-z0-9._~+/=-]+/gi, "$1$2[redacted]")
    .replace(/oa_(sand|prod)_[A-Za-z0-9._-]+/g, "oa_[redacted]")
    .replace(/ey[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt redacted]")
    .slice(0, 300);
}
