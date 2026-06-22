"use client";

import React, { useEffect, useRef, useState } from "react";

/** Splits "£3.0K" → { prefix:"£", target:3, decimals:1, suffix:"K" }.
 *  Handles thousands separators too: "£4,200" → target 4200, grouped true. */
function parse(value: string) {
  const m = value.match(/^(\D*?)([\d,]+(?:\.\d+)?)(\D*)$/);
  if (!m) return null;
  const [, prefix, digits, suffix] = m;
  const clean = digits.replace(/,/g, "");
  if (!/\d/.test(clean)) return null;
  const dot = clean.indexOf(".");
  return {
    prefix,
    suffix,
    target: parseFloat(clean),
    decimals: dot === -1 ? 0 : clean.length - dot - 1,
    grouped: digits.includes(","),
  };
}

// easeOutCubic — fast start, gentle settle.
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Counts a numeric value up from 0 the first time it scrolls into view.
 * SSR-safe (initial render === `value`), one-shot (IntersectionObserver
 * threshold 0.5), and honours prefers-reduced-motion by rendering the final
 * value with no animation. Non-numeric values (e.g. "Weeks") render unchanged.
 */
export function CountUp({
  value,
  durationMs = 1500,
  className,
  style,
}: {
  value: string;
  durationMs?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number | null>(null);
  const [display, setDisplay] = useState(value);

  const parsed = parse(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || !parsed) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return; // keep final `value` from initial render

    const { prefix, suffix, target, decimals, grouped } = parsed;
    const format = (n: number) =>
      `${prefix}${
        grouped
          ? n.toLocaleString("en-GB", {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            })
          : n.toFixed(decimals)
      }${suffix}`;

    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        setDisplay(format(target * ease(t)));
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
      };
      setDisplay(format(0));
      rafRef.current = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          io.unobserve(el);
          run();
        }
      },
      { threshold: 0.5 }
    );
    io.observe(el);

    return () => {
      io.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // value drives parse(); duration changes re-arm the animation.
  }, [value, durationMs]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span ref={ref} className={className} style={style}>
      {parsed ? display : value}
    </span>
  );
}
