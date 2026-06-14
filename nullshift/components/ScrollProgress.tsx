"use client";

import { motion, useScroll, useSpring } from "framer-motion";
import { T } from "@/lib/tokens";

/**
 * Hairline scroll-progress indicator pinned to the top of the viewport.
 * Spring-smoothed so it trails the scroll with a touch of inertia —
 * the subtle premium cue Apple uses to signal "you're moving through this".
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    mass: 0.3,
  });

  return (
    <motion.div
      aria-hidden
      style={{
        scaleX,
        transformOrigin: "0%",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: 300,
        background: `linear-gradient(90deg, ${T.primary}, ${T.primaryHover} 60%, ${T.accent})`,
        boxShadow: `0 0 12px ${T.primary}88`,
      }}
    />
  );
}
