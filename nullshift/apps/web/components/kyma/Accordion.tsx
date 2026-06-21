"use client";

import React, { useState } from "react";
import { T } from "@nullshift/ui/tokens";

export type FAQItem = { q: string; a: React.ReactNode; cat?: string };

/* Kyma-style FAQ accordion — hairline rows, rotating + toggle, smooth
   grid-rows height reveal. Themed via --k-* CSS vars (cream/dark). */
export function Accordion({
  items,
  defaultOpen = 0,
}: {
  items: FAQItem[];
  defaultOpen?: number | null;
}) {
  const [open, setOpen] = useState<number | null>(defaultOpen);

  return (
    <div style={{ borderTop: "1px solid var(--k-border)" }}>
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} style={{ borderBottom: "1px solid var(--k-border)" }}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-6 text-left"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                paddingBlock: "clamp(18px,2.2vw,26px)",
              }}
            >
              <span className="flex items-baseline gap-4">
                {item.cat && (
                  <span
                    className="hidden sm:inline"
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.66rem",
                      fontWeight: 500,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--k-accent)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.cat}
                  </span>
                )}
                <span
                  style={{
                    fontFamily: T.sans,
                    fontWeight: 700,
                    fontSize: "clamp(1.05rem,1.7vw,1.35rem)",
                    letterSpacing: "-0.02em",
                    lineHeight: 1.15,
                    textTransform: "uppercase",
                    color: "var(--k-fg)",
                  }}
                >
                  {item.q}
                </span>
              </span>
              <span
                className="k-acc-icon"
                data-open={isOpen}
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 999,
                  border: `1px solid ${isOpen ? "var(--k-accent)" : "var(--k-border-strong)"}`,
                  color: isOpen ? "var(--k-accent)" : "var(--k-muted)",
                  fontFamily: T.mono,
                  fontSize: "1rem",
                  lineHeight: 1,
                }}
              >
                +
              </span>
            </button>
            <div className="k-acc-body" data-open={isOpen}>
              <div>
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.95rem",
                    lineHeight: 1.6,
                    letterSpacing: "-0.01em",
                    color: "var(--k-muted)",
                    maxWidth: "70ch",
                    paddingBottom: "clamp(18px,2.2vw,26px)",
                    margin: 0,
                  }}
                >
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
