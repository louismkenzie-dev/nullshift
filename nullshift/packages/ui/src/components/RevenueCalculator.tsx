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
          fontWeight: 600,
          fontSize: "clamp(1.3rem, 2.6vw, 1.9rem)",
          letterSpacing: "-0.025em",
          lineHeight: 1.1,
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
                fontWeight: 700,
                fontSize: "clamp(2rem, 5vw, 3rem)",
                letterSpacing: "-0.03em",
                color: T.warning,
                lineHeight: 1,
              }}
            >
              {result.primary.value}
            </div>
            <div
              style={{
                fontFamily: T.sans,
                fontSize: "0.85rem",
                color: T.muted,
                marginTop: 6,
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
                fontWeight: 700,
                fontSize: "1.5rem",
                letterSpacing: "-0.02em",
                color: result.secondary.tone === "emerald" ? T.primary : T.warning,
                lineHeight: 1,
              }}
            >
              {result.secondary.value}
            </div>
            <div
              style={{
                fontFamily: T.sans,
                fontSize: "0.82rem",
                color: T.muted,
                marginTop: 5,
              }}
            >
              {result.secondary.label}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          borderLeft: `3px solid ${T.primary}`,
          background: `${T.primary}10`,
          borderRadius: "0 12px 12px 0",
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
          className="inline-flex items-center justify-center gap-2 font-medium transition-opacity hover:opacity-90"
          style={{
            fontFamily: T.sans,
            fontSize: "0.9375rem",
            fontWeight: 600,
            height: 46,
            paddingInline: 22,
            background: T.primary,
            color: T.primaryFg,
            borderRadius: T.r.md,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 0 24px ${T.primary}30`,
            textDecoration: "none",
          }}
        >
          Book a free 15-min call →
        </Link>
        <Link
          href="/systems-lab"
          className="inline-flex items-center justify-center gap-2 font-medium"
          style={{
            fontFamily: T.sans,
            fontSize: "0.9375rem",
            fontWeight: 500,
            height: 46,
            paddingInline: 22,
            background: "transparent",
            color: T.muted,
            borderRadius: T.r.md,
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
