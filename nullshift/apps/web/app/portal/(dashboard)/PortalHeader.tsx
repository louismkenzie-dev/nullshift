"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { T } from "@nullshift/ui/tokens";
import { Logo } from "@nullshift/ui/components/Logo";
import { ScrambleHover } from "@/components/anim/ScrambleHover";

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.68rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

/** Portal navigation — the client's five places, in plain words. */
const NAV = [
  { n: "01", href: "/portal", label: "Home" },
  { n: "02", href: "/portal/requests", label: "Requests" },
  { n: "03", href: "/portal/updates", label: "Updates" },
  { n: "04", href: "/portal/plan", label: "Plan" },
  { n: "05", href: "/portal/deliverables", label: "Documents" },
];

/**
 * Portal header — deliberately minimal and mobile-safe, branded to match the
 * marketing nav (KYMA). Top row: logo, live status marker, account/sign-out.
 * Below it a slim nav row (mono uppercase links, emerald underline on the
 * active section) so the client can move between Home / Requests / Updates /
 * Plan / Documents. The email is hidden on narrow screens to keep it from
 * overlapping the sign-out button; the nav row scrolls sideways if it must.
 */
export function PortalHeader({ email }: { email: string }) {
  const pathname = usePathname();
  return (
    <header
      className="pt-[env(safe-area-inset-top)]"
      style={{
        borderBottom: `1px solid var(--k-border)`,
        background: "rgba(10,10,10,0.72)",
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
              <ScrambleHover text="Sign out" hoverText="SIGN OUT" />
            </button>
          </form>
        </div>
      </div>

      {/* Section nav — emerald underline marks where you are */}
      <nav
        aria-label="Portal sections"
        style={{ borderTop: "1px solid var(--k-border)" }}
      >
        <div
          className="flex items-center gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ maxWidth: 880, margin: "0 auto", padding: "0 16px" }}
        >
          {NAV.map((item) => {
            const active =
              item.href === "/portal"
                ? pathname === "/portal"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="inline-flex items-baseline gap-1.5"
                style={{
                  fontFamily: T.mono,
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: active ? "var(--k-accent)" : "var(--k-muted)",
                  textDecoration: "none",
                  padding: "11px 0 9px",
                  borderBottom: active
                    ? "2px solid var(--k-accent)"
                    : "2px solid transparent",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {/* [NN] marker — the KYMA eyebrow signature, emerald like the front page */}
                <span
                  aria-hidden
                  style={{
                    color: active ? "var(--k-accent)" : "var(--k-faint)",
                    fontSize: 10,
                  }}
                >
                  [{item.n}]
                </span>
                {/* Hover-scramble (uppercase target = same glyphs, pure decode effect) */}
                <ScrambleHover text={item.label} hoverText={item.label.toUpperCase()} />
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
