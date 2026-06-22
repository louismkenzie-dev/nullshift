"use client";

import React, { useState } from "react";
import { T } from "@nullshift/ui/tokens";
import type { ServiceItem } from "./ui";

/* ════════════════════════════════════════════════════════════════
   Services accordion (ANIM 10) — all rows stay open; the ACTIVE row
   (hover / focus / tap) gets an emerald left track, an emerald corner
   block and full-opacity text, while inactive rows are dimmed under a
   diagonal hatch (ANIM 17). Not a collapsing accordion.
   ════════════════════════════════════════════════════════════════ */
export function ServiceAccordion({ items }: { items: ServiceItem[] }) {
  const [active, setActive] = useState(0);

  return (
    <div style={{ borderTop: "1px solid var(--k-border)" }}>
      {items.map((it, i) => {
        const on = i === active;
        return (
          <div
            key={it.n}
            tabIndex={0}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
            className="relative"
            style={{
              borderBottom: "1px solid var(--k-border)",
              background: on ? "var(--k-surface)" : "transparent",
              transition: "background 0.3s var(--ease-out-expo)",
              cursor: "pointer",
              overflow: "hidden",
              outline: "none",
            }}
          >
            {/* diagonal hatch on inactive rows */}
            {!on && (
              <div aria-hidden className="k-hatch pointer-events-none absolute inset-0" />
            )}
            {/* emerald left track */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 4,
                background: "var(--k-accent)",
                transform: on ? "scaleY(1)" : "scaleY(0)",
                transformOrigin: "top",
                transition: "transform 0.3s var(--ease-out-expo)",
              }}
            />
            <div
              className="relative grid items-start gap-5 md:gap-8 p-6 md:p-8"
              style={{ gridTemplateColumns: "auto 1fr auto" }}
            >
              {/* big number */}
              <span
                style={{
                  fontFamily: T.sans,
                  fontWeight: 800,
                  fontSize: "clamp(2.4rem,5vw,3.4rem)",
                  lineHeight: 0.9,
                  letterSpacing: "-0.03em",
                  color: on ? "var(--k-accent)" : "var(--k-faint)",
                  transition: "color 0.3s ease",
                }}
              >
                {it.n}
              </span>

              {/* category + headline + copy */}
              <div>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.66rem",
                    fontWeight: 500,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: on ? "var(--k-accent)" : "var(--k-muted)",
                    transition: "color 0.3s ease",
                  }}
                >
                  {it.label}
                </span>
                <h3
                  className="mt-2"
                  style={{
                    fontFamily: T.sans,
                    fontWeight: 700,
                    fontSize: "clamp(1.3rem,2.4vw,2rem)",
                    lineHeight: 1.05,
                    letterSpacing: "-0.02em",
                    textTransform: "uppercase",
                    color: on ? "var(--k-fg)" : "var(--k-muted)",
                    transition: "color 0.3s ease",
                  }}
                >
                  {it.title}
                </h3>
                <p
                  className="mt-3"
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.92rem",
                    lineHeight: 1.5,
                    maxWidth: "52ch",
                    color: on ? "var(--k-muted)" : "var(--k-faint)",
                    transition: "color 0.3s ease",
                  }}
                >
                  {it.desc}
                </p>
                {it.points && it.points.length > 0 && on && (
                  <ul
                    className="mt-4 flex flex-wrap gap-x-6 gap-y-2"
                    style={{ listStyle: "none", margin: 0, padding: 0 }}
                  >
                    {it.points.map((p) => (
                      <li
                        key={p}
                        className="inline-flex items-center gap-2"
                        style={{
                          fontFamily: T.mono,
                          fontSize: "0.7rem",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          color: "var(--k-muted)",
                        }}
                      >
                        <span aria-hidden style={{ color: "var(--k-accent)" }}>
                          ▸
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* emerald corner block */}
              <div
                aria-hidden
                style={{
                  width: "clamp(34px,5vw,52px)",
                  height: "clamp(34px,5vw,52px)",
                  background: "var(--k-accent)",
                  transform: on ? "scale(1)" : "scale(0)",
                  transformOrigin: "top right",
                  transition: "transform 0.3s var(--ease-out-expo)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
