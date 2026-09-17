"use client";

import { useEffect, useRef } from "react";
import {
  CAPABILITIES_FILM,
  CAPABILITY_CUES,
  capabilitiesFraming,
  capabilitiesFrame,
  capabilitiesTextFrame,
} from "@/lib/capabilitiesFilm";
import { PORTRAIT_FILM_QUERY, unitProgress } from "@/lib/scrollFilmHero";
import { createFilmScrubber, setFilmStyle } from "@/lib/filmScrubber";
import styles from "./CapabilitiesFilm.module.css";

export function CapabilitiesFilm() {
  const root = useRef<HTMLElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const words = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const section = root.current;
    const stage = scene.current;
    const film = video.current;
    if (!section || !stage || !film) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const portrait = matchMedia(PORTRAIT_FILM_QUERY);
    const mobile = matchMedia("(max-width: 900px)");
    let raf = 0;
    let previous = -1;
    let failed = false;
    let active = false;
    let nearby = false;
    let stageWidth = stage.clientWidth;
    let stageHeight = stage.clientHeight;
    let range = Math.max(1, section.offsetHeight - stageHeight);
    const canPaint = () =>
      active && !document.hidden && !reduced.matches && (!failed || mobile.matches);
    const scrub = createFilmScrubber(film, {
      fps: CAPABILITIES_FILM.fps,
      canSeek: () => canPaint() && !mobile.matches,
    });
    const paint = () => {
      raf = 0;
      if (!canPaint()) return;
      // Native scroll owns movement. Do not add a second, frame-rate-dependent tail.
      const current = unitProgress(-section.getBoundingClientRect().top / range);
      if (current === previous) return;
      previous = current;
      const frame = mobile.matches
        ? capabilitiesTextFrame(current)
        : capabilitiesFrame(current, film.duration);
      if (section.dataset.progress !== frame.progress.toFixed(4))
        section.dataset.progress = frame.progress.toFixed(4);
      setFilmStyle(section, "--blackout", String(frame.blackout));
      setFilmStyle(section, "--scene-blur", `${frame.sceneBlur}px`);
      setFilmStyle(section, "--anything", String(frame.anything));
      setFilmStyle(section, "--anything-blur", `${(1 - frame.anything) * 12}px`);
      setFilmStyle(section, "--anything-lift", `${(1 - frame.anything) * 40}px`);
      // The portrait derivative already bakes in the phone-tracking crop.
      setFilmStyle(
        section,
        "--film-position",
        `${portrait.matches ? 50 : capabilitiesFraming(stageWidth, stageHeight, frame.progress)}%`
      );
      setFilmStyle(
        section,
        "--word-shadow",
        String(Math.max(...frame.words.map((word) => word.opacity)))
      );
      words.current.forEach((word, index) => {
        if (!word) return;
        const state = frame.words[index];
        setFilmStyle(word, "opacity", String(state.opacity));
        setFilmStyle(word, "filter", `blur(${state.blur}px)`);
        setFilmStyle(word, "transform", `translateY(${state.lift}px)`);
      });
      if (!mobile.matches) scrub.request(frame.time);
    };
    const schedule = () => {
      if (canPaint() && !raf) raf = requestAnimationFrame(paint);
    };
    const load = () => {
      if (!nearby || document.hidden || reduced.matches || mobile.matches || failed)
        return;
      const source = portrait.matches
        ? CAPABILITIES_FILM.portraitSrc
        : CAPABILITIES_FILM.src;
      if (film.getAttribute("src") === source) return;
      scrub.reset();
      previous = -1;
      film.poster = portrait.matches
        ? CAPABILITIES_FILM.portraitPoster
        : CAPABILITIES_FILM.poster;
      film.width = portrait.matches
        ? CAPABILITIES_FILM.portraitWidth
        : CAPABILITIES_FILM.width;
      film.height = portrait.matches
        ? CAPABILITIES_FILM.portraitHeight
        : CAPABILITIES_FILM.height;
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
      section.dataset.presentation = mobile.matches ? "text" : "film";
      section.dataset.failed = String(failed && !mobile.matches);
      stageWidth = stage.clientWidth;
      stageHeight = stage.clientHeight;
      range = Math.max(1, section.offsetHeight - stageHeight);
      const rect = section.getBoundingClientRect();
      active = rect.bottom > 0 && rect.top < innerHeight;
      nearby = rect.bottom > -900 && rect.top < innerHeight + 900;
      if (reduced.matches || mobile.matches) {
        scrub.reset();
        film.pause();
        const hadSource = film.hasAttribute("src");
        film.removeAttribute("src");
        film.removeAttribute("poster");
        film.preload = "none";
        if (hadSource) film.load();
        schedule();
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
      if (mobile.matches) return;
      failed = true;
      section.dataset.failed = "true";
    };
    const mediaObserver = new IntersectionObserver(
      ([entry]) => {
        nearby = entry.isIntersecting;
        load();
      },
      { rootMargin: "900px 0px" }
    );
    const observer = new IntersectionObserver(([entry]) => {
      active = entry.isIntersecting;
      if (!active) {
        cancelAnimationFrame(raf);
        raf = 0;
        return;
      }
      previous = -1;
      schedule();
    });
    const sizing = new ResizeObserver(sync);
    mediaObserver.observe(section);
    observer.observe(section);
    sizing.observe(stage);
    sizing.observe(section);
    film.addEventListener("loadeddata", ready);
    film.addEventListener("error", error);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", sync);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    portrait.addEventListener("change", sync);
    mobile.addEventListener("change", sync);
    sync();
    return () => {
      cancelAnimationFrame(raf);
      mediaObserver.disconnect();
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
      mobile.removeEventListener("change", sync);
    };
  }, []);

  return (
    <section
      id="capabilities-film"
      ref={root}
      className={styles.root}
      aria-labelledby="capabilities-film-title"
    >
      <h2 id="capabilities-film-title" className={styles.accessible}>
        Software built around your operation
      </h2>
      <p className={styles.accessible}>
        {CAPABILITY_CUES.map((cue) => cue.label).join(". ")}. Anything.
      </p>
      <div className={styles.scene} ref={scene}>
        <video
          ref={video}
          className={styles.film}
          preload="none"
          muted
          playsInline
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
        />
        <div className={styles.shade} aria-hidden="true" />
        <div className={styles.words} aria-hidden="true">
          {CAPABILITY_CUES.map((cue, index) => (
            <span
              key={cue.label}
              ref={(node) => {
                words.current[index] = node;
              }}
            >
              {cue.label}
            </span>
          ))}
        </div>
        <div className={styles.blackout} aria-hidden="true" />
        <p className={styles.anything} aria-hidden="true">
          Anything
        </p>
        <a className={styles.skip} href="#platform-features">
          Explore the features ↗
        </a>
      </div>
    </section>
  );
}
