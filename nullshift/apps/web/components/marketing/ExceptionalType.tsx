"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./DesignStatement.module.css";

const FONT_COUNT = 10;

export function ExceptionalType() {
  const root = useRef<HTMLDivElement>(null);
  const [font, setFont] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let inView = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    function stop() {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    }
    function sync() {
      stop();
      if (!paused && !reduced.matches && inView && !document.hidden) {
        timer = setInterval(() => setFont((current) => (current + 1) % FONT_COUNT), 850);
      }
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        sync();
      },
      { threshold: 0.2 }
    );
    observer.observe(element);
    reduced.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      stop();
      observer.disconnect();
      reduced.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [paused]);

  return (
    <div ref={root} className={styles.typeStudy}>
      <h2 className={styles.headline}>
        Works beautifully.
        <br />
        Feels
        <span className={styles.wordFrame}>
          <span className={styles.srOnly}> exceptional.</span>
          <span aria-hidden="true" className={styles.changingWord} data-font={font}>
            exceptional
          </span>
          <span aria-hidden="true" className={styles.staticWord}>
            exceptional
          </span>
        </span>
      </h2>
      <button
        type="button"
        className={styles.motionControl}
        aria-pressed={paused}
        onClick={() => setPaused((value) => !value)}
      >
        {paused ? "Play font animation" : "Pause font animation"}
        <span aria-hidden="true">{paused ? " ▷" : " Ⅱ"}</span>
      </button>
    </div>
  );
}
