import { T } from "@nullshift/ui/tokens";
import type { BrandSpec } from "@/lib/brandSpec";

/**
 * Renders a tailored homepage MOCK for the prospect's business from an AI-written
 * (or fallback) BrandSpec — their own branding, copy and palette. A light,
 * customer-facing website concept, clearly labelled as a concept that isn't
 * wired to live data (they pay to build the real one). Presentational/hook-free
 * so it renders in the funnel result (client) and the /plan page (server).
 */
export function BrandedHomePreview({ spec }: { spec: BrandSpec }) {
  const p = spec.palette;
  const host =
    spec.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24) || "yourbusiness";

  return (
    <div
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: T.r.lg,
        overflow: "hidden",
        boxShadow: T.shadow.md,
        background: T.surface,
      }}
    >
      {/* Browser chrome */}
      <div
        className="flex items-center gap-2"
        style={{
          height: 38,
          padding: "0 14px",
          borderBottom: `1px solid ${T.border}`,
          background: T.bg,
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: 999, background: "#2f323d" }} />
        <span style={{ width: 9, height: 9, borderRadius: 999, background: "#2f323d" }} />
        <span style={{ width: 9, height: 9, borderRadius: 999, background: "#2f323d" }} />
        <div
          className="flex items-center gap-2 mx-auto"
          style={{
            fontFamily: T.mono,
            fontSize: 11,
            color: T.muted,
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 999,
            padding: "3px 12px",
          }}
        >
          {host}.co.uk
        </div>
      </div>

      {/* The mock homepage (their palette) */}
      <div style={{ background: p.bg, color: p.text }}>
        {/* Nav */}
        <div
          className="flex items-center justify-between"
          style={{ padding: "14px 20px", borderBottom: `1px solid ${p.text}14` }}
        >
          <span
            style={{
              fontFamily: T.display,
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: "-0.01em",
              color: p.text,
            }}
          >
            {spec.businessName}
          </span>
          <div className="flex items-center gap-4">
            <span
              className="hidden sm:inline"
              style={{ fontFamily: T.sans, fontSize: 12.5, color: p.muted }}
            >
              Services
            </span>
            <span
              className="hidden sm:inline"
              style={{ fontFamily: T.sans, fontSize: 12.5, color: p.muted }}
            >
              About
            </span>
            <span
              style={{
                fontFamily: T.sans,
                fontSize: 12.5,
                fontWeight: 600,
                color: "#fff",
                background: p.primary,
                borderRadius: 7,
                padding: "7px 12px",
              }}
            >
              {spec.ctaLabel}
            </span>
          </div>
        </div>

        {/* Hero */}
        <div style={{ padding: "26px 20px 22px" }}>
          <div className="grid md:grid-cols-2 gap-5 items-center">
            <div>
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: p.primary,
                  marginBottom: 8,
                }}
              >
                {spec.tagline}
              </div>
              <h3
                style={{
                  fontFamily: T.display,
                  fontWeight: 700,
                  fontSize: "clamp(1.4rem,3.6vw,2rem)",
                  lineHeight: 1.08,
                  letterSpacing: "-0.025em",
                  color: p.text,
                }}
              >
                {spec.heroHeadline}
              </h3>
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  color: p.muted,
                  marginTop: 10,
                  maxWidth: "40ch",
                }}
              >
                {spec.heroSub}
              </p>
              <span
                className="inline-flex"
                style={{
                  marginTop: 16,
                  fontFamily: T.sans,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#fff",
                  background: p.primary,
                  borderRadius: 9,
                  padding: "10px 18px",
                }}
              >
                {spec.ctaLabel}
              </span>
            </div>
            {/* Faux hero image */}
            <div
              className="hidden md:block"
              style={{
                height: 150,
                borderRadius: 12,
                background: `linear-gradient(135deg, ${p.primary}22, ${p.accent}33)`,
                border: `1px solid ${p.text}10`,
              }}
            />
          </div>

          {/* 3 feature cards */}
          <div
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            style={{ marginTop: 22 }}
          >
            {spec.sections.slice(0, 3).map((s, i) => (
              <div
                key={i}
                style={{
                  background: p.surface,
                  border: `1px solid ${p.text}12`,
                  borderRadius: 10,
                  padding: "13px 14px",
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: `${p.primary}1f`,
                    marginBottom: 9,
                  }}
                />
                <div
                  style={{
                    fontFamily: T.display,
                    fontWeight: 600,
                    fontSize: 13.5,
                    color: p.text,
                  }}
                >
                  {s.title}
                </div>
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: 11.5,
                    lineHeight: 1.5,
                    color: p.muted,
                    marginTop: 4,
                  }}
                >
                  {s.blurb}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
