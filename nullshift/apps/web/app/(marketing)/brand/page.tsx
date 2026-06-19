"use client";

import { useRef, useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { Logo, LogoMark } from "@nullshift/ui/components/Logo";
import { T } from "@nullshift/ui/tokens";
import { COLORS, TYPE, PRINCIPLES, generateBrandPdf } from "@/lib/brandPdf";

/* ── App icon (favicon) — rounded square + parallel pills ── */
function AppIcon({ size = 56 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        width="160"
        height="160"
        rx="34"
        fill="#0a0b0d"
        stroke={T.border}
        strokeWidth="2"
      />
      <rect x="44.69" y="33.95" width="31.42" height="81.96" rx="10" fill="#d6d6d6" />
      <rect x="83.88" y="45.3" width="29.5" height="78.7" rx="10" fill={T.primary} />
    </svg>
  );
}

/* ── Signature graphic marks (static SVG of the live 3D pieces) ── */
function GyroscopeMark({ size = 132 }: { size?: number }) {
  const g = T.primary,
    b = T.primaryHover;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <ellipse
        cx="120"
        cy="120"
        rx="92"
        ry="38"
        stroke={g}
        strokeWidth="3"
        opacity="0.9"
      />
      <ellipse
        cx="120"
        cy="120"
        rx="44"
        ry="86"
        stroke={g}
        strokeWidth="3"
        opacity="0.9"
      />
      <ellipse
        cx="120"
        cy="120"
        rx="70"
        ry="62"
        stroke={b}
        strokeWidth="2.4"
        opacity="0.6"
      />
      <circle cx="120" cy="120" r="11" fill="#020A04" stroke={b} strokeWidth="2.5" />
      <circle cx="120" cy="120" r="4.5" fill={b} />
    </svg>
  );
}
function NeuralMark({ size = 132 }: { size?: number }) {
  const g = T.primary,
    b = T.primaryHover;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="120" cy="120" r="84" stroke={g} strokeWidth="2" opacity="0.35" />
      <g stroke={g} strokeWidth="1.6" opacity="0.55">
        <line x1="120" y1="120" x2="64" y2="76" />
        <line x1="120" y1="120" x2="180" y2="86" />
        <line x1="120" y1="120" x2="86" y2="182" />
        <line x1="64" y1="76" x2="180" y2="86" />
        <line x1="180" y1="86" x2="86" y2="182" />
        <line x1="64" y1="76" x2="86" y2="182" />
      </g>
      <g fill={b}>
        <circle cx="120" cy="120" r="9" />
        <circle cx="64" cy="76" r="5.5" />
        <circle cx="180" cy="86" r="5.5" />
        <circle cx="86" cy="182" r="5.5" />
        <circle cx="170" cy="170" r="4.5" />
        <circle cx="52" cy="140" r="4.5" />
      </g>
    </svg>
  );
}

/* ── Colour swatch with copy-to-clipboard ── */
function Swatch({
  name,
  token,
  hex,
  role,
}: {
  name: string;
  token: string;
  hex: string;
  role: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(hex);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="group text-left w-full block"
      style={{ cursor: "pointer" }}
    >
      <div
        className="h-24 w-full rounded-lg border transition-transform duration-200 group-hover:scale-[1.03]"
        style={{ background: hex, borderColor: T.borderStr }}
      />
      <div className="mt-3 flex items-center justify-between">
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "0.72rem",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: T.fg,
            fontWeight: 600,
          }}
        >
          {name}
        </span>
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "0.62rem",
            color: copied ? T.primary : `${T.muted}99`,
          }}
        >
          {copied ? "COPIED ✓" : "COPY"}
        </span>
      </div>
      <div style={{ fontFamily: T.mono, fontSize: "0.78rem", color: T.muted }}>{hex}</div>
      <div style={{ fontFamily: T.mono, fontSize: "0.66rem", color: `${T.muted}99` }}>
        var(--{token})
      </div>
      <div
        style={{
          fontFamily: T.sans,
          fontSize: "0.78rem",
          color: T.muted,
          paddingTop: "4px",
        }}
      >
        {role}
      </div>
    </button>
  );
}

function SectionTag({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-3 mb-6"
      style={{
        fontFamily: T.mono,
        fontSize: "0.7rem",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: T.primary,
      }}
    >
      <span>{children}</span>
      <span className="h-px w-8" style={{ background: `${T.primary}55` }} />
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-8"
      style={{
        fontFamily: T.display,
        fontWeight: 600,
        fontSize: "clamp(2.2rem,4vw,3rem)",
        lineHeight: 1.04,
        letterSpacing: "-0.03em",
        color: T.fg,
      }}
    >
      {children}
    </h2>
  );
}

