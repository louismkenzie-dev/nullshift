"use client";

import Link from "next/link";
import { T } from "../tokens";
import { CLINIC } from "@nullshift/content/marketing";

/** The clinic care-plan ladder (pricing page). Build fee + monthly care plan. */
export function PlanLadder() {
  const cfg = CLINIC;

  return (
    <div>
      {/* Ladder */}
      <div className="grid md:grid-cols-3 gap-4" style={{ alignItems: "stretch" }}>
        {cfg.plans.map((p) => (
          <div
            key={p.tier}
            style={{
              background: T.surface,
              border: `1px solid ${p.highlighted ? T.primary : T.border}`,
              boxShadow: p.highlighted ? `inset 0 0 0 1px ${T.primary}40` : "none",
              borderRadius: T.r.xl,
              padding: "26px 24px",
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="flex items-center justify-between">
              <span
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "1.15rem",
                  color: T.fg,
                }}
              >
                {p.tier}
              </span>
              {p.highlighted && (
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.62rem",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: T.primary,
                    background: `${T.primary}14`,
                    border: `1px solid ${T.primary}44`,
                    borderRadius: 0,
                    padding: "3px 9px",
                  }}
                >
                  Most popular
                </span>
              )}
            </div>
            <div
              style={{ marginTop: 16, display: "flex", alignItems: "baseline", gap: 8 }}
            >
              <span
                style={{
                  fontFamily: T.display,
                  fontWeight: 700,
                  fontSize: "2.2rem",
                  letterSpacing: "-0.03em",
                  color: T.fg,
                }}
              >
                {p.monthly}
              </span>
              <span style={{ fontFamily: T.sans, fontSize: "0.95rem", color: T.muted }}>
                /mo
              </span>
            </div>
            <div
              style={{
                fontFamily: T.mono,
                fontSize: "0.74rem",
                color: T.faint,
                marginTop: 4,
              }}
            >
              + {p.setup} one-off build
            </div>
            <ul
              className="list-none"
              style={{
                marginTop: 18,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                flex: 1,
              }}
            >
              {p.inside.map((f) => (
                <li
                  key={f}
                  className="flex gap-2.5"
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.88rem",
                    lineHeight: 1.45,
                    color: T.muted,
                  }}
                >
                  <span
                    style={{
                      flex: "0 0 16px",
                      height: 16,
                      marginTop: 2,
                      borderRadius: "50%",
                      background: `${T.primary}1f`,
                      border: `1px solid ${T.primary}55`,
                      color: T.primary,
                      display: "grid",
                      placeItems: "center",
                      fontSize: "0.6rem",
                    }}
                  >
                    ✓
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/start"
              className="inline-flex items-center justify-center font-medium transition-opacity hover:opacity-90"
              style={{
                marginTop: 22,
                fontFamily: T.sans,
                fontSize: "0.9rem",
                fontWeight: 600,
                height: 44,
                background: p.highlighted ? T.primary : "transparent",
                color: p.highlighted ? T.primaryFg : T.fg,
                border: p.highlighted ? "none" : `1px solid ${T.borderStr}`,
                borderRadius: T.r.md,
                boxShadow: p.highlighted
                  ? `inset 0 1px 0 rgba(255,255,255,0.18)`
                  : "none",
                textDecoration: "none",
              }}
            >
              Get my free plan →
            </Link>
          </div>
        ))}
      </div>
      <p
        style={{
          fontFamily: T.mono,
          fontSize: "0.72rem",
          letterSpacing: "0.04em",
          color: T.faint,
          marginTop: 16,
        }}
      >
        You own the code &amp; every account · cancel anytime &amp; keep everything · no
        per-practitioner fees · no hidden fees.
      </p>
    </div>
  );
}
