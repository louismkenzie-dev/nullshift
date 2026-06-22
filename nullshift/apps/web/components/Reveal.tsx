"use client";

import React, { useEffect, useRef, useState } from "react";

export function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          io.unobserve(el);
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, visible };
}

type Dir = "up" | "down" | "left" | "right" | "none";

const OFFSETS: Record<Dir, [number, number]> = {
  up: [0, 40],
  down: [0, -40],
  left: [40, 0],
  right: [-40, 0],
  none: [0, 0],
};

/**
 * Apple-grade scroll reveal: content rises into place while a soft blur
 * resolves to sharp and a subtle scale settles to 1. Easing is easeOutExpo
 * (cubic-bezier(.16,1,.3,1)) — the slow, weighty settle Apple uses on its
 * product pages. Fires once when scrolled into view.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  direction = "up",
  distance,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  direction?: Dir;
  distance?: number;
}) {
  const { ref, visible } = useReveal();
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Reduced motion: render the final state, no transform / blur / fade.
  if (reduced) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  let [tx, ty] = OFFSETS[direction];
  if (distance !== undefined) {
    tx = tx === 0 ? 0 : Math.sign(tx) * distance;
    ty = ty === 0 ? 0 : Math.sign(ty) * distance;
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible
          ? "translate3d(0,0,0) scale(1)"
          : `translate3d(${tx}px, ${ty}px, 0) scale(0.965)`,
        filter: visible ? "blur(0px)" : "blur(12px)",
        willChange: "opacity, transform, filter",
        transition: [
          `opacity 0.7s var(--ease-out-expo) ${delay}s`,
          `transform 0.95s var(--ease-out-expo) ${delay}s`,
          `filter 0.7s var(--ease-out-expo) ${delay}s`,
        ].join(", "),
      }}
    >
      {children}
    </div>
  );
}
