"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { T } from "@nullshift/ui/tokens";
import {
  CATEGORY_COPY,
  COOKIE_INVENTORY,
  cookiesByCategory,
  optionalCategories,
  type CookieCategory,
} from "@nullshift/content/legal/cookies";
import { legalConfig } from "@nullshift/content/legal/config";
import {
  CONSENT_EVENT,
  acceptAll,
  currentConsent,
  readConsent,
  rejectAll,
  writeConsent,
  type ConsentChoice,
} from "@/lib/consent";

/**
 * Consent manager (spec §10).
 *
 * Three rules the UI has to honour, not merely claim:
 *
 *  1. Reject is exactly as easy as accept. Both are first-level buttons of the
 *     same size in the same row — no "reject" hidden a panel deep.
 *  2. Nothing non-essential is on by default. The toggles start off and stay
 *     off until switched, because `lib/consent` defaults them off, not because
 *     this component remembers to.
 *  3. The decision is withdrawable at any time, from a link that is always
 *     present in the footer.
 *
 * The banner only appears when there is something to decide. Today the cookie
 * inventory contains only strictly-necessary technologies, so no consent is
 * required and no banner shows — asking for consent we do not need would be
 * theatre, and the old banner's claim that we "would also like to set analytics
 * cookies" was simply untrue. Add one analytics or marketing entry to
 * `legal/cookies.ts` and the banner turns itself on.
 */

const OPTIONAL = optionalCategories();

/* ── shared bits ───────────────────────────────────────────────── */

const label: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.64rem",
  fontWeight: 500,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

function Toggle({
  on,
  disabled,
  onChange,
  name,
}: {
  on: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
  name: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={name}
      disabled={disabled}
      onClick={() => onChange?.(!on)}
      style={{
        flex: "0 0 auto",
        width: 46,
        height: 24,
        padding: 3,
        border: "1px solid var(--k-border-strong)",
        borderRadius: 0,
        background: on ? "var(--k-accent)" : "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        display: "inline-flex",
        justifyContent: on ? "flex-end" : "flex-start",
        alignItems: "center",
        transition: "background-color 0.15s ease",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "block",
          width: 16,
          height: 16,
          background: on ? "var(--k-on-accent)" : "var(--k-muted)",
        }}
      />
    </button>
  );
}

/** One category row: what it is, what it does, and its switch. */
function CategoryRow({
  category,
  on,
  onChange,
}: {
  category: CookieCategory;
  on: boolean;
  onChange?: (v: boolean) => void;
}) {
  const copy = CATEGORY_COPY[category];
  const entries = cookiesByCategory(category);
  const necessary = category === "necessary";

  return (
    <div
      style={{
        borderTop: "1px solid var(--k-border)",
        paddingTop: 16,
        marginTop: 16,
      }}
    >
      <div className="flex items-start justify-between gap-5">
        <div style={{ minWidth: 0 }}>
          <span style={{ ...label, color: "var(--k-fg)" }}>{copy.label}</span>
          {necessary && (
            <span style={{ ...label, color: "var(--k-faint)", marginLeft: 10 }}>
              Always on
            </span>
          )}
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.85rem",
              lineHeight: 1.65,
              color: "var(--k-muted)",
              marginTop: 8,
              maxWidth: "62ch",
            }}
          >
            {copy.description}
          </p>
          {entries.length > 0 && (
            <p
              style={{
                fontFamily: T.mono,
                fontSize: "0.66rem",
                lineHeight: 1.8,
                color: "var(--k-faint)",
                marginTop: 8,
              }}
            >
              {entries.map((e) => e.nameOrPattern).join(" · ")}
            </p>
          )}
          {entries.length === 0 && (
            <p
              style={{
                fontFamily: T.mono,
                fontSize: "0.66rem",
                color: "var(--k-faint)",
                marginTop: 8,
              }}
            >
              Nothing in this category is used on this site.
            </p>
          )}
        </div>
        <Toggle
          name={copy.label}
          on={necessary ? true : on}
          disabled={necessary}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

/* ── preferences panel (also the /cookie-settings page body) ───── */

