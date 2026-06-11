"use client";

import { useEffect, useRef } from "react";
import { T } from "@/lib/tokens";

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

export default function ScrollVideoSection() {
  const sectionRef     = useRef<HTMLElement>(null);
  const videoRef       = useRef<HTMLVideoElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const panelInnerRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const dotRefs        = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const rafRef         = useRef<number>(0);

  useEffect(() => {
    const section = sectionRef.current;
    const video   = videoRef.current;
    const canvas  = canvasRef.current;
    if (!section || !video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    video.pause();

    let isReady      = false;
    let pendingTime: number | null = null;
    let lastProgress = -1;
    let vw = 0, vh = 0; // cached video dimensions

    // ── Canvas sizing + draw ─────────────────────────────────────
    // IMPORTANT: canvas must have absolute CSS dimensions (clamp/vh, not %)
    // so that offsetWidth/Height are always correct when this runs from a
    // video event — relative dimensions (100%) may not be computed yet.
    const sizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const w   = canvas.offsetWidth  || window.innerWidth;
      const h   = canvas.offsetHeight || window.innerHeight;
      if (w === 0 || h === 0) return;
      canvas.width  = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };

    const draw = () => {
      if (!isReady || vw === 0 || vh === 0) return;
      const cw = canvas.width, ch = canvas.height;
      if (cw === 0 || ch === 0) return;
      const videoAspect  = vw / vh;
      const canvasAspect = cw / ch;
      // Cover: fill canvas, crop excess video edges
      let sx = 0, sy = 0, sw = vw, sh = vh;
      if (videoAspect > canvasAspect) {
        sw = vh * canvasAspect;
        sx = (vw - sw) / 2;
      } else {
        sh = vw / canvasAspect;
        sy = (vh - sh) / 2;
      }
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);

      // ── Edge vignette via source-over painting ────────────────────
      // destination-in silently fails on GPU-composited canvas layers —
      // transparent pixels are shown as black, not the page background.
      // Instead we paint the page background colour (#0A0B0F) directly
      // onto the canvas at each edge, fading from fully opaque at the
      // boundary to transparent inward. source-over is the default mode
      // and works in every browser regardless of compositing layer setup.
      // Corners are naturally covered twice — they become fully page-bg.
      const C = "10,11,15";       // T.bg = #0A0B0F as rgb components
      const fw = Math.round(cw * 0.46); // 46% from each side — very wide feather
      const fh = Math.round(ch * 0.42); // 42% from top/bottom

      ctx.globalCompositeOperation = "source-over";

      // 5-stop gradients produce a smooth S-curve falloff with no visible
      // inflection point — page-bg bleeds deeply before becoming transparent.
      const stops: [number, number][] = [
        [0,    1.00],
        [0.20, 0.88],
        [0.45, 0.58],
        [0.70, 0.22],
        [0.88, 0.05],
        [1,    0.00],
      ];
      const rev = [...stops].map(([t, a]) => [1 - t, a] as [number, number]).reverse();

      const lG = ctx.createLinearGradient(0, 0, fw, 0);
      stops.forEach(([t, a]) => lG.addColorStop(t, `rgba(${C},${a})`));
      ctx.fillStyle = lG; ctx.fillRect(0, 0, fw, ch);

      const rG = ctx.createLinearGradient(cw - fw, 0, cw, 0);
      rev.forEach(([t, a]) => rG.addColorStop(t, `rgba(${C},${a})`));
      ctx.fillStyle = rG; ctx.fillRect(cw - fw, 0, fw, ch);

      const tG = ctx.createLinearGradient(0, 0, 0, fh);
      stops.forEach(([t, a]) => tG.addColorStop(t, `rgba(${C},${a})`));
      ctx.fillStyle = tG; ctx.fillRect(0, 0, cw, fh);

      const bG = ctx.createLinearGradient(0, ch - fh, 0, ch);
      rev.forEach(([t, a]) => bG.addColorStop(t, `rgba(${C},${a})`));
      ctx.fillStyle = bG; ctx.fillRect(0, ch - fh, cw, fh);
    };

    // ── Seek management (one seek at a time) ─────────────────────
    const seek = (t: number) => {
      if (!isFinite(t) || !isFinite(video.duration)) return;
      const clamped = Math.max(0, Math.min(video.duration, t));
      if (video.seeking) { pendingTime = clamped; return; }
      video.currentTime = clamped;
    };

    const onSeeked = () => {
      draw();
      if (pendingTime !== null) {
        const t = pendingTime; pendingTime = null;
        video.currentTime = t;
      }
    };

    const init = () => {
      if (isReady) return;
      isReady = true;
      vw = video.videoWidth;
      vh = video.videoHeight;
      sizeCanvas();
      // Seek to 0.001 instead of 0 — guarantees the 'seeked' event fires
      // even if currentTime is already 0, which then calls draw()
      video.currentTime = 0.001;
    };

    const onResize = () => { sizeCanvas(); draw(); };

    video.addEventListener("loadedmetadata", init);
    video.addEventListener("canplay",        init);
    video.addEventListener("seeked",         onSeeked);
    window.addEventListener("resize",        onResize);

    // Video may already be loaded (cached/fast network) — init immediately
    if (video.readyState >= 2) init();

    // ── RAF loop ─────────────────────────────────────────────────
    const tick = () => {
      const rect       = section.getBoundingClientRect();
      const scrollable = section.offsetHeight - window.innerHeight;
      const progress   = Math.max(0, Math.min(1, -rect.top / scrollable));

      if (Math.abs(progress - lastProgress) > 0.00007) {
        lastProgress = progress;

        if (isReady) seek(progress * video.duration);

        // Animate panel inner divs (translateX + opacity)
        PANELS.forEach((p, i) => {
          const el = panelInnerRefs.current[i];
          if (!el) return;
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

          el.style.opacity   = String(Math.max(0, Math.min(1, opacity)));
          el.style.transform = `translateX(${x}px)`;
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

    return () => {
      cancelAnimationFrame(rafRef.current);
      video.removeEventListener("loadedmetadata", init);
      video.removeEventListener("canplay",        init);
      video.removeEventListener("seeked",         onSeeked);
      window.removeEventListener("resize",        onResize);
    };
  }, []);

  // Panel inner content
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

  // Render a panel: outer div centres vertically, inner div is the animation target
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

  // Gradient bg colour as hex-alpha for overlay divs
  const bg = T.bg; // "#0A0B0F"

  return (
    <section ref={sectionRef} style={{ height: "420vh", position: "relative" }}>
      <div style={{
        position: "sticky", top: 0, height: "100vh",
        overflow: "hidden",
      }}>

        {/* Hidden video — decoded frames are painted to the canvas */}
        <video
          ref={videoRef}
          src="/green-tech-graphic.mp4"
          muted playsInline preload="auto"
          style={{ display: "none" }}
        />

        {/* Canvas with its OWN absolute CSS dimensions so offsetWidth/Height
            are reliably readable from video events before layout settles.
            Never use relative (%) dimensions here — that breaks sizeCanvas(). */}
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "clamp(480px, 68vw, 1060px)",
            height: "78vh",
            display: "block",
            zIndex: 1,
          }}
        />

        {/* Ambient glow */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2,
          background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${T.primary}0d 0%, transparent 70%)`,
        }} />

        {/* Viewport-edge strips — cover the space between the canvas boundary
            and the viewport edge. Canvas vignette handles the canvas-internal
            fade; these cover the outer margin so nothing leaks to the viewport. */}
        <div style={{
          position: "absolute", top: 0, bottom: 0, left: 0, width: "18%",
          background: `linear-gradient(to right, ${bg}, transparent)`,
          pointerEvents: "none", zIndex: 4,
        }} />
        <div style={{
          position: "absolute", top: 0, bottom: 0, right: 0, width: "18%",
          background: `linear-gradient(to left, ${bg}, transparent)`,
          pointerEvents: "none", zIndex: 4,
        }} />
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "13%",
          background: `linear-gradient(to bottom, ${bg}, transparent)`,
          pointerEvents: "none", zIndex: 4,
        }} />
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: "13%",
          background: `linear-gradient(to top, ${bg}, transparent)`,
          pointerEvents: "none", zIndex: 4,
        }} />

        {/* ── Text panels floating over video ── */}
        {/* Panel 0 — left, visible initially */}
        {renderPanel(0, { left: "clamp(52px, 6vw, 100px)" }, 1, 0)}
        {/* Panel 2 — left, hidden initially */}
        {renderPanel(2, { left: "clamp(52px, 6vw, 100px)" }, 0, -44)}
        {/* Panel 1 — right, hidden initially */}
        {renderPanel(1, { right: "clamp(52px, 6vw, 100px)", textAlign: "right" }, 0, 44)}

        {/* ── Progress rail ── */}
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

        {/* ── Scroll hint ── */}
        <div style={{
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
