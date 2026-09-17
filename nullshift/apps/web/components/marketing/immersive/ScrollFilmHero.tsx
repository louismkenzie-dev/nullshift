"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  HERO_FILM,
  PORTRAIT_FILM_QUERY,
  heroFrame,
  filmTime,
  unitProgress,
} from "@/lib/scrollFilmHero";
import { createFilmScrubber, setFilmStyle } from "@/lib/filmScrubber";
import styles from "./ScrollFilmHero.module.css";

/** Native sticky scrolling: never captures gestures or changes body overflow. */
export function ScrollFilmHero() {
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const closing = useRef<HTMLDivElement>(null);
  const actions = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = root.current;
    const film = video.current;
    const end = closing.current;
    const links = actions.current;
    if (!section || !film || !end || !links) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const portrait = matchMedia(PORTRAIT_FILM_QUERY);
    let raf = 0;
    let previous = -1;
    let range = Math.max(1, section.offsetHeight - innerHeight);
    let active = false;
    let failed = false;
    const canPaint = () => active && !document.hidden && !reduced.matches && !failed;
    const scrub = createFilmScrubber(film, { fps: HERO_FILM.fps, canSeek: canPaint });
    const paint = () => {
      raf = 0;
      if (!canPaint()) return;
      const current = unitProgress(-section.getBoundingClientRect().top / range);
      if (current === previous) return;
      previous = current;
      const frame = heroFrame(current);
      if (section.dataset.progress !== current.toFixed(4))
        section.dataset.progress = current.toFixed(4);
      setFilmStyle(section, "--title-opacity", String(frame.title));
      setFilmStyle(section, "--title-blur", `${frame.blur}px`);
      setFilmStyle(section, "--title-lift", `${frame.lift}px`);
      setFilmStyle(section, "--actions-opacity", String(frame.actions));
      const actionsHidden = frame.actions < 0.1;
      if (links.inert !== actionsHidden) links.inert = actionsHidden;
      if (links.getAttribute("aria-hidden") !== String(actionsHidden))
        links.setAttribute("aria-hidden", String(actionsHidden));
      setFilmStyle(section, "--closing-opacity", String(frame.closing));
      setFilmStyle(section, "--middle-opacity", String(frame.middle));
      setFilmStyle(section, "--film-scale", String(frame.scale));
      setFilmStyle(section, "--film-reveal", String(frame.filmReveal));
      setFilmStyle(section, "--progress", String(frame.progress));
      const inert = frame.closing < 0.9;
      if (end.inert !== inert) end.inert = inert;
      if (end.getAttribute("aria-hidden") !== String(inert))
        end.setAttribute("aria-hidden", String(inert));
      scrub.request(filmTime(current, film.duration));
    };
    const schedule = () => {
      if (canPaint() && !raf) raf = requestAnimationFrame(paint);
    };
    const load = () => {
      if (!canPaint()) return;
      const source = portrait.matches ? HERO_FILM.portraitSrc : HERO_FILM.src;
      if (film.getAttribute("src") === source) return;
      scrub.reset();
      previous = -1;
      film.poster = portrait.matches ? HERO_FILM.portraitPoster : HERO_FILM.poster;
      film.width = portrait.matches ? 406 : 1280;
      film.height = 720;
      film.src = source;
      film.preload = "auto";
      film.load();
    };
    const sync = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      previous = -1;
      if (document.hidden) return;
      const motion = reduced.matches ? "reduced" : "full";
      if (section.dataset.motion !== motion) section.dataset.motion = motion;
      const rect = section.getBoundingClientRect();
      range = Math.max(1, section.offsetHeight - innerHeight);
      active = rect.bottom > 0 && rect.top < innerHeight;
      if (reduced.matches) {
        scrub.reset();
        const hadSource = film.hasAttribute("src");
        film.removeAttribute("src");
        film.removeAttribute("poster");
        film.preload = "none";
        if (hadSource) film.load();
        end.inert = false;
        end.setAttribute("aria-hidden", "false");
        links.inert = false;
        links.setAttribute("aria-hidden", "false");
      } else {
        load();
        schedule();
      }
    };
    const ready = () => {
      previous = -1;
      schedule();
    };
    const error = () => {
      failed = true;
      section.dataset.failed = "true";
      end.inert = false;
      end.setAttribute("aria-hidden", "false");
      links.inert = false;
      links.setAttribute("aria-hidden", "false");
    };
    const observer = new IntersectionObserver(([entry]) => {
      active = entry.isIntersecting;
      if (!active) {
        cancelAnimationFrame(raf);
        raf = 0;
        return;
      }
      previous = -1;
      load();
      schedule();
    });
    const sizing = new ResizeObserver(sync);
    observer.observe(section);
    sizing.observe(section);
    film.addEventListener("loadeddata", ready);
    film.addEventListener("error", error);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", sync);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    portrait.addEventListener("change", sync);
    sync();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      sizing.disconnect();
      scrub.destroy();
      film.removeEventListener("loadeddata", ready);
      film.removeEventListener("error", error);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", sync);
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
      portrait.removeEventListener("change", sync);
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
          <div ref={actions} className={styles.actions} data-hero-actions>
            <Link href="/book" prefetch={false} className={styles.demoAction}>
              Discuss your project <span aria-hidden="true">↗</span>
            </Link>
            <Link href="/portal/login" prefetch={false} className={styles.portalAction}>
              Existing Clients and Partners <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
        <div className={styles.middle} data-hero-message>
          <p>
            Custom, Integrated <br />
            Software for <em>any operation</em>
          </p>
        </div>
        <div ref={closing} className={styles.closing} inert aria-hidden="true">
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
