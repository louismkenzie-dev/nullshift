"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  motion,
  useTransform,
  useMotionValueEvent,
  useReducedMotion,
} from "framer-motion";
import { T } from "@nullshift/ui/tokens";
import { useScrollProgress } from "./useScrollProgress";

export type Step = { num: string; title: string; desc: string };

/* ════════════════════════════════════════════════════════════════
   Process timeline (ANIM 12) — a scroll-stepped progress bar with a
   ruler and N step columns. As you scroll the pinned section the bar
   fills left→right and the active column lights (filled dot, accent
   underline, full opacity) while past columns read "done" and future
   ones dim. Degrades to a static full-bar grid on mobile / reduced.
   ════════════════════════════════════════════════════════════════ */
export function ProcessTimeline({ steps }: { steps: Step[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [pinned, setPinned] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setPinned(mq.matches && !reduce);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [reduce]);

  const progress = useScrollProgress(ref, ["start start", "end end"]);
  const fill = useTransform(progress, [0, 1], ["0%", "100%"]);
  useMotionValueEvent(progress, "change", (v) => {
    const i = Math.min(
      steps.length - 1,
      Math.max(0, Math.floor(v * steps.length + 0.0001))
    );
    setActive(i);
  });

  const Bar = ({ animated }: { animated: boolean }) => (
    <div>
      <div style={{ position: "relative", height: 3, background: "var(--k-border)" }}>
        {animated ? (
          <motion.div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: "100%",
              width: fill,
              background: "var(--k-accent)",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--k-accent)",
            }}
          />
        )}
      </div>
      {/* ruler ticks */}
      <div
        aria-hidden
        style={{
          height: 10,
          marginTop: 1,
          backgroundImage:
            "repeating-linear-gradient(90deg, var(--k-border-strong) 0, var(--k-border-strong) 1px, transparent 1px, transparent 24px)",
        }}
      />
    </div>
  );

  const Columns = ({
    activeIdx,
    scrubbing,
  }: {
    activeIdx: number;
    scrubbing: boolean;
  }) => (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      style={{
        borderTop: "1px solid var(--k-border)",
        borderLeft: "1px solid var(--k-border)",
      }}
    >
      {steps.map((s, i) => {
        const state = i < activeIdx ? "past" : i === activeIdx ? "current" : "future";
        return (
          <div
            key={s.num}
            className="flex flex-col gap-3 p-6 md:p-8"
            style={{
              borderRight: "1px solid var(--k-border)",
              borderBottom: "1px solid var(--k-border)",
              opacity: scrubbing && state === "future" ? 0.4 : 1,
              transition: "opacity 0.4s var(--ease-out-expo)",
            }}
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  border: `2px solid ${state === "future" ? "var(--k-border-strong)" : "var(--k-accent)"}`,
                  background:
                    state === "current"
                      ? "var(--k-accent)"
                      : state === "past"
                        ? "var(--k-border-strong)"
                        : "transparent",
                  transition: "background 0.4s ease, border-color 0.4s ease",
                }}
              />
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.72rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--k-muted)",
                }}
              >
                {s.num}
              </span>
            </div>
            <h3
              style={{
                fontFamily: T.sans,
                fontWeight: 700,
                fontSize: "clamp(1.1rem,1.6vw,1.4rem)",
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
                color: "var(--k-fg)",
              }}
            >
              {s.title}
            </h3>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.88rem",
                lineHeight: 1.5,
                color: "var(--k-muted)",
              }}
            >
              {s.desc}
            </p>
            <div
              style={{
                height: 2,
                width: 48,
                marginTop: "auto",
                background: state === "current" ? "var(--k-accent)" : "transparent",
                transition: "background 0.4s ease",
              }}
            />
          </div>
        );
      })}
    </div>
  );

  /* Static fallback — full bar, all columns lit */
  if (!pinned) {
    return (
      <div>
        <Bar animated={false} />
        <div className="mt-6">
          <Columns activeIdx={steps.length - 1} scrubbing={false} />
        </div>
      </div>
    );
  }

  /* Pinned scrub — desktop */
  return (
    <div
      ref={ref}
      style={{ height: `${steps.length * 60 + 40}vh`, position: "relative" }}
    >
      <div
        className="sticky flex flex-col justify-center"
        style={{ top: 0, minHeight: "100vh" }}
      >
        <Bar animated />
        <div className="mt-8">
          <Columns activeIdx={active} scrubbing />
        </div>
      </div>
    </div>
  );
}
