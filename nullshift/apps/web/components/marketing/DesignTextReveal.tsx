"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Text is visible without JavaScript; enhancement runs only once on entry. */
export function DesignTextReveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!element || reduced.matches || !("IntersectionObserver" in window)) return;

    const animations: Animation[] = [];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          if (reduced.matches || typeof entry.target.animate !== "function") continue;
          animations.push(
            entry.target.animate(
              [
                { opacity: 0, transform: "translateY(20px)" },
                { opacity: 1, transform: "translateY(0)" },
              ],
              { duration: 650, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
            )
          );
        }
      },
      { threshold: 0.12 }
    );

    element.querySelectorAll("[data-design-reveal]").forEach((target) => {
      observer.observe(target);
    });

    function stopMotion() {
      if (!reduced.matches) return;
      observer.disconnect();
      animations.forEach((animation) => animation.cancel());
    }

    reduced.addEventListener("change", stopMotion);
    return () => {
      observer.disconnect();
      animations.forEach((animation) => animation.cancel());
      reduced.removeEventListener("change", stopMotion);
    };
  }, []);

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
