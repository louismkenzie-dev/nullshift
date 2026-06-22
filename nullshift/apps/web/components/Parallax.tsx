"use client";

import React, { useRef } from "react";
import { motion, useTransform, useReducedMotion } from "framer-motion";
import { useScrollProgress } from "./useScrollProgress";

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
  const scrollYProgress = useScrollProgress(ref, ["start end", "end start"]);
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
