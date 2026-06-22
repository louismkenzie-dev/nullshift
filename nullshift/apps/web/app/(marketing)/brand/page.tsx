"use client";

import { useRef, useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { NeuralField } from "@/components/NeuralField";
import { Parallax } from "@/components/Parallax";
import { Logo, LogoMark } from "@nullshift/ui/components/Logo";
import { T } from "@nullshift/ui/tokens";
import { ClipReveal } from "@/components/anim/ClipReveal";
import {
  Reveal,
  Section,
  Container,
  Eyebrow,
  Display,
  Lead,
  SectionHeader,
  TextLink,
  Watermark,
} from "@/components/kyma";
import { COLORS, TYPE, PRINCIPLES, PRINT, generateBrandPdf } from "@/lib/brandPdf";

/* ── App icon — square tile + the parallel pills ── */
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
        fill="#0a0a0a"
        stroke="rgba(244,244,232,0.18)"
        strokeWidth="2"
      />
      <rect x="44.69" y="33.95" width="31.42" height="81.96" rx="9" fill="#d6d6d6" />
      <rect x="83.88" y="45.3" width="29.5" height="78.7" rx="9" fill={T.primary} />
    </svg>
  );
}

/* ── Signature graphic — the agentic node-network (static mark of the live
   NeuralField), used on the page + captured into the PDF ── */
function NodeMeshMark({
  size = 132,
  line = PRINT.emerald,
  node = PRINT.emerald,
  pulse = PRINT.emerald2,
}: {
  size?: number;
  line?: string;
  node?: string;
  pulse?: string;
}) {
  const P: [number, number][] = [
    [120, 120],
    [54, 60],
    [190, 70],
    [212, 150],
    [150, 198],
    [66, 182],
    [38, 116],
    [120, 36],
    [176, 118],
    [92, 96],
    [150, 150],
  ];
  const E: [number, number][] = [
    [0, 9],
    [0, 8],
    [0, 10],
    [0, 7],
    [9, 1],
    [9, 6],
    [1, 7],
    [7, 2],
    [2, 8],
    [8, 3],
    [3, 10],
    [10, 4],
    [4, 5],
    [5, 6],
    [5, 10],
  ];
  const pulses = [8, 9, 4];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <g stroke={line} strokeWidth="1.4" opacity="0.5">
        {E.map(([a, b], i) => (
          <line key={i} x1={P[a][0]} y1={P[a][1]} x2={P[b][0]} y2={P[b][1]} />
        ))}
      </g>
      <g fill={node}>
        {P.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === 0 ? 6.5 : 3.4}
            opacity={i === 0 ? 1 : 0.85}
          />
        ))}
      </g>
      <g fill={pulse}>
        {pulses.map((i) => (
          <circle key={i} cx={P[i][0]} cy={P[i][1]} r="5.5" />
        ))}
      </g>
    </svg>
  );
}

/* ── Colour swatch (theme-aware; copy hex to clipboard) ── */
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
        setTimeout(() => setCopied(false), 1400);
      }}
      className="group text-left w-full block"
      style={{ cursor: "pointer", background: "none", border: "none", padding: 0 }}
    >
      <div
        className="w-full transition-transform duration-200 group-hover:scale-[1.02]"
        style={{
          height: 84,
          background: hex,
          border: "1px solid var(--k-border-strong)",
        }}
      />
      <div className="mt-3 flex items-center justify-between">
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "0.72rem",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--k-fg)",
            fontWeight: 500,
          }}
        >
          {name}
        </span>
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "0.6rem",
            letterSpacing: "0.06em",
            color: copied ? "var(--k-accent)" : "var(--k-faint)",
          }}
        >
          {copied ? "COPIED ✓" : "COPY"}
        </span>
      </div>
      <div style={{ fontFamily: T.mono, fontSize: "0.76rem", color: "var(--k-muted)" }}>
        {hex}
      </div>
      <div style={{ fontFamily: T.mono, fontSize: "0.64rem", color: "var(--k-faint)" }}>
        var(--{token.split(" ")[0]})
      </div>
      <div
        style={{
          fontFamily: T.sans,
          fontSize: "0.78rem",
          lineHeight: 1.45,
          color: "var(--k-muted)",
          paddingTop: 4,
        }}
      >
        {role}
      </div>
    </button>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-3 mb-5"
      style={{
        fontFamily: T.mono,
        fontSize: "0.7rem",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--k-accent)",
      }}
    >
      <span>{children}</span>
      <span style={{ height: 1, flex: 1, background: "var(--k-border)" }} />
    </div>
  );
}

