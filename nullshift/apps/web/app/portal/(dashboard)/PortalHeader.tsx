"use client";

import { useEffect, useState } from "react";
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

/** Portal navigation — the client's places, in plain words. */
const NAV = [
  { n: "01", href: "/portal", label: "Home" },
  { n: "02", href: "/portal/proposal", label: "Agreement" },
  { n: "03", href: "/portal/payments", label: "Payments" },
  { n: "04", href: "/portal/requests", label: "Requests" },
  { n: "05", href: "/portal/updates", label: "Updates" },
  { n: "06", href: "/portal/plan", label: "Plan" },
  { n: "07", href: "/portal/deliverables", label: "Documents" },
];

/**
 * Portal header, branded to match the marketing nav (KYMA). Desktop keeps the
 * slim tab row (mono uppercase, emerald underline on the active section).
 * Phones get the marketing site's MENU button instead — a full-screen cream
 * overlay sliding in from the right with big tappable links — because seven
 * side-scrolling tabs are not a thumb-friendly menu.
 */
export function PortalHeader({ email }: { email: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Route change = navigation happened — close the sheet.
  useEffect(() => setOpen(false), [pathname]);
  // Lock page scroll behind the overlay.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);

  return (
    <>
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
            <form action="/api/auth/signout" method="post" className="max-md:hidden">
              <button type="submit" className="kb kb-outline kb-sm">
                <ScrambleHover text="Sign out" hoverText="SIGN OUT" />
              </button>
            </form>
            {/* MENU — phones only, styled like the marketing nav's button */}
            <button
              onClick={() => setOpen(true)}
              className="md:hidden inline-flex items-center gap-2.5"
              style={{
                ...mono,
                color: "#0a0a0a",
                background: "#f4f4e8",
                height: 36,
                paddingInline: 14,
                borderRadius: 0,
                border: "none",
                cursor: "pointer",
              }}
              aria-label="Open menu"
            >
              Menu
              <span
                aria-hidden
                style={{ display: "inline-flex", flexDirection: "column", gap: 3 }}
              >
                <span style={{ width: 14, height: 1.5, background: "#0a0a0a" }} />
                <span style={{ width: 14, height: 1.5, background: "#0a0a0a" }} />
              </span>
            </button>
          </div>
        </div>

        {/* Section tabs — desktop only; emerald underline marks where you are */}
        <nav
          aria-label="Portal sections"
          className="max-md:hidden"
          style={{ borderTop: "1px solid var(--k-border)" }}
        >
          <div
            className="flex items-center gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ maxWidth: 880, margin: "0 auto", padding: "0 16px" }}
          >
            {NAV.map((item) => {
              const active = isActive(item.href);
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
                  <ScrambleHover text={item.label} hoverText={item.label.toUpperCase()} />
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Full-screen menu overlay — slides in from the right, marketing-style */}
      <div
        className="fixed inset-0 z-[60] md:hidden flex flex-col"
        style={{
          background: "#f4f4e8",
          color: "#0a0a0a",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: `transform ${open ? 0.45 : 0.3}s var(--ease-out-expo)`,
          pointerEvents: open ? "auto" : "none",
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        aria-hidden={!open}
      >
        {/* top bar */}
        <div className="flex items-center justify-between px-5" style={{ height: 64 }}>
          <span style={{ ...mono, color: "#55554c" }}>Client portal</span>
          <button
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-2.5"
            style={{
              ...mono,
              color: "#0a0a0a",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            aria-label="Close menu"
          >
            Close
            <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>
              ✕
            </span>
          </button>
        </div>

        {/* links */}
        <nav className="flex-1 overflow-y-auto px-5" style={{ minHeight: 0 }}>
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-baseline gap-4 border-b"
                style={{
                  borderColor: "rgba(10,10,10,0.12)",
                  paddingBlock: 14,
                  textDecoration: "none",
                }}
              >
                <span style={{ ...mono, color: T.primary, fontSize: "0.72rem" }}>
                  [{item.n}]
                </span>
                <span
                  style={{
                    fontFamily: T.sans,
                    fontWeight: 700,
                    fontSize: "1.65rem",
                    letterSpacing: "-0.03em",
                    lineHeight: 1.05,
                    textTransform: "uppercase",
                    color: active ? T.primary : "#0a0a0a",
                  }}
                >
                  {item.label}
                </span>
                {active && (
                  <span
                    style={{ ...mono, color: T.primary, fontSize: "0.6rem", marginLeft: "auto" }}
                  >
                    You are here
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* account + sign out */}
        <div className="px-5 pt-4" style={{ paddingBottom: 88 }}>
          <p
            style={{
              ...mono,
              color: "#8a8a7e",
              fontSize: "0.62rem",
              marginBottom: 10,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            Signed in as {email}
          </p>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="kb kb-primary k-cream" style={{ width: "100%" }}>
              Sign out
            </button>
          </form>
        </div>

        {/* bottom accent band */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 64,
            background: T.primary,
          }}
        />
      </div>
    </>
  );
}
