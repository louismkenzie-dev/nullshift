"use client";

import React, { useEffect, useRef, useState } from "react";

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#@$%&";
const TICK_MS = 28;

/**
 * Hover-driven scramble: the label decodes from its resting `text` into
 * `hoverText` (characters lock left→right) while the enclosing control is
 * hovered or focused, then scrambles back to `text` on leave/blur. Listeners
 * attach to the nearest enclosing button/anchor (via closest) so hovering
 * anywhere on the control triggers it — not just the glyphs themselves.
 *
 * Display is React state (not imperative DOM writes) so frequent parent
 * re-renders — e.g. the nav's live clock — never clobber a scramble mid-flight.
 * `aria-label` always exposes the resting `text` to assistive tech.
 * prefers-reduced-motion → instant swap, no scramble.
 */
export function ScrambleHover({
  text,
  hoverText,
  className = "",
  style,
  durationMs = 360,
}: {
  text: string;
  hoverText?: string;
  className?: string;
  style?: React.CSSProperties;
  durationMs?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(text);
  const target = hoverText ?? text;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const host = (el.closest("button, a") as HTMLElement | null) ?? el;

    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let interval: ReturnType<typeof setInterval> | null = null;
    let start = 0;
    let current = text; // the word we're currently resting on / heading toward

    const rand = () => CHARSET[Math.floor(Math.random() * CHARSET.length)];
    const stop = () => {
      if (interval) clearInterval(interval);
      interval = null;
    };

    const morph = (toStr: string) => {
      stop();
      if (reduced) {
        setDisplay(toStr);
        return;
      }
      start = performance.now();
      const len = Math.max(current.length, toStr.length);
      const tick = () => {
        const p =
          durationMs > 0 ? Math.min((performance.now() - start) / durationMs, 1) : 1;
        const locked = Math.floor(p * len);
        let out = "";
        for (let i = 0; i < len; i++) {
          const ch = toStr[i] ?? "";
          out += i < locked || ch === " " ? ch : rand();
        }
        setDisplay(out);
        if (p >= 1) {
          setDisplay(toStr);
          stop();
        }
      };
      tick();
      interval = setInterval(tick, TICK_MS);
    };

    const onEnter = () => {
      if (current === target) return;
      morph(target);
      current = target;
    };
    const onLeave = () => {
      if (current === text) return;
      morph(text);
      current = text;
    };

    host.addEventListener("pointerenter", onEnter);
    host.addEventListener("pointerleave", onLeave);
    host.addEventListener("focusin", onEnter);
    host.addEventListener("focusout", onLeave);

    return () => {
      stop();
      host.removeEventListener("pointerenter", onEnter);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("focusin", onEnter);
      host.removeEventListener("focusout", onLeave);
      setDisplay(text);
    };
  }, [text, target, durationMs]);

  return (
    <span ref={ref} className={className} style={style} aria-label={text}>
      {display}
    </span>
  );
}
