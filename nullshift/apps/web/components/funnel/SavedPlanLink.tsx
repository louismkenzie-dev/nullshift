"use client";

import { useState } from "react";
import Link from "next/link";
import { T } from "@nullshift/ui/tokens";

/** A "your plan is saved" chip with the permanent /plan link + copy button. */
export function SavedPlanLink({ planToken }: { planToken: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/plan/${planToken}`;

  const copy = async () => {
    try {
      const abs = typeof window !== "undefined" ? window.location.origin + path : path;
      await navigator.clipboard.writeText(abs);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-3"
      style={{
        padding: "13px 16px",
        borderRadius: T.r.md,
        border: `1px solid ${T.border}`,
        background: T.surface,
      }}
    >
      <div className="flex items-center gap-2.5" style={{ minWidth: 0 }}>
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: T.primary,
            boxShadow: `0 0 0 3px ${T.primary}22`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: T.sans,
            fontSize: "0.875rem",
            color: T.fg,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          Your plan is saved — revisit or share it any time.
        </span>
      </div>
      <div className="flex items-center gap-2 sm:ml-auto">
        <Link
          href={path}
          target="_blank"
          rel="noreferrer"
          style={{
            fontFamily: T.mono,
            fontSize: 11,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: T.primary,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Open ↗
        </Link>
        <button
          type="button"
          onClick={copy}
          style={{
            fontFamily: T.mono,
            fontSize: 11,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: copied ? T.primary : T.muted,
            border: `1px solid ${T.border}`,
            borderRadius: 0,
            padding: "5px 10px",
            background: "transparent",
            whiteSpace: "nowrap",
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
