"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { T } from "@/lib/tokens";
import { scoreLead, type Answers } from "@/lib/funnel";
import { funnelSound } from "@/lib/funnelAudio";

type Scored = ReturnType<typeof scoreLead>;

const LINES = [
  "Reading your answers",
  "Matching our playbook",
  "Scoping the right build",
  "Building your recommendation",
];

/** Stage 3 — the perceived-value bridge. A cinematic "analysing" screen that
 *  is *skip-proof*: there is no control to advance. It auto-resolves only once
 *  the animation timeline completes, and the real recommendation is computed
 *  up front (`scoreLead`). Honours prefers-reduced-motion. */
export function HoldScreen({ answers, onResult }: { answers: Answers; onResult: (r: Scored) => void }) {
  const result = useMemo(() => scoreLead(answers), [answers]);
  const [pct, setPct] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    funnelSound.holdEnter();
    const DURATION = reduced ? 650 : 2700;
    const start = performance.now();
    let raf = 0;
    let lastLine = -1;

    const finish = () => {
      if (done.current) return;
      done.current = true;
      funnelSound.resolve(result.segment === "qualified");
      onResult(result);
    };

    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / DURATION);
      const eased = 1 - Math.pow(1 - p, 2);
      setPct(Math.round(eased * 100));
      const li = Math.min(LINES.length - 1, Math.floor(p * LINES.length));
      if (li !== lastLine) {
        lastLine = li;
        setLineIdx(li);
        if (!reduced) funnelSound.holdBeat(li);
      }
      if (p < 1) raf = requestAnimationFrame(tick);
      else finish();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const R = 54;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - pct / 100);

  return (
    <div className="ns-funnel-enter flex flex-col items-center text-center">
      <div style={{ position: "relative", width: 150, height: 150 }}>
        <div className="ns-hold-core" />
        <svg width="150" height="150" viewBox="0 0 150 150" style={{ position: "relative" }}>
          <circle cx="75" cy="75" r={R} fill="none" stroke={T.border} strokeWidth="2" />
          <circle
            cx="75"
            cy="75"
            r={R}
            fill="none"
            stroke={T.primary}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            transform="rotate(-90 75 75)"
            style={{ filter: `drop-shadow(0 0 6px ${T.primary})`, transition: "stroke-dashoffset .12s linear" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: T.mono, fontSize: 24, fontWeight: 600, color: T.fg }}>{pct}%</span>
        </div>
      </div>

      <span className="mt-9" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}>
        Analysing
      </span>
      <h1
        aria-live="polite"
        className="mt-3"
        style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(1.6rem,4.8vw,2.4rem)", lineHeight: 1.1, letterSpacing: "-0.03em", color: T.fg, minHeight: "1.2em" }}
      >
        {LINES[lineIdx]}…
      </h1>
      <p className="mt-3 max-w-[38ch]" style={{ fontFamily: T.sans, fontSize: "0.9rem", lineHeight: 1.6, color: T.muted }}>
        Cross-referencing your answers with what actually works for businesses like yours.
      </p>
    </div>
  );
}
