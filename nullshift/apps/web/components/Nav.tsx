"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { T } from "@nullshift/ui/tokens";
import { Logo } from "@nullshift/ui/components/Logo";
import { createClient } from "@nullshift/db/client";
import { ScrambleHover } from "@/components/anim/ScrambleHover";
import { visibleLinks } from "@/lib/pricingVisibility";
import {
  navCompactState,
  navScrollState,
  type NavScrollState,
} from "@/lib/navVisibility";
import styles from "./Nav.module.css";

// Numbered after filtering, so hiding a link never leaves a gap in the ladder.
const LINKS = visibleLinks([
  { label: "What we build", href: "/#platform-features" },
  { label: "Agent Consultation", href: "/start" },
  { label: "Client stories", href: "/client-stories" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "FAQ", href: "/faq" },
]).map((l, i) => ({ ...l, n: String(i + 1).padStart(2, "0") }));

const SOCIALS = [
  { n: "1.0", label: "LinkedIn" },
  { n: "1.1", label: "X / Twitter" },
  { n: "1.2", label: "Instagram" },
  { n: "1.3", label: "GitHub" },
];

const EMAIL = "louis@nullshift.co.uk";

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.68rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

/**
 * `tone` names the background the bar first sits on. The bar itself is
 * transparent until you scroll, so on a cream hero the default light-on-dark
 * palette washes out (wordmark, tagline and clock all go faint). "cream"
 * flips to dark ink until scrolling. On the homepage the compact controls
 * are white with difference blending, so they invert the actual scene below.
 */
