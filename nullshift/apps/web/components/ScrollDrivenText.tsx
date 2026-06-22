"use client";

import React, { useRef } from "react";
import { motion, useTransform, useReducedMotion } from "framer-motion";
import { T } from "@nullshift/ui/tokens";
import { useScrollProgress } from "./useScrollProgress";

/* ════════════════════════════════════════════════════════════════
   Scroll-driven horizontal text (ANIM 11) — a big line that drifts
   right→left as the section passes through the viewport, mapped from
   vertical scroll progress. Reduced motion renders it static.
   ════════════════════════════════════════════════════════════════ */
export function ScrollDrivenText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const progress = useScrollProgress(ref, ["start end", "end start"]);
  const x = useTransform(progress, [0, 1], reduce ? ["0%", "0%"] : ["12%", "-18%"]);

  return (
    <div ref={ref} className={className} style={{ overflow: "hidden" }}>
      <motion.div
        style={{
          x,
          fontFamily: T.sans,
          fontWeight: 800,
          fontSize: "clamp(2.2rem,7vw,6rem)",
          lineHeight: 1.0,
          letterSpacing: "-0.03em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          color: "var(--k-fg)",
        }}
      >
        {text}
      </motion.div>
    </div>
  );
}
