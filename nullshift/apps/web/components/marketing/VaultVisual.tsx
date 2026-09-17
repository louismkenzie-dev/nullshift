"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { createFilmScrubber } from "@/lib/filmScrubber";
import { VAULT_FILM, vaultProgress, vaultTime } from "@/lib/vaultFilm";
import styles from "./FinancialServices.module.css";

/** Blender-rendered turntable. No autoplay, WebGL runtime or continuous loop. */
export function VaultVisual() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    const film = videoRef.current;
    if (!scene || !film) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = matchMedia("(max-width: 760px)");
    let active = false;
    let nearby = false;
    let failed = false;
    let raf = 0;
    let previousTime = -1;
    let height = scene.clientHeight;
    const canPaint = () => active && !document.hidden && !reduced.matches && !failed;
    const scrub = createFilmScrubber(film, { fps: VAULT_FILM.fps, canSeek: canPaint });

    const paint = () => {
      raf = 0;
      if (!canPaint()) return;
      const progress = vaultProgress(
        scene.getBoundingClientRect().top,
        height,
        innerHeight
      );
      const time = vaultTime(progress);
      if (time === previousTime) return;
      previousTime = time;
      scene.dataset.progress = progress.toFixed(4);
      scrub.request(time);
    };
    const schedule = () => {
      if (canPaint() && !raf) raf = requestAnimationFrame(paint);
    };
    const load = () => {
      if (!nearby || document.hidden || reduced.matches || failed) return;
      const source = mobile.matches ? VAULT_FILM.mobileSrc : VAULT_FILM.src;
      if (film.getAttribute("src") === source) return;
      scene.dataset.ready = "false";
      previousTime = -1;
      scrub.reset();
      film.width = film.height = mobile.matches ? 720 : 1080;
      film.src = source;
      film.preload = "auto";
      film.load();
    };
    const sync = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      previousTime = -1;
      if (document.hidden) return;
      height = scene.clientHeight;
      const rect = scene.getBoundingClientRect();
      active = rect.bottom > 0 && rect.top < innerHeight;
      nearby = rect.bottom > -600 && rect.top < innerHeight + 600;
      scene.dataset.motion = reduced.matches ? "reduced" : "full";
      if (reduced.matches) {
        scene.dataset.ready = "false";
        scrub.reset();
        film.pause();
        if (film.hasAttribute("src")) {
          film.removeAttribute("src");
          film.preload = "none";
          film.load();
        }
      } else {
        load();
        schedule();
      }
    };
    const ready = () => {
      if (failed || reduced.matches || !film.hasAttribute("src")) return;
      if (film.readyState >= 2 && scene.dataset.ready !== "true")
        scene.dataset.ready = "true";
      previousTime = -1;
      schedule();
    };
    const error = () => {
      failed = true;
      scene.dataset.ready = "false";
      scene.dataset.failed = "true";
      scrub.reset();
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const empty = () => {
      scene.dataset.ready = "false";
    };
    const mediaObserver = new IntersectionObserver(
      ([entry]) => {
        nearby = entry.isIntersecting;
        load();
      },
      { rootMargin: "600px 0px" }
    );
    const observer = new IntersectionObserver(([entry]) => {
      active = entry.isIntersecting;
      if (!active) {
        cancelAnimationFrame(raf);
        raf = 0;
        return;
      }
      previousTime = -1;
      schedule();
    });
    const sizing = new ResizeObserver(sync);
    mediaObserver.observe(scene);
    observer.observe(scene);
    sizing.observe(scene);
    film.addEventListener("loadeddata", ready);
    film.addEventListener("seeked", ready);
    film.addEventListener("error", error);
    film.addEventListener("emptied", empty);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", sync);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    mobile.addEventListener("change", sync);
    sync();

    return () => {
      cancelAnimationFrame(raf);
      mediaObserver.disconnect();
      observer.disconnect();
      sizing.disconnect();
      scrub.destroy();
      film.removeEventListener("loadeddata", ready);
      film.removeEventListener("seeked", ready);
      film.removeEventListener("error", error);
      film.removeEventListener("emptied", empty);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", sync);
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
      mobile.removeEventListener("change", sync);
      film.pause();
      film.removeAttribute("src");
      film.load();
    };
  }, []);

  return (
    <figure
      className={styles.figure}
      aria-label="Precision-engineered vault, rotating as you scroll"
    >
      <div ref={sceneRef} className={styles.scene} data-vault-film aria-hidden="true">
        <Image
          src={VAULT_FILM.poster}
          loader={({ width }) =>
            width <= 720 ? VAULT_FILM.mobilePoster : VAULT_FILM.poster
          }
          fill
          sizes="(max-width: 760px) calc(100vw - 40px), (max-width: 1280px) 43vw, 530px"
          alt=""
          className={styles.poster}
        />
        <video
          ref={videoRef}
          className={styles.film}
          width={1080}
          height={1080}
          preload="none"
          muted
          playsInline
          disablePictureInPicture
          tabIndex={-1}
        />
      </div>
    </figure>
  );
}
