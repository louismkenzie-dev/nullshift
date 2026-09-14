"use client";

import React, { useRef } from "react";
import { animate, stagger, splitText, svg, createTimeline, utils } from "animejs";
import { T } from "@nullshift/ui/tokens";
import { useAnimeScope, usePrefersReducedMotion } from "@/lib/motion";

/* ════════════════════════════════════════════════════════════════
   HERO STAGE — a system drawing itself into existence.

   The thesis of the whole page is "we build the thing your business
   needs, whatever it is", so the hero has to show construction rather
   than describe it. A lattice of hairlines draws itself, nodes settle
   onto the joints, panels assemble out of nothing, and the headline
   resolves letter by letter on top.

   Everything is SVG and DOM — no WebGL, no third-party scene to fetch.
   A hero that cannot fail to load is worth more than one that is
   slightly shinier when it does.
   ════════════════════════════════════════════════════════════════ */

/* The lattice. Drawn in a 0 0 560 460 space and scaled to fit, so the
   geometry is authored once and never recomputed. */
const EDGES: string[] = [
  "M60 250 L180 180",
  "M180 180 L300 210",
  "M300 210 L430 140",
  "M180 180 L200 330",
  "M200 330 L340 360",
  "M340 360 L430 280",
  "M300 210 L340 360",
  "M430 140 L500 240",
  "M500 240 L430 280",
  "M60 250 L200 330",
  "M300 210 L200 330",
  "M430 140 L500 100",
];

const NODES: [number, number, number][] = [
  [60, 250, 4],
  [180, 180, 6],
  [300, 210, 7],
  [430, 140, 5],
  [200, 330, 5],
  [340, 360, 6],
  [500, 240, 4],
  [430, 280, 4],
  [500, 100, 3],
];

/* Little interface fragments that assemble on the lattice — the point
   being that what gets built is always made of the same parts, in a
   different arrangement every time. */
const CHIPS: { x: number; y: number; w: number; label: string }[] = [
  { x: 214, y: 118, w: 108, label: "Booking" },
  { x: 336, y: 250, w: 96, label: "Payment" },
  { x: 78, y: 296, w: 88, label: "Register" },
  { x: 394, y: 74, w: 86, label: "Report" },
  { x: 236, y: 386, w: 104, label: "Dashboard" },
];