export function Nav({ tone = "dark" }: { tone?: "dark" | "cream" } = {}) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const hiddenRef = useRef(false);
  const compactRef = useRef(false);
  const header = useRef<HTMLElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const compactMenuButton = useRef<HTMLButtonElement>(null);
  const home = pathname === "/";
  const [time, setTime] = useState<{ h: string; m: string } | null>(null);
  const [ready, setReady] = useState(false);
  // null = unknown (don't render the chip yet, avoids a flash); true/false once resolved.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  // Staff are routed to the admin hub, clients to the portal (server enforces
  // real access either way — this only picks the right front door).
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  // Eyebrow auth chip: reflect the client-portal session and live-update on
  // sign in/out. Degrades silently if Supabase isn't configured.
  useEffect(() => {
    let active = true;
    let unsub: (() => void) | undefined;
    try {
      const supabase = createClient();
      const checkStaff = (hasSession: boolean) => {
        if (!hasSession) {
          if (active) setIsStaff(false);
          return;
        }
        supabase.rpc("is_internal_staff").then(({ data: staff }) => {
          if (active) setIsStaff(staff === true);
        });
      };
      supabase.auth.getSession().then(({ data }) => {
        if (!active) return;
        setSignedIn(!!data.session);
        checkStaff(!!data.session);
      });
      const { data } = supabase.auth.onAuthStateChange((_e, session) => {
        if (!active) return;
        setSignedIn(!!session);
        checkStaff(!!session);
      });
      unsub = () => data.subscription.unsubscribe();
    } catch {
      if (active) setSignedIn(false);
    }
    return () => {
      active = false;
      unsub?.();
    };
  }, []);

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
    let state: NavScrollState = {
      anchor: window.scrollY,
      previous: window.scrollY,
      direction: 0,
      hidden: false,
    };
    let compact = home
      ? navCompactState(compactRef.current, window.scrollY)
      : window.scrollY > 40;
    compactRef.current = compact;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const nextCompact = home ? navCompactState(compact, y) : y > 40;
      if (compact !== nextCompact) {
        compact = nextCompact;
        compactRef.current = compact;
        setScrolled(compact);
      }
      const next = navScrollState(
        state,
        y,
        !home || open || !!header.current?.contains(document.activeElement)
      );
      if (next.hidden !== hiddenRef.current) {
        hiddenRef.current = next.hidden;
        setNavHidden(next.hidden);
      }
      state = next;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const reveal = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.clientY > 24 || !state.hidden) return;
      state = { ...state, anchor: window.scrollY, hidden: false };
      hiddenRef.current = false;
      setNavHidden(false);
    };
    // Initial deep links should have a compact, visible header, not a broad band.
    frame = requestAnimationFrame(() => {
      setScrolled(compact);
      update();
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    if (home) window.addEventListener("pointermove", reveal, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", reveal);
    };
  }, [home, open]);

  // The displayed precision is minutes; do not rerender the entire nav every second.
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
      setTime((previous) =>
        previous?.h === h && previous.m === m ? previous : { h, m }
      );
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    const returnFocus = home && scrolled ? compactMenuButton.current : menuButton.current;
    document.body.style.overflow = "hidden";
    const first = menu.current?.querySelector<HTMLElement>(
      'button[aria-label="Close menu"]'
    );
    first?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !menu.current) return;
      const links = [
        ...menu.current.querySelectorAll<HTMLElement>("a[href], button"),
      ].filter((element) => element.getClientRects().length > 0);
      const first = links[0],
        last = links.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onKey);
      returnFocus?.focus({ preventScroll: true });
    };
  }, [open, home, scrolled]);

  const enter = (delay: number): React.CSSProperties => ({
    opacity: ready ? 1 : 0,
    transform: ready ? "translateY(0)" : "translateY(-8px)",
    transition: "opacity 0.4s var(--ease-out-expo), transform 0.4s var(--ease-out-expo)",
    transitionDelay: ready ? `${delay}s` : "0s",
  });

  const compact = home && scrolled;
  // Keep the full header's palette stable while its layer fades away.
  const onLight = tone === "cream" && !scrolled;
  const ink = onLight ? "#0a0a0a" : "#f4f4e8";
  const dim = onLight ? "#55554c" : "#9a9a90";
  const faint = onLight ? "#8a8a7e" : "#5c5c54"; // tertiary text
  const menuBg = onLight ? "#0a0a0a" : "#f4f4e8";
  const menuFg = onLight ? "#f4f4e8" : "#0a0a0a";

  return (
    <>
      <header
        ref={header}
        className={styles.header}
        data-site-header
        data-home={home}
        data-compact={compact}
        data-hidden={home && navHidden && !open}
        onFocusCapture={() => {
          hiddenRef.current = false;
          setNavHidden(false);
        }}
      >
        <nav aria-label="Primary navigation">
          <div
            className={`${styles.bar} ${styles.fullBar}`}
            data-nav-layer="full"
            inert={compact}
            aria-hidden={compact}
            style={{
              borderRadius: 0,
              background: scrolled && !compact ? "rgba(10,10,10,0.96)" : "transparent",
              border: `1px solid ${scrolled && !compact ? "rgba(244,244,232,0.12)" : "transparent"}`,
            }}
          >
            {/* Brand */}
            <Link
              href="/"
              className={`flex items-center gap-1.5 shrink-0 ${styles.brand}`}
              style={{ textDecoration: "none", ...enter(0) }}
            >
              <Logo markSize={22} color={ink} />
              <span style={{ color: dim, fontFamily: T.mono, fontSize: "0.7rem" }}>
                ®
              </span>
            </Link>

            {/* Center status */}
            <div
              className={`hidden lg:flex items-center gap-6 ${styles.status}`}
              style={{ color: dim, ...mono, ...enter(0.08) }}
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
              <span style={{ color: faint }}>UK · Global reach</span>
              {time && (
                <span style={{ color: ink }} suppressHydrationWarning>
                  {time.h}
                  <span className="k-clock-colon">:</span>
                  {time.m}
                </span>
              )}
            </div>

            {/* Right cluster — auth status chip + MENU */}
            <div
              className={`flex items-center gap-3 sm:gap-4 shrink-0 ${styles.actions}`}
              style={enter(0.16)}
            >
              {/* Signed-in / signed-out indicator (links into the client portal) */}
              {signedIn !== null && (
                <Link
                  href={signedIn ? (isStaff ? "/admin" : "/portal") : "/portal/login"}
                  className={`hidden sm:inline-flex items-center gap-2 ${styles.auth}`}
                  style={{
                    ...mono,
                    color: signedIn ? ink : dim,
                    textDecoration: "none",
                  }}
                  aria-label={
                    signedIn
                      ? isStaff
                        ? "Signed in — open admin hub"
                        : "Signed in — open client portal"
                      : "Sign in to client portal"
                  }
                >
                  <span
                    aria-hidden
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: signedIn ? T.primary : faint,
                      boxShadow: signedIn ? `0 0 0 3px ${T.primary}22` : "none",
                    }}
                  />
                  {signedIn ? "Signed in" : "Sign in"}
                </Link>
              )}

              {/* MENU button */}
              <button
                ref={menuButton}
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2.5"
                style={{
                  ...mono,
                  color: menuFg,
                  background: menuBg,
                  height: 44,
                  paddingInline: 16,
                  borderRadius: 0,
                  border: "none",
                  cursor: "pointer",
                }}
                aria-label="Open menu"
                aria-expanded={open}
                aria-controls="site-menu"
              >
                <ScrambleHover text="Menu" hoverText="View" />
                <span
                  aria-hidden
                  style={{ display: "inline-flex", flexDirection: "column", gap: 3 }}
                >
                  <span style={{ width: 14, height: 1.5, background: menuFg }} />
                  <span style={{ width: 14, height: 1.5, background: menuFg }} />
                </span>
              </button>
            </div>
          </div>
          {home && (
            <div
              className={styles.compactBar}
              data-nav-layer="compact"
              inert={!compact}
              aria-hidden={!compact}
            >
              <button
                ref={compactMenuButton}
                onClick={() => setOpen(true)}
                className={styles.compactMenu}
                aria-label="Open menu"
                aria-expanded={open}
                aria-controls="site-menu"
              >
                <ScrambleHover text="Menu" hoverText="View" />
                <span aria-hidden className={styles.compactHamburger}>
                  <span />
                  <span />
                </span>
              </button>
              <Link href="/" className={styles.compactBrand}>
                <Logo markSize={22} color="#ffffff" />
                <span className={styles.registration}>®</span>
              </Link>
            </div>
          )}
        </nav>
      </header>

      {/* Fullscreen overlay menu — slides in from the RIGHT (ANIM 7) */}
      <div
        ref={menu}
        id="site-menu"
        role="dialog"
        aria-label="Site menu"
        aria-modal={open ? true : undefined}
        className="fixed inset-0 z-[60] grid md:grid-cols-[320px_1fr]"
        style={{
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: reduce
            ? "none"
            : `transform ${open ? 0.3 : 0.2}s var(--ease-out-expo)`,
          pointerEvents: open ? "auto" : "none",
        }}
        aria-hidden={!open}
        inert={!open}
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
                  London · {time.h}
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
              <ScrambleHover text="Close" hoverText="Exit" />
              <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>
                ✕
              </span>
            </button>
          </div>

          {/* links */}
          <nav
            className="k-menu-links flex-1 overflow-y-auto px-5 sm:px-10"
            style={{ minHeight: 0 }}
          >
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
                    paddingBlock: "clamp(8px,1.5vw,15px)",
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
                      fontSize: "clamp(1.7rem,5.2vw,3.5rem)",
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
          <div className="px-5 sm:px-10 pt-5" style={{ paddingBottom: 78 }}>
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
                // Same routing as the status chip: staff → admin hub, signed-in
                // clients → portal, everyone else → the login page (which also
                // knows to send staff to /admin). Never a bare /portal — that
                // is how an admin ends up inside a client-shaped page.
                href={signedIn ? (isStaff ? "/admin" : "/portal") : "/portal/login"}
                onClick={() => setOpen(false)}
                className="kb kb-outline k-cream"
              >
                <ScrambleHover text="Client login" hoverText="Sign in" />
              </Link>
              <Link
                href="/start"
                onClick={() => setOpen(false)}
                className="kb kb-primary k-cream"
              >
                <ScrambleHover text="Get my free plan" hoverText="Let's go" />
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
