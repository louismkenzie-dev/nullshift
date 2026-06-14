"use client";

import { useEffect, useRef } from "react";

/**
 * Cinematic "systems constellation" — the homepage scroll graphic.
 *
 * Replaces the old WebGL gyroscope/neural-sphere. Built in the intro's visual
 * language (the brand pill at the core, emerald glow, embers, hairlines) and
 * driven entirely by a single inherited CSS custom property `--p` (0→1, the
 * scroll progress set by the parent ScrollVideoSection). As you scroll the
 * core pill resolves "from nothing", system nodes assemble around it and wire
 * back to the core (systems that scale), then everything settles and glows
 * (one team, end to end). No second WebGL context, no per-frame React work for
 * the constellation — CSS calc()/clamp() off `--p` does the scrubbing.
 */
const SYSTEMS = ["Websites", "Booking", "CRM", "Portals", "Automations", "Courses", "AI agents"];
const CX = 300, CY = 300, RX = 215, RY = 132;

type Node = { x: number; y: number; len: number; t: number; label: string; anchor: "start" | "middle" | "end"; lx: number; ly: number };

const NODES: Node[] = SYSTEMS.map((label, i) => {
  const a = (-90 + i * (360 / SYSTEMS.length)) * (Math.PI / 180);
  const x = CX + RX * Math.cos(a);
  const y = CY + RY * Math.sin(a);
  const cos = Math.cos(a), sin = Math.sin(a);
  const anchor: Node["anchor"] = cos > 0.25 ? "start" : cos < -0.25 ? "end" : "middle";
  const dx = anchor === "start" ? 16 : anchor === "end" ? -16 : 0;
  const dy = anchor === "middle" ? (sin < 0 ? -14 : 20) : 4;
  return { x, y, len: Math.hypot(x - CX, y - CY), t: 0.24 + i * 0.058, label, anchor, lx: x + dx, ly: y + dy };
});

export default function CinematicSystems() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Ember field — subtle, paused when off-screen.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current, stage = stageRef.current;
    if (!canvas || !stage) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, raf = 0, visible = true;

    const resize = () => {
      const r = stage.getBoundingClientRect();
      W = canvas.width = Math.max(1, Math.round(r.width * DPR));
      H = canvas.height = Math.max(1, Math.round(r.height * DPR));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(stage);

    const io = new IntersectionObserver((es) => { visible = es[0]?.isIntersecting ?? true; }, { threshold: 0 });
    io.observe(stage);

    type P = { x: number; y: number; r: number; vy: number; vx: number; a: number; ph: number; cyan: boolean };
    const mk = (): P => ({ x: Math.random() * W, y: H + Math.random() * H, r: (Math.random() * 1.4 + 0.4) * DPR, vy: -(Math.random() * 0.16 + 0.05) * DPR, vx: (Math.random() - 0.5) * 0.07 * DPR, a: Math.random() * 0.3 + 0.05, ph: Math.random() * Math.PI * 2, cyan: Math.random() < 0.16 });
    const parts: P[] = [];
    for (let i = 0; i < 26; i++) { const p = mk(); p.y = Math.random() * H; parts.push(p); }

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.y += p.vy; p.x += p.vx; p.ph += 0.02;
        const fl = 0.55 + 0.45 * Math.sin(p.ph);
        if (p.y < -10) { parts[i] = mk(); continue; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = (p.cyan ? "rgba(61,215,229," : "rgba(16,185,129,") + (p.a * fl).toFixed(3) + ")";
        ctx.shadowBlur = 6 * DPR;
        ctx.shadowColor = p.cyan ? "rgba(61,215,229,0.5)" : "rgba(16,185,129,0.5)";
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, []);

  return (
    <div ref={stageRef} className="cs-stage relight-shell">
      <canvas ref={canvasRef} className="cs-embers" aria-hidden />
      <svg className="cs-svg" viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        {/* core glow */}
        <circle className="cs-glow" cx={CX} cy={CY} r={150} fill="#10B981" />

        {/* orbital rings */}
        <g className="cs-rings">
          <ellipse cx={CX} cy={CY} rx={RX} ry={RY} />
          <ellipse cx={CX} cy={CY} rx={RX + 54} ry={RY + 36} />
        </g>

        {/* wires core → node */}
        {NODES.map((n, i) => (
          <line
            key={`l${i}`}
            className="cs-line"
            x1={CX} y1={CY} x2={n.x} y2={n.y}
            style={{ ["--len" as string]: String(n.len), ["--t" as string]: String(n.t) }}
          />
        ))}

        {/* nodes */}
        {NODES.map((n, i) => (
          <g key={`n${i}`} className="cs-node" style={{ ["--t" as string]: String(n.t) }}>
            <circle className="cs-node-ring" cx={n.x} cy={n.y} r={9} />
            <circle className="cs-dot" cx={n.x} cy={n.y} r={4} />
            <text className="cs-label" x={n.lx} y={n.ly} textAnchor={n.anchor}>{n.label}</text>
          </g>
        ))}

        {/* core pill — exact brand coordinates, scaled to the centre */}
        <g className="cs-pill">
          <g transform="translate(197.3,197.3) scale(1.3)">
            <rect x="44.69" y="33.95" width="31.42" height="81.96" rx="10" fill="var(--pill-light, #D6D6D6)" />
            <rect x="83.88" y="45.30" width="29.50" height="78.70" rx="10" fill="#10B981" />
          </g>
        </g>
      </svg>
    </div>
  );
}
