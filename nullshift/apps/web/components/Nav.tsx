"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { T } from "@nullshift/ui/tokens";
import { Logo } from "@nullshift/ui/components/Logo";

const LINKS = [
  { n: "01", label: "What we build", href: "/#capabilities" },
  { n: "02", label: "Systems Lab", href: "/systems-lab" },
  { n: "03", label: "Pricing", href: "/pricing" },
  { n: "04", label: "About", href: "/about" },
  { n: "05", label: "FAQ", href: "/faq" },
];

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.68rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const tick = () =>
      setTime(
        new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/London",
        }).format(new Date())
      );
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3">
        <nav
          className="mx-auto flex items-center justify-between transition-all duration-300"
          style={{
            maxWidth: 1400,
            height: 56,
            paddingInline: 18,
            borderRadius: 0,
            background: scrolled ? "rgba(10,10,10,0.72)" : "transparent",
            border: `1px solid ${scrolled ? "rgba(244,244,232,0.12)" : "transparent"}`,
            backdropFilter: scrolled ? "blur(14px)" : "none",
          }}
        >
          {/* Brand */}
          <Link
            href="/"
            className="flex items-center gap-1.5 shrink-0"
            style={{ textDecoration: "none" }}
          >
            <Logo markSize={22} />
            <span style={{ color: "#9a9a90", fontFamily: T.mono, fontSize: "0.7rem" }}>
              ®
            </span>
          </Link>

          {/* Center status */}
          <div
            className="hidden md:flex items-center gap-6"
            style={{ color: "#9a9a90", ...mono }}
          >
            <span className="inline-flex items-center gap-2">
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: T.primary,
                  boxShadow: `0 0 0 3px ${T.primary}22`,
                }}
              />
              Agentic AI · Automation · Systems
            </span>
            <span style={{ color: "#5c5c54" }}>UK · Global reach</span>
            {time && (
              <span style={{ color: "#f4f4e8" }} suppressHydrationWarning>
                {time}
              </span>
            )}
          </div>

          {/* MENU button */}
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2.5"
            style={{
              ...mono,
              color: "#0a0a0a",
              background: "#f4f4e8",
              height: 38,
              paddingInline: 16,
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
        </nav>
      </header>

      {/* Fullscreen overlay menu */}
      <div
        className="fixed inset-0 z-[60] flex flex-col"
        style={{
          background: "#0a0a0a",
          color: "#f4f4e8",
          transform: open ? "translateY(0)" : "translateY(-100%)",
          transition: "transform 0.5s cubic-bezier(0.16,1,0.3,1)",
          pointerEvents: open ? "auto" : "none",
        }}
        aria-hidden={!open}
      >
        {/* Overlay top bar */}
        <div
          className="flex items-center justify-between px-5 sm:px-8"
          style={{ height: 72, borderBottom: "1px solid rgba(244,244,232,0.12)" }}
        >
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1.5"
            style={{ textDecoration: "none" }}
          >
            <Logo markSize={22} />
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-2.5"
            style={{
              ...mono,
              color: "#0a0a0a",
              background: "#f4f4e8",
              height: 38,
              paddingInline: 16,
              borderRadius: 0,
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

        {/* Links */}
        <nav className="flex-1 overflow-y-auto px-5 sm:px-8 py-8">
          <div className="mx-auto" style={{ maxWidth: 1400 }}>
            {LINKS.map((l) => {
              const active =
                pathname === l.href ||
                (l.href !== "/" &&
                  pathname.startsWith(l.href.split("#")[0]) &&
                  l.href.includes(pathname));
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="group flex items-center gap-5 border-b"
                  style={{
                    borderColor: "rgba(244,244,232,0.12)",
                    paddingBlock: "clamp(14px,2.4vw,26px)",
                    textDecoration: "none",
                  }}
                >
                  <span style={{ ...mono, color: T.primary, fontSize: "0.74rem" }}>
                    [{l.n}]
                  </span>
                  <span
                    className="transition-colors"
                    style={{
                      fontFamily: T.sans,
                      fontWeight: 700,
                      fontSize: "clamp(2rem,6vw,4rem)",
                      letterSpacing: "-0.03em",
                      lineHeight: 1,
                      textTransform: "uppercase",
                      color: active ? T.primary : "#f4f4e8",
                    }}
                  >
                    {l.label}
                  </span>
                  <span
                    aria-hidden
                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: T.primary, fontSize: "1.4rem" }}
                  >
                    →
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Overlay footer — CTAs */}
        <div
          className="px-5 sm:px-8 py-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:justify-between"
          style={{ borderTop: "1px solid rgba(244,244,232,0.12)" }}
        >
          <span style={{ ...mono, color: "#9a9a90" }}>
            UK-based · Global reach · Response within 24h
          </span>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/portal"
              onClick={() => setOpen(false)}
              className="kb kb-outline k-dark"
            >
              Client login
            </Link>
            <Link
              href="/start"
              onClick={() => setOpen(false)}
              className="kb kb-primary k-dark"
            >
              Get my free plan
              <span className="k-arrow" aria-hidden>
                →
              </span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
