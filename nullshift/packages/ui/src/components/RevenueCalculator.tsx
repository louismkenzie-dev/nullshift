"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { T } from "../tokens";
import type { VerticalConfig } from "@nullshift/content/marketing";

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");

function fmt(v: number, unit?: string) {
  if (unit === "gbp") return gbp(v);
  if (unit === "pct") return v + "%";
  return String(v);
}

/**
 * Lead-magnet calculator — quantifies the prospect's pain in pounds, then
 * routes to a call. Drives "The £24,000 Phone Call" (trades) and "Your Empty
 * Chair" (wellness). Pure client-side, no tracking.
 */
export function RevenueCalculator({
  calc,
  ctaHref = "/book",
}: {
  calc: VerticalConfig["calc"];
  ctaHref?: string;
}) {
  const [vals, setVals] = useState<Record<string, number>>(() =>
    Object.fromEntries(calc.sliders.map((s) => [s.id, s.value]))
  );
  const set = (id: string, v: number) => setVals((p) => ({ ...p, [id]: v }));

  const result = useMemo(() => {
    if (calc.variant === "missed-call") {
      const week = vals.miss * (vals.conv / 100) * vals.job;
      return {
        primary: { value: gbp(week * 52), label: "Walking out the door per year" },
        secondary: {
          value: gbp(week),
          label: "Leaking every week",
          tone: "amber" as const,
        },
      };
    }
    if (calc.variant === "saas-bill") {
      const annual = vals.perSeat * vals.seats * 12;
      const saved = annual * (vals.keep / 100);
      return {
        primary: { value: gbp(annual), label: "Renting your software, per year" },
        secondary: {
          value: gbp(saved),
          label: "Gone when you own it",
          tone: "emerald" as const,
        },
      };
    }
    // no-show
    const lostYear = vals.noshows * vals.value * 52;
    const recovered = lostYear * (vals.recover / 100);
    return {
      primary: { value: gbp(lostYear), label: "Lost to no-shows per year" },
      secondary: {
        value: gbp(recovered),
        label: "Recovered automatically",
        tone: "emerald" as const,
      },
    };
  }, [vals, calc.variant]);

  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.r.xl,
        padding: "clamp(20px, 4vw, 36px)",
        boxShadow: T.shadow.md,
      }}
    >
      <div
        className="flex items-center gap-2 mb-2"
        style={{
          fontFamily: T.mono,
          fontSize: "0.7rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: T.primary,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: T.primary,
            boxShadow: `0 0 0 4px ${T.primary}22`,
          }}
        />
        {calc.eyebrow}
      </div>
      <h3
        style={{
          fontFamily: T.display,
          fontWeight: 700,
          fontSize: "clamp(1.4rem, 2.8vw, 2.1rem)",
          letterSpacing: "-0.03em",
          lineHeight: 1.04,
          textTransform: "uppercase",
          color: T.fg,
        }}
      >
        {calc.title}
      </h3>
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.9375rem",
          lineHeight: 1.6,
          color: T.muted,
          marginTop: 8,
          maxWidth: "52ch",
        }}
      >
        {calc.sub}
      </p>

      <div
        className="grid md:grid-cols-2 gap-6 md:gap-8"
        style={{ marginTop: 24, alignItems: "center" }}
      >
        {/* Sliders */}
        <div className="flex flex-col gap-5">
          {calc.sliders.map((s) => (
            <div key={s.id}>
              <label
                className="flex items-center justify-between"
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.875rem",
                  color: T.muted,
                  marginBottom: 8,
                }}
              >
                <span>{s.label}</span>
                <span style={{ fontFamily: T.mono, fontWeight: 600, color: T.primary }}>
                  {fmt(vals[s.id], s.unit)}
                </span>
              </label>
              <input
                type="range"
                className="ns-range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={vals[s.id]}
                onChange={(e) => set(s.id, +e.target.value)}
                aria-label={s.label}
              />
            </div>
          ))}
        </div>

        {/* Outputs */}
        <div className="flex flex-col gap-3">
          <div
            style={{
              background: T.bg,
              border: `1px solid ${T.border}`,
              borderRadius: T.r.lg,
              padding: "20px 22px",
            }}
          >
            <div
              style={{
                fontFamily: T.display,
                fontWeight: 800,
                fontSize: "clamp(2.4rem, 5.5vw, 3.4rem)",
                letterSpacing: "-0.03em",
                color: T.warning,
                lineHeight: 0.95,
              }}
            >
              {result.primary.value}
            </div>
            <div
              style={{
                fontFamily: T.mono,
                fontSize: "0.72rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: T.muted,
                marginTop: 10,
              }}
            >
              {result.primary.label}
            </div>
          </div>
          <div
            style={{
              background: T.bg,
              border: `1px solid ${T.border}`,
              borderRadius: T.r.lg,
              padding: "16px 22px",
            }}
          >
            <div
              style={{
                fontFamily: T.display,
                fontWeight: 800,
                fontSize: "1.8rem",
                letterSpacing: "-0.03em",
                color: result.secondary.tone === "emerald" ? T.primary : T.warning,
                lineHeight: 0.95,
              }}
            >
              {result.secondary.value}
            </div>
            <div
              style={{
                fontFamily: T.mono,
                fontSize: "0.7rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: T.muted,
                marginTop: 8,
              }}
            >
              {result.secondary.label}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          borderLeft: `2px solid ${T.primary}`,
          background: `${T.primary}10`,
          padding: "14px 18px",
          marginTop: 22,
        }}
      >
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.92rem",
            lineHeight: 1.6,
            color: T.fg,
          }}
        >
          {calc.pitch}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3" style={{ marginTop: 20 }}>
        <Link
          href={ctaHref}
          className="inline-flex items-center justify-center gap-2.5"
          style={{
            fontFamily: T.mono,
            fontSize: "0.72rem",
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            height: 48,
            paddingInline: 26,
            background: T.primary,
            color: T.primaryFg,
            textDecoration: "none",
          }}
        >
          Book a free 15-min call <span aria-hidden>→</span>
        </Link>
        <Link
          href="/systems-lab"
          className="inline-flex items-center justify-center gap-2.5"
          style={{
            fontFamily: T.mono,
            fontSize: "0.72rem",
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            height: 48,
            paddingInline: 26,
            background: "transparent",
            color: T.fg,
            border: `1px solid ${T.borderStr}`,
            textDecoration: "none",
          }}
        >
          Try the live demos
        </Link>
      </div>
    </div>
  );
}
