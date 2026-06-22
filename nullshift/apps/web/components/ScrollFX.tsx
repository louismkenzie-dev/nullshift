"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  motion,
  useTransform,
  useMotionValueEvent,
  useReducedMotion,
} from "framer-motion";
import { T } from "@nullshift/ui/tokens";
import { useScrollProgress, type OffsetPair } from "./useScrollProgress";

type Range = [number, number];

/* ────────────────────────────────────────────────────────────────
   ScrollFX — map an element's scroll progress (through the viewport)
   to any of translate / scale / opacity / rotate. The workhorse for
   "shrink the logo / expand the image / fade as it passes" effects.
   Reduced-motion disables transform (opacity still allowed).
   ──────────────────────────────────────────────────────────────── */
export function ScrollFX({
  children,
  className = "",
  style,
  y,
  scale,
  opacity,
  rotate,
  offset = ["start end", "end start"],
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  y?: Range;
  scale?: Range;
  opacity?: Range;
  rotate?: Range;
  offset?: [OffsetPair, OffsetPair];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const scrollYProgress = useScrollProgress(ref, offset);
  const yV = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : (y ?? [0, 0]));
  const sV = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : (scale ?? [1, 1]));
  const oV = useTransform(scrollYProgress, [0, 1], opacity ?? [1, 1]);
  const rV = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : (rotate ?? [0, 0]));
  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ ...style, y: yV, scale: sV, opacity: oV, rotate: rV }}
    >
      {children}
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────
   ScrollStory — a pinned "story beat" section (Fusion / Archar
   pattern). A heading stays anchored while the beats scrub past it
   one at a time as you scroll. Degrades to a static stacked list on
   mobile / under reduced-motion.
   ──────────────────────────────────────────────────────────────── */
export type Beat = {
  n: string;
  title: string;
  desc: string;
};

