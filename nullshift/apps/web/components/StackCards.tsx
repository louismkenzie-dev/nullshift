"use client";

import React, { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import { T } from "@nullshift/ui/tokens";

/**
 * Scroll-stacking capability cards. Each card pins to the viewport and the next
 * slides up and layers over it; the cards beneath scale down a touch so the
 * stack reads with depth (the Olivier Larose sticky-stack pattern). Cards are
 * frosted-glass panels so the WebGL field flows behind the gaps. Honours
 * prefers-reduced-motion by falling back to a plain stacked column.
 */
export type StackTile = {
  Asset: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  nn: string;
  label: string;
  title: string;
  caption: string;
};

const STICK_TOP = 96; // px below the top edge where cards pin (clears the nav)

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: T.mono,
        fontSize: "0.72rem",
        fontWeight: 500,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: T.primary,
      }}
    >
      {children}
    </span>
  );
}

function CardInner({ tile }: { tile: StackTile }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 h-full" style={{ gap: 0 }}>
      {/* Left — copy */}
      <div className="flex flex-col justify-center p-8 md:p-12">
        <div className="mb-5 flex items-center gap-3">
          <Eyebrow>{`// ${tile.nn}`}</Eyebrow>
          <span
            style={{
              height: 1,
              width: 28,
              background: `${T.primary}55`,
              display: "inline-block",
            }}
          />
          <Eyebrow>{tile.label}</Eyebrow>
        </div>
        <h3
          style={{
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: "clamp(1.6rem,3vw,2.4rem)",
            letterSpacing: "-0.025em",
            lineHeight: 1.08,
            color: T.fg,
          }}
        >
          {tile.title}
        </h3>
        <p
          className="mt-4"
          style={{
            fontFamily: T.sans,
            fontSize: "1rem",
            lineHeight: 1.6,
            letterSpacing: "-0.005em",
            color: T.muted,
            maxWidth: "42ch",
          }}
        >
          {tile.caption}
        </p>
      </div>

      {/* Right — animated brand asset */}
      <div
        className="relative hidden md:flex items-center justify-center overflow-hidden"
        style={{
          borderLeft: `1px solid ${T.border}`,
          background:
            "radial-gradient(120% 100% at 80% 20%, rgba(16,185,129,0.10), transparent 60%)",
        }}
      >
        <tile.Asset style={{ height: "78%", minHeight: 0, width: "82%" }} />
      </div>
    </div>
  );
}

function StickyCard({
  tile,
  i,
  total,
  progress,
}: {
  tile: StackTile;
  i: number;
  total: number;
  progress: MotionValue<number>;
}) {
  // Earlier cards settle to a slightly smaller scale as later ones cover them.
  const targetScale = 1 - (total - 1 - i) * 0.045;
  const start = i / total;
  const scale = useTransform(progress, [start, 1], [1, targetScale]);

  return (
    <div
      style={{
        position: "sticky",
        top: STICK_TOP,
        height: "82vh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
      }}
    >
      <motion.article
        style={{
          scale,
          top: i * 26, // stagger the stack so edges peek out
          position: "relative",
          width: "100%",
          maxWidth: 1040,
          height: "min(70vh, 560px)",
          transformOrigin: "top center",
          borderRadius: T.r.xl,
          border: `1px solid ${T.border}`,
          background: "rgba(18,19,26,0.72)",
          backdropFilter: "blur(14px) saturate(1.1)",
          WebkitBackdropFilter: "blur(14px) saturate(1.1)",
          boxShadow: `0 30px 80px -30px rgba(0,0,0,0.7), 0 0 0 1px ${T.primary}0d, 0 0 60px -30px ${T.primary}55`,
          overflow: "hidden",
        }}
      >
        <CardInner tile={tile} />
      </motion.article>
    </div>
  );
}

export function StackCards({ tiles }: { tiles: StackTile[] }) {
  const container = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: container,
    offset: ["start start", "end end"],
  });

  // Reduced-motion / no-JS-friendly fallback: a plain bordered column.
  if (reduced) {
    return (
      <div
        style={{
          borderTop: `1px solid ${T.border}`,
          borderLeft: `1px solid ${T.border}`,
        }}
      >
        {tiles.map((tile) => (
          <article
            key={tile.nn}
            style={{
              borderRight: `1px solid ${T.border}`,
              borderBottom: `1px solid ${T.border}`,
              background: T.surface,
              minHeight: 320,
            }}
          >
            <CardInner tile={tile} />
          </article>
        ))}
      </div>
    );
  }

  return (
    <div ref={container} style={{ position: "relative" }}>
      {tiles.map((tile, i) => (
        <StickyCard
          key={tile.nn}
          tile={tile}
          i={i}
          total={tiles.length}
          progress={scrollYProgress}
        />
      ))}
    </div>
  );
}
