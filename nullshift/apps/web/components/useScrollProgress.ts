"use client";

import { useEffect } from "react";
import { useMotionValue, type MotionValue } from "framer-motion";

/* ────────────────────────────────────────────────────────────────
   useScrollProgress — a Lenis-proof replacement for framer-motion's
   useScroll({ target }). framer v12 drives useScroll from the native
   ScrollTimeline, which does NOT track Lenis' smooth scroll, so every
   scrub silently stays at 0. This reads getBoundingClientRect on each
   scroll frame (Lenis scrolls the window natively, so plain scroll
   events fire) and returns a MotionValue<0..1> — a drop-in for
   useTransform / useMotionValueEvent.

   offset mirrors framer's syntax: [ "<targetEdge> <viewportEdge>",
   "<targetEdge> <viewportEdge>" ] where each edge is start|center|end.
   Progress is 0 at the first pair and 1 at the second.
   ──────────────────────────────────────────────────────────────── */

type Edge = "start" | "center" | "end";
export type OffsetPair = `${Edge} ${Edge}`;

const edgeVal = (e: string) =>
  e === "start" ? 0 : e === "center" ? 0.5 : e === "end" ? 1 : parseFloat(e) || 0;

export function useScrollProgress(
  ref: React.RefObject<HTMLElement | null>,
  offset: [OffsetPair, OffsetPair] = ["start end", "end start"]
): MotionValue<number> {
  const progress = useMotionValue(0);
  const o0 = offset[0];
  const o1 = offset[1];

  useEffect(() => {
    const [t0, c0] = o0.split(" ");
    const [t1, c1] = o1.split(" ");
    const te0 = edgeVal(t0);
    const ce0 = edgeVal(c0);
    const te1 = edgeVal(t1);
    const ce1 = edgeVal(c1);

    let raf = 0;
    let alive = true;
    // Continuous rAF: reads ref.current live every frame, so it works no
    // matter when the element mounts (pinned sections attach late) and it
    // tracks Lenis' smooth scroll natively. Skips work when far off-screen.
    const tick = () => {
      if (!alive) return;
      raf = requestAnimationFrame(tick);
      const node = ref.current;
      if (!node) return;
      const r = node.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      if (r.bottom < -vh || r.top > vh * 2) return; // far outside viewport
      const h = r.height;
      // f(edge) = targetEdgePos - viewportEdgePos, linear in r.top.
      const f0 = r.top + te0 * h - ce0 * vh;
      const f1 = r.top + te1 * h - ce1 * vh;
      const denom = f0 - f1 || 1;
      let p = f0 / denom;
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      progress.set(p);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref, o0, o1, progress]);

  return progress;
}
