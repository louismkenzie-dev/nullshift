"use client";

import { useEffect, useRef } from "react";

/* ════════════════════════════════════════════════════════════════
   NeuralField — an agentic node-network backdrop (Canvas 2D).
   Nodes wired together by proximity, with emerald "data pulses"
   travelling the edges — reads as an AI system routing work end to
   end, not abstract fog. Layered depth-parallax on scroll, a soft
   cursor halo, single rAF, capped DPR, paused offscreen, and a
   single static frame under prefers-reduced-motion.
   Drop-in for dark hero sections (props match the old field).
   ════════════════════════════════════════════════════════════════ */

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  z: number; // depth 0.4..1.6 → parallax + size
  ph: number; // twinkle phase
  px: number; // resolved draw x (this frame)
  py: number; // resolved draw y (this frame)
  glow: number; // smoothed cursor proximity 0..1
};

type Pulse = { a: number; b: number; t: number; speed: number; hops: number };

const EMER = "16,185,129"; // #10b981
const EMER_HI = "52,211,153"; // #34d399

export function NeuralField({
  className = "",
  style,
  intensity = 1,
  density = 1,
}: {
  className?: string;
  style?: React.CSSProperties;
  intensity?: number;
  density?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let cssW = 0;
    let cssH = 0;
    let nodes: Node[] = [];

    const LINK = 150; // max link distance (css px)

    const build = () => {
      const area = cssW * cssH;
      const count = Math.max(26, Math.min(120, Math.round((area / 15000) * density)));
      nodes = Array.from({ length: count }, () => {
        const z = 0.4 + Math.random() * 1.2;
        return {
          x: Math.random() * cssW,
          y: Math.random() * cssH,
          vx: (Math.random() - 0.5) * 0.09,
          vy: (Math.random() - 0.5) * 0.09,
          r: 0.8 + z * 0.9,
          z,
          ph: Math.random() * Math.PI * 2,
          px: 0,
          py: 0,
          glow: 0,
        };
      });
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      cssW = r.width;
      cssH = r.height;
      canvas.width = Math.max(1, Math.floor(cssW * dpr));
      canvas.height = Math.max(1, Math.floor(cssH * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // smoothed cursor (css coords, relative to canvas); off-screen by default
    const mouse = { x: -999, y: -999, active: false };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      mouse.active = e.clientY >= r.top && e.clientY <= r.bottom;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), {
      rootMargin: "140px",
    });
    io.observe(canvas);

    const pulses: Pulse[] = [];
    const nearest = (i: number) => {
      // pick a reasonably-close neighbour (some randomness for variety)
      const a = nodes[i];
      let best = -1;
      let bd = LINK;
      for (let j = 0; j < nodes.length; j++) {
        if (j === i) continue;
        const d = Math.hypot(nodes[j].px - a.px, nodes[j].py - a.py);
        if (d < bd && Math.random() < 0.6) {
          best = j;
          bd = d;
        }
      }
      return best;
    };
    const spawnPulse = () => {
      if (nodes.length < 2 || pulses.length > 9) return;
      const i = (Math.random() * nodes.length) | 0;
      const b = nearest(i);
      if (b >= 0)
        pulses.push({ a: i, b, t: 0, speed: 0.006 + Math.random() * 0.012, hops: 0 });
    };

    const start = performance.now();
    let last = start;
    let acc = 0;
    let raf = 0;

    const frame = (now: number, animate: boolean) => {
      const time = (now - start) / 1000;
      const scroll = window.scrollY || 0;
      ctx.clearRect(0, 0, cssW, cssH);

      // 1) resolve each node's drawn position (drift + depth-parallax, wrapped)
      const wrapH = cssH + 120;
      for (const n of nodes) {
        if (animate) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > cssW) n.vx *= -1;
          if (n.y < 0 || n.y > cssH) n.vy *= -1;
        }
        n.px = n.x;
        let yy = (n.y + scroll * 0.03 * n.z) % wrapH;
        if (yy < 0) yy += wrapH;
        n.py = yy - 60;

        // cursor proximity (smoothed)
        let target = 0;
        if (mouse.active) {
          const dm = Math.hypot(mouse.x - n.px, mouse.y - n.py);
          target = dm < 150 ? 1 - dm / 150 : 0;
        }
        n.glow += (target - n.glow) * (animate ? 0.08 : 1);
      }

      // 2) edges — hairline links between near nodes
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.px - b.px;
          const dy = a.py - b.py;
          const d2 = dx * dx + dy * dy;
          if (d2 > LINK * LINK) continue;
          const d = Math.sqrt(d2);
          const base = (1 - d / LINK) * 0.5;
          const lift = (a.glow + b.glow) * 0.4;
          const alpha = Math.min(0.85, base + lift) * intensity;
          if (alpha < 0.015) continue;
          ctx.strokeStyle = `rgba(${EMER},${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.px, a.py);
          ctx.lineTo(b.px, b.py);
          ctx.stroke();
        }
      }

      // 3) nodes — emerald dots, gentle twinkle, brighten near cursor
      for (const n of nodes) {
        const tw = animate ? 0.55 + 0.45 * Math.sin(time * 0.9 + n.ph) : 0.85;
        const a = Math.min(1, 0.18 + 0.5 * tw + n.glow * 0.7) * intensity;
        const r = n.r + n.glow * 1.6;
        if (n.glow > 0.05) {
          ctx.fillStyle = `rgba(${EMER_HI},${0.1 * n.glow * intensity})`;
          ctx.beginPath();
          ctx.arc(n.px, n.py, r + 7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(${n.glow > 0.3 ? EMER_HI : EMER},${a})`;
        ctx.beginPath();
        ctx.arc(n.px, n.py, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4) pulses — bright dots routing along edges
      for (let k = pulses.length - 1; k >= 0; k--) {
        const p = pulses[k];
        if (animate) p.t += p.speed;
        const a = nodes[p.a];
        const b = nodes[p.b];
        if (!a || !b) {
          pulses.splice(k, 1);
          continue;
        }
        const t = Math.min(1, p.t);
        const x = a.px + (b.px - a.px) * t;
        const y = a.py + (b.py - a.py) * t;
        ctx.fillStyle = `rgba(${EMER_HI},${0.12 * intensity})`;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${EMER_HI},${0.95 * intensity})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, Math.PI * 2);
        ctx.fill();
        if (p.t >= 1) {
          // chain onward a hop or two so "work" routes through the graph
          if (p.hops < 2) {
            const nb = nearest(p.b);
            if (nb >= 0) {
              pulses.push({
                a: p.b,
                b: nb,
                t: 0,
                speed: p.speed,
                hops: p.hops + 1,
              });
            }
          }
          pulses.splice(k, 1);
        }
      }
    };

    if (reduce) {
      // single static frame — wired graph, no motion
      frame(start, false);
      return () => {
        ro.disconnect();
        io.disconnect();
        window.removeEventListener("pointermove", onMove);
      };
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible) {
        last = now;
        return;
      }
      const dt = now - last;
      last = now;
      // spawn pulses on a gentle cadence (~ every 520ms)
      acc += dt;
      if (acc > 520) {
        acc = 0;
        spawnPulse();
      }
      frame(now, true);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, [intensity, density]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}
    />
  );
}
