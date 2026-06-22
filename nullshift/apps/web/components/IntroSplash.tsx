"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { T } from "@nullshift/ui/tokens";
import { ScrambleText } from "@/components/anim/ScrambleText";

/* ════════════════════════════════════════════════════════════════
   Intro splash (ANIM 1) — a full-viewport emerald screen with the
   wordmark + tagline. Holds briefly on first landing / refresh, then
   slides UP off-screen (ease-in-expo) to reveal the hero beneath.
   Client-side route changes are handled by the page-transition wipe,
   not the splash, so this fires once per load. Click anywhere to skip.
   ════════════════════════════════════════════════════════════════ */

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const; // snappy arrive
const EASE_IN_EXPO = [0.76, 0, 0.24, 1] as const; // aggressive depart

const HOLD_MS = 1400;
const HOLD_REDUCED_MS = 700;

export function IntroSplash() {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(true);

  // Hold, then begin the exit. Runs once on mount (landing / refresh).
  // Signal the nav (and anything else gated on the intro) when we lift.
  useEffect(() => {
    const id = setTimeout(
      () => {
        setShow(false);
        window.dispatchEvent(new Event("ns:intro-done"));
      },
      reduce ? HOLD_REDUCED_MS : HOLD_MS
    );
    return () => clearTimeout(id);
  }, [reduce]);

  // Lock body scroll while the splash covers the viewport.
  useEffect(() => {
    if (!show) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [show]);

  // Stagger-in transition for the centred content.
  const enter = (delay: number, duration: number) =>
    reduce ? { duration: 0.001, delay: 0 } : { delay, duration, ease: EASE_OUT_EXPO };
  const offset = (y: number) => (reduce ? 0 : y);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          aria-hidden
          data-intro-splash=""
          onClick={() => {
            setShow(false);
            window.dispatchEvent(new Event("ns:intro-done"));
          }}
          initial={{ y: 0 }}
          exit={
            reduce
              ? { opacity: 0, transition: { duration: 0.2 } }
              : { y: "-100%", transition: { duration: 0.55, ease: EASE_IN_EXPO } }
          }
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: T.primary,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            overflow: "hidden",
            willChange: "transform",
          }}
        >
          {/* Wordmark */}
          <motion.div
            initial={{ opacity: reduce ? 1 : 0, y: offset(8) }}
            animate={{ opacity: 1, y: 0 }}
            transition={enter(0.1, 0.45)}
            style={{
              fontFamily: T.sans,
              fontWeight: 800,
              fontSize: "clamp(1.9rem,7vw,3.4rem)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: T.primaryFg,
              lineHeight: 1,
            }}
          >
            <ScrambleText
              as="span"
              text="NULLSHIFT"
              startOnView={false}
              durationMs={700}
              charset="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@$%&"
            />
            <sup style={{ fontSize: "0.42em", fontWeight: 600, marginLeft: "0.05em" }}>
              ®
            </sup>
          </motion.div>

          {/* Tagline */}
          <motion.div
            initial={{ opacity: reduce ? 1 : 0, y: offset(6) }}
            animate={{ opacity: 1, y: 0 }}
            transition={enter(0.3, 0.4)}
            style={{
              fontFamily: T.mono,
              fontSize: "clamp(0.6rem,1.4vw,0.72rem)",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(10,11,15,0.72)",
            }}
          >
            Agentic AI · Automation · Systems
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
