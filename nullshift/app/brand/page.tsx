"use client";

import { useRef, useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { T } from "@/lib/tokens";
import { COLORS, TYPE, PRINCIPLES, generateBrandPdf } from "@/lib/brandPdf";

/* ── Colour swatch with copy-to-clipboard ── */
function Swatch({ name, token, hex, role }: { name: string; token: string; hex: string; role: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(hex); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="group text-left"
      style={{ cursor: "pointer" }}
    >
      <div className="h-24 rounded-lg border transition-transform duration-200 group-hover:scale-[1.03]"
        style={{ background: hex, borderColor: T.borderStr }} />
      <div className="mt-3 flex items-center justify-between">
        <span style={{ fontFamily: T.mono, fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: T.fg, fontWeight: 600 }}>{name}</span>
        <span style={{ fontFamily: T.mono, fontSize: "0.62rem", color: copied ? T.primary : `${T.muted}99` }}>{copied ? "COPIED ✓" : "COPY"}</span>
      </div>
      <div style={{ fontFamily: T.mono, fontSize: "0.78rem", color: T.muted }}>{hex}</div>
      <div style={{ fontFamily: T.mono, fontSize: "0.66rem", color: `${T.muted}99` }}>var(--{token})</div>
      <div style={{ fontFamily: T.sans, fontSize: "0.78rem", color: T.muted, paddingTop: "4px" }}>{role}</div>
    </button>
  );
}

function SectionTag({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-6" style={{ fontFamily: T.mono, fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", color: T.primary }}>
      <span>{children}</span>
      <span className="h-px w-8" style={{ background: `${T.primary}55` }} />
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-8" style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(2.2rem,4vw,3rem)", lineHeight: 0.92, letterSpacing: "-0.01em", textTransform: "uppercase", color: T.fg }}>
      {children}
    </h2>
  );
}

