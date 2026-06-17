"use client";

import { useEffect, useRef } from "react";

/** Ambient cinematic backdrop for the funnel — a slow emerald aurora, a sparse
 *  drifting ember field (canvas) and a fine film grain. Ported from the brand
 *  intro so /start feels like the same world. Sits behind funnel content
 *  (pointer-events: none) and fully respects prefers-reduced-motion. */
export function Atmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = canvasRef.current;
    if (reduced || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    let raf = 0;

    const resize = () => {
      W = canvas.width = window.innerWidth * DPR;
      H = canvas.height = window.innerHeight * DPR;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    };
    resize();
    window.addEventListener("resize", resize);

    type P = { x: number; y: number; r: number; vy: number; vx: number; a: number; ph: number; cyan: boolean };
    const mk = (): P => {
      const cyan = Math.random() < 0.16;
      return {
        x: Math.random() * W,
        y: H + Math.random() * H,
        r: (Math.random() * 1.4 + 0.4) * DPR,
        vy: -(Math.random() * 0.16 + 0.05) * DPR,
        vx: (Math.random() - 0.5) * 0.08 * DPR,
        a: Math.random() * 0.34 + 0.06,
        ph: Math.random() * Math.PI * 2,
        cyan,
      };
    };
    const parts: P[] = [];
    for (let i = 0; i < 34; i++) {
      const p = mk();
      p.y = Math.random() * H;
      parts.push(p);
    }

    const loop = () => {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.y += p.vy;
        p.x += p.vx;
        p.ph += 0.022;
        const fl = 0.55 + 0.45 * Math.sin(p.ph);
        if (p.y < -10) {
          parts[i] = mk();
          continue;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = (p.cyan ? "rgba(61,215,229," : "rgba(16,185,129,") + (p.a * fl).toFixed(3) + ")";
        ctx.shadowBlur = 7 * DPR;
        ctx.shadowColor = p.cyan ? "rgba(61,215,229,0.5)" : "rgba(16,185,129,0.5)";
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div aria-hidden className="ns-funnel-atmos" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      <div className="ns-funnel-aurora" />
      <canvas ref={canvasRef} className="ns-funnel-embers" />
      <div className="ns-funnel-grain" />
    </div>
  );
}
