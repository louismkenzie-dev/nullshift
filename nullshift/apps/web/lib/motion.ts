"use client";

import { useEffect, useRef, useState } from "react";
import { createScope, type Scope } from "animejs";

/* ════════════════════════════════════════════════════════════════
   Motion foundations for the immersive marketing sections.

   Two rules hold everything here together:

   1. Every anime.js animation is built inside a `createScope`, whose
      `revert()` we call on unmount. Anime writes inline styles onto
      real DOM nodes, and React does not know about them — without the
      scope, a route change leaves half-finished transforms behind and
      split text stays shattered.

   2. Nothing animates until it is on screen, and nothing animates at
      all when the visitor has asked for less motion. Heavy scroll work
      on a phone is a battery and jank problem, not a design flourish.
   ════════════════════════════════════════════════════════════════ */

/** SSR-safe: starts false so the server render matches, flips on mount. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * True once the element has been on screen. One-shot: we never take an
 * entrance back once it has played.
 */
export function useInView<T extends HTMLElement>(
  rootMargin = "-10% 0px -10% 0px"
): { ref: React.RefObject<T | null>; inView: boolean } {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return { ref, inView };
}

/**
 * Below this width the page drops to the calm treatment: entrances still
 * play, but nothing is scrubbed frame-by-frame against scroll. A phone
 * should not be running five synchronised timelines to sell a website.
 */
export const HEAVY_MOTION_MIN_WIDTH = 900;

export function useHeavyMotion(): boolean {
  const reduced = usePrefersReducedMotion();
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${HEAVY_MOTION_MIN_WIDTH}px)`);
    setWide(mq.matches);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return wide && !reduced;
}

/**
 * Run `build` inside an anime scope bound to `root`, once `enabled` is true,
 * and revert everything it touched on cleanup or when the deps change.
 *
 * `build` receives the root element. Anything it creates — animations,
 * timelines, scroll observers, split text — is torn down by the revert.
 */
export function useAnimeScope(
  root: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  build: (el: HTMLElement) => void,
  deps: React.DependencyList = []
) {
  const buildRef = useRef(build);
  buildRef.current = build;

  useEffect(() => {
    const el = root.current;
    if (!el || !enabled) return;

    // Read the preference synchronously, here, rather than trusting a state
    // flip. usePrefersReducedMotion has to start false so the server render
    // matches, which means a scope gated only on that state STARTS and is then
    // reverted a tick later — and revert does not reliably restore everything
    // anime touches. It left createDrawable paths at a zero-length dash array,
    // so the hero lattice disappeared for exactly the visitors who should have
    // got the static version of it. Never starting is the only safe answer.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let scope: Scope | undefined;
    // A frame's grace so layout (and split text measurement) has settled.
    const raf = requestAnimationFrame(() => {
      scope = createScope({ root: el }).add(() => buildRef.current(el));
    });

    return () => {
      cancelAnimationFrame(raf);
      scope?.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, enabled, ...deps]);
}
