"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { HERO_FILM, heroFrame, filmTime, unitProgress } from "@/lib/scrollFilmHero";
import styles from "./ScrollFilmHero.module.css";

/** Native sticky scrolling: never captures gestures or changes body overflow. */
export function ScrollFilmHero() {
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const closing = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = root.current;
    const film = video.current;
    const end = closing.current;
    if (!section || !film || !end) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let current = 0;
    let target = 0;
    let wantedTime = 0;
    let failed = false;
    let disposed = false;

    const seek = () => {
      if (disposed || reduced.matches || failed || film.seeking || film.readyState < 2)
        return;
      if (Math.abs(film.currentTime - wantedTime) > 1 / 60) film.currentTime = wantedTime;
    };
    const paint = () => {
      raf = 0;
      const staticView = reduced.matches || failed;
      current = staticView ? 0 : current + (target - current) * 0.18;
      if (Math.abs(target - current) < 0.0003) current = target;
      const frame = heroFrame(current);
      section.dataset.progress = current.toFixed(4);
      section.style.setProperty("--title-opacity", String(frame.title));
      section.style.setProperty("--title-blur", `${frame.blur}px`);
      section.style.setProperty("--title-lift", `${frame.lift}px`);
      section.style.setProperty("--closing-opacity", String(frame.closing));
      section.style.setProperty("--film-scale", String(frame.scale));
      section.style.setProperty("--progress", String(frame.progress));
      end.inert = !staticView && frame.closing < 0.9;
      end.setAttribute("aria-hidden", String(end.inert));
      wantedTime = filmTime(current, film.duration);
      seek();
      if (!staticView && current !== target) raf = requestAnimationFrame(paint);
    };
    const update = () => {
      const rect = section.getBoundingClientRect();
      target = unitProgress(-rect.top / Math.max(1, section.offsetHeight - innerHeight));
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const preference = () => {
      section.dataset.motion = reduced.matches ? "reduced" : "full";
      film.preload = reduced.matches ? "none" : "auto";
      update();
    };
    const ready = () => {
      section.dataset.ready = "true";
      update();
    };
    const error = () => {
      failed = true;
      section.dataset.failed = "true";
      update();
    };
    film.addEventListener("loadeddata", ready);
    film.addEventListener("seeked", seek);
    film.addEventListener("error", error);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    reduced.addEventListener("change", preference);
    preference();
    if (film.readyState >= 2) ready();
    if (film.error) error();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      film.removeEventListener("loadeddata", ready);
      film.removeEventListener("seeked", seek);
      film.removeEventListener("error", error);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      reduced.removeEventListener("change", preference);
    };
  }, []);

  return (
    <section
      ref={root}
      className={styles.hero}
      aria-label="Nullshift introduction"
      data-film-hero
    >
      <div className={styles.scene}>
        <video
          ref={video}
          className={styles.film}
          src={HERO_FILM.src}
          poster={HERO_FILM.poster}
          style={{ objectFit: HERO_FILM.fit }}
          preload="none"
          muted
          playsInline
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
        />
        <div className={styles.shade} />
        <div className={styles.title}>
          <p className={styles.eyebrow}>Bespoke systems. Boundless possibilities.</p>
          <h1>BUILT AROUND YOU.</h1>
        </div>
        <div ref={closing} className={styles.closing}>
          <p>
            We build it.
            <br />
            We run it.
            <br />
            <em>We grow it.</em>
          </p>
          <Link href="/start">
            Let’s build your next chapter <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className={styles.bottom}>
          <span className={styles.scrollHint}>
            SCROLL TO EXPLORE <span aria-hidden="true">↓</span>
          </span>
          <a href="#home-after-hero" className={styles.skip}>
            Skip introduction ↗
          </a>
        </div>
        <div className={styles.progress} aria-hidden="true" />
      </div>
    </section>
  );
}
