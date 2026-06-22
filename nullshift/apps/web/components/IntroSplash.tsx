"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { T } from "@nullshift/ui/tokens";

/* ════════════════════════════════════════════════════════════════
   Intro splash — a minimalistic node-network that wires up a couple
   of connections (at the static-mark's scale) and then resolves into
   the NULLSHIFT wordmark. Plays on every landing, refresh and page
   change (no once-per-session gating). Click anywhere to skip.
   ════════════════════════════════════════════════════════════════ */

const WORD = "NULLSHIFT";

// Small node cluster (viewBox 0 0 140 140) — the size of the static mark.
const NODES: { x: number; y: number; accent?: boolean }[] = [
  { x: 70, y: 70, accent: true }, // 0 — hub
  { x: 26, y: 40 }, //               1
  { x: 112, y: 30 }, //              2
  { x: 116, y: 98 }, //              3
  { x: 40, y: 110 }, //              4
  { x: 100, y: 74, accent: true }, // 5
];
// A couple of connections — kept sparse.
const LINKS: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 5],
  [5, 3],
  [1, 4],
];
const PULSE: [number, number] = [0, 5]; // edge the data-pulse routes along

const BONE = "#f4f4e8";
const HIDE_MS = 1550;

export function IntroSplash() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [show, setShow] = useState(true);
  const [run, setRun] = useState(0);
  const first = useRef(true);

  // Trigger on mount (land / refresh) and on every pathname change.
  useEffect(() => {
    if (!first.current) {
      setShow(true);
      setRun((r) => r + 1);
    }
    first.current = false;
    const t = setTimeout(() => setShow(false), reduce ? 750 : HIDE_MS);
    return () => clearTimeout(t);
  }, [pathname, reduce]);

  const t = (delay: number, duration: number) =>
    reduce
      ? { duration: 0.001, delay: 0 }
      : { delay, duration, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={run}
          aria-hidden
          onClick={() => setShow(false)}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.76, 0, 0.24, 1] }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "#0a0a0a",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 30,
            overflow: "hidden",
          }}
        >
          {/* node-network */}
          <svg
            viewBox="0 0 140 140"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              width: "clamp(118px,22vw,168px)",
              height: "auto",
              overflow: "visible",
            }}
          >
            {/* connections draw in */}
            {LINKS.map(([a, b], i) => (
              <motion.line
                key={i}
                x1={NODES[a].x}
                y1={NODES[a].y}
                x2={NODES[b].x}
                y2={NODES[b].y}
                stroke={BONE}
                strokeOpacity={0.32}
                strokeWidth={1.2}
                initial={{ pathLength: reduce ? 1 : 0 }}
                animate={{ pathLength: 1 }}
                transition={t(0.28 + i * 0.1, 0.5)}
              />
            ))}
            {/* nodes pop in */}
            {NODES.map((n, i) => (
              <motion.circle
                key={i}
                cx={n.x}
                cy={n.y}
                r={i === 0 ? 5.5 : 3.4}
                fill={n.accent ? T.primary : BONE}
                initial={{ scale: reduce ? 1 : 0, opacity: reduce ? 1 : 0 }}
                animate={{ scale: 1, opacity: n.accent ? 1 : 0.85 }}
                transition={t(i * 0.08, 0.4)}
                style={{ transformOrigin: `${n.x}px ${n.y}px` }}
              />
            ))}
            {/* one emerald data-pulse routes an edge */}
            {!reduce && (
              <motion.circle
                r={3}
                fill={T.primaryHover}
                initial={{ cx: NODES[PULSE[0]].x, cy: NODES[PULSE[0]].y, opacity: 0 }}
                animate={{
                  cx: [NODES[PULSE[0]].x, NODES[PULSE[1]].x],
                  cy: [NODES[PULSE[0]].y, NODES[PULSE[1]].y],
                  opacity: [0, 1, 1, 0],
                }}
                transition={{ delay: 0.8, duration: 0.7, ease: "easeInOut" }}
              />
            )}
          </svg>

          {/* NULLSHIFT forms */}
          <div
            style={{
              display: "flex",
              fontFamily: T.sans,
              fontWeight: 800,
              fontSize: "clamp(1.9rem,7vw,3.4rem)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: BONE,
              lineHeight: 1,
            }}
          >
            {WORD.split("").map((ch, i) => (
              <motion.span
                key={i}
                initial={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : 9 }}
                animate={{ opacity: 1, y: 0 }}
                transition={t(0.72 + i * 0.045, 0.4)}
              >
                {ch}
              </motion.span>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
