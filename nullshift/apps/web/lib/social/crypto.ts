/**
 * Social access-token encryption at rest — AES-256-GCM with node:crypto,
 * keyed by SOCIAL_TOKEN_ENCRYPTION_KEY (32 bytes as 64 hex characters).
 * Same construction as lib/revolut/crypto.ts, but the three parts are stored
 * in separate columns (ciphertext / iv / tag) per migration 0071.
 *
 * The auth tag covers the ciphertext and the associated data (the account
 * id), so a ciphertext copied from one account row to another fails to
 * decrypt. Pure apart from randomness; no I/O, no logging. Tokens must never
 * be logged or returned to the browser.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALG = "aes-256-gcm";
const IV_BYTES = 12;

export class SocialCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SocialCryptoError";
  }
}

export type EncryptedToken = { ciphertext: string; iv: string; tag: string };

/** Parse the hex key; refuses anything that is not exactly 32 bytes. */
export function parseSocialKey(hex: string | undefined | null): Buffer {
  const trimmed = (hex ?? "").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed))
    throw new SocialCryptoError(
      "SOCIAL_TOKEN_ENCRYPTION_KEY must be 32 bytes as 64 hex characters."
    );
  return Buffer.from(trimmed, "hex");
}

export function encryptSocialToken(
  plaintext: string,
  key: Buffer,
  aad: string
): EncryptedToken {
  if (key.length !== 32) throw new SocialCryptoError("Key must be 32 bytes.");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALG, key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: data.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
  };
}

export function decryptSocialToken(
  enc: EncryptedToken,
  key: Buffer,
  aad: string
): string {
  if (key.length !== 32) throw new SocialCryptoError("Key must be 32 bytes.");
  const iv = Buffer.from(enc.iv, "base64url");
  const tag = Buffer.from(enc.tag, "base64url");
  const data = Buffer.from(enc.ciphertext, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== 16)
    throw new SocialCryptoError("Unrecognised ciphertext format.");
  try {
    const decipher = createDecipheriv(ALG, key, iv);
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    throw new SocialCryptoError("Token could not be decrypted (wrong key or tampered).");
  }
}

/** Strip anything that looks like a token from an error message. */
export function sanitiseSocialError(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/(access_token|code)("?\s*[:=]\s*"?)[A-Za-z0-9._~+/=-]+/gi, "$1$2[redacted]")
    .replace(/EAA[A-Za-z0-9]{20,}/g, "[token redacted]")
    .slice(0, 400);
}