export function HeroStage() {
  const root = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useAnimeScope(root, !reduced, (el) => {
    /* ── The headline resolves character by character. ── */
    const split = splitText(el.querySelectorAll("[data-hero-line]"), {
      chars: { wrap: "clip" },
      words: false,
      accessible: true,
    });

    const tl = createTimeline({ defaults: { ease: "outExpo" } });

    tl.add(
      split.chars,
      {
        y: ["110%", "0%"],
        opacity: [0, 1],
        duration: 900,
        delay: stagger(14),
      },
      0
    );

    /* ── The lattice draws itself under the words. ── */
    const edges = svg.createDrawable(el.querySelectorAll("[data-edge]"));
    tl.add(
      edges,
      { draw: ["0 0", "0 1"], duration: 1500, delay: stagger(55), ease: "inOutQuad" },
      180
    );

    /* ── Nodes land on the joints. ── */
    tl.add(
      el.querySelectorAll("[data-node]"),
      {
        scale: [0, 1],
        opacity: [0, 1],
        duration: 700,
        delay: stagger(70),
        ease: "outBack(2.4)",
      },
      620
    );

    /* ── Parts snap into place. ── */
    tl.add(
      el.querySelectorAll("[data-chip]"),
      {
        opacity: [0, 1],
        scale: [0.86, 1],
        y: [10, 0],
        duration: 620,
        delay: stagger(110),
      },
      900
    );

    /* ── Then it stays alive: a pulse travels the lattice forever. ── */
    animate(el.querySelectorAll("[data-node]"), {
      opacity: [1, 0.45, 1],
      scale: [1, 1.22, 1],
      duration: 2600,
      delay: stagger(180, { from: "center" }),
      loop: true,
      ease: "inOutSine",
    });

    /* ── And the cursor tilts the whole stage, so it feels held rather
          than printed. Cheap: one transform on one wrapper. ── */
    const stage = el.querySelector<HTMLElement>("[data-stage]");
    if (stage && window.matchMedia("(pointer: fine)").matches) {
      const onMove = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const nx = utils.clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5);
        const ny = utils.clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5);
        animate(stage, {
          rotateY: nx * 9,
          rotateX: -ny * 7,
          duration: 900,
          ease: "out(3)",
        });
      };
      el.addEventListener("pointermove", onMove);
      // Scope revert does not know about listeners, so hand one back.
      return () => el.removeEventListener("pointermove", onMove);
    }
  });

  return (
    <div ref={root} style={{ position: "relative" }}>
      <div
        className="ns-hero-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1.05fr) minmax(0,0.95fr)",
          alignItems: "center",
          gap: "clamp(32px,5vw,72px)",
        }}
      >
        {/* ── Words ── */}
        <div style={{ minWidth: 0 }}>
          <span
            style={{
              fontFamily: T.mono,
              fontSize: "0.68rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--k-accent)",
            }}
          >
            [01] Bespoke business systems
          </span>

          <h1 className="mt-7" style={{ margin: 0 }}>
            <span data-hero-line style={heroLine}>
              We build
            </span>
            <span data-hero-line style={heroLine}>
              anything your
            </span>
            <span data-hero-line style={{ ...heroLine, color: "var(--k-accent)" }}>
              business needs.
            </span>
          </h1>

          <p
            style={{
              margin: 0,
              marginTop: "clamp(28px,3.4vw,52px)",
              fontFamily: T.sans,
              fontWeight: 400,
              fontSize: "clamp(1.05rem,1.7vw,1.5rem)",
              lineHeight: 1.26,
              color: "var(--k-fg)",
              maxWidth: "30ch",
            }}
          >
            Whatever your business runs on — bookings, payments, records, people, stock,
            jobs — we design and build the system for it. Bespoke to you, beautiful to
            use, and yours to own.
          </p>
        </div>

        {/* ── The system building itself ── */}
        <div
          className="ns-hero-stage"
          style={{ minWidth: 0, perspective: 1200, perspectiveOrigin: "50% 45%" }}
        >
          <div
            data-stage
            style={{ transformStyle: "preserve-3d", willChange: "transform" }}
          >
            <svg
              viewBox="0 0 560 460"
              role="img"
              aria-label="A system assembling itself from connected parts"
              style={{
                width: "100%",
                height: "auto",
                display: "block",
                overflow: "visible",
              }}
            >
              {EDGES.map((d, i) => (
                <path
                  key={d}
                  data-edge
                  d={d}
                  fill="none"
                  stroke="var(--k-accent)"
                  strokeOpacity={i % 3 === 0 ? 0.5 : 0.24}
                  strokeWidth={1}
                  strokeLinecap="round"
                />
              ))}

              {NODES.map(([cx, cy, r]) => (
                <circle
                  key={`${cx}-${cy}`}
                  data-node
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="var(--k-accent)"
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                />
              ))}

              {CHIPS.map((c) => (
                <g
                  key={c.label}
                  data-chip
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                >
                  <rect
                    x={c.x}
                    y={c.y}
                    width={c.w}
                    height={30}
                    rx={3}
                    fill="var(--k-surface)"
                    stroke="var(--k-border-strong)"
                    strokeWidth={1}
                  />
                  <text
                    x={c.x + 12}
                    y={c.y + 20}
                    fill="var(--k-fg)"
                    style={{
                      fontFamily: T.mono,
                      fontSize: 11,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    {c.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .ns-hero-grid { grid-template-columns: minmax(0,1fr) !important; }
          .ns-hero-stage { order: 2; max-width: 460px; }
        }
      `}</style>
    </div>
  );
}

const heroLine: React.CSSProperties = {
  display: "block",
  fontFamily: T.sans,
  fontWeight: 500,
  fontSize: "clamp(2.1rem,5.2vw,3.9rem)",
  lineHeight: 0.9,
  letterSpacing: "normal",
  textTransform: "uppercase",
  color: "var(--k-fg)",
};