/* ════════════════════════════════════════════════
   HIDDEN PRINTABLE — A4-width (794px) layout captured
   to PDF. Uses the real brand fonts + hex colours so
   the output mirrors the on-page guidelines exactly.
════════════════════════════════════════════════ */
function BrandPrintable({
  printRef,
}: {
  printRef: React.RefObject<HTMLDivElement | null>;
}) {
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "10px",
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: T.primary,
            display: "inline-block",
          }}
        />
        <span
          style={{
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: "40px",
            lineHeight: 1.04,
            letterSpacing: "-0.01em",
            textTransform: "uppercase",
            color: T.fg,
          }}
        >
          BRAND GUIDELINES
        </span>
      </div>
      <div
        style={{
          fontFamily: T.mono,
          fontSize: "11px",
          color: T.muted,
          marginBottom: "20px",
        }}
      >
        // NULLSHIFT — WEB DEVELOPMENT &amp; BRAND CREATION
      </div>
      <div style={{ height: 1, background: T.border, marginBottom: "20px" }} />
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "13px",
          lineHeight: 1.7,
          color: T.muted,
          maxWidth: "62ch",
          marginBottom: "40px",
        }}
      >
        This document is the single source of truth for Nullshift&apos;s visual identity.
        It defines the typography, colour palette, logo usage, and design principles that
        keep every touchpoint consistent, recognisable, and intentional.
      </p>

      {/* 01 Typography */}
      <div
        style={{
          fontFamily: T.mono,
          fontSize: "11px",
          letterSpacing: "0.06em",
          color: T.primary,
          marginBottom: "12px",
        }}
      >
        // 01 — TYPOGRAPHY
      </div>
      <div
        style={{
          fontFamily: T.display,
          fontWeight: 600,
          fontSize: "30px",
          lineHeight: 1.04,
          letterSpacing: "-0.03em",
          color: T.fg,
          marginBottom: "18px",
        }}
      >
        TYPE SYSTEM
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginBottom: "44px",
        }}
      >
        {TYPE.map((t) => (
          <div
            key={t.role}
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: "18px 20px",
            }}
          >
            <div
              style={{
                fontFamily: T.mono,
                fontSize: "10px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: T.muted,
                fontWeight: 600,
                marginBottom: "6px",
              }}
            >
              {t.role}
            </div>
            <div
              style={{
                fontFamily: `var(${t.cssVar})`,
                fontSize: "26px",
                fontWeight: 600,
                color: T.fg,
                marginBottom: "4px",
              }}
            >
              {t.font}
            </div>
            <div style={{ fontFamily: T.mono, fontSize: "11px", color: T.primary }}>
              {t.weights} &nbsp; var({t.cssVar})
            </div>
            <div
              style={{
                fontFamily: T.sans,
                fontSize: "12px",
                color: T.muted,
                marginTop: "8px",
              }}
            >
              {t.usage}
            </div>
          </div>
        ))}
      </div>

      {/* 02 Colour */}
      <div
        style={{
          fontFamily: T.mono,
          fontSize: "11px",
          letterSpacing: "0.06em",
          color: T.primary,
          marginBottom: "12px",
        }}
      >
        // 02 — COLOUR PALETTE
      </div>
      <div
        style={{
          fontFamily: T.display,
          fontWeight: 600,
          fontSize: "30px",
          lineHeight: 1.04,
          letterSpacing: "-0.03em",
          color: T.fg,
          marginBottom: "18px",
        }}
      >
        COLOUR
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "16px 16px",
          marginBottom: "44px",
        }}
      >
        {COLORS.map((c) => (
          <div key={c.token}>
            <div
              style={{
                height: 70,
                borderRadius: 6,
                background: c.hex,
                border: `1px solid ${T.borderStr}`,
              }}
            />
            <div
              style={{
                fontFamily: T.mono,
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: T.fg,
                marginTop: "8px",
              }}
            >
              {c.name}
            </div>
            <div style={{ fontFamily: T.mono, fontSize: "11px", color: T.muted }}>
              {c.hex}
            </div>
            <div style={{ fontFamily: T.mono, fontSize: "10px", color: `${T.muted}99` }}>
              var(--{c.token})
            </div>
            <div
              style={{
                fontFamily: T.sans,
                fontSize: "10.5px",
                lineHeight: 1.5,
                color: T.muted,
                marginTop: "3px",
              }}
            >
              {c.role}
            </div>
          </div>
        ))}
      </div>

      {/* 03 Logo */}
      <div
        style={{
          fontFamily: T.mono,
          fontSize: "11px",
          letterSpacing: "0.06em",
          color: T.primary,
          marginBottom: "12px",
        }}
      >
        // 03 — LOGO &amp; MARK
      </div>
      <div
        style={{
          fontFamily: T.display,
          fontWeight: 600,
          fontSize: "30px",
          lineHeight: 1.04,
          letterSpacing: "-0.03em",
          color: T.fg,
          marginBottom: "18px",
        }}
      >
        THE MARK
      </div>
      {/* Logo variants — equal tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "10px",
          marginBottom: "10px",
        }}
      >
        {[
          { label: "PRIMARY LOCKUP", node: <Logo markSize={20} /> },
          { label: "MARK", node: <LogoMark size={34} /> },
          { label: "APP ICON", node: <AppIcon size={44} /> },
        ].map((v) => (
          <div
            key={v.label}
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: "16px",
            }}
          >
            <div
              style={{
                fontFamily: T.mono,
                fontSize: "9px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: T.muted,
                fontWeight: 600,
                marginBottom: "12px",
              }}
            >
              {v.label}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 84,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                background: T.bg,
              }}
            >
              {v.node}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px",
          marginBottom: "44px",
        }}
      >
        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: "20px",
          }}
        >
          <div
            style={{
              fontFamily: T.mono,
              fontSize: "10px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: T.primary,
              fontWeight: 600,
              marginBottom: "14px",
            }}
          >
            DO
          </div>
          {[
            "Maintain clear space of at least the mark's width",
            "Minimum lockup width: 120px · mark: 18px",
            "Use on the near-black background",
            "Keep the light / emerald pill relationship intact",
          ].map((r) => (
            <div
              key={r}
              style={{
                display: "flex",
                gap: "8px",
                fontFamily: T.sans,
                fontSize: "12px",
                color: T.muted,
                marginBottom: "8px",
              }}
            >
              <span style={{ color: T.primary }}>•</span>
              {r}
            </div>
          ))}
        </div>
        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: "20px",
          }}
        >
          <div
            style={{
              fontFamily: T.mono,
              fontSize: "10px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: T.danger,
              fontWeight: 600,
              marginBottom: "14px",
            }}
          >
            DON&apos;T
          </div>
          {[
            "Don't rotate, stretch or distort the mark",
            "Don't change the colour scheme or recolour the pills",
            "Don't add effects except the approved hero-glow",
            "Don't place on busy or light backgrounds",
            "Don't recreate or re-letter the wordmark",
          ].map((r) => (
            <div
              key={r}
              style={{
                display: "flex",
                gap: "8px",
                fontFamily: T.sans,
                fontSize: "12px",
                color: T.muted,
                marginBottom: "8px",
              }}
            >
              <span style={{ color: T.danger }}>✕</span>
              {r}
            </div>
          ))}
        </div>
      </div>

      {/* 04 Signature Graphics */}
      <div
        style={{
          fontFamily: T.mono,
          fontSize: "11px",
          letterSpacing: "0.06em",
          color: T.primary,
          marginBottom: "12px",
        }}
      >
        // 04 — SIGNATURE GRAPHICS
      </div>
      <div
        style={{
          fontFamily: T.display,
          fontWeight: 600,
          fontSize: "30px",
          lineHeight: 1.04,
          letterSpacing: "-0.03em",
          color: T.fg,
          marginBottom: "18px",
        }}
      >
        VISUAL LANGUAGE
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px",
          marginBottom: "44px",
        }}
      >
        {[
          {
            label: "GYROSCOPE",
            mark: <GyroscopeMark size={104} />,
            desc: "Gimbal rings, glass band, mirror core — craft, precision, motion.",
          },
          {
            label: "NEURAL SPHERE",
            mark: <NeuralMark size={104} />,
            desc: "Icosphere node network in a glass cage — systems, intelligence, connection.",
          },
        ].map((v) => (
          <div
            key={v.label}
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: "18px",
            }}
          >
            <div
              style={{
                fontFamily: T.mono,
                fontSize: "10px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: T.muted,
                fontWeight: 600,
                marginBottom: "12px",
              }}
            >
              {v.label}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 150,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                background: T.bg,
                marginBottom: "12px",
              }}
            >
              {v.mark}
            </div>
            <div
              style={{
                fontFamily: T.sans,
                fontSize: "11.5px",
                lineHeight: 1.6,
                color: T.muted,
              }}
            >
              {v.desc}
            </div>
          </div>
        ))}
      </div>

      {/* 05 Principles */}
      <div
        style={{
          fontFamily: T.mono,
          fontSize: "11px",
          letterSpacing: "0.06em",
          color: T.primary,
          marginBottom: "12px",
        }}
      >
        // 05 — DESIGN PRINCIPLES
      </div>
      <div
        style={{
          fontFamily: T.display,
          fontWeight: 600,
          fontSize: "30px",
          lineHeight: 1.04,
          letterSpacing: "-0.03em",
          color: T.fg,
          marginBottom: "18px",
        }}
      >
        CORE PRINCIPLES
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "10px",
          marginBottom: "36px",
        }}
      >
        {PRINCIPLES.map((p, i) => (
          <div
            key={p.title}
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: "18px",
            }}
          >
            <div
              style={{
                fontFamily: T.mono,
                fontWeight: 600,
                fontSize: "15px",
                color: `${T.primary}70`,
                marginBottom: "10px",
              }}
            >
              0{i + 1}
            </div>
            <div
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: "15px",
                letterSpacing: "0.01em",
                color: T.fg,
                marginBottom: "8px",
              }}
            >
              {p.title}
            </div>
            <div
              style={{
                fontFamily: T.sans,
                fontSize: "11.5px",
                lineHeight: 1.6,
                color: T.muted,
              }}
            >
              {p.desc}
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 1, background: T.border, margin: "8px 0 14px" }} />
      <div
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.06em",
          color: `${T.muted}99`,
        }}
      >
        © 2025 NULLSHIFT — BUILT WITH INTENTION
      </div>
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
      style={{
        fontFamily: T.sans,
        fontSize: "0.875rem",
        letterSpacing: "-0.005em",
        background: T.primary,
        color: T.primaryFg,
        borderRadius: T.r.md,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)`,
        whiteSpace: "nowrap",
      }}
    >
      {busy ? "Generating…" : "Download PDF"}
      {!busy && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M7 1V9M7 9L4 6M7 9L10 6M2 12H12"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );

  return (
    <>
      <Nav />
      <BrandPrintable printRef={printRef} />
      <main>
        {/* Header */}
        <section
          className="pt-28 pb-16 px-8 md:px-16"
          style={{
            borderBottom: `1px solid ${T.border}`,
            backgroundImage: `radial-gradient(ellipse 50% 60% at 75% 30%, color-mix(in oklab, ${T.primary} 5%, transparent) 0%, transparent 70%)`,
          }}
        >
          <div className="flex items-center gap-2 mb-5">
            <span
              className="size-2 rounded-full"
              style={{ background: T.primary, boxShadow: `0 0 0 3px ${T.primarySoft}` }}
            />
            <span
              style={{
                fontFamily: T.sans,
                fontSize: "0.75rem",
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: T.muted,
              }}
            >
              Brand guidelines
            </span>
          </div>
          <h1
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "clamp(3rem,8vw,8rem)",
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
              color: T.fg,
            }}
          >
            Brand
            <br />
            <span className="hero-glow" style={{ color: T.primary }}>
              guidelines.
            </span>
          </h1>
          <p
            className="mt-6 max-w-[52ch]"
            style={{
              fontFamily: T.sans,
              fontSize: "1rem",
              lineHeight: 1.75,
              color: T.muted,
            }}
          >
            The single source of truth for Nullshift&apos;s visual identity — typography,
            colour, logo usage, and the principles that keep every touchpoint consistent
            and intentional.
          </p>
          <div className="mt-8">
            <DownloadBtn />
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-8 md:px-16">
          {/* 01 — Typography */}
          <section className="py-20">
            <Reveal>
              <SectionTag>// 01 — Typography</SectionTag>
            </Reveal>
            <Reveal delay={0.05}>
              <H2>Type System</H2>
            </Reveal>
            <div className="grid md:grid-cols-3 gap-3">
              {TYPE.map((t, i) => (
                <Reveal key={t.role} delay={i * 0.06}>
                  <div
                    className="p-6 rounded-lg border h-full"
                    style={{ background: T.surface, borderColor: T.border }}
                  >
                    <div
                      style={{
                        fontFamily: T.mono,
                        fontSize: "0.7rem",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: T.muted,
                        fontWeight: 600,
                      }}
                    >
                      {t.role}
                    </div>
                    <div
                      className="mt-2 mb-1"
                      style={{
                        fontFamily: `var(${t.cssVar})`,
                        fontSize: "1.6rem",
                        fontWeight: 600,
                        color: T.fg,
                      }}
                    >
                      {t.font}
                    </div>
                    <div
                      style={{
                        fontFamily: T.mono,
                        fontSize: "0.68rem",
                        color: T.primary,
                      }}
                    >
                      {t.weights}
                    </div>
                    <div
                      style={{
                        fontFamily: T.mono,
                        fontSize: "0.66rem",
                        color: `${T.muted}99`,
                        marginTop: "2px",
                      }}
                    >
                      var({t.cssVar})
                    </div>
                    <p
                      className="mt-4"
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.8rem",
                        lineHeight: 1.6,
                        color: T.muted,
                      }}
                    >
                      {t.usage}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* 02 — Colour */}
          <section className="py-20" style={{ borderTop: `1px solid ${T.border}` }}>
            <Reveal>
              <SectionTag>// 02 — Colour Palette</SectionTag>
            </Reveal>
            <Reveal delay={0.05}>
              <H2>Colour</H2>
            </Reveal>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-8">
              {COLORS.map((c, i) => (
                <Reveal key={c.token} delay={(i % 3) * 0.05}>
                  <Swatch {...c} />
                </Reveal>
              ))}
            </div>
            <p
              className="mt-10 max-w-[60ch]"
              style={{
                fontFamily: T.sans,
                fontSize: "0.85rem",
                lineHeight: 1.7,
                color: T.muted,
              }}
            >
              The emerald <span style={{ color: T.primary }}>{T.primary}</span> is the
              single accent — reserved for the logo dot, CTAs, the headline glow, hover
              states, and active nav. Everything else stays in the near-black → white →
              grey range.
            </p>
          </section>

          {/* 03 — Logo & Mark */}
          <section className="py-20" style={{ borderTop: `1px solid ${T.border}` }}>
            <Reveal>
              <SectionTag>// 03 — Logo &amp; Mark</SectionTag>
            </Reveal>
            <Reveal delay={0.05}>
              <H2>The Mark</H2>
            </Reveal>
            <Reveal delay={0.08}>
              <p
                className="mb-12 max-w-[56ch]"
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.9375rem",
                  lineHeight: 1.65,
                  color: T.muted,
                }}
              >
                Two staggered, rounded pills — one light, one emerald, offset to suggest a
                shift — paired with the NULLSHIFT wordmark. One consistent signature
                across every surface.
              </p>
            </Reveal>

            {/* Logo variants — all tiles identical dimensions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              {[
                { label: "Primary lockup", node: <Logo markSize={28} /> },
                { label: "Mark", node: <LogoMark size={48} /> },
                { label: "App icon", node: <AppIcon size={60} /> },
              ].map((v, i) => (
                <Reveal key={v.label} delay={i * 0.06}>
                  <div
                    className="p-6 rounded-lg border h-full"
                    style={{ background: T.surface, borderColor: T.border }}
                  >
                    <div
                      className="mb-5"
                      style={{
                        fontFamily: T.mono,
                        fontSize: "0.7rem",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: T.muted,
                        fontWeight: 600,
                      }}
                    >
                      {v.label}
                    </div>
                    <div
                      className="flex items-center justify-center rounded-lg border"
                      style={{ height: 132, borderColor: T.border, background: T.bg }}
                    >
                      {v.node}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Usage + Don't — equal-height cards */}
            <div className="grid lg:grid-cols-2 gap-3">
              <Reveal>
                <div
                  className="p-8 rounded-lg border h-full"
                  style={{ background: T.surface, borderColor: T.border }}
                >
                  <div
                    className="mb-6"
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.7rem",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: T.primary,
                      fontWeight: 600,
                    }}
                  >
                    Do
                  </div>
                  <ul className="space-y-3">
                    {[
                      "Maintain clear space of at least the mark's width on all sides",
                      "Minimum lockup width: 120px · minimum mark: 18px",
                      "Use on the near-black background (or the dark app-icon tile)",
                      "Keep the light pill / emerald pill colour relationship intact",
                    ].map((r) => (
                      <li
                        key={r}
                        className="flex gap-3"
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.85rem",
                          lineHeight: 1.5,
                          color: T.muted,
                        }}
                      >
                        <span style={{ color: T.primary, flexShrink: 0 }}>•</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
              <Reveal delay={0.08}>
                <div
                  className="p-8 rounded-lg border h-full"
                  style={{ background: T.surface, borderColor: T.border }}
                >
                  <div
                    className="mb-6"
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.7rem",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: T.danger,
                      fontWeight: 600,
                    }}
                  >
                    Don&apos;t
                  </div>
                  <ul className="space-y-3">
                    {[
                      "Don't rotate, stretch or distort the mark or pills",
                      "Don't change the colour scheme or recolour the pills",
                      "Don't add effects except the approved hero-glow",
                      "Don't place on busy or light backgrounds",
                      "Don't recreate or re-letter the wordmark",
                    ].map((r) => (
                      <li
                        key={r}
                        className="flex gap-3"
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.85rem",
                          lineHeight: 1.5,
                          color: T.muted,
                        }}
                      >
                        <span style={{ color: T.danger, flexShrink: 0 }}>✕</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
          </section>

          {/* 04 — Signature Graphics */}
          <section className="py-20" style={{ borderTop: `1px solid ${T.border}` }}>
            <Reveal>
              <SectionTag>// 04 — Signature Graphics</SectionTag>
            </Reveal>
            <Reveal delay={0.05}>
              <H2>Visual Language</H2>
            </Reveal>
            <Reveal delay={0.08}>
              <p
                className="mb-12 max-w-[60ch]"
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.9375rem",
                  lineHeight: 1.65,
                  color: T.muted,
                }}
              >
                Our signature graphics share one system —{" "}
                <span style={{ color: T.fg }}>
                  &ldquo;Glass &amp; Metal Relight&rdquo;
                </span>
                : emerald glass and gunmetal rendered on near-black with filmic
                tone-mapping. They animate and crossfade on scroll across the homepage.
              </p>
            </Reveal>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  label: "Gyroscope",
                  mark: <GyroscopeMark />,
                  desc: "Three gimbal rings, a glass band and a mirror core — craft, precision, motion. Anchors the “websites built from scratch” and “custom systems” chapters.",
                },
                {
                  label: "Neural Sphere",
                  mark: <NeuralMark />,
                  desc: "An icosphere network of pulsing nodes inside a glass cage — systems, intelligence, connection. Resolves in for the “one team, end to end” chapter.",
                },
              ].map((v, i) => (
                <Reveal key={v.label} delay={i * 0.06}>
                  <div
                    className="p-6 rounded-lg border h-full flex flex-col"
                    style={{ background: T.surface, borderColor: T.border }}
                  >
                    <div
                      className="mb-4"
                      style={{
                        fontFamily: T.mono,
                        fontSize: "0.7rem",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: T.muted,
                        fontWeight: 600,
                      }}
                    >
                      {v.label}
                    </div>
                    <div
                      className="flex items-center justify-center rounded-lg border mb-5"
                      style={{
                        height: 200,
                        borderColor: T.border,
                        background: `radial-gradient(ellipse 70% 70% at 50% 45%, ${T.primary}0e, transparent 75%), ${T.bg}`,
                      }}
                    >
                      {v.mark}
                    </div>
                    <p
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.85rem",
                        lineHeight: 1.65,
                        color: T.muted,
                      }}
                    >
                      {v.desc}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* 04 — Principles */}
          <section className="py-20" style={{ borderTop: `1px solid ${T.border}` }}>
            <Reveal>
              <SectionTag>// 05 — Design Principles</SectionTag>
            </Reveal>
            <Reveal delay={0.05}>
              <H2>Core Principles</H2>
            </Reveal>
            <div className="grid md:grid-cols-3 gap-3">
              {PRINCIPLES.map((p, i) => (
                <Reveal key={p.title} delay={i * 0.06}>
                  <div
                    className="p-7 rounded-lg border h-full"
                    style={{ background: T.surface, borderColor: T.border }}
                  >
                    <div
                      className="mb-3"
                      style={{
                        fontFamily: T.mono,
                        fontWeight: 600,
                        fontSize: "1.1rem",
                        color: `${T.primary}70`,
                      }}
                    >
                      0{i + 1}
                    </div>
                    <h3
                      className="mb-3"
                      style={{
                        fontFamily: T.display,
                        fontWeight: 600,
                        fontSize: "1.2rem",
                        letterSpacing: "0.01em",
                        color: T.fg,
                      }}
                    >
                      {p.title}
                    </h3>
                    <p
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.85rem",
                        lineHeight: 1.7,
                        color: T.muted,
                      }}
                    >
                      {p.desc}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* 05 — UI System */}
          <section className="py-20" style={{ borderTop: `1px solid ${T.border}` }}>
            <Reveal>
              <SectionTag>// 06 — UI System</SectionTag>
            </Reveal>
            <Reveal delay={0.05}>
              <H2>Halo UI System</H2>
            </Reveal>
            <p
              className="mb-12 max-w-[52ch]"
              style={{
                fontFamily: T.sans,
                fontSize: "0.9375rem",
                lineHeight: 1.65,
                color: T.muted,
              }}
            >
              Every interface is built on three surface tiers, a single brand signal, and
              typography that carries hierarchy without colour.
            </p>

            {/* Surface tiers */}
            <Reveal>
              <div
                className="mb-3"
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: T.muted,
                }}
              >
                Surface tiers
              </div>
            </Reveal>
            <div className="grid md:grid-cols-3 gap-3 mb-10">
              {[
                {
                  label: "Background",
                  color: T.bg,
                  token: "bg",
                  desc: "Page canvas. Nothing sits below this tier.",
                },
                {
                  label: "Surface",
                  color: T.surface,
                  token: "surface",
                  desc: "Cards, panels, nav, and inputs live here.",
                },
                {
                  label: "Elevated",
                  color: T.elevated,
                  token: "elevated",
                  desc: "Modals, dropdowns, and active tabs rise to this tier.",
                },
              ].map((s, i) => (
                <Reveal key={s.token} delay={i * 0.06}>
                  <div
                    className="p-6 rounded-lg border"
                    style={{ background: T.surface, borderColor: T.border }}
                  >
                    <div
                      className="h-12 rounded mb-4"
                      style={{ background: s.color, border: `1px solid ${T.borderStr}` }}
                    />
                    <div className="flex items-center justify-between mb-1">
                      <span
                        style={{
                          fontFamily: T.sans,
                          fontWeight: 600,
                          fontSize: "0.875rem",
                          color: T.fg,
                        }}
                      >
                        {s.label}
                      </span>
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: "0.7rem",
                          color: T.primary,
                        }}
                      >
                        T.{s.token}
                      </span>
                    </div>
                    <p
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.8rem",
                        lineHeight: 1.55,
                        color: T.muted,
                      }}
                    >
                      {s.desc}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Eyebrow pattern + radius */}
            <div className="grid md:grid-cols-2 gap-3 mb-3">
              <Reveal>
                <div
                  className="p-6 rounded-lg border h-full"
                  style={{ background: T.surface, borderColor: T.border }}
                >
                  <div
                    className="mb-3"
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: T.muted,
                    }}
                  >
                    Eyebrow pattern
                  </div>
                  <div className="flex items-center gap-2 mb-6">
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: T.primary,
                        boxShadow: `0 0 0 3px ${T.primarySoft}`,
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: T.muted,
                      }}
                    >
                      Section label
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {[
                      "8px dot in T.primary + T.primarySoft ring",
                      "label-sm: 0.75rem · weight 500 · 0.08em tracking",
                      "Uppercase · T.sans (not mono)",
                      "Used once per section to name the topic",
                    ].map((r) => (
                      <li
                        key={r}
                        className="flex gap-2.5"
                        style={{ fontFamily: T.sans, fontSize: "0.8rem", color: T.muted }}
                      >
                        <span style={{ color: T.primary, flexShrink: 0 }}>—</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
              <Reveal delay={0.06}>
                <div
                  className="p-6 rounded-lg border h-full"
                  style={{ background: T.surface, borderColor: T.border }}
                >
                  <div
                    className="mb-3"
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: T.muted,
                    }}
                  >
                    Radius scale
                  </div>
                  <div className="flex flex-col gap-3">
                    {[
                      { label: "sm — 6px", r: T.r.sm, usage: "Badges, inline tags" },
                      { label: "md — 10px", r: T.r.md, usage: "Inputs, buttons, chips" },
                      { label: "lg — 16px", r: T.r.lg, usage: "Cards, modals, panels" },
                      {
                        label: "xl — 24px",
                        r: T.r.xl,
                        usage: "Hero cards, large containers",
                      },
                    ].map(({ label, r, usage }) => (
                      <div key={label} className="flex items-center gap-4">
                        <div
                          style={{
                            width: 36,
                            height: 22,
                            background: T.primarySoft,
                            border: `1px solid ${T.primary}44`,
                            borderRadius: r,
                            flexShrink: 0,
                          }}
                        />
                        <div>
                          <span
                            style={{
                              fontFamily: T.mono,
                              fontSize: "0.72rem",
                              color: T.fg,
                            }}
                          >
                            {label}
                          </span>
                          <span
                            style={{
                              fontFamily: T.sans,
                              fontSize: "0.75rem",
                              color: T.muted,
                              marginLeft: 8,
                            }}
                          >
                            {usage}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            </div>

            {/* Button anatomy */}
            <Reveal delay={0.08}>
              <div
                className="p-6 rounded-lg border"
                style={{ background: T.surface, borderColor: T.border }}
              >
                <div
                  className="mb-4"
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: T.muted,
                  }}
                >
                  Button anatomy
                </div>
                <div className="flex flex-wrap items-center gap-4 mb-6">
                  <button
                    style={{
                      height: 48,
                      padding: "0 20px",
                      fontFamily: T.sans,
                      fontSize: "0.9375rem",
                      fontWeight: 500,
                      letterSpacing: "-0.005em",
                      background: T.primary,
                      color: T.primaryFg,
                      borderRadius: T.r.md,
                      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)`,
                      border: "none",
                      cursor: "default",
                    }}
                  >
                    Primary action
                  </button>
                  <button
                    style={{
                      height: 40,
                      padding: "0 16px",
                      fontFamily: T.sans,
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      letterSpacing: "-0.005em",
                      background: "transparent",
                      color: T.fg,
                      borderRadius: T.r.md,
                      border: `1px solid ${T.borderStr}`,
                      cursor: "default",
                    }}
                  >
                    Secondary
                  </button>
                  <button
                    style={{
                      height: 40,
                      padding: "0 16px",
                      fontFamily: T.sans,
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      letterSpacing: "-0.005em",
                      background: "transparent",
                      color: T.danger,
                      borderRadius: T.r.md,
                      border: `1px solid ${T.danger}44`,
                      cursor: "default",
                    }}
                  >
                    Destructive
                  </button>
                </div>
                <ul className="flex flex-wrap gap-x-8 gap-y-2">
                  {[
                    "T.sans — never mono on buttons",
                    "40–48px height",
                    "T.r.md radius (10px)",
                    "inset 0 1px 0 rgba(255,255,255,0.18) top-light",
                    "One brand colour for primary; no outlines or glows",
                  ].map((r) => (
                    <li
                      key={r}
                      className="flex gap-2"
                      style={{ fontFamily: T.sans, fontSize: "0.8rem", color: T.muted }}
                    >
                      <span style={{ color: T.primary }}>·</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </section>

          {/* 07 — Brand assets / Downloads */}
          <section className="py-20" style={{ borderTop: `1px solid ${T.border}` }}>
            <Reveal>
              <SectionTag>// 07 — Downloads</SectionTag>
            </Reveal>
            <Reveal delay={0.05}>
              <H2>Brand assets</H2>
            </Reveal>
            <Reveal delay={0.08}>
              <p
                className="mb-12 max-w-[58ch]"
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.9375rem",
                  lineHeight: 1.65,
                  color: T.muted,
                }}
              >
                Take the logo files and the animated intro with you — for slides, socials,
                email signatures, partner sites, or anywhere the brand needs to show up.
                High-resolution transparent PNGs, plus the logo opener as an MP4.
              </p>
            </Reveal>

            {/* Logo files — transparent PNGs for dark and light backgrounds */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              {[
                {
                  label: "Mark — on dark",
                  file: "/logos/nullshift-mark-dark.png",
                  download: "nullshift-mark-dark.png",
                  tileBg: T.bg,
                },
                {
                  label: "Mark — on light",
                  file: "/logos/nullshift-mark-light.png",
                  download: "nullshift-mark-light.png",
                  tileBg: "#F2F4F8",
                },
                {
                  label: "Wordmark",
                  file: "/logos/nullshift-wordmark.png",
                  download: "nullshift-wordmark.png",
                  tileBg: T.bg,
                },
              ].map((f, i) => (
                <Reveal key={f.label} delay={i * 0.06}>
                  <div
                    className="rounded-lg border overflow-hidden h-full flex flex-col"
                    style={{ background: T.surface, borderColor: T.border }}
                  >
                    <div
                      className="flex items-center justify-center"
                      style={{ height: 140, background: f.tileBg }}
                    >
                      <div
                        role="img"
                        aria-label={f.label}
                        style={{
                          width: "80%",
                          height: 88,
                          backgroundImage: `url(${f.file})`,
                          backgroundSize: "contain",
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "center",
                        }}
                      />
                    </div>
                    <div
                      className="flex items-center justify-between px-5 py-4"
                      style={{ borderTop: `1px solid ${T.border}` }}
                    >
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: "0.72rem",
                          letterSpacing: "0.04em",
                          color: T.fg,
                        }}
                      >
                        {f.label}
                      </span>
                      <a
                        href={f.file}
                        download={f.download}
                        className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-80"
                        style={{
                          fontFamily: T.mono,
                          fontSize: "0.7rem",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: T.primary,
                          textDecoration: "none",
                        }}
                      >
                        PNG
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 14 14"
                          fill="none"
                          aria-hidden
                        >
                          <path
                            d="M7 1V9M7 9L4 6M7 9L10 6M2 12H12"
                            stroke="currentColor"
                            strokeWidth="1.3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </a>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Animated intro */}
            <Reveal delay={0.1}>
              <div
                className="rounded-lg border overflow-hidden grid md:grid-cols-2"
                style={{ background: T.surface, borderColor: T.border }}
              >
                <div style={{ background: T.bg }}>
                  <video
                    src="/nullshift-logo-opener.mp4"
                    autoPlay
                    muted
                    loop
                    playsInline
                    aria-label="Nullshift animated logo opener"
                    style={{
                      width: "100%",
                      height: "100%",
                      minHeight: 240,
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </div>
                <div className="flex flex-col justify-center gap-4 p-8">
                  <div
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.7rem",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: T.primary,
                    }}
                  >
                    // The Nullshift intro
                  </div>
                  <h3
                    style={{
                      fontFamily: T.display,
                      fontWeight: 600,
                      fontSize: "1.5rem",
                      lineHeight: 1.1,
                      letterSpacing: "-0.02em",
                      color: T.fg,
                    }}
                  >
                    A cinematic logo opener.
                  </h3>
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.875rem",
                      lineHeight: 1.65,
                      color: T.muted,
                    }}
                  >
                    A 1080p brand reveal you can drop into videos, socials or
                    presentations. Download the MP4, or open the full interactive version
                    (with sound) that greets first-time visitors.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    <a
                      href="/nullshift-logo-opener.mp4"
                      download="nullshift-logo-opener.mp4"
                      className="inline-flex items-center gap-2 px-5 h-11 font-medium transition-opacity hover:opacity-90"
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.875rem",
                        background: T.primary,
                        color: T.primaryFg,
                        borderRadius: T.r.md,
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)`,
                        textDecoration: "none",
                      }}
                    >
                      Download MP4
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 14 14"
                        fill="none"
                        aria-hidden
                      >
                        <path
                          d="M7 1V9M7 9L4 6M7 9L10 6M2 12H12"
                          stroke="currentColor"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </a>
                    <a
                      href="/nullshift-intro.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 h-11 transition-opacity hover:opacity-90"
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.875rem",
                        color: T.fg,
                        border: `1px solid ${T.borderStr}`,
                        borderRadius: T.r.md,
                        textDecoration: "none",
                      }}
                    >
                      Open full version
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 14 14"
                        fill="none"
                        aria-hidden
                      >
                        <path
                          d="M5 3h6v6M11 3L3 11"
                          stroke="currentColor"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            </Reveal>
          </section>

          {/* Footer download CTA */}
          <section
            className="py-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
            style={{ borderTop: `1px solid ${T.border}` }}
          >
            <div>
              <h2
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "clamp(1.8rem,3.5vw,2.8rem)",
                  lineHeight: 1.04,
                  letterSpacing: "-0.03em",
                  color: T.fg,
                }}
              >
                Take it with you.
              </h2>
              <p
                className="mt-2"
                style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted }}
              >
                Download the full guidelines as a PDF.
              </p>
            </div>
            <DownloadBtn />
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
