"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/motion";
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

/* ── Failsafe ──────────────────────────────────────────────────────
   The splash covers the viewport and locks the page, and both are
   undone by JavaScript: a timer lifts it, an effect cleanup restores
   scroll. That is fine until the main thread stalls or dies — a heavy
   third-party scene compiling, a script throwing mid-hydration — at
   which point the timer never fires and the visitor is left staring
   at a solid emerald screen with the whole site sealed behind it.
   So the browser is given the same instructions in pure CSS: the
   splash slides away on its own at FAILSAFE_MS, and the scroll lock
   releases just after. Neither needs a single line of JS to run. In
   the normal case React has unmounted all of this seconds earlier and
   none of it is ever seen. A loading screen must never be able to
   trap the site. */
const FAILSAFE_MS = 4000;
const UNLOCK_MS = FAILSAFE_MS + 400;

const FAILSAFE_CSS = `
@keyframes ns-intro-failsafe {
  to { transform: translateY(-100%); visibility: hidden; pointer-events: none; }
}
@keyframes ns-intro-unlock { to { overflow: visible; } }
body[data-intro-lock] {
  overflow: hidden;
  animation: ns-intro-unlock 0.01s linear ${UNLOCK_MS}ms forwards;
}
@media (prefers-reduced-motion: reduce) {
  [data-intro-splash] { display: none !important; }
  body[data-intro-lock] { overflow: visible; animation: none; }
}`;

export function IntroSplash() {
  // The homepage already opens in darkness with its own introduction. Do not
  // put a timed loading screen or a body-scroll lock in front of it.
  const pathname = usePathname();
  const [initialPath] = useState(pathname);
  // Consume the introduction once per layout lifetime, including homepage entry.
  // Navigating from Home to Book must not mount a new timed splash.
  // A direct project-enquiry link should open immediately, without a sales-flow delay.
  return initialPath === "/" || initialPath === "/book" ? null : (
    <IntroSplashAnimation suppressed={pathname !== initialPath} />
  );
}

function IntroSplashAnimation({ suppressed }: { suppressed: boolean }) {
  const reduce = usePrefersReducedMotion();
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

  // Lock body scroll while the splash covers the viewport. The lock lives on
  // an attribute rather than an inline style so the CSS above can release it
  // on its own timeline if we never get the chance to.
  useEffect(() => {
    if (
      !show ||
      suppressed ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    document.body.setAttribute("data-intro-lock", "");
    return () => {
      document.body.removeAttribute("data-intro-lock");
    };
  }, [show, suppressed]);

  // Stagger-in transition for the centred content.
  const enter = (delay: number, duration: number) =>
    reduce ? { duration: 0.001, delay: 0 } : { delay, duration, ease: EASE_OUT_EXPO };
  const offset = (y: number) => (reduce ? 0 : y);

  return (
    <AnimatePresence>
      {show && !suppressed && (
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
            // Delay-phase only until FAILSAFE_MS; `forwards` (not `both`) means
            // it applies nothing while it waits, so framer owns the transform
            // for the entire normal lifetime of the splash.
            animation: `ns-intro-failsafe 0.4s ${FAILSAFE_MS}ms cubic-bezier(0.76,0,0.24,1) forwards`,
          }}
        >
          <style>{FAILSAFE_CSS}</style>

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