export function ConsentPreferences({
  source,
  onSaved,
}: {
  source: "banner" | "settings";
  onSaved?: () => void;
}) {
  const [choice, setChoice] = useState<ConsentChoice>({
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
  });
  const [decided, setDecided] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Read on mount only: the cookie is not available during SSR, and reading it
  // in render would produce a hydration mismatch.
  useEffect(() => {
    setChoice(currentConsent());
    setDecided(readConsent()?.recordedAt ?? null);
  }, []);

  const set = (k: CookieCategory) => (v: boolean) => {
    setSaved(false);
    setChoice((c) => ({ ...c, [k]: v }));
  };

  const save = (next?: Partial<ConsentChoice>) => {
    const record = writeConsent({ ...choice, ...next }, source);
    setChoice(record);
    setDecided(record.recordedAt);
    setSaved(true);
    onSaved?.();
  };

  return (
    <div>
      <CategoryRow category="necessary" on />
      {(["functional", "analytics", "marketing"] as const).map((c) => (
        <CategoryRow key={c} category={c} on={choice[c]} onChange={set(c)} />
      ))}

      <div
        className="flex flex-wrap items-center gap-3"
        style={{ marginTop: 24 }}
      >
        <button
          type="button"
          className="kb kb-primary kb-sm"
          onClick={() => save()}
        >
          Save preferences
        </button>
        <button
          type="button"
          className="kb kb-outline kb-sm"
          onClick={() =>
            save({ functional: true, analytics: true, marketing: true })
          }
        >
          Accept all
        </button>
        <button
          type="button"
          className="kb kb-outline kb-sm"
          onClick={() =>
            save({ functional: false, analytics: false, marketing: false })
          }
        >
          Reject all
        </button>
      </div>

      <p
        style={{
          fontFamily: T.mono,
          fontSize: "0.66rem",
          lineHeight: 1.8,
          color: saved ? "var(--k-accent)" : "var(--k-faint)",
          marginTop: 16,
        }}
      >
        {saved
          ? "Saved. Your choice applies from now on and you can change it here at any time."
          : decided
            ? `Your current choice was recorded on ${new Date(decided).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`
            : "You have not made a choice yet. Everything optional is off until you do."}
      </p>

      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.82rem",
          lineHeight: 1.7,
          color: "var(--k-faint)",
          marginTop: 14,
        }}
      >
        The full table of what we set — {COOKIE_INVENTORY.length} technolog
        {COOKIE_INVENTORY.length === 1 ? "y" : "ies"} in total, with purpose and
        duration — is in the{" "}
        <Link href={legalConfig.routes.cookies} style={{ color: "var(--k-accent)" }}>
          Cookie Policy
        </Link>
        .
      </p>
    </div>
  );
}

/* ── the banner ────────────────────────────────────────────────── */

export function ConsentManager() {
  const [show, setShow] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const refresh = useCallback(() => {
    // Nothing optional exists → nothing to consent to → no banner. See the
    // note at the top of this file.
    if (OPTIONAL.length === 0) return setShow(false);
    setShow(readConsent() === null);
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(CONSENT_EVENT, refresh);
    return () => window.removeEventListener(CONSENT_EVENT, refresh);
  }, [refresh]);

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="ns-consent-title"
      className="k-dark fixed z-[60] left-3 right-3 bottom-3 sm:left-auto sm:right-4 sm:bottom-4"
      style={{
        maxWidth: expanded ? 620 : 460,
        maxHeight: "calc(100vh - 32px)",
        overflowY: "auto",
        background: "var(--k-bg)",
        color: "var(--k-fg)",
        border: "1px solid var(--k-border-strong)",
        borderRadius: 0,
        padding: "20px 22px",
      }}
    >
      <p style={{ ...label, color: "var(--k-accent)" }}>[ Cookies ]</p>
      <h2
        id="ns-consent-title"
        style={{
          fontFamily: T.sans,
          fontSize: "1.05rem",
          fontWeight: 600,
          color: "var(--k-fg)",
          marginTop: 10,
        }}
      >
        Your choice about cookies
      </h2>
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.875rem",
          lineHeight: 1.65,
          color: "var(--k-muted)",
          marginTop: 8,
        }}
      >
        We use cookies that are strictly necessary to run this site. We&apos;d also
        like to set optional ones — nothing optional loads unless you say yes, and
        saying no is one click. See our{" "}
        <Link href={legalConfig.routes.cookies} style={{ color: "var(--k-accent)" }}>
          Cookie Policy
        </Link>{" "}
        and{" "}
        <Link href={legalConfig.routes.privacy} style={{ color: "var(--k-accent)" }}>
          Privacy Notice
        </Link>
        .
      </p>

      {expanded ? (
        <div style={{ marginTop: 4 }}>
          <ConsentPreferences source="banner" onSaved={() => setShow(false)} />
        </div>
      ) : (
        <>
          {/* Equal prominence, deliberately: same class, same size, same row. */}
          <div className="flex flex-wrap gap-2" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="kb kb-primary kb-sm"
              onClick={() => {
                acceptAll("banner");
                setShow(false);
              }}
            >
              Accept all
            </button>
            <button
              type="button"
              className="kb kb-primary kb-sm"
              onClick={() => {
                rejectAll("banner");
                setShow(false);
              }}
            >
              Reject all
            </button>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            style={{
              ...label,
              color: "var(--k-muted)",
              background: "none",
              border: "none",
              padding: 0,
              marginTop: 14,
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Manage preferences
          </button>
        </>
      )}
    </div>
  );
}
