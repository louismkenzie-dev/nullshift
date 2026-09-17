"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./TrustedBy.module.css";

/** CSS owns translation; JS only responds to visibility and the pause control. */
export function LogoMarquee({ children }: { children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const section = root.current;
    if (!section) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const sync = () => {
      section.dataset.enhanced = String(!reduced.matches);
      section.dataset.running = String(visible && !document.hidden && !reduced.matches);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(section);
    reduced.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      observer.disconnect();
      reduced.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <section
      id="trusted-by"
      ref={root}
      className={`k-cream ${styles.section}`}
      data-paused={paused}
      aria-labelledby="trusted-by-heading"
    >
      <div className={styles.headingRow}>
        <h2 id="trusted-by-heading" className={styles.heading}>
          Trusted by
        </h2>
        <button
          className={styles.control}
          type="button"
          aria-label={paused ? "Resume logo scrolling" : "Pause logo scrolling"}
          aria-controls="trusted-by-logos"
          onClick={() => setPaused((value) => !value)}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="currentColor"
            aria-hidden="true"
          >
            {paused ? <path d="M3 1.5v9L10 6z" /> : <path d="M2 1h3v10H2zm5 0h3v10H7z" />}
          </svg>
        </button>
      </div>
      <div id="trusted-by-logos">{children}</div>
    </section>
  );
}
