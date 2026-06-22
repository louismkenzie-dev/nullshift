"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { T } from "@nullshift/ui/tokens";
import { Logo } from "@nullshift/ui/components/Logo";

const LINKS = [
  { n: "01", label: "What we build", href: "/#capabilities" },
  { n: "02", label: "Systems Lab", href: "/systems-lab" },
  { n: "03", label: "Pricing", href: "/pricing" },
  { n: "04", label: "About", href: "/about" },
  { n: "05", label: "FAQ", href: "/faq" },
];

const SOCIALS = [
  { n: "1.0", label: "LinkedIn" },
  { n: "1.1", label: "X / Twitter" },
  { n: "1.2", label: "Instagram" },
  { n: "1.3", label: "GitHub" },
];

const EMAIL = "hello@nullshift.co.uk";

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.68rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

export function Nav() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [time, setTime] = useState<{ h: string; m: string } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  // Navbar load (ANIM 15): wait for the intro splash to lift on first load,
  // otherwise (route changes) clip in immediately.
  useEffect(() => {
    if (reduce) {
      setReady(true);
      return;
    }
    const introPlaying =
      typeof document !== "undefined" && !!document.querySelector("[data-intro-splash]");
    if (!introPlaying) {
      setReady(true);
      return;
    }
    const onDone = () => setReady(true);
    window.addEventListener("ns:intro-done", onDone, { once: true });
    const fallback = setTimeout(() => setReady(true), 2600);
    return () => {
      window.removeEventListener("ns:intro-done", onDone);
      clearTimeout(fallback);
    };
  }, [reduce]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Live clock — ticks every second; colon blinks via CSS (ANIM 14).
  useEffect(() => {
    const tick = () => {
      const parts = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Europe/London",
      }).formatToParts(new Date());
      const h = parts.find((p) => p.type === "hour")?.value ?? "00";
      const m = parts.find((p) => p.type === "minute")?.value ?? "00";
      setTime({ h, m });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const enter = (delay: number): React.CSSProperties => ({
    opacity: ready ? 1 : 0,
    transform: ready ? "translateY(0)" : "translateY(-8px)",
    transition: "opacity 0.4s var(--ease-out-expo), transform 0.4s var(--ease-out-expo)",
    transitionDelay: ready ? `${delay}s` : "0s",
  });

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
            style={{ textDecoration: "none", ...enter(0) }}
          >
            <Logo markSize={22} />
            <span style={{ color: "#9a9a90", fontFamily: T.mono, fontSize: "0.7rem" }}>
              ®
            </span>
          </Link>

          {/* Center status */}
          <div
            className="hidden md:flex items-center gap-6"
            style={{ color: "#9a9a90", ...mono, ...enter(0.08) }}
          >
            <span className="inline-flex items-center gap-2">
              <span
                className="k-livedot"
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
                {time.h}
                <span className="k-clock-colon">:</span>
                {time.m}
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
              ...enter(0.16),
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

      {/* Fullscreen overlay menu — slides in from the RIGHT (ANIM 7) */}
      <div
        className="fixed inset-0 z-[60] grid md:grid-cols-[320px_1fr]"
        style={{
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: `transform ${open ? 0.45 : 0.3}s var(--ease-out-expo)`,
          pointerEvents: open ? "auto" : "none",
        }}
        aria-hidden={!open}
      >
        {/* Left panel — dark info card (desktop only) */}
        <div
          className="hidden md:flex flex-col justify-between"
          style={{
            background: "#0a0a0a",
            color: "#f4f4e8",
            padding: 40,
            borderRight: "1px solid rgba(244,244,232,0.12)",
          }}
        >
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1.5"
            style={{ textDecoration: "none" }}
          >
            <Logo markSize={24} />
          </Link>
          <div
            style={{
              fontFamily: T.sans,
              fontWeight: 700,
              fontSize: "1.25rem",
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              color: "#f4f4e8",
            }}
          >
            Agentic AI automation
            <br />
            for businesses across
            <br />
            <span style={{ color: T.primary }}>every industry.</span>
          </div>
          <div
            style={{
              ...mono,
              color: "#9a9a90",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <span className="inline-flex items-center gap-2">
              <span
                className="k-livedot"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: T.primary,
                  boxShadow: `0 0 0 3px ${T.primary}22`,
                }}
              />
              {time && (
                <span suppressHydrationWarning style={{ color: "#f4f4e8" }}>
                  Newcastle · {time.h}
                  <span className="k-clock-colon">:</span>
                  {time.m}
                </span>
              )}
            </span>
            <span style={{ color: "#5c5c54" }}>UK · Global reach</span>
          </div>
        </div>

        {/* Right panel — giant nav links (ANIM 7/8) */}
        <div
          className="relative flex flex-col"
          style={{ background: "#f4f4e8", color: "#0a0a0a", overflow: "hidden" }}
        >
          {/* top bar */}
          <div
            className="flex items-center justify-end px-5 sm:px-10"
            style={{ height: 72 }}
          >
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
          <nav className="k-menu-links flex-1 overflow-y-auto px-5 sm:px-10">
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
                  className="flex items-baseline gap-5 border-b"
                  style={{
                    borderColor: "rgba(10,10,10,0.12)",
                    paddingBlock: "clamp(10px,2vw,20px)",
                    textDecoration: "none",
                  }}
                >
                  <span style={{ ...mono, color: T.primary, fontSize: "0.74rem" }}>
                    [{l.n}]
                  </span>
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontWeight: 700,
                      fontSize: "clamp(2rem,7vw,4.6rem)",
                      letterSpacing: "-0.03em",
                      lineHeight: 1,
                      textTransform: "uppercase",
                      color: active ? T.primary : "#0a0a0a",
                    }}
                  >
                    {l.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* contact + socials */}
          <div className="px-5 sm:px-10 pt-6" style={{ paddingBottom: 100 }}>
            <div style={{ ...mono, color: "#55554c", marginBottom: 10 }}>
              <a
                href={`mailto:${EMAIL}`}
                style={{
                  background: T.primary,
                  color: T.primaryFg,
                  padding: "3px 8px",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                {EMAIL.toUpperCase()}
              </a>
            </div>
            <div
              style={{ ...mono, color: "#8a8a7e", fontSize: "0.6rem", marginBottom: 8 }}
            >
              [Socials]
            </div>
            <div
              className="grid grid-cols-2 gap-x-12 gap-y-1.5"
              style={{ ...mono, color: "#55554c", fontSize: "0.62rem" }}
            >
              {SOCIALS.map((s) => (
                <span key={s.n} className="inline-flex items-center">
                  <span style={{ color: "rgba(10,10,10,0.3)", marginRight: 12 }}>
                    {s.n}
                  </span>
                  {s.label}
                </span>
              ))}
            </div>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link
                href="/portal"
                onClick={() => setOpen(false)}
                className="kb kb-outline k-cream"
              >
                Client login
              </Link>
              <Link
                href="/start"
                onClick={() => setOpen(false)}
                className="kb kb-primary k-cream"
              >
                Get my free plan
                <span className="k-arrow" aria-hidden>
                  →
                </span>
              </Link>
            </div>
          </div>

          {/* bottom accent band */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 80,
              background: T.primary,
            }}
          />
        </div>
      </div>
    </>
  );
}
