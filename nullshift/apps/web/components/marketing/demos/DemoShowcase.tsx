"use client";

import React, { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { T } from "@nullshift/ui/tokens";
import { DeviceFrame } from "../DeviceFrame";
import { useDemoScript, useOnScreen, type DemoStep } from "./engine";

/** The showcase block: browser chrome, the scripted demo inside it, and a
 *  step rail underneath that both narrates and drives the script. */
export function DemoShowcase({
  steps,
  url,
  caption,
  tint,
  eyebrow,
  title,
  children,
}: {
  steps: DemoStep[];
  url?: string | null;
  caption: string;
  tint?: string;
  /** e.g. "Reproduced from their codebase" */
  eyebrow: string;
  /** e.g. "Amie's pricing engine" */
  title: string;
  /** `clock` changes whenever the script restarts — key sub-step timers on it. */
  children: (step: number, clock: string) => React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(wrapRef);
  const [hover, setHover] = useState(false);
  const [hidden, setHidden] = useState(false);

  React.useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const { step, goTo, reduce, epoch } = useDemoScript(steps, {
    active: onScreen && !hidden,
    paused: hover,
  });
  const clock = `${epoch}:${step}`;
  const current = steps[step];

  return (
    <div ref={wrapRef}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div
            style={{
              fontFamily: T.mono,
              fontSize: "0.66rem",
              fontWeight: 500,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--k-accent)",
            }}
          >
            {eyebrow}
          </div>
          <h3
            style={{
              fontFamily: T.sans,
              fontWeight: 700,
              fontSize: "1.3rem",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              color: "var(--k-fg)",
              margin: "6px 0 0",
            }}
          >
            {title}
          </h3>
        </div>
        <div
          style={{
            fontFamily: T.mono,
            fontSize: "0.62rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--k-faint)",
          }}
        >
          {reduce
            ? "Step through with the rail"
            : hover
              ? "Paused · hover to inspect"
              : "Playing · hover to pause"}
        </div>
      </div>

      <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <DeviceFrame url={url} caption={caption} tint={tint}>
          {children(step, clock)}
        </DeviceFrame>
      </div>

      {/* Step rail */}
      <ol
        className="mt-4 grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
          listStyle: "none",
          padding: 0,
          margin: "16px 0 0",
        }}
        aria-label="Demo steps"
      >
        {steps.map((s, i) => {
          const on = i === step;
          const done = i < step;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-current={on ? "step" : undefined}
                className="w-full text-left"
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "inherit",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: "block",
                    height: 2,
                    background: on || done ? "var(--k-accent)" : "var(--k-border)",
                    opacity: done && !on ? 0.5 : 1,
                    transition: "background 300ms ease, opacity 300ms ease",
                  }}
                />
                <span
                  className="mt-2 block"
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.62rem",
                    fontWeight: 500,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: on ? "var(--k-fg)" : "var(--k-faint)",
                    transition: "color 300ms ease",
                  }}
                >
                  {String(i + 1).padStart(2, "0")} · {s.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Caption */}
      <div style={{ minHeight: 48, marginTop: 10 }} aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={current.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            style={{
              fontFamily: T.sans,
              fontSize: "0.92rem",
              lineHeight: 1.55,
              color: "var(--k-muted)",
              margin: 0,
              maxWidth: "78ch",
            }}
          >
            <span style={{ color: "var(--k-fg)", fontWeight: 600 }}>
              {current.label}.{" "}
            </span>
            {current.caption}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
