"use client";

import React from "react";
import { Parallax } from "@/components/Parallax";
import { Reveal } from "@/components/Reveal";
import { ClipReveal } from "@/components/anim/ClipReveal";
import { T } from "@nullshift/ui/tokens";

/* ════════════════════════════════════════════════════════════════
   STEP REVEAL — one idea, one viewport.

   The darkroom-editorial pattern: a full-viewport void, a single
   object held in the middle of it, and the words kept to the edges —
   heading left, description right, nothing else competing. Each step
   of the system gets a whole screen, so a visitor meets one thing at
   a time instead of a wall of features.

   Typography follows the reference rather than our usual Kyma tracking:
   uppercase display at line-height 0.9 with NO negative letter-spacing,
   so the caps stack as a solid sculptural block, answered by a single
   mixed-case paragraph at a size that reads as speech rather than
   small print. That switch — caps to sentence case, tight to open — is
   the signal that you have moved from label to explanation.

   The object drifts on scroll while the text holds still, which is what
   makes a flat page feel like it has depth.
   ════════════════════════════════════════════════════════════════ */

export function StepReveal({
  index,
  kicker,
  heading,
  body,
  aside,
  screen,
}: {
  /** Two-digit step number, shown at both edges. */
  index: string;
  /** Micro-label above the heading. */
  kicker: string;
  heading: string;
  body: string;
  /** One short line under the body — the detail that makes it concrete. */
  aside?: string;
  /** The object held in the middle of the void. */
  screen: React.ReactNode;
}) {
  return (
    <section
      className="k-dark relative"
      style={{
        background: "var(--k-bg)",
        color: "var(--k-fg)",
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        borderTop: "1px dashed var(--k-border)",
        overflow: "hidden",
      }}
    >
      {/* Edge serial — a physical-product artifact, borrowed deliberately. */}
      <span
        aria-hidden
        className="ns-edge"
        style={{
          position: "absolute",
          right: 18,
          top: "50%",
          transform: "translateY(-50%) rotate(90deg)",
          transformOrigin: "center",
          fontFamily: T.mono,
          fontSize: "0.62rem",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--k-faint)",
          whiteSpace: "nowrap",
        }}
      >
        Nullshift — Step {index} of 05
      </span>

      <div
        className="ns-step"
        style={{
          width: "100%",
          maxWidth: 1320,
          margin: "0 auto",
          paddingInline: "clamp(20px,5vw,64px)",
          paddingBlock: "clamp(72px,12vh,140px)",
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: "clamp(24px,4vw,64px)",
        }}
      >
        {/* ── Heading column ── */}
        <div style={{ order: 1, minWidth: 0 }}>
          <Reveal>
            <span
              style={{
                fontFamily: T.mono,
                fontSize: "0.66rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--k-accent)",
              }}
            >
              [{index}] {kicker}
            </span>
          </Reveal>
          <ClipReveal delay={0.06} className="mt-6">
            <h2
              style={{
                margin: 0,
                fontFamily: T.sans,
                fontWeight: 500,
                fontSize: "clamp(2rem,4.4vw,3.2rem)",
                lineHeight: 0.9,
                letterSpacing: "normal",
                textTransform: "uppercase",
                color: "var(--k-fg)",
              }}
            >
              {heading}
            </h2>
          </ClipReveal>
        </div>

        {/* ── The object ── */}
        <div style={{ order: 2, display: "flex", justifyContent: "center", minWidth: 0 }}>
          <Parallax distance={26}>
            <Reveal delay={0.1}>{screen}</Reveal>
          </Parallax>
        </div>

        {/* ── Description column ── */}
        <div style={{ order: 3, minWidth: 0 }}>
          <Reveal delay={0.16}>
            <p
              style={{
                margin: 0,
                fontFamily: T.sans,
                fontWeight: 400,
                fontSize: "clamp(1.05rem,1.7vw,1.5rem)",
                lineHeight: 1.26,
                color: "var(--k-fg)",
                maxWidth: "26ch",
              }}
            >
              {body}
            </p>
            {aside && (
              <>
                <div
                  aria-hidden
                  style={{
                    borderTop: "1px dashed var(--k-border)",
                    marginBlock: 24,
                    maxWidth: "26ch",
                  }}
                />
                <p
                  style={{
                    margin: 0,
                    fontFamily: T.mono,
                    fontSize: "0.7rem",
                    lineHeight: 1.7,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--k-muted)",
                    maxWidth: "30ch",
                  }}
                >
                  {aside}
                </p>
              </>
            )}
          </Reveal>
        </div>
      </div>

      {/* Three columns only work while the middle one can breathe. Below that
          the object leads and the words stack under it, still one per screen. */}
      <style>{`
        @media (max-width: 1024px) {
          .ns-step {
            grid-template-columns: minmax(0, 1fr) !important;
            justify-items: start;
            gap: 28px !important;
          }
          .ns-step > div:nth-child(1) { order: 1 !important; }
          .ns-step > div:nth-child(2) { order: 2 !important; justify-content: flex-start !important; }
          .ns-step > div:nth-child(3) { order: 3 !important; }
          .ns-edge { display: none !important; }
        }
      `}</style>
    </section>
  );
}
