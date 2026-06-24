"use client";

import Link from "next/link";
import { T } from "@nullshift/ui/tokens";
import { Logo } from "@nullshift/ui/components/Logo";

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.68rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

/**
 * Portal header — deliberately minimal and mobile-safe, branded to match the
 * marketing nav (KYMA). Navigation happens inside the project (cards on the home
 * page → project hub), so the header only carries the home link, a live status
 * marker, and account/sign-out. The email is hidden on narrow screens to keep it
 * from overlapping the sign-out button.
 */
export function PortalHeader({ email }: { email: string }) {
  return (
    <header
      style={{
        borderBottom: `1px solid var(--k-border)`,
        background: "rgba(10,11,15,0.72)",
        flexShrink: 0,
        position: "sticky",
        top: 0,
        zIndex: 20,
        backdropFilter: "blur(14px)",
      }}
    >
      <div
        className="flex items-center justify-between gap-3"
        style={{ maxWidth: 880, margin: "0 auto", height: 56, padding: "0 16px" }}
      >
        <div className="flex items-center gap-1.5 shrink-0 min-w-0">
          {/* Logo → main marketing homepage */}
          <Link
            href="/"
            aria-label="Nullshift — back to homepage"
            className="flex items-center"
            style={{ textDecoration: "none" }}
          >
            <Logo markSize={20} />
          </Link>
          {/* Label → portal home */}
          <Link
            href="/portal"
            aria-label="Client portal home"
            style={{
              ...mono,
              color: "var(--k-faint)",
              fontSize: "0.66rem",
              textDecoration: "none",
            }}
          >
            / Portal
          </Link>
        </div>

        {/* Live status — Roboto Mono + emerald live dot (KYMA marketing nav cue) */}
        <span
          className="hidden md:inline-flex items-center gap-2"
          style={{ ...mono, color: "var(--k-muted)" }}
        >
          <span
            className="k-livedot"
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: "var(--k-accent)",
              boxShadow: `0 0 0 3px ${T.primarySoft}`,
            }}
          />
          Client workspace · Live
        </span>

        <div className="flex items-center gap-3 min-w-0">
          <span
            className="hidden sm:inline"
            style={{
              fontFamily: T.mono,
              fontSize: "0.7rem",
              letterSpacing: "0.06em",
              color: "var(--k-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 200,
            }}
          >
            {email}
          </span>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="kb kb-outline kb-sm">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
