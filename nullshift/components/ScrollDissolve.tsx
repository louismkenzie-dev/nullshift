"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform, MotionValue } from "framer-motion";

/**
 * Wraps a block so that, as it scrolls up and out of view, it gently recedes
 * into depth — scaling back, drifting up, softening to a blur and fading out.
 * This is the Apple "the hero dissolves as the story begins" opening move.
 *
 * Tied to the element's own scroll position (offset start→end against the top
 * of the viewport), so it works with Lenis smooth scrolling out of the box.
 */
export function ScrollDissolve({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.55, 0.85], [1, 0.55, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);
  const y = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const blurAmt: MotionValue<number> = useTransform(scrollYProgress, [0, 0.7], [0, 9]);
  const filter = useTransform(blurAmt, (b) => `blur(${b}px)`);

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ opacity, scale, y, filter, willChange: "transform, opacity, filter" }}
    >
      {children}
    </motion.div>
  );
}
