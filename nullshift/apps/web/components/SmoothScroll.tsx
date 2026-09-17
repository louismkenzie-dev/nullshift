"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useEffect(() => {
    // The film homepage owns its visual timing. Never ease the user's scroll
    // position as well, or touch/trackpad input trails behind the story.
    if (pathname === "/") return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let lenis: import("lenis").default | undefined;
    let generation = 0;
    let frame = 0;
    function raf(time: number) {
      lenis?.raf(time);
      frame = requestAnimationFrame(raf);
    }
    const stop = () => {
      generation++;
      cancelAnimationFrame(frame);
      lenis?.destroy();
      lenis = undefined;
    };
    const preference = () => {
      stop();
      if (reduced.matches) return;
      const request = generation;
      // Keep the optional smooth-scroll runtime out of the homepage bundle.
      void import("lenis").then(({ default: Lenis }) => {
        if (request !== generation) return;
        lenis = new Lenis({
          duration: 1.15,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          smoothWheel: true,
          touchMultiplier: 1.5,
        });
        frame = requestAnimationFrame(raf);
      });
    };
    preference();
    reduced.addEventListener("change", preference);
    return () => {
      stop();
      reduced.removeEventListener("change", preference);
    };
  }, [pathname]);

  return <>{children}</>;
}
