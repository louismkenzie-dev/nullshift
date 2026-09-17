"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MobileParentHubShowcase } from "./MobileParentHubShowcase";
import { ArrowDown, Expand, X } from "lucide-react";
import {
  clamp,
  clipTime,
  preparedShowcaseClips,
  parentFrame,
  PARENT_CHAPTERS,
  showcaseAsset,
  showcaseImageLoader,
  showcaseInlineVideo,
} from "@/lib/showcasePrototype";
import { createFilmScrubber } from "@/lib/filmScrubber";
import styles from "./ShowcasePrototype.module.css";

const clips = ["parent-home", "parent-report"];
const mobileQuery = "(max-width: 900px)";
const subscribeMobile = (callback: () => void) => {
  const query = matchMedia(mobileQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
const mobileSnapshot = () => matchMedia(mobileQuery).matches;
const serverSnapshot = () => false;

export function ParentHubShowcase({ embedded = false }: { embedded?: boolean }) {
  const mobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, serverSnapshot);
  return mobile ? (
    <MobileParentHubShowcase embedded={embedded} />
  ) : (
    <DesktopParentHubShowcase embedded={embedded} />
  );
}

function DesktopParentHubShowcase({ embedded = false }: { embedded?: boolean }) {
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
  const [imagesReady, setImagesReady] = useState(false);
  const [inspectClip, setInspectClip] = useState<string | null>(null);

  useEffect(() => {
    const section = story.current;
    const device = camera.current;
    // Do not acquire desktop imagery while the responsive branch hydrates.
    if (!section || !device || matchMedia(mobileQuery).matches) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let previousProgress = -1;
    let lastChapter = 0;
    let active = false;
    let nearby = false;
    let dirty = true;
    let needsPaint = true;
    let top = 0;
    let travel = 1;
    let selected = 0;
    let mediaKey = "";
    const media = videos.current.filter((video): video is HTMLVideoElement => !!video);
    const scrubbers = media.map((video, index) =>
      createFilmScrubber(video, {
        fps: 30,
        canSeek: () =>
          active && !document.hidden && !reduced.matches && selected === index,
      })
    );
    const style = (node: HTMLElement, property: string, value: string) => {
      if (node.style.getPropertyValue(property) !== value)
        node.style.setProperty(property, value);
    };
    const measure = () => {
      if (!dirty || (!active && !nearby) || document.hidden) return;
      top = scrollY + section.getBoundingClientRect().top;
      travel = Math.max(1, section.offsetHeight - innerHeight);
      dirty = false;
    };
    const prepare = (progress: number) => {
      if (document.hidden) return;
      const wanted =
        nearby && !reduced.matches ? preparedShowcaseClips(progress, true) : [];
      const sources = media.map((_, index) =>
        wanted.includes(index)
          ? showcaseInlineVideo(
              clips[index],
              embedded,
              innerWidth <= 700,
              devicePixelRatio > 2
            )
          : ""
      );
      const key = sources.join("|");
      if (key === mediaKey) return;
      mediaKey = key;
      media.forEach((video, index) => {
        if ((video.getAttribute("src") ?? "") === sources[index]) return;
        scrubbers[index].reset();
        if (sources[index]) {
          video.preload = "auto";
          video.src = sources[index];
        } else {
          video.pause();
          video.removeAttribute("src");
        }
        video.load();
      });
    };
    const apply = () => {
      raf = 0;
      if (!active || document.hidden) return;
      measure();
      const progress = reduced.matches ? manual.current : clamp((scrollY - top) / travel);
      if (!needsPaint && previousProgress === progress) return;
      needsPaint = false;
      previousProgress = progress;
      const frame = parentFrame(progress);
      selected = frame.chapter === 2 ? 1 : 0;
      prepare(progress);
      if (section.dataset.progress !== progress.toFixed(4))
        section.dataset.progress = progress.toFixed(4);
      if (section.dataset.chapter !== String(frame.chapter))
        section.dataset.chapter = String(frame.chapter);
      if (frame.chapter !== lastChapter) {
        lastChapter = frame.chapter;
        setChapter(frame.chapter);
      }
      // Keep the portrait UI at its original aspect ratio. On phones it almost fills
      // the viewport; on desktops it fills the available height next to the story.
      style(device, "--phone-reveal", String(reduced.matches ? 1 : frame.zoom));
      style(section, "--parent-zoom", String(reduced.matches ? 1 : frame.zoom));
      const transition = clamp((progress - 0.63) / 0.035);
      layers.current.forEach((layer, i) => {
        if (layer) {
          style(
            layer,
            "visibility",
            i === selected || (i === 0 && transition < 1) ? "visible" : "hidden"
          );
          style(layer, "opacity", String(i === 0 ? 1 : transition));
        }
        const video = videos.current[i];
        if (
          video &&
          !reduced.matches &&
          i === selected &&
          Number.isFinite(video.duration)
        )
          scrubbers[i].request(
            clipTime(progress, i === 0 ? 0.3 : 0.63, i === 0 ? 0.63 : 1, video.duration)
          );
      });
    };
    const schedule = () => {
      if (active && !document.hidden && !raf) raf = requestAnimationFrame(apply);
    };
    const invalidate = () => {
      needsPaint = true;
      schedule();
    };
    refresh.current = invalidate;
    const resize = () => {
      dirty = true;
      invalidate();
    };
    const mediaObserver = new IntersectionObserver(
      ([entry]) => {
        nearby = entry.isIntersecting;
        if (nearby) {
          setImagesReady(true);
          dirty = true;
          measure();
        }
        prepare(clamp((scrollY - top) / travel));
      },
      { rootMargin: "800px 0px" }
    );
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      active = entry.isIntersecting;
      section.dataset.active = String(active && !document.hidden);
      if (active) resize();
      else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    const preference = () => {
      prepare(previousProgress);
      resize();
    };
    const visibility = () => {
      section.dataset.active = String(active && !document.hidden);
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else {
        dirty = true;
        prepare(previousProgress);
        invalidate();
      }
    };
    mediaObserver.observe(section);
    visibilityObserver.observe(section);
    const sizing = new ResizeObserver(resize);
    sizing.observe(section);
    sizing.observe(section.firstElementChild!);
    sizing.observe(document.body);
    media.forEach((video) => video.addEventListener("loadedmetadata", invalidate));
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", resize);
    reduced.addEventListener("change", preference);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(raf);
      mediaObserver.disconnect();
      visibilityObserver.disconnect();
      sizing.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", resize);
      reduced.removeEventListener("change", preference);
      document.removeEventListener("visibilitychange", visibility);
      media.forEach((video) => video.removeEventListener("loadedmetadata", invalidate));
      scrubbers.forEach((scrubber) => scrubber.destroy());
      refresh.current = () => {};
    };
  }, [embedded]);

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
              {imagesReady && (
                <Image
                  src={asset("portrait-iphone.jpg")}
                  alt="A robotic hand holding a portrait iPhone showing the Suffolk Tennis Parent Hub"
                  width={3000}
                  height={2000}
                  loader={embedded ? showcaseImageLoader : undefined}
                  unoptimized={!embedded}
                  sizes="(max-width: 700px) 210vw, 170vw"
                  loading="eager"
                  className={styles.phoneHardware}
                />
              )}
              <div className={styles.phoneScreen} aria-hidden="true">
                {clips.map((clip, index) => (
                  <div
                    key={clip}
                    className={styles.phoneClip}
                    ref={(el) => {
                      layers.current[index] = el;
                    }}
                  >
                    {imagesReady && (
                      <Image
                        src={asset(
                          `${index === 0 && chapter === 1 ? "parent-bookings" : clip}.png`
                        )}
                        alt=""
                        fill
                        loader={embedded ? showcaseImageLoader : undefined}
                        unoptimized={!embedded}
                        sizes="(max-width: 700px) 82vw, 440px"
                        loading="eager"
                      />
                    )}
                    <video
                      ref={(el) => {
                        videos.current[index] = el;
                      }}
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
              {imagesReady && (
                <Image
                  src={asset("portrait-iphone.jpg")}
                  alt=""
                  width={3000}
                  height={2000}
                  loader={embedded ? showcaseImageLoader : undefined}
                  unoptimized={!embedded}
                  sizes="(max-width: 700px) 210vw, 170vw"
                  loading="eager"
                  className={styles.phoneForeground}
                  aria-hidden="true"
                />
              )}
            </div>
          </div>
          <div className={styles.parentFooter}>
            <span>Scroll to move closer. Keep scrolling to explore.</span>
            <button
              onClick={() => {
                setInspectClip(clips[chapter === 2 ? 1 : 0]);
                dialog.current?.showModal();
              }}
            >
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
        onClose={() => {
          dialog.current?.querySelector("video")?.pause();
          setInspectClip(null);
        }}
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
        {inspectClip && (
          <video
            key={inspectClip}
            src={asset(`${inspectClip}.mp4`)}
            poster={asset(`${inspectClip}.png`)}
            controls
            muted
            playsInline
            preload="auto"
            aria-label="Silent Parent Hub mobile demonstration with fictional data"
          />
        )}
      </dialog>
    </>
  );
}
