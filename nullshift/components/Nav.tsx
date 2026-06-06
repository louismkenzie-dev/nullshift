"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { T } from "@/lib/tokens";
import { Logo, LogoMark } from "@/components/Logo";

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

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center justify-between px-5 border-b"
        style={{ background: `${T.bg}e6`, borderColor: T.border, backdropFilter: "blur(12px)" }}
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
                className="transition-colors hover:text-[#10b981]"
                style={{
                  fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.12em",
                  textTransform: "uppercase", color: pathname === href ? T.primary : T.muted,
                }}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Right: CTA + hamburger */}
        <div className="flex items-center gap-3">
          <Link
            href="/book"
            className="h-7 px-4 inline-flex items-center font-semibold transition-opacity hover:opacity-90"
            style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", background: T.primary, color: T.primaryFg, borderRadius: "2px" }}
          >
            Book a call
          </Link>

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setOpen(v => !v)}
            className="md:hidden flex flex-col justify-center items-center gap-[5px] w-8 h-8 rounded-md transition-colors"
            style={{ background: open ? T.surface2 : "transparent" }}
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
            <span style={{ fontFamily: T.display, fontWeight: 900, fontSize: "0.95rem", color: T.fg }}>NULLSHIFT</span>
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
                className="flex items-center gap-3 px-3 py-3 rounded-lg transition-colors"
                style={{
                  background: active ? `${T.primary}18` : "transparent",
                  borderLeft: `2px solid ${active ? T.primary : "transparent"}`,
                  animationDelay: `${idx * 40}ms`,
                }}
              >
                <span style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1rem", letterSpacing: "0.04em", color: active ? T.primary : T.fg }}>
                  {l.label}
                </span>
                {active && <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: T.primary }} />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-5 shrink-0" style={{ borderTop: `1px solid ${T.border}` }}>
          <Link
            href="/book"
            className="w-full h-11 inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
            style={{ fontFamily: T.mono, fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", background: T.primary, color: T.primaryFg, borderRadius: "6px", boxShadow: `0 0 20px ${T.primary}40` }}
          >
            Book a call →
          </Link>
        </div>
      </aside>
    </>
  );
}