/* ════════════════════════════════════════════════
   HIDDEN PRINTABLE — A4-width (794px) layout captured
   to PDF. Uses the real brand fonts + hex colours so
   the output mirrors the on-page guidelines exactly.
════════════════════════════════════════════════ */
function BrandPrintable({ printRef }: { printRef: React.RefObject<HTMLDivElement | null> }) {
  const PAD = 56;
  return (
    <div
      ref={printRef}
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: "-12000px",
        width: "794px",
        background: T.bg,
        padding: `${PAD}px`,
        fontFamily: T.sans,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: T.primary, display: "inline-block" }} />
        <span style={{ fontFamily: T.display, fontWeight: 900, fontSize: "40px", lineHeight: 0.95, letterSpacing: "-0.01em", textTransform: "uppercase", color: T.fg }}>
          BRAND GUIDELINES
        </span>
      </div>
      <div style={{ fontFamily: T.mono, fontSize: "11px", color: T.muted, marginBottom: "20px" }}>
        // NULLSHIFT — WEB DEVELOPMENT &amp; BRAND CREATION
      </div>
      <div style={{ height: 1, background: T.border, marginBottom: "20px" }} />
      <p style={{ fontFamily: T.sans, fontSize: "13px", lineHeight: 1.7, color: T.muted, maxWidth: "62ch", marginBottom: "40px" }}>
        This document is the single source of truth for Nullshift&apos;s visual identity. It defines the
        typography, colour palette, logo usage, and design principles that keep every touchpoint consistent,
        recognisable, and intentional.
      </p>

      {/* 01 Typography */}
      <div style={{ fontFamily: T.mono, fontSize: "11px", letterSpacing: "0.06em", color: T.primary, marginBottom: "12px" }}>// 01 — TYPOGRAPHY</div>
      <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: "30px", lineHeight: 0.92, letterSpacing: "-0.01em", textTransform: "uppercase", color: T.fg, marginBottom: "18px" }}>TYPE SYSTEM</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "44px" }}>
        {TYPE.map((t) => (
          <div key={t.role} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "18px 20px" }}>
            <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted, fontWeight: 600, marginBottom: "6px" }}>{t.role}</div>
            <div style={{ fontFamily: `var(${t.cssVar})`, fontSize: "26px", fontWeight: t.cssVar === "--font-display" ? 900 : 600, color: T.fg, textTransform: t.cssVar === "--font-display" ? "uppercase" : "none", marginBottom: "4px" }}>{t.font}</div>
            <div style={{ fontFamily: T.mono, fontSize: "11px", color: T.primary }}>{t.weights} &nbsp; var({t.cssVar})</div>
            <div style={{ fontFamily: T.sans, fontSize: "12px", color: T.muted, marginTop: "8px" }}>{t.usage}</div>
          </div>
        ))}
      </div>

      {/* 02 Colour */}
      <div style={{ fontFamily: T.mono, fontSize: "11px", letterSpacing: "0.06em", color: T.primary, marginBottom: "12px" }}>// 02 — COLOUR PALETTE</div>
      <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: "30px", lineHeight: 0.92, letterSpacing: "-0.01em", textTransform: "uppercase", color: T.fg, marginBottom: "18px" }}>COLOUR</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px 16px", marginBottom: "44px" }}>
        {COLORS.map((c) => (
          <div key={c.token}>
            <div style={{ height: 70, borderRadius: 6, background: c.hex, border: `1px solid ${T.borderStr}` }} />
            <div style={{ fontFamily: T.mono, fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: T.fg, marginTop: "8px" }}>{c.name}</div>
            <div style={{ fontFamily: T.mono, fontSize: "11px", color: T.muted }}>{c.hex}</div>
            <div style={{ fontFamily: T.mono, fontSize: "10px", color: `${T.muted}99` }}>var(--{c.token})</div>
            <div style={{ fontFamily: T.sans, fontSize: "10.5px", lineHeight: 1.5, color: T.muted, marginTop: "3px" }}>{c.role}</div>
          </div>
        ))}
      </div>

      {/* 03 Logo */}
      <div style={{ fontFamily: T.mono, fontSize: "11px", letterSpacing: "0.06em", color: T.primary, marginBottom: "12px" }}>// 03 — LOGO USAGE</div>
      <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: "30px", lineHeight: 0.92, letterSpacing: "-0.01em", textTransform: "uppercase", color: T.fg, marginBottom: "18px" }}>LOGO GUIDELINES</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "44px" }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "20px" }}>
          <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted, fontWeight: 600, marginBottom: "14px" }}>PRIMARY LOGO</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 110, border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: "14px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: 11, height: 11, borderRadius: "50%", background: T.primary, display: "inline-block" }} />
              <span style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "18px", letterSpacing: "0.04em", color: T.fg }}>NULLSHIFT</span>
            </span>
          </div>
          {["Always maintain clear space around the logo", "Minimum width: 120px", "Use on dark backgrounds (near-black) only"].map((r) => (
            <div key={r} style={{ display: "flex", gap: "8px", fontFamily: T.sans, fontSize: "12px", color: T.muted, marginBottom: "6px" }}>
              <span style={{ color: T.primary }}>•</span>{r}
            </div>
          ))}
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "20px" }}>
          <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#f87171", fontWeight: 600, marginBottom: "14px" }}>DON&apos;T</div>
          {["Don't rotate, stretch or distort the logo", "Don't change the colour scheme", "Don't add effects except the approved hero-glow", "Don't place on busy or light backgrounds", "Don't recreate or re-letter the wordmark"].map((r) => (
            <div key={r} style={{ display: "flex", gap: "8px", fontFamily: T.sans, fontSize: "12px", color: T.muted, marginBottom: "10px" }}>
              <span style={{ color: "#f87171" }}>✕</span>{r}
            </div>
          ))}
        </div>
      </div>

      {/* 04 Principles */}
      <div style={{ fontFamily: T.mono, fontSize: "11px", letterSpacing: "0.06em", color: T.primary, marginBottom: "12px" }}>// 04 — DESIGN PRINCIPLES</div>
      <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: "30px", lineHeight: 0.92, letterSpacing: "-0.01em", textTransform: "uppercase", color: T.fg, marginBottom: "18px" }}>CORE PRINCIPLES</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "36px" }}>
        {PRINCIPLES.map((p, i) => (
          <div key={p.title} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "18px" }}>
            <div style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "15px", color: `${T.primary}70`, marginBottom: "10px" }}>0{i + 1}</div>
            <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: "15px", letterSpacing: "0.01em", color: T.fg, marginBottom: "8px" }}>{p.title}</div>
            <div style={{ fontFamily: T.sans, fontSize: "11.5px", lineHeight: 1.6, color: T.muted }}>{p.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ height: 1, background: T.border, margin: "8px 0 14px" }} />
      <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.06em", color: `${T.muted}99` }}>© 2025 NULLSHIFT — BUILT WITH INTENTION</div>
    </div>
  );
}

