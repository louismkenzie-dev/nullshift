"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { T } from "@/lib/tokens";
import { Logo, LogoMark } from "@/components/Logo";
import { cn } from "@/lib/utils";

const links = [
  { label: "About",       href: "/about" },
  { label: "Work",        href: "/work" },
  { label: "Systems Lab", href: "/systems-lab" },
  { label: "Pricing",     href: "/pricing" },
  { label: "FAQ",         href: "/faq" },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Scroll detection for floating pill
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 px-3 pt-2">
      <nav
        className={cn(
          "mx-auto flex items-center justify-between transition-all duration-500",
          isScrolled
            ? "max-w-4xl rounded-2xl border px-5 backdrop-blur-xl"
            : "max-w-7xl px-4"
        )}
        style={{
          height: 64,
          background: isScrolled ? `${T.bg}d0` : "transparent",
          borderColor: isScrolled ? T.border : "transparent",
        }}
      >
        {/* Logo */}
        <Link href="/" className="relative z-10">
          <Logo markSize={24} />
        </Link>

        {/* Desktop links */}
        <ul className="hidden md:flex items-center gap-8 list-none">
          {links.map(({ label, href }) => (
            <li key={href}>
              <Link
                href={href}
                className="transition-colors"
                style={{
                  fontFamily: T.sans, fontSize: "0.875rem", fontWeight: 500,
                  letterSpacing: "-0.005em",
                  color: pathname === href ? T.fg : T.muted,
                  textDecoration: "none",
                  transition: `color 150ms ${T.ease}`,
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = T.fg}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = pathname === href ? T.fg : T.muted}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Right: CTA + hamburger */}
        <div className="flex items-center gap-3">
          <Link
            href="/learn"
            className="hidden md:inline-flex items-center font-medium transition-opacity hover:opacity-80"
            style={{
              fontFamily: T.sans, fontSize: "0.875rem", fontWeight: 500,
              letterSpacing: "-0.005em",
              height: 36, paddingInline: 16,
              background: "transparent", color: T.muted,
              borderRadius: "10px",
              border: `1px solid ${T.border}`,
            }}
          >
            Client login
          </Link>
          <Link
            href="/book"
            className="hidden md:inline-flex items-center font-medium transition-opacity hover:opacity-90"
            style={{
              fontFamily: T.sans, fontSize: "0.875rem", fontWeight: 500,
              letterSpacing: "-0.005em",
              height: 36, paddingInline: 16,
              background: T.primary, color: T.primaryFg,
              borderRadius: "10px",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
            }}
          >
            Book a call
          </Link>

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setOpen(v => !v)}
            className="md:hidden flex flex-col justify-center items-center gap-[5px] w-9 h-9 transition-colors"
            style={{ background: open ? T.surface2 : "transparent", borderRadius: "10px", border: `1px solid ${open ? T.borderStr : "transparent"}` }}
            aria-label="Open menu"
          >
            <span style={{ display: "block", width: 18, height: 1.5, background: T.fg, borderRadius: 2, transition: "transform .2s, opacity .2s", transform: open ? "translateY(6.5px) rotate(45deg)" : "none" }} />
            <span style={{ display: "block", width: 18, height: 1.5, background: T.fg, borderRadius: 2, transition: "opacity .2s", opacity: open ? 0 : 1 }} />
            <span style={{ display: "block", width: 18, height: 1.5, background: T.fg, borderRadius: 2, transition: "transform .2s, opacity .2s", transform: open ? "translateY(-6.5px) rotate(-45deg)" : "none" }} />
          </button>
        </div>
      </nav>

      {/* ── Mobile drawer ──────────────────────────── */}
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className="md:hidden fixed inset-0 z-40 transition-opacity duration-300"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
      />

      {/* Drawer panel */}
      <aside
        className="md:hidden fixed top-0 right-0 bottom-0 z-50 flex flex-col"
        style={{
          width: "min(300px, 82vw)",
          background: T.surface,
          borderLeft: `1px solid ${T.border}`,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 h-12 shrink-0" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div className="flex items-center gap-2.5">
            <LogoMark size={18} />
            <span style={{ fontFamily: T.sans, fontWeight: 700, fontSize: "0.9375rem", letterSpacing: "-0.01em", color: T.fg }}>Nullshift</span>
          </div>
          <button onClick={() => setOpen(false)} style={{ color: T.muted, fontFamily: T.mono, fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Nav links */}
        <nav className="flex flex-col gap-1 px-4 py-6 flex-1">
          <div style={{ fontFamily: T.mono, fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.muted, paddingLeft: "12px", marginBottom: "8px" }}>Navigation</div>
          {links.map((l, idx) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center gap-3 px-3 py-3 transition-colors"
                style={{
                  background: active ? `${T.primary}14` : "transparent",
                  borderLeft: `2px solid ${active ? T.primary : "transparent"}`,
                  borderRadius: "10px",
                  animationDelay: `${idx * 40}ms`,
                }}
              >
                <span style={{ fontFamily: T.sans, fontWeight: 600, fontSize: "0.9375rem", letterSpacing: "-0.01em", color: active ? T.primary : T.fg }}>
                  {l.label}
                </span>
                {active && <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: T.primary }} />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-5 shrink-0 flex flex-col gap-2" style={{ borderTop: `1px solid ${T.border}` }}>
          <Link
            href="/learn"
            className="w-full h-11 inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-80"
            style={{ fontFamily: T.sans, fontSize: "0.875rem", fontWeight: 500, letterSpacing: "-0.005em", background: "transparent", color: T.muted, borderRadius: "10px", border: `1px solid ${T.border}` }}
          >
            Client login
          </Link>
          <Link
            href="/book"
            className="w-full h-11 inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
            style={{ fontFamily: T.sans, fontSize: "0.875rem", fontWeight: 500, letterSpacing: "-0.005em", background: T.primary, color: T.primaryFg, borderRadius: "10px", boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 0 20px ${T.primary}30` }}
          >
            Book a call →
          </Link>
        </div>
      </aside>
      </header>
    </>
  );
}
