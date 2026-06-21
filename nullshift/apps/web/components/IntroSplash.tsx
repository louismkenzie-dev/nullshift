"use client";

import { useEffect, useRef, useState } from "react";
import { T } from "@nullshift/ui/tokens";
import { Logo } from "@nullshift/ui/components/Logo";

/* ════════════════════════════════════════════════════════════════
   Intro splash — an on-brand "systems boot" screen.
   • FULL version plays once per session on first landing (no buttons,
     auto-dismisses, then wipes up to reveal the site).
   • SHORT version flashes when the user returns to the tab.
   Client-side navigation does not replay it (the layout stays mounted).
   ════════════════════════════════════════════════════════════════ */

const GRID_COLS = 14;
const GRID_ROWS = 7;
const CELLS = GRID_COLS * GRID_ROWS;

const STATUS = [
  "Initialising systems",
  "Wiring automations",
  "Connecting the build",
  "Ready",
];

export function IntroSplash() {
  const [show, setShow] = useState(true);
  const [mode, setMode] = useState<"full" | "short">("full");
  const [leaving, setLeaving] = useState(false);
  const [step, setStep] = useState(0);
  const busy = useRef(false);

  // Decide on first mount: full once per session, else skip.
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("ns-intro") === "1";
    } catch {
      /* ignore */
    }
    if (seen && !location.search.includes("introforce")) {
      setShow(false);
      return;
    }
    busy.current = true;
    const dur = 2500;
    const stepTimers = STATUS.map((_, i) =>
      setTimeout(() => setStep(i), (dur / STATUS.length) * i)
    );
    const leave = setTimeout(() => setLeaving(true), dur);
    const done = setTimeout(() => {
      setShow(false);
      busy.current = false;
      try {
        sessionStorage.setItem("ns-intro", "1");
      } catch {
        /* ignore */
      }
    }, dur + 620);
    return () => {
      stepTimers.forEach(clearTimeout);
      clearTimeout(leave);
      clearTimeout(done);
    };
  }, []);

  // Short flash when returning to the tab.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible" || busy.current) return;
      busy.current = true;
      setMode("short");
      setLeaving(false);
      setShow(true);
      setTimeout(() => setLeaving(true), 850);
      setTimeout(() => {
        setShow(false);
        busy.current = false;
      }, 1300);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  if (!show) return null;

  const isFull = mode === "full";

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "#0a0a0a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        transform: leaving ? "translateY(-100%)" : "translateY(0)",
        transition: "transform 0.6s cubic-bezier(0.76,0,0.24,1)",
      }}
    >
      {/* systems dot-grid backdrop */}
      {isFull && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
            opacity: 0.5,
            maskImage: "radial-gradient(60% 60% at 50% 50%, transparent 22%, #000 80%)",
            WebkitMaskImage:
              "radial-gradient(60% 60% at 50% 50%, transparent 22%, #000 80%)",
          }}
        >
          {Array.from({ length: CELLS }).map((_, i) => (
            <div
              key={i}
              style={{
                borderRight: "1px solid rgba(244,244,232,0.05)",
                borderBottom: "1px solid rgba(244,244,232,0.05)",
                position: "relative",
              }}
            >
              <span
                className="ns-intro-cell"
                style={{
                  position: "absolute",
                  inset: "30%",
                  background: T.primary,
                  animation: `ns-intro-cell 2.4s ease-in-out ${(i % GRID_COLS) * 0.09 + Math.floor(i / GRID_COLS) * 0.05}s infinite`,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* center lockup */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 22,
          animation: "ns-intro-pop 0.6s cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        <div className="flex items-center gap-3">
          <Logo markSize={isFull ? 40 : 30} />
        </div>
        <div
          style={{
            fontFamily: T.sans,
            fontWeight: 800,
            fontSize: isFull ? "clamp(2.2rem,7vw,4rem)" : "clamp(1.6rem,6vw,2.4rem)",
            letterSpacing: "-0.03em",
            textTransform: "uppercase",
            color: "#f4f4e8",
            lineHeight: 1,
          }}
        >
          Nullshift
        </div>

        {isFull && (
          <>
            {/* progress bar */}
            <div
              style={{
                width: "min(280px, 60vw)",
                height: 2,
                background: "rgba(244,244,232,0.12)",
                overflow: "hidden",
                marginTop: 4,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: "100%",
                  background: T.primary,
                  transformOrigin: "left",
                  animation: "ns-intro-bar 2.5s cubic-bezier(0.4,0,0.2,1) both",
                }}
              />
            </div>
            {/* status line */}
            <div
              key={step}
              className="inline-flex items-center gap-2.5"
              style={{
                fontFamily: T.mono,
                fontSize: "0.72rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#9a9a90",
                animation: "ns-intro-line 0.4s ease both",
                minHeight: 16,
              }}
            >
              <span
                className="ns-intro-blink"
                style={{
                  width: 7,
                  height: 7,
                  background: T.primary,
                  animation: "ns-intro-blink 0.9s ease-in-out infinite",
                }}
              />
              {STATUS[step]}
              {step === STATUS.length - 1 && <span style={{ color: T.primary }}>✓</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
