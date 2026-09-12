"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, useReducedMotion } from "framer-motion";

/* ────────────────────────────────────────────────────────────────
   Live-demo engine — the shared machinery under every client demo.

   A demo is a scripted walk-through of a real screen, reproduced from the
   client's codebase and driven by the client's own logic. The engine gives
   each demo:

   • useDemoScript — a step index that advances on a timer while the demo
     is on screen, pauses on hover / off-screen / hidden tab, and can be
     driven by the step rail. Reduced motion: no auto-advance, the last
     step is shown, the rail still works.
   • ScaledStage — a fixed logical canvas (e.g. 960 × 600) scaled to the
     container width, so a screen designed once looks identical at every
     breakpoint. Below `compactBelow` px the demo is asked to render its
     stacked layout on a narrower canvas instead of shrinking to nothing.
   • Cursor — a fake pointer that glides to whichever element the current
     step "clicks", so the motion reads as a person using the product.
   ──────────────────────────────────────────────────────────────── */

export type DemoStep = {
  id: string;
  /** Rail label, e.g. "Choose a plan". */
  label: string;
  /** One line under the stage explaining what the code just did. */
  caption: string;
  /** How long to hold this step before advancing (ms). */
  hold?: number;
};

export type DemoProps = {
  /** Current step index. */
  step: number;
  /** True when the narrow canvas is in use. */
  compact: boolean;
  /** Register the element the fake cursor should sit on for this step. */
  cursorTo: (el: HTMLElement | null) => void;
};

/* ── Visibility ─────────────────────────────────────────────────── */

export function useOnScreen<T extends Element>(
  ref: React.RefObject<T | null>,
  margin = "-10% 0px"
) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), {
      rootMargin: margin,
      threshold: 0.25,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);
  return on;
}

/* ── Script ─────────────────────────────────────────────────────── */

export function useDemoScript(
  steps: DemoStep[],
  opts: { active: boolean; paused: boolean; defaultHold?: number; loopDelay?: number }
) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(reduce ? Math.max(0, steps.length - 1) : 0);
  const [userDriven, setUserDriven] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const wasActive = useRef(false);
  const { active, paused, defaultHold = 3200, loopDelay = 4200 } = opts;

  // Entering the viewport restarts the script from the top, so a visitor who
  // scrolls down late still sees the first beat play rather than its aftermath.
  useEffect(() => {
    if (active && !wasActive.current) {
      setStep(reduce ? Math.max(0, steps.length - 1) : 0);
      setUserDriven(false);
      setEpoch((e) => e + 1);
    }
    wasActive.current = active;
  }, [active, reduce, steps.length]);

  useEffect(() => {
    if (reduce || !active || paused || userDriven) return;
    const last = step >= steps.length - 1;
    const hold = last ? loopDelay : (steps[step]?.hold ?? defaultHold);
    const t = window.setTimeout(() => setStep((s) => (s + 1) % steps.length), hold);
    return () => window.clearTimeout(t);
  }, [reduce, active, paused, userDriven, step, steps, defaultHold, loopDelay]);

  // A manual pick holds for a while, then the script resumes from there.
  useEffect(() => {
    if (!userDriven) return;
    const t = window.setTimeout(() => setUserDriven(false), 9000);
    return () => window.clearTimeout(t);
  }, [userDriven, step]);

  const goTo = useCallback((i: number) => {
    setStep(i);
    setUserDriven(true);
  }, []);

  /** Changes whenever the script restarts; key sub-step clocks on `${epoch}:${step}`. */
  return { step, goTo, reduce, epoch };
}

/* ── Scaled stage ───────────────────────────────────────────────── */

export function ScaledStage({
  width,
  height,
  compactWidth,
  compactHeight,
  compactBelow = 640,
  children,
  background,
}: {
  width: number;
  height: number;
  compactWidth: number;
  compactHeight: number;
  /** Container widths below this use the compact canvas. */
  compactBelow?: number;
  children: (compact: boolean) => React.ReactNode;
  background?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(width);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setCw(el.clientWidth || width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  const compact = cw < compactBelow;
  const w = compact ? compactWidth : width;
  const h = compact ? compactHeight : height;
  const scale = Math.min(1, cw / w);

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: "100%",
        height: Math.round(h * scale),
        overflow: "hidden",
        background,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: w,
          height: h,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children(compact)}
      </div>
    </div>
  );
}

