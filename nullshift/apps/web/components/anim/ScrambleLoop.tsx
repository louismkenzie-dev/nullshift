"use client";

import { useEffect, useState } from "react";

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#@$%&";
const TICK_MS = 42;

/**
 * Looping decode scramble for loading states — the sibling of ScrambleHover.
 * The word repeatedly locks in left→right out of glyph noise, rests briefly,
 * then dissolves and decodes again, for as long as it's mounted.
 * prefers-reduced-motion → static text.
 */
export function ScrambleLoop({
  text,
  className = "",
  style,
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplay(text);
      return;
    }
    const DECODE_TICKS = 26; // ticks to fully lock the word
    const REST_TICKS = 14; // ticks the resolved word holds before dissolving
    let tick = 0;
    const id = setInterval(() => {
      tick = (tick + 1) % (DECODE_TICKS + REST_TICKS);
      if (tick >= DECODE_TICKS) {
        setDisplay(text);
        return;
      }
      const locked = Math.floor((tick / DECODE_TICKS) * text.length);
      setDisplay(
        text
          .split("")
          .map((ch, i) => {
            if (ch === " ") return " ";
            if (i < locked) return ch;
            return CHARSET[Math.floor(Math.random() * CHARSET.length)];
          })
          .join("")
      );
    }, TICK_MS);
    return () => clearInterval(id);
  }, [text]);

  return (
    <span className={className} style={style} aria-label={text} role="status">
      {display}
    </span>
  );
}
