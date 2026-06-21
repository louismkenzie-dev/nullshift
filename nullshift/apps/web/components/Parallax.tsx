"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";

/**
 * Scroll parallax — drifts its children vertically as the element passes
 * through the viewport. Respects prefers-reduced-motion (no drift). Used on
 * the big decorative watermarks / accents to add depth without distraction.
 */
export function Parallax({
  children,
  distance = 60,
  className = "",
  style,
}: {
  children: React.ReactNode;
  /** total vertical travel in px across the scroll range */
  distance?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    reduce ? [0, 0] : [distance, -distance]
  );

  return (
    <motion.div ref={ref} className={className} style={{ ...style, y }}>
      {children}
    </motion.div>
  );
}
