"use client";

import React, { useEffect, useRef, useState } from "react";

type El = "span" | "div" | "p";

const DEFAULT_CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#@$%&";

const TICK_MS = 30;

/**
 * Kyma decode/glitch effect: text resolves out of random characters, each
 * non-space glyph cycling through `charset` and locking left→right until the
 * string settles exactly on `text` by `durationMs`. Fires once when scrolled
 * into view (IntersectionObserver, threshold 0.4, one-shot). SSR-safe — the
 * initial render is the final text, so SSR === first client paint; scrambling
 * begins on the next frame. prefers-reduced-motion renders `text` and skips it.
 */
export function ScrambleText({
  text,
  as = "span",
  className = "",
  style,
  durationMs = 480,
  charset = DEFAULT_CHARSET,
  startOnView = true,
}: {
  text: string;
  as?: El;
  className?: string;
  style?: React.CSSProperties;
  durationMs?: number;
  charset?: string;
  startOnView?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  // Initial render is the final text → SSR matches the first client paint.
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setDisplay(text);
      return;
    }

    let interval: ReturnType<typeof setInterval> | null = null;
    let start = 0;
    const chars = charset.length > 0 ? charset : DEFAULT_CHARSET;

    const rand = () => chars[Math.floor(Math.random() * chars.length)];

    const tick = () => {
      const elapsed = performance.now() - start;
      const progress = durationMs > 0 ? Math.min(elapsed / durationMs, 1) : 1;
      // Characters lock in left→right as progress advances.
      const locked = Math.floor(progress * text.length);
      let out = "";
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === " " || i < locked) out += ch;
        else out += rand();
      }
      setDisplay(out);
      if (progress >= 1) {
        setDisplay(text);
        if (interval) clearInterval(interval);
        interval = null;
      }
    };

    const run = () => {
      start = performance.now();
      tick();
      interval = setInterval(tick, TICK_MS);
    };

    let raf = 0;
    let io: IntersectionObserver | null = null;

    if (startOnView) {
      io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            io?.unobserve(el);
            run();
          }
        },
        { threshold: 0.4 }
      );
      io.observe(el);
    } else {
      // Start as early as possible after mount (one final-text frame is fine).
      raf = requestAnimationFrame(run);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (raf) cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [text, charset, durationMs, startOnView]);

  const Tag = as as React.ElementType;
  return (
    <Tag ref={ref} className={className} style={style}>
      {display}
    </Tag>
  );
}
