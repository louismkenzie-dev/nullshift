"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { T } from "@nullshift/ui/tokens";

/* ════════════════════════════════════════════════════════════════
   Page-transition wipe (ANIM 2) — an emerald panel that slides UP
   from below to cover the viewport (ease-in-expo), the route swaps
   behind it, then it continues UP off the top to reveal the new
   page (ease-out-expo).

   Internal link clicks are intercepted globally (capture phase) so
   every <Link>/anchor is "wired" without rewriting each one. Clicks
   are suppressed (stopPropagation) and we drive router.push after the
   cover completes; the Nav menu closes itself on pathname change, so
   no inline onClick is needed. Opt a link out with data-no-transition.
   Disabled entirely under prefers-reduced-motion.
   ════════════════════════════════════════════════════════════════ */

const COVER_MS = 380;
const REVEAL_MS = 480;

type Phase = "idle" | "cover" | "reveal";

export function PageTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const pending = useRef<string | null>(null);
  const prevPath = useRef(pathname);

  // Once the new route commits (pathname changes after a covered nav),
  // continue the panel up off the top to reveal it.
  useEffect(() => {
    if (pathname === prevPath.current) return;
    prevPath.current = pathname;
    if (pending.current === null) return;
    pending.current = null;
    setPhase("reveal");
    const id = setTimeout(() => setPhase("idle"), REVEAL_MS);
    return () => clearTimeout(id);
  }, [pathname]);

  // Intercept internal link clicks: cover, then navigate.
  useEffect(() => {
    if (reduce) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href) return;
      const target = a.getAttribute("target");
      if (target && target !== "_self") return;
      if (a.hasAttribute("download")) return;
      if ((a as HTMLElement).dataset.noTransition !== undefined) return;
      if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#"))
        return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return; // external
      if (url.pathname === window.location.pathname) return; // same page / anchor

      e.preventDefault();
      e.stopPropagation();
      const dest = url.pathname + url.search + url.hash;
      pending.current = dest;
      setPhase("cover");
      window.setTimeout(() => router.push(dest), COVER_MS);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [reduce, router]);

  const transform =
    phase === "cover"
      ? "translateY(0%)"
      : phase === "reveal"
        ? "translateY(-100%)"
        : "translateY(100%)";

  const transition =
    phase === "cover"
      ? `transform ${COVER_MS}ms var(--ease-in-expo)`
      : phase === "reveal"
        ? `transform ${REVEAL_MS}ms var(--ease-out-expo)`
        : "none";

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: T.primary,
        transform,
        transition,
        pointerEvents: phase === "idle" ? "none" : "auto",
        willChange: "transform",
      }}
    />
  );
}