/* ── Square download button (radius 0, emerald) ── */
function DownloadBtn({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-3 transition-opacity hover:opacity-90 disabled:opacity-60"
      style={{
        height: 52,
        padding: "0 26px",
        fontFamily: T.mono,
        fontSize: "0.78rem",
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        background: "var(--k-accent)",
        color: PRINT.onEmerald,
        border: "none",
        borderRadius: 0,
        cursor: busy ? "default" : "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {busy ? "Generating…" : "Download guidelines"}
      {!busy && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M7 1V9M7 9L4 6M7 9L10 6M2 12H12"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

/* ════════════════════════════════════════════════════════════════
   HIDDEN PRINTABLE — A4-width (794px) dark document captured to PDF.
   Uses explicit hex (PRINT.*) since it sits outside the themed
   sections, so the output matches the live design system exactly.
   ════════════════════════════════════════════════════════════════ */
function BrandPrintable({
  printRef,
}: {
  printRef: React.RefObject<HTMLDivElement | null>;
}) {
  const PAD = 56;
  const sub = (n: string, t: string) => (
    <>
      <div
        style={{
          fontFamily: T.mono,
          fontSize: "11px",
          letterSpacing: "0.06em",
          color: PRINT.emerald,
          marginBottom: "12px",
        }}
      >
        {n}
      </div>
      <div
        style={{
          fontFamily: T.sans,
          fontWeight: 700,
          fontSize: "30px",
          lineHeight: 1.04,
          letterSpacing: "-0.03em",
          textTransform: "uppercase",
          color: PRINT.bone,
          marginBottom: "18px",
        }}
      >
        {t}
      </div>
    </>
  );
  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: PRINT.darkSurface,
    border: `1px solid ${PRINT.darkBorder}`,
    padding: "18px 20px",
    ...extra,
  });
  return (
    <div
      ref={printRef}
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: "-12000px",
        width: "794px",
        background: PRINT.ink,
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
            background: PRINT.emerald,
            display: "inline-block",
          }}
        />
        <span
          style={{
            fontFamily: T.sans,
            fontWeight: 700,
            fontSize: "40px",
            lineHeight: 1.02,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            color: PRINT.bone,
          }}
        >
          Brand Guidelines
        </span>
      </div>
      <div
        style={{
          fontFamily: T.mono,
          fontSize: "11px",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: PRINT.darkMuted,
          marginBottom: "20px",
        }}
      >
        Nullshift — Agentic AI automation · Design system 2026
      </div>
      <div style={{ height: 1, background: PRINT.darkBorder, marginBottom: "20px" }} />
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "13px",
          lineHeight: 1.7,
          color: PRINT.darkMuted,
          maxWidth: "64ch",
          marginBottom: "40px",
        }}
      >
        The single source of truth for Nullshift&apos;s visual identity: the
        cream-and-dark themes, one emerald accent, square geometry, TASA Orbiter and
        Roboto Mono, and the agentic node-network that signs every surface.
      </p>

      {/* 01 Typography */}
      {sub("// 01 — Typography", "Type system")}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginBottom: "44px",
        }}
      >
        {TYPE.map((t) => (
          <div key={t.role} style={card()}>
            <div
              style={{
                fontFamily: T.mono,
                fontSize: "10px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: PRINT.darkMuted,
                fontWeight: 500,
                marginBottom: "6px",
              }}
            >
              {t.role}
            </div>
            <div
              style={{
                fontFamily: `var(${t.cssVar})`,
                fontSize: "26px",
                fontWeight: 700,
                textTransform: t.cssVar === "--font-mono" ? "none" : "uppercase",
                color: PRINT.bone,
                marginBottom: "4px",
              }}
            >
              {t.font}
            </div>
            <div style={{ fontFamily: T.mono, fontSize: "11px", color: PRINT.emerald }}>
              {t.weights} &nbsp; var({t.cssVar})
            </div>
            <div
              style={{
                fontFamily: T.sans,
                fontSize: "12px",
                lineHeight: 1.5,
                color: PRINT.darkMuted,
                marginTop: "8px",
              }}
            >
              {t.usage}
            </div>
          </div>
        ))}
      </div>

      {/* 02 Colour */}
      {sub("// 02 — Colour", "Cream, dark & emerald")}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "14px",
          marginBottom: "44px",
        }}
      >
        {COLORS.map((c) => (
          <div key={c.name + c.token}>
            <div
              style={{
                height: 58,
                background: c.hex,
                border: `1px solid ${PRINT.darkBorderStrong}`,
              }}
            />
            <div
              style={{
                fontFamily: T.mono,
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
                color: PRINT.bone,
                marginTop: "8px",
              }}
            >
              {c.name}
            </div>
            <div style={{ fontFamily: T.mono, fontSize: "11px", color: PRINT.darkMuted }}>
              {c.hex}
            </div>
            <div
              style={{ fontFamily: T.mono, fontSize: "9.5px", color: PRINT.darkFaint }}
            >
              {c.group}
            </div>
          </div>
        ))}
      </div>

      {/* 03 Logo */}
      {sub("// 03 — Logo & mark", "The mark")}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "10px",
          marginBottom: "44px",
        }}
      >
        {[
          { label: "Primary lockup", node: <Logo markSize={20} /> },
          { label: "Mark", node: <LogoMark size={34} /> },
          { label: "App icon", node: <AppIcon size={44} /> },
        ].map((v) => (
          <div key={v.label} style={card({ padding: "16px" })}>
            <div
              style={{
                fontFamily: T.mono,
                fontSize: "9px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: PRINT.darkMuted,
                fontWeight: 500,
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
                border: `1px solid ${PRINT.darkBorder}`,
                background: PRINT.ink,
              }}
            >
              {v.node}
            </div>
          </div>
        ))}
      </div>

      {/* 04 Visual language */}
      {sub("// 04 — Visual language", "The node-network")}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.4fr",
          gap: "12px",
          alignItems: "center",
          marginBottom: "44px",
          ...card({ padding: "22px" }),
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 150,
            border: `1px solid ${PRINT.darkBorder}`,
            background: PRINT.ink,
          }}
        >
          <NodeMeshMark size={132} />
        </div>
        <div
          style={{
            fontFamily: T.sans,
            fontSize: "12.5px",
            lineHeight: 1.65,
            color: PRINT.darkMuted,
          }}
        >
          The signature motif: nodes wired together with emerald data-pulses routing the
          edges — intelligence, connection and work routed end to end. It runs live behind
          every dark hero and resolves to this static mark in print. Pair it with square,
          hairline geometry and a single emerald highlight.
        </div>
      </div>

      {/* 05 Principles */}
      {sub("// 05 — Principles", "Core principles")}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        {PRINCIPLES.map((p, i) => (
          <div key={p.title} style={card()}>
            <div
              style={{
                fontFamily: T.mono,
                fontWeight: 500,
                fontSize: "13px",
                color: PRINT.emerald,
                marginBottom: "8px",
              }}
            >
              0{i + 1}
            </div>
            <div
              style={{
                fontFamily: T.sans,
                fontWeight: 700,
                fontSize: "15px",
                textTransform: "uppercase",
                letterSpacing: "-0.01em",
                color: PRINT.bone,
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
                color: PRINT.darkMuted,
              }}
            >
              {p.desc}
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 1, background: PRINT.darkBorder, margin: "26px 0 14px" }} />
      <div
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: PRINT.darkFaint,
        }}
      >
        © 2026 Nullshift — square corners, one emerald, built with intention
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
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

  const groups = ["Dark theme", "Cream theme", "Brand", "Signal"] as const;

  return (
    <>
      <Nav />
      <BrandPrintable printRef={printRef} />
      <main>
        {/* ═══ HERO (dark · layered node-network) ═══ */}
        <section
          className="k-dark relative overflow-hidden"
          style={{ background: "var(--k-bg)", color: "var(--k-fg)" }}
        >
          <NeuralField className="absolute inset-0" style={{ zIndex: 0 }} />
          <Parallax
            distance={-28}
            className="pointer-events-none absolute inset-0"
            style={{ zIndex: 1 }}
          >
            <div
              className="k-vgrid absolute inset-0"
              style={{
                opacity: 0.4,
                WebkitMaskImage: "linear-gradient(180deg,#000,transparent 82%)",
                maskImage: "linear-gradient(180deg,#000,transparent 82%)",
              }}
            />
          </Parallax>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              zIndex: 1,
              background:
                "radial-gradient(125% 95% at 50% 0%, transparent 30%, var(--k-bg) 94%)",
            }}
          />
          <Container
            style={{
              paddingTop: "clamp(116px,15vh,168px)",
              paddingBottom: "clamp(40px,6vw,72px)",
              position: "relative",
              zIndex: 2,
            }}
          >
            <Reveal>
              <Eyebrow index="00" label="Design system" />
            </Reveal>
            <ClipReveal delay={0.05}>
              <Display as="h1" size="hero" className="mt-6" style={{ maxWidth: "13ch" }}>
                Brand <span style={{ color: "var(--k-accent)" }}>system.</span>
              </Display>
            </ClipReveal>
            <Reveal delay={0.1}>
              <Lead className="mt-7" style={{ maxWidth: "58ch", fontSize: "1.125rem" }}>
                The single source of truth for Nullshift&apos;s identity — the
                cream-and-dark themes, the one emerald, the square geometry, TASA Orbiter
                and Roboto Mono, and the agentic node-network that signs every surface.
              </Lead>
            </Reveal>
            <Reveal delay={0.16}>
              <div className="mt-9 flex flex-wrap items-center gap-5">
                <DownloadBtn busy={busy} onClick={handleDownload} />
                <TextLink href="/">Back to site</TextLink>
              </div>
            </Reveal>
            <Parallax distance={42} className="mt-12 overflow-hidden">
              <Watermark>Brand</Watermark>
            </Parallax>
          </Container>
        </section>

        {/* ═══ 01 — Typography (cream) ═══ */}
        <Section theme="cream" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="01"
              label="Typography"
              title="TASA Orbiter + Roboto Mono"
              lead="Two typefaces carry the whole system. TASA Orbiter sets every heading in UPPERCASE and the body in sentence case; Roboto Mono handles the labels, tags and numbers."
            />
          </Reveal>
          <Reveal delay={0.06}>
            <div
              className="mt-12 p-8 md:p-12"
              style={{
                border: "1px solid var(--k-border)",
                background: "var(--k-surface)",
              }}
            >
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.7rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--k-accent)",
                }}
              >
                TASA Orbiter · 700
              </div>
              <div
                style={{
                  fontFamily: T.sans,
                  fontWeight: 700,
                  fontSize: "clamp(2.6rem,8vw,6rem)",
                  lineHeight: 0.98,
                  letterSpacing: "-0.03em",
                  textTransform: "uppercase",
                  color: "var(--k-fg)",
                  marginTop: 8,
                }}
              >
                Automated by AI
                <br />
                you own.
              </div>
            </div>
          </Reveal>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            {TYPE.map((t, i) => (
              <Reveal key={t.role} delay={i * 0.06}>
                <div
                  className="h-full p-6"
                  style={{
                    border: "1px solid var(--k-border)",
                    background: "var(--k-surface)",
                  }}
                >
                  <div
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.7rem",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--k-muted)",
                      fontWeight: 500,
                    }}
                  >
                    {t.role}
                  </div>
                  <div
                    className="mt-2 mb-1"
                    style={{
                      fontFamily: `var(${t.cssVar})`,
                      fontSize: "1.7rem",
                      fontWeight: 700,
                      textTransform: t.cssVar === "--font-mono" ? "none" : "uppercase",
                      color: "var(--k-fg)",
                    }}
                  >
                    {t.font}
                  </div>
                  <div
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.68rem",
                      color: "var(--k-accent)",
                    }}
                  >
                    {t.weights}
                  </div>
                  <div
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.64rem",
                      color: "var(--k-faint)",
                      marginTop: 2,
                    }}
                  >
                    var({t.cssVar})
                  </div>
                  <p
                    className="mt-4"
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.82rem",
                      lineHeight: 1.55,
                      color: "var(--k-muted)",
                    }}
                  >
                    {t.usage}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ═══ 02 — Colour (dark) ═══ */}
        <Section theme="dark" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="02"
              label="Colour"
              title="Cream, dark & one emerald"
              lead="The marketing site alternates two themes band to band. Emerald is the only accent — everything else is the warm ink-and-bone range. Signal colours are status only."
            />
          </Reveal>
          <div className="mt-12 flex flex-col gap-12">
            {groups.map((g) => (
              <Reveal key={g}>
                <div>
                  <GroupLabel>{g}</GroupLabel>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8">
                    {COLORS.filter((c) => c.group === g).map((c) => (
                      <Swatch
                        key={c.name + c.token}
                        name={c.name}
                        token={c.token}
                        hex={c.hex}
                        role={c.role}
                      />
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ═══ 03 — Logo & mark (cream) ═══ */}
        <Section theme="cream" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="03"
              label="Logo & mark"
              title="The mark"
              lead="Two staggered rounded pills — one bone, one emerald, offset to suggest a shift — beside the NULLSHIFT wordmark. The pills are the one place curves are allowed; everything around them is square."
            />
          </Reveal>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "Primary lockup", node: <Logo markSize={28} /> },
              { label: "Mark", node: <LogoMark size={48} /> },
              { label: "App icon", node: <AppIcon size={60} /> },
            ].map((v, i) => (
              <Reveal key={v.label} delay={i * 0.06}>
                <div
                  className="h-full p-6"
                  style={{
                    border: "1px solid var(--k-border)",
                    background: "var(--k-surface)",
                  }}
                >
                  <div
                    className="mb-5"
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.7rem",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--k-muted)",
                      fontWeight: 500,
                    }}
                  >
                    {v.label}
                  </div>
                  <div
                    className="flex items-center justify-center"
                    style={{
                      height: 132,
                      border: "1px solid var(--k-border)",
                      background: "#0a0a0a",
                    }}
                  >
                    {v.node}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Reveal>
              <div
                className="h-full p-8"
                style={{
                  border: "1px solid var(--k-border)",
                  background: "var(--k-surface)",
                }}
              >
                <div
                  className="mb-6"
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.7rem",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--k-accent)",
                    fontWeight: 500,
                  }}
                >
                  Do
                </div>
                <ul className="flex flex-col gap-3">
                  {[
                    "Keep clear space of at least the mark's width on all sides",
                    "Minimum lockup width 120px · minimum mark 18px",
                    "Show the lockup on dark, or use the light-background asset",
                    "Keep the bone pill / emerald pill relationship intact",
                  ].map((r) => (
                    <li
                      key={r}
                      className="flex gap-3"
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.85rem",
                        lineHeight: 1.5,
                        color: "var(--k-muted)",
                      }}
                    >
                      <span style={{ color: "var(--k-accent)", flexShrink: 0 }}>▸</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div
                className="h-full p-8"
                style={{
                  border: "1px solid var(--k-border)",
                  background: "var(--k-surface)",
                }}
              >
                <div
                  className="mb-6"
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.7rem",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: T.danger,
                    fontWeight: 500,
                  }}
                >
                  Don&apos;t
                </div>
                <ul className="flex flex-col gap-3">
                  {[
                    "Don't rotate, stretch or distort the mark or pills",
                    "Don't recolour the pills or change the scheme",
                    "Don't round the corners of containers — stay square",
                    "Don't place the dark lockup on busy or light backgrounds",
                    "Don't recreate or re-letter the wordmark",
                  ].map((r) => (
                    <li
                      key={r}
                      className="flex gap-3"
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.85rem",
                        lineHeight: 1.5,
                        color: "var(--k-muted)",
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
        </Section>

        {/* ═══ 04 — Visual language (dark) ═══ */}
        <Section theme="dark" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="04"
              label="Visual language"
              title="The agentic node-network"
              lead="The signature motif across every dark surface: nodes wired together with emerald data-pulses routing the edges — intelligence, connection, and work routed end to end."
            />
          </Reveal>
          <div className="mt-12 grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-3">
            <Reveal>
              <div
                className="relative overflow-hidden"
                style={{
                  border: "1px solid var(--k-border)",
                  minHeight: 320,
                  background: "#0a0a0a",
                }}
              >
                <NeuralField className="absolute inset-0" />
                <div className="relative p-8" style={{ zIndex: 1 }}>
                  <div
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.7rem",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--k-accent)",
                    }}
                  >
                    Live · NeuralField
                  </div>
                  <p
                    className="mt-3"
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.9rem",
                      lineHeight: 1.6,
                      color: "var(--k-muted)",
                      maxWidth: "40ch",
                    }}
                  >
                    A hand-written canvas backdrop. Single context, paused off-screen, one
                    static frame under reduced-motion.
                  </p>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div
                className="h-full flex flex-col items-center justify-center gap-6 p-8"
                style={{
                  border: "1px solid var(--k-border)",
                  background: "var(--k-surface)",
                }}
              >
                <NodeMeshMark
                  size={150}
                  line="var(--k-accent)"
                  node="var(--k-accent)"
                  pulse="var(--k-accent-2)"
                />
                <div
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.66rem",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--k-faint)",
                    textAlign: "center",
                  }}
                >
                  Static mark — for print &amp; favicons
                </div>
              </div>
            </Reveal>
          </div>
        </Section>

        {/* ═══ 05 — Principles (cream) ═══ */}
        <Section theme="cream" pad="lg" topBorder>
          <Reveal>
            <SectionHeader index="05" label="Principles" title="Core principles" />
          </Reveal>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PRINCIPLES.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.05}>
                <div
                  className="h-full p-7"
                  style={{
                    border: "1px solid var(--k-border)",
                    background: "var(--k-surface)",
                  }}
                >
                  <div
                    className="mb-3"
                    style={{
                      fontFamily: T.mono,
                      fontWeight: 500,
                      fontSize: "1.1rem",
                      color: "var(--k-accent)",
                    }}
                  >
                    0{i + 1}
                  </div>
                  <h3
                    className="mb-3"
                    style={{
                      fontFamily: T.sans,
                      fontWeight: 700,
                      fontSize: "1.15rem",
                      letterSpacing: "-0.02em",
                      textTransform: "uppercase",
                      lineHeight: 1.06,
                      color: "var(--k-fg)",
                    }}
                  >
                    {p.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.85rem",
                      lineHeight: 1.6,
                      color: "var(--k-muted)",
                    }}
                  >
                    {p.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ═══ 06 — UI system (dark) ═══ */}
        <Section theme="dark" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="06"
              label="UI system"
              title="Square, hairline, themed"
              lead="Every interface is built from square corners, 1px hairline borders, two surface tiers per theme, and one emerald action colour."
            />
          </Reveal>

          {/* Buttons + geometry */}
          <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Reveal>
              <div
                className="h-full p-7"
                style={{
                  border: "1px solid var(--k-border)",
                  background: "var(--k-surface)",
                }}
              >
                <div
                  className="mb-5"
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.7rem",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--k-muted)",
                  }}
                >
                  Buttons — square, no radius
                </div>
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      height: 48,
                      padding: "0 22px",
                      fontFamily: T.mono,
                      fontSize: "0.78rem",
                      fontWeight: 500,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      background: "var(--k-accent)",
                      color: PRINT.onEmerald,
                      borderRadius: 0,
                    }}
                  >
                    Primary action
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      height: 48,
                      padding: "0 22px",
                      fontFamily: T.mono,
                      fontSize: "0.78rem",
                      fontWeight: 500,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--k-fg)",
                      border: "1px solid var(--k-border-strong)",
                      borderRadius: 0,
                    }}
                  >
                    Secondary
                  </span>
                </div>
                <ul className="flex flex-col gap-2">
                  {[
                    "Radius 0 — square corners everywhere",
                    "Roboto Mono · UPPERCASE · 0.06–0.1em tracking",
                    "One emerald for primary; hairline outline for secondary",
                    "No drop shadows, no glows, no gradients",
                  ].map((r) => (
                    <li
                      key={r}
                      className="flex gap-2.5"
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.82rem",
                        color: "var(--k-muted)",
                      }}
                    >
                      <span style={{ color: "var(--k-accent)" }}>▸</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div
                className="h-full p-7"
                style={{
                  border: "1px solid var(--k-border)",
                  background: "var(--k-surface)",
                }}
              >
                <div
                  className="mb-5"
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.7rem",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--k-muted)",
                  }}
                >
                  Surface tiers — per theme
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Dark · bg", c: "#0a0a0a" },
                    { label: "Dark · surface", c: "#141414" },
                    { label: "Cream · bg", c: "#f4f4e8" },
                    { label: "Cream · surface", c: "#ecece0" },
                  ].map((s) => (
                    <div key={s.label}>
                      <div
                        style={{
                          height: 46,
                          background: s.c,
                          border: "1px solid var(--k-border-strong)",
                        }}
                      />
                      <div
                        className="mt-2"
                        style={{
                          fontFamily: T.mono,
                          fontSize: "0.66rem",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          color: "var(--k-muted)",
                        }}
                      >
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  className="mt-5"
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.82rem",
                    lineHeight: 1.55,
                    color: "var(--k-muted)",
                  }}
                >
                  Two tiers per theme — canvas and surface. Hairline{" "}
                  <code style={{ fontFamily: T.mono, color: "var(--k-fg)" }}>1px</code>{" "}
                  borders draw the structure; depth is never faked with shadow.
                </div>
              </div>
            </Reveal>
          </div>

          {/* Eyebrow pattern */}
          <Reveal delay={0.1}>
            <div
              className="mt-3 p-7"
              style={{
                border: "1px solid var(--k-border)",
                background: "var(--k-surface)",
              }}
            >
              <div
                className="mb-5"
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.7rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--k-muted)",
                }}
              >
                Section label pattern
              </div>
              <Eyebrow index="0X" label="Section label" />
              <ul className="mt-6 flex flex-wrap gap-x-8 gap-y-2">
                {[
                  "[index] in emerald + label in fg",
                  "Roboto Mono · 0.74rem · 0.1em tracking",
                  "Always UPPERCASE, once per section",
                  "Square emerald cursor block, not a dot",
                ].map((r) => (
                  <li
                    key={r}
                    className="flex gap-2"
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.8rem",
                      color: "var(--k-muted)",
                    }}
                  >
                    <span style={{ color: "var(--k-accent)" }}>·</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </Section>

        {/* ═══ 07 — Downloads (cream) ═══ */}
        <Section theme="cream" pad="lg" topBorder>
          <Reveal>
            <SectionHeader
              index="07"
              label="Downloads"
              title="Brand assets"
              lead="The full guidelines as a PDF, plus logo files and the animated intro — for slides, socials, signatures, partner sites, or anywhere the brand shows up."
            />
          </Reveal>

          {/* PDF + logo files */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                label: "Mark — on dark",
                file: "/logos/nullshift-mark-dark.png",
                tileBg: "#0a0a0a",
              },
              {
                label: "Mark — on light",
                file: "/logos/nullshift-mark-light.png",
                tileBg: "#f4f4e8",
              },
              {
                label: "Wordmark",
                file: "/logos/nullshift-wordmark.png",
                tileBg: "#0a0a0a",
              },
            ].map((f, i) => (
              <Reveal key={f.label} delay={i * 0.06}>
                <div
                  className="h-full flex flex-col overflow-hidden"
                  style={{
                    border: "1px solid var(--k-border)",
                    background: "var(--k-surface)",
                  }}
                >
                  <div
                    className="flex items-center justify-center"
                    style={{ height: 140, background: f.tileBg }}
                  >
                    <div
                      role="img"
                      aria-label={f.label}
                      style={{
                        width: "78%",
                        height: 84,
                        backgroundImage: `url(${f.file})`,
                        backgroundSize: "contain",
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "center",
                      }}
                    />
                  </div>
                  <div
                    className="flex items-center justify-between px-5 py-4"
                    style={{ borderTop: "1px solid var(--k-border)" }}
                  >
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: "0.72rem",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: "var(--k-fg)",
                      }}
                    >
                      {f.label}
                    </span>
                    <a
                      href={f.file}
                      download
                      className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-80"
                      style={{
                        fontFamily: T.mono,
                        fontSize: "0.7rem",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--k-accent)",
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
              className="mt-3 grid grid-cols-1 md:grid-cols-2 overflow-hidden"
              style={{
                border: "1px solid var(--k-border)",
                background: "var(--k-surface)",
              }}
            >
              <div style={{ background: "#0a0a0a" }}>
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
                    color: "var(--k-accent)",
                  }}
                >
                  The Nullshift intro
                </div>
                <Display size="md">A cinematic logo opener.</Display>
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.9rem",
                    lineHeight: 1.6,
                    color: "var(--k-muted)",
                  }}
                >
                  A 1080p brand reveal to drop into videos, socials or decks. Download the
                  MP4, or open the interactive version that greets first-time visitors.
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  <a
                    href="/nullshift-logo-opener.mp4"
                    download
                    className="inline-flex items-center gap-2 transition-opacity hover:opacity-90"
                    style={{
                      height: 46,
                      padding: "0 20px",
                      fontFamily: T.mono,
                      fontSize: "0.74rem",
                      fontWeight: 500,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      background: "var(--k-accent)",
                      color: PRINT.onEmerald,
                      borderRadius: 0,
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
                  <TextLink href="/nullshift-intro.html">Open full version</TextLink>
                </div>
              </div>
            </div>
          </Reveal>
        </Section>

        {/* ═══ FINAL CTA (dark) ═══ */}
        <Section theme="dark" pad="lg" topBorder>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <Display size="xl" style={{ maxWidth: "16ch" }}>
                Take the system{" "}
                <span style={{ color: "var(--k-accent)" }}>with you.</span>
              </Display>
              <Lead className="mt-4">
                The full guidelines as a multi-page PDF — fonts, colour, logo, principles
                and UI.
              </Lead>
            </div>
            <DownloadBtn busy={busy} onClick={handleDownload} />
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
