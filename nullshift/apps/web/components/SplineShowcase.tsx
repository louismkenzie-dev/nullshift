"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { SplineLazy } from "./SplineLazy";
import { useScrollProgress } from "./useScrollProgress";
import { Container, Eyebrow, Display, Lead } from "@/components/kyma";
import { T } from "@nullshift/ui/tokens";
import type { Application } from "@splinetool/runtime";

type Rotatable = { rotation: { x: number; y: number; z: number } };
export type ShowcaseItem = { n: string; title: string; desc: string };

const clamp = (n: number, a = 0, b = 1) => (n < a ? a : n > b ? b : n);
const EASE = "cubic-bezier(.16,1,.3,1)";

/* ════════════════════════════════════════════════════════════════
   SplineShowcase — a full-bleed Spline scene as the flagship of a
   pinned section, biased to the side OPPOSITE the copy. The named
   object either spins continuously (`spin` rad/s — a slow turntable
   for new perspectives) or rotates with scroll (`rotate` rad). Copy
   blurs + fades + slides up, layered over the scene. Edge-masked into
   --k-bg; legibility scrim fades in under the copy. Reduced-motion →
   static. `side` = which side the copy sits.
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
  axis = "y",
  rotate = 1.0,
  spin = 0,
  scrollSpin = 0,
}: {
  scene: string;
  objectName: string;
  index?: string;
  label: string;
  heading: React.ReactNode;
  lead?: React.ReactNode;
  items: ShowcaseItem[];
  side?: "left" | "right";
  axis?: "x" | "y" | "z";
  rotate?: number; // radians mapped across the section's scroll progress (0→1)
  spin?: number; // radians/sec gentle idle spin, so it's alive when still
  scrollSpin?: number; // radians per PIXEL scrolled — window-size-independent scroll spin
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const sceneWrapRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const objRef = useRef<Rotatable | null>(null);
  const baseRot = useRef({ x: 0, y: 0, z: 0 });
  const reduce = useReducedMotion();
  const [headingOn, setHeadingOn] = useState(false);
  const [revealed, setRevealed] = useState(0);

  const sceneOnLeft = side === "right";
  const baseTx = sceneOnLeft ? -20 : 20; // vw
  const sceneCx = sceneOnLeft ? "30%" : "70%";

  const progress = useScrollProgress(
    sectionRef,
    reduce ? ["start end", "end start"] : ["start start", "end end"]
  );

  // Resolve (and cache) the rotatable object lazily — findObjectByName in
  // onLoad can fire before the object tree is ready, so we retry until it
  // resolves. (getAllObjects throws on these scenes, so we probe by name.)
  const ensureObj = useCallback((): Rotatable | null => {
    if (objRef.current) return objRef.current;
    const a = appRef.current;
    if (!a) return null;
    for (const name of [
      objectName,
      "Group",
      "Empty",
      "Mesh",
      "Particles",
      "particles",
      "Cubes",
      "Scene 1",
      "Scene",
    ]) {
      try {
        const o = a.findObjectByName(name) as unknown as Rotatable | undefined;
        if (o) {
          objRef.current = o;
          baseRot.current = { x: o.rotation.x, y: o.rotation.y, z: o.rotation.z };
          return o;
        }
      } catch {
        /* try the next candidate */
      }
    }
    return null;
  }, [objectName]);

  // Single rotation driver. Reads scroll the Lenis-proof way (the section's own
  // getBoundingClientRect — never window.scrollY) and applies three layers:
  //   • spin       — gentle idle so it's alive when still
  //   • scrollSpin — radians per PIXEL scrolled: identical feel at every window
  //                  size, and what makes it spin faster the faster you scroll
  //                  (normalized `progress * rotate` looks frozen on big windows
  //                  because the section spans far more pixels there)
  //   • rotate     — radians mapped across the section's scroll progress (0→1)
  // The scene's own timeline is stopped on load (see onReady) so it can't fight us.
  useEffect(() => {
    if (reduce || (spin === 0 && scrollSpin === 0 && rotate === 0)) return;
    let raf = 0;
    let last = 0;
    let idle = 0; // accumulated idle radians
    let scrolled = 0; // accumulated scroll-spin radians (pixel-based)
    let lastTop: number | null = null;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const o = ensureObj();
      const sec = sectionRef.current;
      if (!o || !sec) {
        last = t;
        lastTop = null;
        return;
      }
      const r = sec.getBoundingClientRect();
      if (r.bottom < -200 || r.top > window.innerHeight + 200) {
        last = t;
        lastTop = r.top;
        return;
      }
      if (!last) last = t;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (lastTop === null) lastTop = r.top;
      const dy = lastTop - r.top; // px scrolled since last frame (window-size independent)
      lastTop = r.top;
      idle += dt * spin;
      scrolled += dy * scrollSpin;
      try {
        o.rotation[axis] =
          baseRot.current[axis] + idle + scrolled + progress.get() * rotate;
        appRef.current?.requestRender?.();
      } catch {
        /* runtime hiccup — ignore */
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduce, spin, scrollSpin, rotate, axis, ensureObj, progress]);

  // Scroll-driven: scene fade/scale, optional scroll-rotation, copy reveal.
  useEffect(() => {
    if (reduce) {
      setHeadingOn(true);
      setRevealed(items.length);
      return;
    }
    const unsub = progress.on("change", (v) => {
      // Rotation is owned by the rotation driver above. Here: scene fade/scale,
      // the legibility scrim, and the staggered copy reveal.
      const enter = clamp(v / 0.14);
      const w = sceneWrapRef.current;
      if (w) {
        w.style.opacity = String(enter);
        w.style.transform = `translateX(${baseTx}vw) scale(${1.07 - enter * 0.07})`;
      }
      if (scrimRef.current)
        // Strong legibility floor while pinned (the bright knot must never wash
        // out the copy on small windows), then ramp to full.
        scrimRef.current.style.opacity = String(Math.max(0.72, clamp((v - 0.04) / 0.18)));
      setHeadingOn(v > 0.08);
      const r = (v - 0.34) / 0.56;
      setRevealed(r <= 0 ? 0 : Math.min(items.length, Math.floor(r * items.length) + 1));
    });
    return () => unsub();
  }, [progress, reduce, baseTx, items.length]);

  const onReady = (app: Application) => {
    appRef.current = app;
    ensureObj();
    // Take manual control: stop the scene's built-in timeline/controls so they
    // can't keep re-writing the object's rotation (which otherwise overrode our
    // scroll-spin for the first ~20s until the intro animation finished). We
    // drive rotation ourselves and call requestRender() each frame.
    if (!reduce) {
      try {
        app.stop();
      } catch {
        /* older runtime without stop() — fine, we still drive rotation */
      }
    }
  };

  const dirScrim =
    side === "left"
      ? "linear-gradient(90deg, var(--k-bg) 0%, rgba(10,10,10,0.92) 34%, rgba(10,10,10,0) 66%)"
      : "linear-gradient(270deg, var(--k-bg) 0%, rgba(10,10,10,0.92) 34%, rgba(10,10,10,0) 66%)";

  const Backdrop = (
    <>
      <div
        ref={sceneWrapRef}
        className="absolute"
        style={{
          inset: "-7%",
          opacity: reduce ? 1 : 0,
          transform: `translateX(${baseTx}vw)`,
          willChange: "transform, opacity",
        }}
      >
        <SplineLazy scene={scene} onReady={onReady} className="w-full h-full" />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          background: `radial-gradient(ellipse 80% 86% at ${sceneCx} 47%, transparent 34%, var(--k-bg) 88%)`,
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          background:
            "linear-gradient(180deg, var(--k-bg) 0%, transparent 15%, transparent 85%, var(--k-bg) 100%)",
        }}
      />
      <div
        ref={scrimRef}
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 1, opacity: reduce ? 1 : 0.72, background: dirScrim }}
      />
    </>
  );

  // Cards — rendered inline (NOT a nested component) so the same DOM nodes
  // update and the blur/fade/slide transition actually plays.
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
            transition: `opacity 0.7s ${EASE}, transform 0.7s ${EASE}`,
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <Eyebrow index={index} label={label} />
          </div>
          <Display
            size="lg"
            style={{ fontSize: "clamp(1.6rem,3.45vw,2.45rem)", lineHeight: 1.05 }}
          >
            {heading}
          </Display>
          {lead && (
            <Lead className="mt-4" style={{ maxWidth: "42ch" }}>
              {lead}
            </Lead>
          )}
        </div>
        <div className="mt-5 flex flex-col gap-2">
          {items.map((it, i) => {
            const on = i < revealed;
            return (
              <div
                key={it.n}
                className="flex items-start gap-4 p-3 md:p-4"
                style={{
                  borderLeft: `2px solid ${on ? "var(--k-accent)" : "transparent"}`,
                  background: on ? "rgba(10,10,10,0.45)" : "transparent",
                  backdropFilter: on ? "blur(6px)" : "none",
                  WebkitBackdropFilter: on ? "blur(6px)" : "none",
                  opacity: on ? 1 : 0,
                  filter: on ? "blur(0px)" : "blur(12px)",
                  transform: `translate(${on ? 0 : side === "left" ? -16 : 16}px, ${on ? 0 : 16}px)`,
                  willChange: "opacity, transform, filter",
                  transition: `opacity 0.8s ${EASE}, transform 0.8s ${EASE}, filter 0.8s ${EASE}, background 0.6s ease, border-color 0.6s ease`,
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
          })}
        </div>
      </div>
    </div>
  );

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
          {/* Reserve space for the fixed nav up top + breathing room below, so the
              copy never crams against the navbar on shorter viewports. */}
          <div
            className="h-full flex items-center"
            style={{
              paddingTop: "clamp(80px, 11vh, 124px)",
              paddingBottom: "clamp(28px, 5vh, 56px)",
              boxSizing: "border-box",
            }}
          >
            {Copy}
          </div>
        </Container>
      </div>
    </section>
  );
}
