import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface ColorSwatchProps {
  name: string;
  token: string;
  hex: string;
  role: string;
}

const ColorSwatch = ({ name, token, hex, role }: ColorSwatchProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative">
      <div
        className="h-24 rounded-lg border transition-all duration-200 group-hover:scale-105"
        style={{
          backgroundColor: hex,
          borderColor: "var(--brand-borderStr)",
        }}
      />
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between">
          <span
            className="uppercase tracking-wider"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              color: "var(--fg)",
              fontWeight: 600,
            }}
          >
            {name}
          </span>
          <button
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--surface2)]"
            style={{ color: "var(--brand-muted)" }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        <div
          className="text-sm"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--brand-muted)",
          }}
        >
          {hex}
        </div>
        <div
          className="text-xs"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--brand-muted)",
            opacity: 0.7,
          }}
        >
          var(--{token})
        </div>
        <div
          className="text-sm pt-1"
          style={{
            fontFamily: "var(--font-sans)",
            color: "var(--brand-muted)",
          }}
        >
          {role}
        </div>
      </div>
    </div>
  );
};

interface TypeSpecProps {
  role: string;
  font: string;
  weights: string;
  cssVar: string;
  usage: string;
}

const TypeSpec = ({ role, font, weights, cssVar, usage }: TypeSpecProps) => {
  return (
    <div
      className="p-6 rounded-lg border"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--brand-border)",
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div
            className="uppercase tracking-wider mb-2"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              color: "var(--brand-muted)",
              fontWeight: 600,
            }}
          >
            {role}
          </div>
          <div
            className="text-2xl mb-1"
            style={{
              fontFamily: `var(${cssVar})`,
              color: "var(--fg)",
            }}
          >
            {font}
          </div>
        </div>
        <div
          className="text-sm px-3 py-1 rounded"
          style={{
            fontFamily: "var(--font-mono)",
            backgroundColor: "var(--surface2)",
            color: "var(--brand-muted)",
          }}
        >
          {weights}
        </div>
      </div>
      <div
        className="text-sm mb-3"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--brand-primary)",
        }}
      >
        {cssVar}
      </div>
      <div
        className="text-sm leading-relaxed"
        style={{
          fontFamily: "var(--font-sans)",
          color: "var(--brand-muted)",
        }}
      >
        {usage}
      </div>
    </div>
  );
};

