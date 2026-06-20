"use client";

import Link from "next/link";
import { T } from "@nullshift/ui/tokens";
import { Logo } from "@nullshift/ui/components/Logo";

/**
 * Portal header — deliberately minimal and mobile-safe. Navigation happens inside
 * the project (cards on the home page → project hub), so the header only carries
 * the home link + account/sign-out. The email is hidden on narrow screens to keep
 * it from overlapping the sign-out button.
 */
export function PortalHeader({ email }: { email: string }) {
  return (
    <header
      style={{
        borderBottom: `1px solid ${T.border}`,
        background: T.surface,
        flexShrink: 0,
        position: "sticky",
        top: 0,
        zIndex: 20,
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        className="flex items-center justify-between gap-3"
        style={{ maxWidth: 880, margin: "0 auto", height: 56, padding: "0 16px" }}
      >
        <Link href="/portal" aria-label="Nullshift client portal" className="min-w-0">
          <Logo markSize={20} />
        </Link>

        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="hidden sm:inline"
            style={{
              fontFamily: T.mono,
              fontSize: "0.74rem",
              color: T.muted,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 200,
            }}
          >
            {email}
          </span>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              style={{
                fontFamily: T.sans,
                fontSize: "0.8rem",
                fontWeight: 500,
                color: T.muted,
                background: "transparent",
                border: `1px solid ${T.border}`,
                borderRadius: T.r.full,
                padding: "5px 14px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
