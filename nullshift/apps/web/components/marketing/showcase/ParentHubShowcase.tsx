"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, Expand, X } from "lucide-react";
import {
  clamp,
  clipTime,
  dampProgress,
  parentFrame,
  PARENT_CHAPTERS,
  showcaseAsset,
} from "@/lib/showcasePrototype";
import styles from "./ShowcasePrototype.module.css";

const clips = ["parent-home", "parent-report"];

export function ParentHubShowcase({ embedded = false }: { embedded?: boolean }) {
  const asset = (name: string) => showcaseAsset(name, embedded);
  const story = useRef<HTMLElement>(null);
  const camera = useRef<HTMLDivElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const manual = useRef(0);
  const refresh = useRef<() => void>(() => {});
  const dialog = useRef<HTMLDialogElement>(null);
  const [chapter, setChapter] = useState(0);
  const [mediaError, setMediaError] = useState(false);

  useEffect(() => {
    const section = story.current;
    const device = camera.current;
    if (!section || !device) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0,
      displayed = 0,
      lastTime = 0,
      lastChapter = -1,
      initialised = false;
    let active = false;
    const targets = new Map<HTMLVideoElement, number>();
    const seek = (video: HTMLVideoElement) => {
      const target = targets.get(video);
      if (
        target !== undefined &&
        !video.seeking &&
        Number.isFinite(video.duration) &&
        Math.abs(video.currentTime - target) > 0.025
      )
        video.currentTime = target;
    };
    const apply = () => {
      raf = 0;
      const rect = section.getBoundingClientRect();
      const target = reduced.matches
        ? manual.current
        : clamp(-rect.top / Math.max(1, section.offsetHeight - innerHeight));
      const now = performance.now();
      displayed =
        !initialised || reduced.matches
          ? target
          : dampProgress(displayed, target, now - lastTime);
      initialised = true;
      lastTime = now;
      const frame = parentFrame(displayed);
      section.dataset.progress = displayed.toFixed(4);
      section.dataset.chapter = String(frame.chapter);
      if (frame.chapter !== lastChapter) {
        lastChapter = frame.chapter;
        setChapter(frame.chapter);
      }
      // Keep the portrait UI at its original aspect ratio. On phones it almost fills
      // the viewport; on desktops it fills the available height next to the story.
      device.style.setProperty(
        "--phone-reveal",
        String(reduced.matches ? 1 : frame.zoom)
      );
      section.style.setProperty(
        "--parent-zoom",
        String(reduced.matches ? 1 : frame.zoom)
      );
      const selected = frame.chapter === 2 ? 1 : 0;
      layers.current.forEach((layer, i) => {
        if (layer)
          layer.style.opacity = String(i === 0 ? 1 : clamp((displayed - 0.63) / 0.035));
        const video = videos.current[i];
        if (video && active && i === selected && Number.isFinite(video.duration)) {
          targets.set(
            video,
            reduced.matches
              ? 0
              : clipTime(
                  displayed,
                  i === 0 ? 0.3 : 0.63,
                  i === 0 ? 0.63 : 1,
                  video.duration
                )
          );
          seek(video);
        }
      });
      if (displayed !== target) raf = requestAnimationFrame(apply);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    refresh.current = schedule;
    // Keep the second section's large footage out of the initial page load.
    const mediaObserver = new IntersectionObserver(
      (entries) => {
        active = entries[0].isIntersecting;
        if (active)
          for (const video of videos.current) {
            if (video && !video.getAttribute("src")) {
              video.src = video.dataset.src!;
              video.load();
            }
          }
        schedule();
      },
      { rootMargin: "100% 0px" }
    );
    mediaObserver.observe(section);
    const media = videos.current.filter((v): v is HTMLVideoElement => !!v);
    const handlers = media.map((video) => {
      const done = () => seek(video);
      video.addEventListener("seeked", done);
      video.addEventListener("loadedmetadata", schedule);
      return done;
    });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduced.addEventListener("change", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(raf);
      mediaObserver.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduced.removeEventListener("change", schedule);
      media.forEach((video, i) => {
        video.removeEventListener("seeked", handlers[i]);
        video.removeEventListener("loadedmetadata", schedule);
      });
      refresh.current = () => {};
    };
  }, []);

  const goTo = (index: number) => {
    const section = story.current;
    if (!section) return;
    const target = index === 0 ? 0 : PARENT_CHAPTERS[index].start + 0.06;
    manual.current = target;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      refresh.current();
      return;
    }
    window.scrollTo({
      top:
        scrollY +
        section.getBoundingClientRect().top +
        target * (section.offsetHeight - innerHeight),
      behavior: "smooth",
    });
  };

  return (
    <>
      <section className={styles.parentIntro} aria-labelledby="parent-title">
        <p className={styles.eyebrow}>02 / The family experience</p>
        <h2 id="parent-title">
          Built for the team.
          <br />
          <em>Ready for the sidelines.</em>
        </h2>
        <p>
          The same connected platform, designed around a parent’s day.
          <br />
          Player profiles, bookings and coaching feedback — on mobile.
        </p>
        <a href="#parent-hub-showcase">
          Explore the Parent Hub <ArrowDown size={17} />
        </a>
      </section>
      <section
        id="parent-hub-showcase"
        ref={story}
        className={styles.parentStory}
        aria-label="Suffolk Tennis mobile Parent Hub showcase"
        data-chapter="0"
      >
        <div className={styles.parentStage}>
          <div className={styles.parentTopline}>
            <span>Suffolk Tennis / Parent Hub</span>
            <span>Fictional demo data</span>
          </div>
          <div className={styles.parentCopy}>
            <div key={chapter} className={styles.captionContent}>
              <p className={styles.chapterLabel}>
                0{chapter + 1} / {PARENT_CHAPTERS[chapter].label}
              </p>
              <h2>{PARENT_CHAPTERS[chapter].title}</h2>
              <p>{PARENT_CHAPTERS[chapter].detail}</p>
            </div>
            <nav aria-label="Parent Hub chapters" className={styles.parentChapters}>
              {PARENT_CHAPTERS.map((entry, index) => (
                <button
                  key={entry.label}
                  onClick={() => goTo(index)}
                  aria-current={chapter === index ? "step" : undefined}
                  aria-label={`Parent Hub chapter ${index + 1}: ${entry.label}`}
                >
                  <span>0{index + 1}</span>
                  {entry.label}
                </button>
              ))}
            </nav>
          </div>
          <div className={styles.phoneViewport}>
            <div ref={camera} className={styles.phoneCamera}>
              <Image
                src={asset("portrait-iphone.jpg")}
                alt="A robotic hand holding a portrait iPhone showing the Suffolk Tennis Parent Hub"
                width={3000}
                height={2000}
                unoptimized
                className={styles.phoneHardware}
              />
              <div className={styles.phoneScreen} aria-hidden="true">
                {clips.map((clip, index) => (
                  <div
                    key={clip}
                    className={styles.phoneClip}
                    ref={(el) => {
                      layers.current[index] = el;
                    }}
                  >
                    <Image
                      src={asset(
                        `${index === 0 && chapter === 1 ? "parent-bookings" : clip}.png`
                      )}
                      alt=""
                      fill
                      unoptimized
                      sizes="440px"
                    />
                    <video
                      ref={(el) => {
                        videos.current[index] = el;
                      }}
                      data-src={asset(`${clip}.mp4`)}
                      poster={asset(`${clip}.png`)}
                      muted
                      playsInline
                      preload="none"
                      tabIndex={-1}
                      disablePictureInPicture
                      onError={() => setMediaError(true)}
                    />
                  </div>
                ))}
              </div>
              <Image
                src={asset("portrait-iphone.jpg")}
                alt=""
                width={3000}
                height={2000}
                unoptimized
                className={styles.phoneForeground}
                aria-hidden="true"
              />
            </div>
          </div>
          <div className={styles.parentFooter}>
            <span>Scroll to move closer. Keep scrolling to explore.</span>
            <button onClick={() => dialog.current?.showModal()}>
              <Expand size={15} /> View mobile screen
            </button>
          </div>
          {mediaError && (
            <p role="status" className={styles.mediaError}>
              A recording could not load. Still previews remain available.
            </p>
          )}
          <p className={styles.parentReducedHint}>
            Reduced motion: choose a chapter to view still previews.
          </p>
        </div>
      </section>
      <dialog
        ref={dialog}
        className={`${styles.inspector} ${styles.phoneInspector}`}
        aria-labelledby="parent-screen-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
        onClose={() => dialog.current?.querySelector("video")?.pause()}
      >
        <div className={styles.inspectorHeader}>
          <div>
            <h2 id="parent-screen-title">Inside the Parent Hub</h2>
            <p>Actual mobile interface · fictional data</p>
          </div>
          <button
            aria-label="Close mobile screen view"
            onClick={() => dialog.current?.close()}
          >
            <X size={22} />
          </button>
        </div>
        <video
          key={chapter === 2 ? 1 : 0}
          src={asset(`${clips[chapter === 2 ? 1 : 0]}.mp4`)}
          poster={asset(`${clips[chapter === 2 ? 1 : 0]}.png`)}
          controls
          muted
          playsInline
          preload="none"
          aria-label="Silent Parent Hub mobile demonstration with fictional data"
        />
      </dialog>
    </>
  );
}
