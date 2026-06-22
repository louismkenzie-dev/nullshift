"use client";

import React, { useEffect, useState } from "react";
import { useReveal } from "../Reveal";

/** True once mounted if the user prefers reduced motion. SSR-safe: starts false
 * (matching the animated branch's server render), flips on the client effect. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * Premium Kyma headline reveal: a clip-masked line-rise. The outer block
 * clips its overflow and reserves the child's height (no layout shift); the
 * inner wrapper starts pushed down 115% with 0 opacity and rises into place
 * on easeOutExpo (cubic-bezier(.16,1,.3,1)) the first time it enters view.
 * Wrap a whole multi-line heading and the block rises as one. Fires once.
 * prefers-reduced-motion renders the final state instantly, overflow visible.
 */
export function ClipReveal({
  children,
  delay = 0,
  durationMs = 700,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  durationMs?: number;
  className?: string;
}) {
  const { ref, visible } = useReveal(0.2);
  const reduced = usePrefersReducedMotion();

  // Reduced motion: render the final state instantly — no clip, no transform.
  if (reduced) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <div ref={ref} className={className} style={{ overflow: "hidden" }}>
      <div
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(115%)",
          willChange: "opacity, transform",
          transition: [
            `opacity ${durationMs}ms cubic-bezier(.16,1,.3,1) ${delay}s`,
            `transform ${durationMs}ms cubic-bezier(.16,1,.3,1) ${delay}s`,
          ].join(", "),
        }}
      >
        {children}
      </div>
    </div>
  );
}
