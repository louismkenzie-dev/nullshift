"use client";

import { useEffect, useRef } from "react";
import { T } from "@/lib/tokens";
import CinematicSystems from "./CinematicSystems";

const PANELS = [
  {
    side: "left" as const,
    label: "01 — Craft",
    heading: ["Websites built", "from scratch."],
    body: "Every project starts with a blank canvas. No templates, no page-builders — bespoke design and clean code crafted specifically for your business.",
  },
  {
    side: "right" as const,
    label: "02 — Systems",
    heading: ["Custom systems", "that scale."],
    body: "Booking engines, CRMs, client portals and automated workflows — built around how your business operates, not the other way around.",
  },
  {
    side: "left" as const,
    label: "03 — Studio",
    heading: ["One team,", "end to end."],
    body: "Strategy, design, and code under one roof. You work with us directly from brief to launch — and we stay available long after.",
  },
];

// [inStart, inEnd, outStart, outEnd]
const BREAKS = [
  [0, 0, 0.27, 0.37],
  [0.27, 0.37, 0.61, 0.71],
  [0.61, 0.71, 1, 1],
] as const;

function eio(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export default function ScrollVideoSection() {
  const sectionRef     = useRef<HTMLElement>(null);
  const graphicWrapRef = useRef<HTMLDivElement>(null);
  const panelInnerRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  // Mobile stacks text above (head: eyebrow+heading) and below (body) the graphic
  const mobileHeadRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const mobileBodyRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const dotRefs        = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const rafRef         = useRef<number>(0);
  // Shared ref the scene reads every frame for the scroll-jog + crossfade
  const progressRef    = useRef<number>(0);

  useEffect(() => {
    if (!sectionRef.current) return;

    let lastProgress = -1;

    const tick = () => {
      // Read the ref fresh each frame — capturing the node once can leave a
      // stale (detached) reference after Fast Refresh, freezing progress.
      const section = sectionRef.current;
      if (!section) { rafRef.current = requestAnimationFrame(tick); return; }
      const rect       = section.getBoundingClientRect();
      const scrollable = section.offsetHeight - window.innerHeight;
      const progress   = Math.max(0, Math.min(1, -rect.top / scrollable));

      if (Math.abs(progress - lastProgress) > 0.00007) {
        lastProgress = progress;
        progressRef.current = progress;

        // ── Graphic materialise + scroll-scrub ─────────────────────
        // The constellation resolves up out of a soft blur as the section
        // enters, then STAYS. Everything else (pill, rings, nodes, wires) is
        // scrubbed by the inherited CSS var --p = progress (see CinematicSystems
        // + the .cs-* rules in globals.css). No per-frame React work for it.
        const ENTER_END  = 0.14; // fully resolved by 14% through
        const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
        const fadeIn  = easeOutCubic(clamp01(progress / ENTER_END));

        const wrap = graphicWrapRef.current;
        if (wrap) {
          wrap.style.setProperty("--p", String(progress));
          wrap.style.opacity   = String(fadeIn);
          wrap.style.transform = `scale(${0.9 + 0.1 * fadeIn})`;
          wrap.style.filter    = `blur(${10 * (1 - fadeIn)}px)`;
        }

        // Animate panel text. Desktop slides horizontally over the graphic;
        // mobile crossfades head (above) and body (below) the graphic.
        PANELS.forEach((p, i) => {
          const [inS, inE, outS, outE] = BREAKS[i];
          const dir = p.side === "left" ? -1 : 1;
          let opacity: number, x: number;

          if      (i === 0 && progress < outS)                   { opacity = 1; x = 0; }
          else if (i === PANELS.length - 1 && progress >= inE)   { opacity = 1; x = 0; }
          else if (progress <= inS)                              { opacity = 0; x = dir * 44; }
          else if (progress < inE) {
            const t = eio((progress - inS) / (inE - inS));
            opacity = t; x = dir * (1 - t) * 44;
          }
          else if (progress <= outS)                             { opacity = 1; x = 0; }
          else if (progress < outE) {
            const t = eio((progress - outS) / (outE - outS));
            opacity = 1 - t; x = -dir * t * 44;
          }
          else                                                   { opacity = 0; x = -dir * 44; }

          const op = Math.max(0, Math.min(1, opacity));

          const dEl = panelInnerRefs.current[i];
          if (dEl) { dEl.style.opacity = String(op); dEl.style.transform = `translateX(${x}px)`; }

          // Mobile: head drifts down from above, body rises from below.
          const y = (1 - op) * 14;
          const hEl = mobileHeadRefs.current[i];
          if (hEl) { hEl.style.opacity = String(op); hEl.style.transform = `translateY(${-y}px)`; }
          const bEl = mobileBodyRefs.current[i];
          if (bEl) { bEl.style.opacity = String(op); bEl.style.transform = `translateY(${y}px)`; }
        });

        // Progress dots
        const active = progress < 0.37 ? 0 : progress < 0.71 ? 1 : 2;
        dotRefs.current.forEach((dot, i) => {
          if (!dot) return;
          dot.style.height  = i === active ? "26px" : "6px";
          dot.style.opacity = i === active ? "1" : "0.2";
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const PanelBody = ({ panel }: { panel: typeof PANELS[number] }) => (
    <>
      <div style={{
        fontFamily: T.mono, fontSize: "0.68rem", fontWeight: 500,
        letterSpacing: "0.12em", textTransform: "uppercase",
        color: T.primary, marginBottom: 18,
      }}>
        {panel.label}
      </div>
      <h2 style={{
        fontFamily: T.display, fontWeight: 600,
        fontSize: "clamp(1.75rem, 2.6vw, 2.6rem)",
        lineHeight: 1.07, letterSpacing: "-0.028em",
        color: T.fg, margin: "0 0 18px",
      }}>
        {panel.heading[0]}<br />
        <span style={{ color: T.muted }}>{panel.heading[1]}</span>
      </h2>
      <p style={{
        fontFamily: T.sans, fontSize: "clamp(0.85rem, 0.95vw, 0.9375rem)",
        lineHeight: 1.65, letterSpacing: "-0.005em",
        color: T.muted, maxWidth: "28ch",
      }}>
        {panel.body}
      </p>
    </>
  );

  const renderPanel = (
    index: number,
    posStyle: React.CSSProperties,
    initOpacity: number,
    initX: number,
  ) => (
    <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", zIndex: 10, ...posStyle }}>
      <div
        ref={el => { panelInnerRefs.current[index] = el; }}
        style={{
          opacity: initOpacity,
          transform: `translateX(${initX}px)`,
          willChange: "opacity, transform",
          maxWidth: 300,
        }}
      >
        <div className="scroll-panel-glass">
          <PanelBody panel={PANELS[index]} />
        </div>
      </div>
    </div>
  );

  return (
    <section ref={sectionRef} style={{ height: "420vh", position: "relative" }}>
      <div style={{
        position: "sticky", top: 0, height: "100vh",
        overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>

        {/* Cinematic systems constellation — the brand pill at the core, system
            nodes assembling and wiring back to it as you scroll. Scrubbed by the
            inherited CSS var --p set on this wrapper each frame. This wrapper
            also materialises the whole assembly out of a soft blur on enter. */}
        <div
          ref={graphicWrapRef}
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1,
            opacity: 0,
            transform: "scale(0.9)",
            filter: "blur(10px)",
            willChange: "opacity, transform, filter",
          }}
        >
          <CinematicSystems />
        </div>

        {/* Ambient emerald glow — soft multi-stop falloff, no hard stop */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2,
          background: `radial-gradient(ellipse 62% 58% at 50% 50%, ${T.primary}12 0%, ${T.primary}08 30%, ${T.primary}03 52%, transparent 78%)`,
        }} />

        {/* Seamless vignette — a single radial that melts the graphic into the
            page background. Replaces the old four rectangular edge-fades, whose
            straight regions + overlapping corners produced visible seams and
            linear-gradient banding. Multi-stop for a buttery falloff; the global
            grain layer dithers any residual banding. */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 4,
          background: `radial-gradient(ellipse 80% 80% at 50% 50%, transparent 0%, transparent 38%, ${T.bg}66 64%, ${T.bg}cc 82%, ${T.bg} 100%)`,
        }} />

        {/* ── Desktop text panels (float over the graphic, left/right) ── */}
        <div className="svs-desktop-panels">
          {renderPanel(0, { left: "clamp(52px, 6vw, 100px)" }, 1, 0)}
          {renderPanel(2, { left: "clamp(52px, 6vw, 100px)" }, 0, -44)}
          {renderPanel(1, { right: "clamp(52px, 6vw, 100px)", textAlign: "right" }, 0, 44)}
        </div>

        {/* ── Mobile text (stacked above & below the graphic) ── */}
        <div className="svs-mobile">
          <div className="svs-mobile-top">
            {PANELS.map((p, i) => (
              <div
                key={i}
                ref={el => { mobileHeadRefs.current[i] = el; }}
                className="svs-mobile-head"
                style={{ opacity: i === 0 ? 1 : 0, willChange: "opacity, transform" }}
              >
                <div style={{
                  fontFamily: T.mono, fontSize: "0.62rem", fontWeight: 500,
                  letterSpacing: "0.14em", textTransform: "uppercase",
                  color: T.primary, marginBottom: 10,
                }}>
                  {p.label}
                </div>
                <h2 style={{
                  fontFamily: T.display, fontWeight: 600,
                  fontSize: "clamp(1.6rem, 7.5vw, 2.3rem)",
                  lineHeight: 1.08, letterSpacing: "-0.028em",
                  color: T.fg, margin: 0,
                }}>
                  {p.heading[0]}<br />
                  <span style={{ color: T.muted }}>{p.heading[1]}</span>
                </h2>
              </div>
            ))}
          </div>
          <div className="svs-mobile-bottom">
            {PANELS.map((p, i) => (
              <div
                key={i}
                ref={el => { mobileBodyRefs.current[i] = el; }}
                className="svs-mobile-body"
                style={{ opacity: i === 0 ? 1 : 0, willChange: "opacity, transform" }}
              >
                <p style={{
                  fontFamily: T.sans, fontSize: "0.9rem",
                  lineHeight: 1.6, letterSpacing: "-0.005em",
                  color: T.muted, margin: 0,
                }}>
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Progress rail */}
        <div style={{
          position: "absolute", left: "clamp(16px, 2vw, 24px)",
          top: "50%", transform: "translateY(-50%)",
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 6, zIndex: 15,
        }}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              ref={el => { dotRefs.current[i] = el; }}
              style={{
                width: 2, height: i === 0 ? 26 : 6,
                borderRadius: 999, background: T.primary,
                opacity: i === 0 ? 1 : 0.2,
                transition: "height 360ms cubic-bezier(0.2,0.6,0.2,1), opacity 360ms",
              }}
            />
          ))}
        </div>

        {/* Scroll hint */}
        <div className="svs-scroll-hint" style={{
          position: "absolute", bottom: 28, left: "50%",
          transform: "translateX(-50%)",
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 5,
          opacity: 0.28, pointerEvents: "none", zIndex: 15,
        }}>
          <span style={{
            fontFamily: T.mono, fontSize: "0.58rem",
            letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted,
          }}>scroll</span>
          <div style={{ width: 1, height: 26, background: `linear-gradient(to bottom, ${T.muted}, transparent)` }} />
        </div>
      </div>
    </section>
  );
}
