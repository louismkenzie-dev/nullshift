import { randomBytes, createHash } from "node:crypto";

/** URL-safe public key for embeds: 20 chars, no ambiguity, no vowels-only words. */
export function publicKey(prefix: string): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(20);
  let out = "";
  for (let i = 0; i < 20; i++) out += alphabet[bytes[i] % alphabet.length];
  return `${prefix}_${out}`;
}

/** Longer unguessable token for private client links. */
export function privateToken(): string {
  return randomBytes(24).toString("base64url");
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Lower-case, hyphenated slug from a business name. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
