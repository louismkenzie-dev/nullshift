/**
 * Cookie and storage-technology inventory (spec §10).
 *
 * The public cookie table is GENERATED from this file — it is never hand-
 * written, and nothing may be invented. Every non-necessary technology must
 * appear here with its category and legal basis before the code that sets it
 * ships; `assertCookieInventory()` is the CI rule that enforces it.
 */

export type CookieCategory = "necessary" | "functional" | "analytics" | "marketing";

export type CookieEntry = {
  nameOrPattern: string;
  provider: string;
  purpose: string;
  category: CookieCategory;
  firstOrThirdParty: "first" | "third";
  duration: string;
  /** "consent" = blocked until opted in. "documented_exception" needs a rationale. */
  legalMode: "consent" | "documented_exception";
  exceptionRationale?: string;
};

/**
 * The live inventory. Currently only strictly-necessary technologies: the site
 * sets no analytics or marketing storage, which is why the analytics and
 * marketing categories are empty rather than speculative.
 */
export const COOKIE_INVENTORY: CookieEntry[] = [
  {
    nameOrPattern: "sb-*-auth-token",
    provider: "Supabase (first-party cookie set by Nullshift)",
    purpose:
      "Keeps you signed in to the client portal and staff hub, and refreshes your session.",
    category: "necessary",
    firstOrThirdParty: "first",
    duration: "Session and refresh token lifetime",
    legalMode: "documented_exception",
    exceptionRationale:
      "Strictly necessary to provide the authenticated service the user has requested.",
  },
  {
    nameOrPattern: "ns_consent",
    provider: "Nullshift",
    purpose:
      "Remembers your cookie choices so we do not ask again and do not load anything you declined.",
    category: "necessary",
    firstOrThirdParty: "first",
    duration: "12 months",
    legalMode: "documented_exception",
    exceptionRationale:
      "Storing the user's own consent decision is necessary to give effect to it.",
  },
  {
    nameOrPattern: "ns_client_preview",
    provider: "Nullshift",
    purpose: "Staff only: marks a read-only 'view as client' portal preview session.",
    category: "necessary",
    firstOrThirdParty: "first",
    duration: "2 hours",
    legalMode: "documented_exception",
    exceptionRationale:
      "Strictly necessary to provide the staff function the user has requested.",
  },
];

export const cookiesByCategory = (c: CookieCategory): CookieEntry[] =>
  COOKIE_INVENTORY.filter((e) => e.category === c);

/** Categories that actually have entries — drives the consent UI. */
export const activeCategories = (): CookieCategory[] =>
  (["necessary", "functional", "analytics", "marketing"] as const).filter(
    (c) => cookiesByCategory(c).length > 0
  );

/**
 * CI rule (§10): fail when an analytics or marketing integration is present in
 * the build but absent from this inventory. `detected` is the list of
 * integration ids the build found; anything not represented here is a
 * compliance gap, not a nice-to-have.
 */
export function assertCookieInventory(detected: string[]): string[] {
  const problems: string[] = [];
  for (const entry of COOKIE_INVENTORY) {
    if (entry.legalMode === "documented_exception" && !entry.exceptionRationale)
      problems.push(
        `${entry.nameOrPattern}: legalMode is documented_exception but no rationale is recorded.`
      );
    if (
      entry.category !== "necessary" &&
      entry.legalMode === "documented_exception" &&
      !entry.exceptionRationale
    )
      problems.push(
        `${entry.nameOrPattern}: non-necessary technology claiming an exception must record why.`
      );
  }
  const known = COOKIE_INVENTORY.map((e) => e.provider.toLowerCase());
  for (const d of detected) {
    if (!known.some((k) => k.includes(d.toLowerCase())))
      problems.push(
        `Integration "${d}" appears in the build but is not in the cookie inventory.`
      );
  }
  return problems;
}

/** Consent record shape (§10) — no more personal data than the decision itself. */
export type ConsentRecord = {
  consentId: string;
  policyVersion: string;
  necessary: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  recordedAt: string;
  source: "banner" | "settings";
};

export const CONSENT_DEFAULTS = {
  necessary: true as const,
  functional: false,
  analytics: false,
  marketing: false,
};

/**
 * Human copy for each category, used by the consent manager and the public
 * cookie table. Kept beside the inventory so a new category cannot appear in
 * the UI without a description of what agreeing to it actually means.
 */
export const CATEGORY_COPY: Record<
  CookieCategory,
  { label: string; description: string }
> = {
  necessary: {
    label: "Strictly necessary",
    description:
      "Needed to run the site and the things you ask it to do — signing in, keeping your session, and remembering this choice. These cannot be switched off, and we do not ask consent for them.",
  },
  functional: {
    label: "Functional",
    description:
      "Remember preferences you set, so the site behaves the way you left it. Off unless you turn them on.",
  },
  analytics: {
    label: "Analytics",
    description:
      "Measure how the site is used so we can improve it. Off unless you turn them on, and nothing loads until you do.",
  },
  marketing: {
    label: "Marketing",
    description:
      "Used to measure or target advertising. Off unless you turn them on, and nothing loads until you do.",
  },
};

/**
 * The categories a visitor can actually decide about. Empty today, because the
 * build sets no non-necessary storage — which is why no consent banner is
 * shown. Adding one analytics entry above turns the banner on everywhere at
 * once; the UI is driven by the inventory, never the other way round.
 */
export const optionalCategories = (): CookieCategory[] =>
  activeCategories().filter((c) => c !== "necessary");