export default function BrandPage() {
  const printRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    if (!printRef.current || busy) return;
    setBusy(true);
    try {
      await generateBrandPdf(printRef.current);
    } finally {
      setBusy(false);
    }
  };

  const DownloadBtn = ({ className = "" }: { className?: string }) => (
    <button
      onClick={handleDownload}
      disabled={busy}
      className={`inline-flex items-center gap-3 px-6 h-12 font-semibold transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-60 ${className}`}
      style={{ fontFamily: T.mono, fontSize: "0.78rem", letterSpacing: "0.06em", textTransform: "uppercase", background: T.primary, color: T.primaryFg, borderRadius: "2px", boxShadow: `0 0 24px color-mix(in oklab, ${T.primary} 30%, transparent)`, whiteSpace: "nowrap" }}
    >
      {busy ? "Generating…" : "Download PDF"}
      {!busy && <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1V9M7 9L4 6M7 9L10 6M2 12H12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </button>
  );

  return (
    <>
      <Nav />
      <BrandPrintable printRef={printRef} />
      <main>
        {/* Header */}
        <section className="pt-28 pb-16 px-8 md:px-16" style={{ borderBottom: `1px solid ${T.border}`, backgroundImage: `radial-gradient(ellipse 50% 60% at 75% 30%, color-mix(in oklab, ${T.primary} 5%, transparent) 0%, transparent 70%)` }}>
          <div className="flex items-center gap-3 mb-5">
            <span className="size-2 rounded-full" style={{ background: T.primary }} />
            <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}>SYS_08 / BRAND</span>
          </div>
          <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(3rem,8vw,8rem)", lineHeight: 0.9, letterSpacing: "-0.01em", textTransform: "uppercase", color: T.fg }}>
            BRAND<br /><span className="hero-glow" style={{ color: T.primary }}>GUIDELINES.</span>
          </h1>
          <p className="mt-6 max-w-[52ch]" style={{ fontFamily: T.sans, fontSize: "1rem", lineHeight: 1.75, color: T.muted }}>
            The single source of truth for Nullshift&apos;s visual identity — typography, colour, logo usage, and the principles that keep every touchpoint consistent and intentional.
          </p>
          <div className="mt-8"><DownloadBtn /></div>
        </section>

        <div className="max-w-7xl mx-auto px-8 md:px-16">

          {/* 01 — Typography */}
          <section className="py-20">
            <Reveal><SectionTag>// 01 — Typography</SectionTag></Reveal>
            <Reveal delay={0.05}><H2>Type System</H2></Reveal>
            <div className="grid md:grid-cols-3 gap-3">
              {TYPE.map((t, i) => (
                <Reveal key={t.role} delay={i * 0.06}>
                  <div className="p-6 rounded-lg border h-full" style={{ background: T.surface, borderColor: T.border }}>
                    <div style={{ fontFamily: T.mono, fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>{t.role}</div>
                    <div className="mt-2 mb-1" style={{ fontFamily: `var(${t.cssVar})`, fontSize: "1.6rem", fontWeight: t.cssVar === "--font-display" ? 900 : 600, color: T.fg, textTransform: t.cssVar === "--font-display" ? "uppercase" : "none" }}>{t.font}</div>
                    <div style={{ fontFamily: T.mono, fontSize: "0.68rem", color: T.primary }}>{t.weights}</div>
                    <div style={{ fontFamily: T.mono, fontSize: "0.66rem", color: `${T.muted}99`, marginTop: "2px" }}>var({t.cssVar})</div>
                    <p className="mt-4" style={{ fontFamily: T.sans, fontSize: "0.8rem", lineHeight: 1.6, color: T.muted }}>{t.usage}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* 02 — Colour */}
          <section className="py-20" style={{ borderTop: `1px solid ${T.border}` }}>
            <Reveal><SectionTag>// 02 — Colour Palette</SectionTag></Reveal>
            <Reveal delay={0.05}><H2>Colour</H2></Reveal>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-8">
              {COLORS.map((c, i) => (
                <Reveal key={c.token} delay={(i % 3) * 0.05}>
                  <Swatch {...c} />
                </Reveal>
              ))}
            </div>
            <p className="mt-10 max-w-[60ch]" style={{ fontFamily: T.sans, fontSize: "0.85rem", lineHeight: 1.7, color: T.muted }}>
              The emerald <span style={{ color: T.primary }}>{T.primary}</span> is the single accent — reserved for the logo dot, CTAs, the headline glow, hover states, and active nav. Everything else stays in the near-black → white → grey range.
            </p>
          </section>

          {/* 03 — Logo */}
          <section className="py-20" style={{ borderTop: `1px solid ${T.border}` }}>
            <Reveal><SectionTag>// 03 — Logo Usage</SectionTag></Reveal>
            <Reveal delay={0.05}><H2>Logo Guidelines</H2></Reveal>
            <div className="grid lg:grid-cols-2 gap-3">
              <Reveal>
                <div className="p-8 rounded-lg border h-full" style={{ background: T.surface, borderColor: T.border }}>
                  <div style={{ fontFamily: T.mono, fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>Primary Logo</div>
                  <div className="flex items-center justify-center h-40 border rounded-lg my-6" style={{ borderColor: T.border }}>
                    <div className="flex items-center gap-2.5">
                      <span className="size-3 rounded-full" style={{ background: T.primary }} />
                      <span style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "1.4rem", letterSpacing: "0.04em", color: T.fg }}>NULLSHIFT</span>
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {["Always maintain clear space around the logo", "Minimum width: 120px", "Use on dark backgrounds (near-black) only"].map((r) => (
                      <li key={r} className="flex gap-3" style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.muted }}>
                        <span style={{ color: T.primary }}>•</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
              <Reveal delay={0.08}>
                <div className="p-8 rounded-lg border h-full" style={{ background: T.surface, borderColor: T.border }}>
                  <div style={{ fontFamily: T.mono, fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#f87171", fontWeight: 600 }}>Don&apos;t</div>
                  <ul className="space-y-4 mt-6">
                    {["Don't rotate, stretch or distort the logo", "Don't change the colour scheme", "Don't add effects except the approved hero-glow", "Don't place on busy or light backgrounds", "Don't recreate or re-letter the wordmark"].map((r) => (
                      <li key={r} className="flex gap-3" style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.muted }}>
                        <span style={{ color: "#f87171" }}>✕</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
          </section>

          {/* 04 — Principles */}
          <section className="py-20" style={{ borderTop: `1px solid ${T.border}` }}>
            <Reveal><SectionTag>// 04 — Design Principles</SectionTag></Reveal>
            <Reveal delay={0.05}><H2>Core Principles</H2></Reveal>
            <div className="grid md:grid-cols-3 gap-3">
              {PRINCIPLES.map((p, i) => (
                <Reveal key={p.title} delay={i * 0.06}>
                  <div className="p-7 rounded-lg border h-full" style={{ background: T.surface, borderColor: T.border }}>
                    <div className="mb-3" style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "1.1rem", color: `${T.primary}70` }}>0{i + 1}</div>
                    <h3 className="mb-3" style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1.2rem", letterSpacing: "0.01em", color: T.fg }}>{p.title}</h3>
                    <p style={{ fontFamily: T.sans, fontSize: "0.85rem", lineHeight: 1.7, color: T.muted }}>{p.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* Footer download CTA */}
          <section className="py-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6" style={{ borderTop: `1px solid ${T.border}` }}>
            <div>
              <h2 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(1.8rem,3.5vw,2.8rem)", lineHeight: 0.95, textTransform: "uppercase", color: T.fg }}>Take it with you.</h2>
              <p className="mt-2" style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted }}>Download the full guidelines as a PDF.</p>
            </div>
            <DownloadBtn />
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
