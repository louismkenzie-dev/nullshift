"use client";

import {
  CONSENT_DEFAULTS,
  type ConsentRecord,
} from "@nullshift/content/legal/cookies";
import { legalConfig } from "@nullshift/content/legal/config";

/**
 * Cookie consent state (spec §10).
 *
 * Stored in a first-party `ns_consent` cookie — the same name declared in the
 * cookie inventory — so the decision survives across subdomains and is
 * readable server-side if a future script needs gating before hydration.
 *
 * Nothing here loads a script. It records a decision and broadcasts it; the
 * loaders subscribe. That separation is what makes "reject all prevents the
 * network call" testable rather than aspirational.
 */

export const CONSENT_COOKIE = "ns_consent";
export const CONSENT_EVENT = "ns-consent-change";
const MAX_AGE_DAYS = 365;

export type ConsentChoice = Omit<
  ConsentRecord,
  "consentId" | "policyVersion" | "recordedAt" | "source"
>;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

/** The stored decision, or null when the visitor has never chosen. */
export function readConsent(): ConsentRecord | null {
  const raw = readCookie(CONSENT_COOKIE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ConsentRecord;
    // A decision recorded against a superseded policy version is not a
    // decision about the current one — ask again rather than assume.
    if (parsed.policyVersion !== legalConfig.legal.publicPolicyVersion) return null;
    return { ...parsed, necessary: true };
  } catch {
    return null;
  }
}

/** Current effective state — defaults (everything optional off) until chosen. */
export function currentConsent(): ConsentChoice {
  return readConsent() ?? { ...CONSENT_DEFAULTS };
}

export function writeConsent(
  choice: Partial<ConsentChoice>,
  source: ConsentRecord["source"]
): ConsentRecord {
  const record: ConsentRecord = {
    consentId:
      globalThis.crypto?.randomUUID?.() ?? `c_${Date.now().toString(36)}`,
    policyVersion: legalConfig.legal.publicPolicyVersion,
    necessary: true,
    functional: !!choice.functional,
    analytics: !!choice.analytics,
    marketing: !!choice.marketing,
    recordedAt: new Date().toISOString(),
    source,
  };
  try {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(record))}` +
      `; Path=/; Max-Age=${MAX_AGE_DAYS * 24 * 60 * 60}; SameSite=Lax${secure}`;
  } catch {
    // Storage blocked — the decision still applies to this page view via the
    // event below; we simply cannot remember it.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: record }));
  return record;
}

export const acceptAll = (source: ConsentRecord["source"] = "banner") =>
  writeConsent({ functional: true, analytics: true, marketing: true }, source);

export const rejectAll = (source: ConsentRecord["source"] = "banner") =>
  writeConsent({ functional: false, analytics: false, marketing: false }, source);

/**
 * Gate for any non-essential script. Loaders call this and re-check on the
 * consent event — never assume a category is allowed because the page loaded.
 */
export function consentAllows(category: keyof ConsentChoice): boolean {
  if (category === "necessary") return true;
  return currentConsent()[category] === true;
}