/* ── Fake cursor ────────────────────────────────────────────────── */

type CursorTarget = { x: number; y: number; visible: boolean };

const CursorCtx = createContext<{
  stageRef: React.RefObject<HTMLDivElement | null>;
  set: (t: CursorTarget) => void;
} | null>(null);

/** Wrap the demo canvas; call `cursorTo(el)` from a step to glide there. */
export function CursorLayer({
  children,
  color = "#111",
}: {
  children: (cursorTo: (el: HTMLElement | null) => void) => React.ReactNode;
  color?: string;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState<CursorTarget>({ x: 40, y: 40, visible: false });
  const [pressed, setPressed] = useState(false);
  const reduce = useReducedMotion();

  const cursorTo = useCallback(
    (el: HTMLElement | null) => {
      const stage = stageRef.current;
      if (!el || !stage) {
        setT((c) => ({ ...c, visible: false }));
        return;
      }
      const s = stage.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      // Rects are in screen px; the stage may be scaled, so convert back to
      // canvas units by dividing by the stage's rendered scale.
      const scale = s.width / (stage.offsetWidth || s.width);
      const x = (r.left - s.left + r.width * 0.5) / scale;
      const y = (r.top - s.top + r.height * 0.55) / scale;
      setT({ x, y, visible: !reduce });
      setPressed(false);
      const press = window.setTimeout(() => setPressed(true), 650);
      const release = window.setTimeout(() => setPressed(false), 850);
      return () => {
        window.clearTimeout(press);
        window.clearTimeout(release);
      };
    },
    [reduce]
  );

  const ctx = useMemo(() => ({ stageRef, set: setT }), []);

  return (
    <CursorCtx.Provider value={ctx}>
      <div ref={stageRef} style={{ position: "relative", width: "100%", height: "100%" }}>
        {children(cursorTo)}
        <motion.div
          aria-hidden
          initial={false}
          animate={{
            x: t.x,
            y: t.y,
            opacity: t.visible ? 1 : 0,
            scale: pressed ? 0.85 : 1,
          }}
          transition={{
            x: { type: "spring", stiffness: 120, damping: 20, mass: 0.6 },
            y: { type: "spring", stiffness: 120, damping: 20, mass: 0.6 },
            opacity: { duration: 0.25 },
            scale: { duration: 0.12 },
          }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 22,
            height: 26,
            marginLeft: -3,
            marginTop: -2,
            pointerEvents: "none",
            zIndex: 50,
            filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))",
          }}
        >
          <svg width="22" height="26" viewBox="0 0 22 26" fill="none">
            <path
              d="M2 2l6.5 19 3.2-7.4L19 10.8 2 2z"
              fill={color}
              stroke="#fff"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          {pressed && (
            <span
              style={{
                position: "absolute",
                left: -9,
                top: -9,
                width: 22,
                height: 22,
                borderRadius: 999,
                border: `2px solid ${color}`,
                opacity: 0.5,
              }}
            />
          )}
        </motion.div>
      </div>
    </CursorCtx.Provider>
  );
}

export function useCursorCtx() {
  return useContext(CursorCtx);
}

/* ── Small shared helpers ───────────────────────────────────────── */

/** Milliseconds since `key` last changed, ticking every 100 ms — lets a
 *  step sequence its own beats (click → bubble → stream) by elapsed time.
 *  Reduced motion reports a very large number so every beat is "done". */
export function useElapsed(key: unknown): number {
  const reduce = useReducedMotion();
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (reduce) {
      setMs(1e9);
      return;
    }
    setMs(0);
    const start = performance.now();
    const id = window.setInterval(() => setMs(performance.now() - start), 100);
    return () => window.clearInterval(id);
  }, [key, reduce]);
  return ms;
}

/** Tween a number towards `value` for animated totals. */
export function useTweenNumber(value: number, ms = 600) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduce) {
      setV(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setV(a + (value - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, reduce]);
  return v;
}

export const gbp = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

/** Typewriter for chat-style demos. */
export function useTypewriter(text: string, active: boolean, cps = 38) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(active && reduce ? text.length : 0);
  useEffect(() => {
    if (!active) {
      setN(0);
      return;
    }
    if (reduce) {
      setN(text.length);
      return;
    }
    setN(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) window.clearInterval(id);
    }, 1000 / cps);
    return () => window.clearInterval(id);
  }, [text, active, cps, reduce]);
  return text.slice(0, n);
}
