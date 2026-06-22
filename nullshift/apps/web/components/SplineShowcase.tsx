"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { SplineLazy } from "./SplineLazy";
import { useScrollProgress } from "./useScrollProgress";
import { Container, Eyebrow, Display, Lead } from "@/components/kyma";
import { T } from "@nullshift/ui/tokens";
import type { Application } from "@splinetool/runtime";

type Rotatable = { rotation: { x: number; y: number; z: number } };
export type ShowcaseItem = { n: string; title: string; desc: string };

const clamp = (n: number, a = 0, b = 1) => (n < a ? a : n > b ? b : n);

/* ════════════════════════════════════════════════════════════════
   SplineShowcase — a full-bleed Spline scene as the flagship of a
   pinned section. Choreography across the scroll:
     • 0–14%  : the scene fades + scales in (the moment you arrive)
     • all    : the object rotates (3D) and the canvas drifts (CSS)
     • 8%+    : the heading rises in
     • 34%+   : the cards fade + slide up one by one, layered on top
   The canvas is edge-masked into --k-bg (no box), with a legibility
   scrim that fades in under the copy. Reduced-motion → static.
   `side` = which side the copy sits (scene drifts the other way).
   ════════════════════════════════════════════════════════════════ */
export function SplineShowcase({
  scene,
  objectName,
  index,
  label,
  heading,
  lead,
  items,
  side = "left",
  rotate = 1.0,
}: {
  scene: string;
  objectName: string;
  index?: string;
  label: string;
  heading: React.ReactNode;
  lead?: React.ReactNode;
  items: ShowcaseItem[];
  side?: "left" | "right";
  rotate?: number; // radians of Y rotation across the scroll
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const sceneWrapRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const objRef = useRef<Rotatable | null>(null);
  const baseY = useRef(0);
  const baseX = useRef(0);
  const reduce = useReducedMotion();
  const [headingOn, setHeadingOn] = useState(false);
  const [revealed, setRevealed] = useState(0);

  const progress = useScrollProgress(
    sectionRef,
    reduce ? ["start end", "end start"] : ["start start", "end end"]
  );

  useEffect(() => {
    if (reduce) {
      setHeadingOn(true);
      setRevealed(items.length);
      return;
    }
    const dir = side === "left" ? 1 : -1;
    const unsub = progress.on("change", (v) => {
      // scene — real 3D rotation + a slight tilt
      const o = objRef.current;
      if (o) {
        try {
          o.rotation.y = baseY.current + v * rotate * 1.5;
          o.rotation.x = baseX.current + Math.sin(v * Math.PI) * 0.1;
          appRef.current?.requestRender?.();
        } catch {
          /* runtime hiccup — ignore */
        }
      }
      // scene — enter (fade + scale), then drift aside to make room for copy
      const enter = clamp(v / 0.14);
      const drift = clamp((v - 0.3) / 0.5);
      const w = sceneWrapRef.current;
      if (w) {
        w.style.opacity = String(enter);
        w.style.transform = `translateX(${dir * drift * 7}vw) scale(${1.07 - enter * 0.07 - drift * 0.05})`;
      }
      // scrim fades in under the copy
      if (scrimRef.current)
        scrimRef.current.style.opacity = String(clamp((v - 0.24) / 0.22));
      // copy — heading early, cards after the scene's intro
      setHeadingOn(v > 0.08);
      const r = (v - 0.34) / 0.56;
      setRevealed(r <= 0 ? 0 : Math.min(items.length, Math.floor(r * items.length) + 1));
    });
    return () => unsub();
  }, [progress, reduce, rotate, items.length, side]);

  const onReady = (app: Application) => {
    appRef.current = app;
    try {
      const o = app.findObjectByName(objectName) as unknown as Rotatable | undefined;
      if (o) {
        objRef.current = o;
        baseY.current = o.rotation.y;
        baseX.current = o.rotation.x;
      }
    } catch {
      /* findObjectByName can throw on some scenes — degrade to no rotation */
    }
  };

  const dirScrim =
    side === "left"
      ? "linear-gradient(90deg, var(--k-bg) 0%, rgba(10,10,10,0.7) 26%, rgba(10,10,10,0) 60%)"
      : "linear-gradient(270deg, var(--k-bg) 0%, rgba(10,10,10,0.7) 26%, rgba(10,10,10,0) 60%)";

  const Backdrop = (
    <>
      {/* scene — positioned by THIS wrapper (SplineLazy fills it) so it never collapses */}
      <div
        ref={sceneWrapRef}
        className="absolute"
        style={{
          inset: "-7%",
          opacity: reduce ? 1 : 0,
          willChange: "transform, opacity",
        }}
      >
        <SplineLazy scene={scene} onReady={onReady} className="w-full h-full" />
      </div>
      {/* radial edge-fade — melts the canvas into the section */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          background:
            "radial-gradient(ellipse 82% 86% at 50% 47%, transparent 34%, var(--k-bg) 88%)",
        }}
      />
      {/* top + bottom blend into neighbouring sections */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          background:
            "linear-gradient(180deg, var(--k-bg) 0%, transparent 15%, transparent 85%, var(--k-bg) 100%)",
        }}
      />
      {/* directional legibility scrim — fades in with the copy */}
      <div
        ref={scrimRef}
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 1, opacity: reduce ? 1 : 0, background: dirScrim }}
      />
    </>
  );

  const Item = ({ it, on }: { it: ShowcaseItem; on: boolean }) => (
    <div
      className="flex items-start gap-4 p-4 md:p-5"
      style={{
        borderLeft: `2px solid ${on ? "var(--k-accent)" : "transparent"}`,
        background: on ? "rgba(10,10,10,0.45)" : "transparent",
        backdropFilter: on ? "blur(6px)" : undefined,
        WebkitBackdropFilter: on ? "blur(6px)" : undefined,
        opacity: on ? 1 : 0,
        transform: `translate(${on ? 0 : side === "left" ? -26 : 26}px, ${on ? 0 : 20}px)`,
        transition:
          "opacity 0.55s cubic-bezier(.16,1,.3,1), transform 0.55s cubic-bezier(.16,1,.3,1), background 0.55s ease, border-color 0.55s ease",
      }}
    >
      <span
        style={{
          fontFamily: T.sans,
          fontWeight: 800,
          fontSize: "clamp(1.3rem,2vw,1.9rem)",
          lineHeight: 0.9,
          letterSpacing: "-0.03em",
          color: "var(--k-accent)",
          flexShrink: 0,
        }}
      >
        {it.n}
      </span>
      <div>
        <h3
          style={{
            fontFamily: T.sans,
            fontWeight: 700,
            fontSize: "clamp(1rem,1.4vw,1.25rem)",
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            color: "var(--k-fg)",
          }}
        >
          {it.title}
        </h3>
        <p
          className="mt-1.5"
          style={{
            fontFamily: T.sans,
            fontSize: "0.9rem",
            lineHeight: 1.5,
            color: "var(--k-muted)",
            maxWidth: "42ch",
          }}
        >
          {it.desc}
        </p>
      </div>
    </div>
  );

  const Copy = (
    <div
      className="w-full flex"
      style={{ justifyContent: side === "left" ? "flex-start" : "flex-end" }}
    >
      <div style={{ maxWidth: "34rem", textShadow: "0 1px 30px rgba(10,10,10,0.55)" }}>
        <div
          style={{
            opacity: headingOn ? 1 : 0,
            transform: `translateY(${headingOn ? 0 : 18}px)`,
            transition:
              "opacity 0.7s cubic-bezier(.16,1,.3,1), transform 0.7s cubic-bezier(.16,1,.3,1)",
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <Eyebrow index={index} label={label} />
          </div>
          <Display size="lg">{heading}</Display>
          {lead && (
            <Lead className="mt-5" style={{ maxWidth: "42ch" }}>
              {lead}
            </Lead>
          )}
        </div>
        <div className="mt-7 flex flex-col gap-2.5">
          {items.map((it, i) => (
            <Item key={it.n} it={it} on={i < revealed} />
          ))}
        </div>
      </div>
    </div>
  );

  /* Static full-bleed — reduced-motion */
  if (reduce) {
    return (
      <section
        ref={sectionRef}
        className="k-dark relative overflow-hidden"
        style={{
          background: "var(--k-bg)",
          color: "var(--k-fg)",
          borderTop: "1px solid var(--k-border)",
        }}
      >
        {Backdrop}
        <Container
          className="relative"
          style={{
            zIndex: 2,
            minHeight: "100svh",
            display: "flex",
            alignItems: "center",
            paddingBlock: "clamp(80px,14vh,120px)",
          }}
        >
          {Copy}
        </Container>
      </section>
    );
  }

  /* Pinned full-bleed flagship — desktop + mobile */
  return (
    <section
      ref={sectionRef}
      className="k-dark relative"
      style={{
        height: `${items.length * 50 + 150}vh`,
        background: "var(--k-bg)",
        color: "var(--k-fg)",
        borderTop: "1px solid var(--k-border)",
      }}
    >
      <div className="sticky overflow-hidden" style={{ top: 0, height: "100vh" }}>
        {Backdrop}
        <Container className="relative h-full" style={{ zIndex: 2 }}>
          <div className="h-full flex items-center">{Copy}</div>
        </Container>
      </div>
    </section>
  );
}
