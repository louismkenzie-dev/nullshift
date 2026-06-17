"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { T } from "@nullshift/ui/tokens";

/**
 * Privacy-first cookie consent banner (brief §4/§9). Non-essential cookies are
 * DECLINED by default — dismissing or "Decline" stores a declined choice, and we
 * only set analytics/marketing cookies after an explicit "Accept". The choice is
 * stored in localStorage; no cookies are written by the banner itself.
 */
const KEY = "ns-cookie-consent"; // "accepted" | "declined"

export function ConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      // localStorage unavailable (private mode) — show once, don't persist.
      setShow(true);
    }
  }, []);

  const choose = (choice: "accepted" | "declined") => {
    try {
      localStorage.setItem(KEY, choice);
    } catch {
      // ignore persistence failures
    }
    // Signal other code (e.g. analytics loaders) without a hard dependency.
    window.dispatchEvent(new CustomEvent("ns-consent", { detail: choice }));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed z-[60] left-3 right-3 bottom-3 sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-md"
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.r.lg,
        boxShadow: T.shadow.lg,
        padding: "18px 20px",
      }}
    >
      <p
        style={{
          fontFamily: T.mono,
          fontSize: "0.66rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: T.primary,
          marginBottom: 8,
        }}
      >
        {"// Cookies"}
      </p>
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.875rem",
          lineHeight: 1.6,
          color: T.muted,
        }}
      >
        We use only essential cookies to run the site. We&apos;d also like to set optional
        analytics cookies to understand what&apos;s useful — but only if you say yes. See
        our{" "}
        <Link href="/legal" style={{ color: T.fg, textDecoration: "underline" }}>
          privacy &amp; cookie policy
        </Link>
        .
      </p>
      <div className="flex gap-2" style={{ marginTop: 14 }}>
        <button
          onClick={() => choose("accepted")}
          style={{
            fontFamily: T.sans,
            fontSize: "0.85rem",
            fontWeight: 600,
            height: 38,
            paddingInline: 16,
            background: T.primary,
            color: T.primaryFg,
            border: "none",
            borderRadius: T.r.md,
            cursor: "pointer",
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)`,
          }}
        >
          Accept optional
        </button>
        <button
          onClick={() => choose("declined")}
          style={{
            fontFamily: T.sans,
            fontSize: "0.85rem",
            fontWeight: 500,
            height: 38,
            paddingInline: 16,
            background: "transparent",
            color: T.muted,
            border: `1px solid ${T.borderStr}`,
            borderRadius: T.r.md,
            cursor: "pointer",
          }}
        >
          Decline
        </button>
      </div>
    </div>
  );
}