export function BrandGuidelines() {
  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: "var(--bg)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Header */}
      <header
        className="border-b sticky top-0 z-50 backdrop-blur-sm"
        style={{
          backgroundColor: "rgba(9, 9, 11, 0.8)",
          borderColor: "var(--brand-border)",
        }}
      >
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center gap-3">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--brand-primary)" }}
            />
            <h1
              className="uppercase tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "2rem",
                fontWeight: 900,
                lineHeight: 0.95,
                letterSpacing: "-0.01em",
                color: "var(--fg)",
              }}
            >
              BRAND GUIDELINES
            </h1>
          </div>
          <p
            className="mt-3"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.875rem",
              color: "var(--brand-muted)",
            }}
          >
            // TEMPLATE DOCUMENT — WEB DEVELOPMENT & BRAND CREATION
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-12">
        {/* Introduction */}
        <section className="mb-20">
          <div
            className="mb-6"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              color: "var(--brand-primary)",
              letterSpacing: "0.05em",
            }}
          >
            // 01 — INTRODUCTION
          </div>
          <h2
            className="uppercase mb-6"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "3rem",
              fontWeight: 900,
              lineHeight: 0.92,
              letterSpacing: "-0.01em",
              color: "var(--fg)",
            }}
          >
            WELCOME TO
            <br />
            YOUR BRAND
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <p
                className="text-lg leading-relaxed mb-4"
                style={{
                  fontFamily: "var(--font-sans)",
                  color: "var(--brand-muted)",
                }}
              >
                This document serves as the single source of truth for your brand's visual identity. 
                It outlines the design principles, typography, color palette, and usage guidelines 
                that ensure consistency across all touchpoints.
              </p>
              <p
                className="leading-relaxed"
                style={{
                  fontFamily: "var(--font-sans)",
                  color: "var(--brand-muted)",
                }}
              >
                Every element has been carefully considered to create a cohesive, recognizable 
                identity that resonates with your audience and stands the test of time.
              </p>
            </div>
            <div
              className="p-6 rounded-lg border"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--brand-borderStr)",
              }}
            >
              <div
                className="uppercase tracking-wider mb-4"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.75rem",
                  color: "var(--brand-primary)",
                  fontWeight: 600,
                }}
              >
                QUICK REFERENCE
              </div>
              <ul className="space-y-3">
                {["Typography System", "Color Palette", "Logo Usage", "Design Principles", "Application Examples"].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3"
                    style={{
                      fontFamily: "var(--font-sans)",
                      color: "var(--fg)",
                    }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: "var(--brand-primary)" }}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section className="mb-20">
          <div
            className="mb-6"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              color: "var(--brand-primary)",
              letterSpacing: "0.05em",
            }}
          >
            // 02 — TYPOGRAPHY
          </div>
          <h2
            className="uppercase mb-8"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "3rem",
              fontWeight: 900,
              lineHeight: 0.92,
              letterSpacing: "-0.01em",
              color: "var(--fg)",
            }}
          >
            TYPE SYSTEM
          </h2>

          <div className="grid lg:grid-cols-3 gap-6 mb-12">
            <TypeSpec
              role="DISPLAY"
              font="Barlow Condensed"
              weights="700, 800, 900"
              cssVar="--font-display"
              usage={'All large headlines (hero, section titles, "NO TEMPLATES" etc.) — uppercase, weight 900'}
            />
            <TypeSpec
              role="BODY / UI"
              font="IBM Plex Sans"
              weights="400, 500, 600, 700"
              cssVar="--font-sans"
              usage="Paragraphs, descriptions, nav links, sub-text"
            />
            <TypeSpec
              role="MONO"
              font="IBM Plex Mono"
              weights="400, 500, 600"
              cssVar="--font-mono"
              usage="Labels, section markers (// 02 — Services), coordinate tags, buttons, fine print"
            />
          </div>

          {/* Typography Examples */}
          <div
            className="p-8 rounded-lg border"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--brand-border)",
            }}
          >
            <div
              className="uppercase tracking-wider mb-6"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.75rem",
                color: "var(--brand-muted)",
                fontWeight: 600,
              }}
            >
              DISPLAY HEADLINE SETTINGS
            </div>
            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center">
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--brand-muted)" }}>
                  fontWeight
                </span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg)" }}>
                  900
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--brand-muted)" }}>
                  lineHeight
                </span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg)" }}>
                  0.92–0.95
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--brand-muted)" }}>
                  letterSpacing
                </span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg)" }}>
                  -0.01em
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--brand-muted)" }}>
                  textTransform
                </span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg)" }}>
                  uppercase
                </span>
              </div>
            </div>
            <div
              className="pt-6 border-t"
              style={{ borderColor: "var(--brand-border)" }}
            >
              <h3
                className="uppercase"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "4rem",
                  fontWeight: 900,
                  lineHeight: 0.92,
                  letterSpacing: "-0.01em",
                  color: "var(--fg)",
                }}
              >
                EXAMPLE
                <br />
                HEADLINE
              </h3>
            </div>
          </div>
        </section>

        {/* Color Palette */}
        <section className="mb-20">
          <div
            className="mb-6"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              color: "var(--brand-primary)",
              letterSpacing: "0.05em",
            }}
          >
            // 03 — COLOR PALETTE
          </div>
          <h2
            className="uppercase mb-8"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "3rem",
              fontWeight: 900,
              lineHeight: 0.92,
              letterSpacing: "-0.01em",
              color: "var(--fg)",
            }}
          >
            COLORS
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
            <ColorSwatch
              name="BG"
              token="bg"
              hex="#09090b"
              role="Page background (cool near-black)"
            />
            <ColorSwatch
              name="SURFACE"
              token="surface"
              hex="#18181b"
              role="Cards, alternating sections, input fields"
            />
            <ColorSwatch
              name="SURFACE2"
              token="surface2"
              hex="#262629"
              role="Tertiary surface / placeholders"
            />
            <ColorSwatch
              name="FG"
              token="fg"
              hex="#fafafa"
              role="Primary text (off-white)"
            />
            <ColorSwatch
              name="MUTED"
              token="muted"
              hex="#a1a1a6"
              role="Secondary / body text (grey)"
            />
            <ColorSwatch
              name="PRIMARY"
              token="primary"
              hex="#10b981"
              role="Emerald accent — buttons, highlights, glows, hover states"
            />
            <ColorSwatch
              name="PRIMARY FG"
              token="primaryFg"
              hex="#131316"
              role="Text on top of the emerald accent"
            />
            <ColorSwatch
              name="BORDER"
              token="border"
              hex="#3d3d42"
              role="Standard borders / dividers"
            />
            <ColorSwatch
              name="BORDER STR"
              token="borderStr"
              hex="#505055"
              role="Stronger borders"
            />
          </div>

          {/* Accent Usage */}
          <div
            className="p-8 rounded-lg border"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--brand-border)",
            }}
          >
            <div
              className="uppercase tracking-wider mb-4"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.75rem",
                color: "var(--brand-primary)",
                fontWeight: 600,
              }}
            >
              ACCENT USAGE
            </div>
            <p
              className="leading-relaxed mb-6"
              style={{
                fontFamily: "var(--font-sans)",
                color: "var(--brand-muted)",
              }}
            >
              The emerald <span style={{ color: "var(--brand-primary)", fontFamily: "var(--font-mono)" }}>#10b981</span> is 
              the single accent — used sparingly for the logo dot, CTA buttons, the headline glow (hero-glow), 
              hover states, and active nav links. Everything else stays in the near-black → white → grey range.
            </p>
            <div
              className="p-4 rounded border-l-4 mt-6"
              style={{
                backgroundColor: "var(--surface2)",
                borderLeftColor: "#f87171",
              }}
            >
              <div
                className="uppercase tracking-wider mb-2"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.75rem",
                  color: "#f87171",
                  fontWeight: 600,
                }}
              >
                SEMANTIC COLOR
              </div>
              <p
                className="text-sm"
                style={{
                  fontFamily: "var(--font-sans)",
                  color: "var(--brand-muted)",
                }}
              >
                <span style={{ color: "#f87171", fontFamily: "var(--font-mono)" }}>#f87171</span> (red) appears on 
                the Why Us page and Legal page for "warning / Wix trap" callouts — it's not a core brand colour, 
                just a semantic alert tone.
              </p>
            </div>
          </div>
        </section>

        {/* Logo Usage */}
        <section className="mb-20">
          <div
            className="mb-6"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              color: "var(--brand-primary)",
              letterSpacing: "0.05em",
            }}
          >
            // 04 — LOGO USAGE
          </div>
          <h2
            className="uppercase mb-8"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "3rem",
              fontWeight: 900,
              lineHeight: 0.92,
              letterSpacing: "-0.01em",
              color: "var(--fg)",
            }}
          >
            LOGO GUIDELINES
          </h2>

          <div className="grid lg:grid-cols-2 gap-8">
            <div
              className="p-8 rounded-lg border"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--brand-border)",
              }}
            >
              <div
                className="uppercase tracking-wider mb-6"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.75rem",
                  color: "var(--brand-muted)",
                  fontWeight: 600,
                }}
              >
                PRIMARY LOGO
              </div>
              <div className="flex items-center justify-center h-40 border rounded-lg mb-6"
                style={{ borderColor: "var(--brand-border)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: "var(--brand-primary)" }}
                  />
                  <span
                    className="uppercase"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "2rem",
                      fontWeight: 900,
                      color: "var(--fg)",
                    }}
                  >
                    YOUR BRAND
                  </span>
                </div>
              </div>
              <ul className="space-y-2">
                {[
                  "Always maintain clear space around logo",
                  "Minimum size: 120px width",
                  "Use on dark backgrounds only (or provide light version)",
                ].map((rule, i) => (
                  <li
                    key={i}
                    className="flex gap-3"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "0.875rem",
                      color: "var(--brand-muted)",
                    }}
                  >
                    <span style={{ color: "var(--brand-primary)" }}>•</span>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="p-8 rounded-lg border"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--brand-border)",
              }}
            >
              <div
                className="uppercase tracking-wider mb-6"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.75rem",
                  color: "var(--brand-muted)",
                  fontWeight: 600,
                }}
              >
                DON'T
              </div>
              <ul className="space-y-4">
                {[
                  "Don't rotate or distort the logo",
                  "Don't change the color scheme",
                  "Don't add effects (shadows, glows, etc.) except the approved hero-glow",
                  "Don't place on busy backgrounds",
                  "Don't recreate or modify the logo",
                ].map((rule, i) => (
                  <li
                    key={i}
                    className="flex gap-3"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "0.875rem",
                      color: "var(--brand-muted)",
                    }}
                  >
                    <span style={{ color: "#f87171" }}>✕</span>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Design Principles */}
        <section className="mb-20">
          <div
            className="mb-6"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              color: "var(--brand-primary)",
              letterSpacing: "0.05em",
            }}
          >
            // 05 — DESIGN PRINCIPLES
          </div>
          <h2
            className="uppercase mb-8"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "3rem",
              fontWeight: 900,
              lineHeight: 0.92,
              letterSpacing: "-0.01em",
              color: "var(--fg)",
            }}
          >
            CORE PRINCIPLES
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "BOLD & UNAPOLOGETIC",
                description: "Strong display headlines, high contrast, confident positioning. Never timid.",
              },
              {
                title: "TECHNICAL PRECISION",
                description: "Monospace labels, coordinate tags, structured layouts. Everything has a purpose.",
              },
              {
                title: "RESTRAINED ACCENT",
                description: "One emerald accent used sparingly. Let the architecture speak first.",
              },
            ].map((principle, i) => (
              <div
                key={i}
                className="p-6 rounded-lg border"
                style={{
                  backgroundColor: "var(--surface)",
                  borderColor: "var(--brand-border)",
                }}
              >
                <div
                  className="w-8 h-1 mb-4"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                />
                <h3
                  className="uppercase mb-3"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.5rem",
                    fontWeight: 900,
                    lineHeight: 1,
                    color: "var(--fg)",
                  }}
                >
                  {principle.title}
                </h3>
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    color: "var(--brand-muted)",
                    lineHeight: 1.6,
                  }}
                >
                  {principle.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer
          className="pt-12 border-t"
          style={{ borderColor: "var(--brand-border)" }}
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div
                className="uppercase tracking-wider mb-2"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.75rem",
                  color: "var(--brand-muted)",
                  fontWeight: 600,
                }}
              >
                TEMPLATE BY
              </div>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  color: "var(--fg)",
                }}
              >
                Web Development & Brand Creation Company
              </p>
            </div>
            <div
              className="text-sm"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--brand-muted)",
              }}
            >
              Last updated: June 2026
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