export function ScrollStory({
  index,
  label,
  heading,
  beats,
}: {
  index?: string;
  label: string;
  heading: React.ReactNode;
  beats: Beat[];
}) {
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

  const scrollYProgress = useScrollProgress(ref, ["start start", "end end"]);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const i = Math.min(
      beats.length - 1,
      Math.max(0, Math.floor(v * beats.length + 0.0001))
    );
    setActive(i);
  });

  const Eyebrow = (
    <span
      className="inline-flex items-center"
      style={{
        gap: 8,
        fontFamily: T.mono,
        fontSize: "0.74rem",
        fontWeight: 500,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--k-fg)",
      }}
    >
      {index && <span style={{ color: "var(--k-accent)" }}>[{index}]</span>}
      <span>{label}</span>
    </span>
  );

  /* Static fallback — plain stacked list */
  if (!pinned) {
    return (
      <div>
        <div style={{ marginBottom: 20 }}>{Eyebrow}</div>
        <div
          style={{
            fontFamily: T.sans,
            fontWeight: 700,
            fontSize: "clamp(2rem,4.4vw,3rem)",
            lineHeight: 1.06,
            letterSpacing: "-0.03em",
            textTransform: "uppercase",
            color: "var(--k-fg)",
          }}
        >
          {heading}
        </div>
        <div
          className="mt-10 grid grid-cols-1 sm:grid-cols-2"
          style={{
            borderTop: "1px solid var(--k-border)",
            borderLeft: "1px solid var(--k-border)",
          }}
        >
          {beats.map((b) => (
            <div
              key={b.n}
              className="flex flex-col gap-3 p-6 md:p-8"
              style={{
                borderRight: "1px solid var(--k-border)",
                borderBottom: "1px solid var(--k-border)",
              }}
            >
              <span
                style={{
                  fontFamily: T.mono,
                  fontWeight: 500,
                  fontSize: "1.5rem",
                  color: "var(--k-accent)",
                }}
              >
                {b.n}
              </span>
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
                {b.title}
              </h3>
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.9rem",
                  lineHeight: 1.5,
                  color: "var(--k-muted)",
                }}
              >
                {b.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* Pinned scrub — desktop */
  return (
    <div
      ref={ref}
      style={{ height: `${beats.length * 78 + 30}vh`, position: "relative" }}
    >
      <div className="sticky flex items-center" style={{ top: 0, height: "100vh" }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full items-center">
          {/* anchored heading + step indicator */}
          <div>
            <div style={{ marginBottom: 20 }}>{Eyebrow}</div>
            <div
              style={{
                fontFamily: T.sans,
                fontWeight: 700,
                fontSize: "clamp(2rem,4.4vw,3.2rem)",
                lineHeight: 1.04,
                letterSpacing: "-0.03em",
                textTransform: "uppercase",
                color: "var(--k-fg)",
              }}
            >
              {heading}
            </div>

            {/* step rail */}
            <div className="mt-10 flex flex-col gap-3">
              {beats.map((b, i) => (
                <div key={b.n} className="flex items-center gap-3">
                  <span
                    style={{
                      width: 28,
                      height: 2,
                      background:
                        i <= active ? "var(--k-accent)" : "var(--k-border-strong)",
                      transition: "background 0.4s ease",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.72rem",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: i === active ? "var(--k-fg)" : "var(--k-faint)",
                      transition: "color 0.4s ease",
                    }}
                  >
                    {b.n} · {b.title}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* scrubbing beat panel */}
          <div className="relative" style={{ minHeight: "clamp(320px,42vh,460px)" }}>
            {beats.map((b, i) => {
              const delta = i - active;
              const visible = i === active;
              return (
                <div
                  key={b.n}
                  className="absolute inset-0 flex flex-col justify-center p-8 md:p-10"
                  style={{
                    border: "1px solid var(--k-border)",
                    background: "var(--k-surface)",
                    opacity: visible ? 1 : 0,
                    transform: `translateY(${visible ? 0 : delta < 0 ? -24 : 24}px)`,
                    transition:
                      "opacity 0.45s cubic-bezier(.16,1,.3,1), transform 0.45s cubic-bezier(.16,1,.3,1)",
                    pointerEvents: visible ? "auto" : "none",
                  }}
                >
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontWeight: 800,
                      fontSize: "clamp(3rem,7vw,5.5rem)",
                      lineHeight: 0.9,
                      letterSpacing: "-0.03em",
                      color: "var(--k-accent)",
                    }}
                  >
                    {b.n}
                  </span>
                  <h3
                    className="mt-5"
                    style={{
                      fontFamily: T.sans,
                      fontWeight: 700,
                      fontSize: "clamp(1.4rem,2.4vw,2rem)",
                      letterSpacing: "-0.02em",
                      textTransform: "uppercase",
                      color: "var(--k-fg)",
                    }}
                  >
                    {b.title}
                  </h3>
                  <p
                    className="mt-4"
                    style={{
                      fontFamily: T.sans,
                      fontSize: "1rem",
                      lineHeight: 1.55,
                      color: "var(--k-muted)",
                      maxWidth: "44ch",
                    }}
                  >
                    {b.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   PinnedReveal — the section anchors (pins) in place, and the
   information ACCUMULATES as you keep scrolling: each item slides /
   fades up and STAYS, building the full list while pinned. A heading
   + progress rail stay anchored on the left. Degrades to a static
   stacked list on mobile / under reduced-motion.
   ──────────────────────────────────────────────────────────────── */
export type RevealItem = { n?: string; title: string; desc: string };

export function PinnedReveal({
  index,
  label,
  heading,
  lead,
  items,
}: {
  index?: string;
  label: string;
  heading: React.ReactNode;
  lead?: React.ReactNode;
  items: RevealItem[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [pinned, setPinned] = useState(false);
  const [revealed, setRevealed] = useState(1);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setPinned(mq.matches && !reduce);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [reduce]);

  const scrollYProgress = useScrollProgress(ref, ["start start", "end end"]);
  // reveal everything across the first ~82% of the scrub, then dwell on the full list
  const SPAN = 0.82;
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const n = Math.floor((v / SPAN) * items.length) + 1;
    setRevealed(Math.max(1, Math.min(items.length, n)));
  });
  const fill = useTransform(scrollYProgress, [0, SPAN], ["0%", "100%"]);

  const num = (it: RevealItem, i: number) => it.n ?? String(i + 1).padStart(2, "0");

  const Eyebrow = (
    <span
      className="inline-flex items-center"
      style={{
        gap: 8,
        fontFamily: T.mono,
        fontSize: "0.74rem",
        fontWeight: 500,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--k-fg)",
      }}
    >
      {index && <span style={{ color: "var(--k-accent)" }}>[{index}]</span>}
      <span>{label}</span>
    </span>
  );

  const Heading = (
    <div
      style={{
        fontFamily: T.sans,
        fontWeight: 700,
        fontSize: "clamp(2rem,4.4vw,3.2rem)",
        lineHeight: 1.04,
        letterSpacing: "-0.03em",
        textTransform: "uppercase",
        color: "var(--k-fg)",
      }}
    >
      {heading}
    </div>
  );

  const Item = ({ it, i, on }: { it: RevealItem; i: number; on: boolean }) => (
    <div
      className="flex items-start gap-5 md:gap-7 p-6 md:p-7"
      style={{
        borderLeft: `2px solid ${on ? "var(--k-accent)" : "var(--k-border)"}`,
        background: on ? "var(--k-surface)" : "transparent",
        opacity: on ? 1 : 0,
        transform: `translateY(${on ? 0 : 22}px)`,
        transition:
          "opacity 0.55s cubic-bezier(.16,1,.3,1), transform 0.55s cubic-bezier(.16,1,.3,1), background 0.55s ease, border-color 0.55s ease",
      }}
    >
      <span
        style={{
          fontFamily: T.sans,
          fontWeight: 800,
          fontSize: "clamp(1.8rem,3vw,2.6rem)",
          lineHeight: 0.9,
          letterSpacing: "-0.03em",
          color: "var(--k-accent)",
          flexShrink: 0,
        }}
      >
        {num(it, i)}
      </span>
      <div>
        <h3
          style={{
            fontFamily: T.sans,
            fontWeight: 700,
            fontSize: "clamp(1.1rem,1.7vw,1.4rem)",
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            color: "var(--k-fg)",
          }}
        >
          {it.title}
        </h3>
        <p
          className="mt-2"
          style={{
            fontFamily: T.sans,
            fontSize: "0.95rem",
            lineHeight: 1.5,
            color: "var(--k-muted)",
            maxWidth: "48ch",
          }}
        >
          {it.desc}
        </p>
      </div>
    </div>
  );

  /* Static fallback — plain stacked list */
  if (!pinned) {
    return (
      <div>
        <div style={{ marginBottom: 20 }}>{Eyebrow}</div>
        {Heading}
        {lead && (
          <p
            className="mt-6"
            style={{
              fontFamily: T.sans,
              fontSize: "1.0625rem",
              lineHeight: 1.5,
              color: "var(--k-muted)",
              maxWidth: "52ch",
            }}
          >
            {lead}
          </p>
        )}
        <div className="mt-10 flex flex-col gap-3">
          {items.map((it, i) => (
            <Item key={num(it, i)} it={it} i={i} on />
          ))}
        </div>
      </div>
    );
  }

  /* Pinned accumulate — desktop */
  return (
    <div
      ref={ref}
      style={{ height: `${items.length * 64 + 40}vh`, position: "relative" }}
    >
      <div className="sticky flex items-center" style={{ top: 0, height: "100vh" }}>
        <div className="grid grid-cols-1 lg:grid-cols-[0.82fr_1.18fr] gap-12 w-full items-center">
          {/* anchored heading + progress */}
          <div>
            <div style={{ marginBottom: 20 }}>{Eyebrow}</div>
            {Heading}
            {lead && (
              <p
                className="mt-6"
                style={{
                  fontFamily: T.sans,
                  fontSize: "1.0625rem",
                  lineHeight: 1.5,
                  color: "var(--k-muted)",
                  maxWidth: "44ch",
                }}
              >
                {lead}
              </p>
            )}
            <div className="mt-10 flex items-center gap-4">
              <div
                style={{
                  position: "relative",
                  width: 2,
                  height: 64,
                  background: "var(--k-border-strong)",
                }}
              >
                <motion.div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: fill,
                    background: "var(--k-accent)",
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.72rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--k-muted)",
                }}
              >
                {String(revealed).padStart(2, "0")} /{" "}
                {String(items.length).padStart(2, "0")}
              </span>
            </div>
          </div>

          {/* accumulating list */}
          <div className="flex flex-col gap-3">
            {items.map((it, i) => (
              <Item key={num(it, i)} it={it} i={i} on={i < revealed} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
