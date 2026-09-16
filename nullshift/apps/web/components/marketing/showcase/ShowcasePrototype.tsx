"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, Expand, RotateCcw, X } from "lucide-react";
import {
  CHAPTERS,
  clamp,
  clipTime,
  dampProgress,
  screenMatrix,
  showcaseFrame,
  showcaseAsset,
} from "@/lib/showcasePrototype";
import { ParentHubShowcase } from "./ParentHubShowcase";
import styles from "./ShowcasePrototype.module.css";

const clips = ["programme", "ledger", "progress"];

export function ShowcasePrototype({ embedded = false }: { embedded?: boolean }) {
  const asset = (name: string) => showcaseAsset(name, embedded);
  const Container = embedded ? "div" : "main";
  const Heading = embedded ? "h2" : "h1";
  const story = useRef<HTMLElement>(null);
  const photo = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const logo = useRef<HTMLDivElement>(null);
  const meter = useRef<HTMLDivElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const manualProgress = useRef(0);
  const update = useRef<() => void>(() => {});
  const [chapter, setChapter] = useState(0);
  const [inspectClip, setInspectClip] = useState("programme");
  const [mediaError, setMediaError] = useState(false);

  useEffect(() => {
    const element = story.current;
    const camera = photo.current;
    if (!element || !camera) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const narrow = window.matchMedia("(max-width: 700px)");
    let raf = 0;
    let displayed = 0;
    let lastTime = 0;
    let initialised = false;
    let previousChapter = -1;
    const targets = new Map<HTMLVideoElement, number>();
    const seek = (video: HTMLVideoElement) => {
      const desired = targets.get(video);
      if (desired === undefined || !Number.isFinite(video.duration) || video.seeking)
        return;
      if (Math.abs(video.currentTime - desired) > 0.025) video.currentTime = desired;
    };
    const apply = () => {
      raf = 0;
      const rect = element.getBoundingClientRect();
      const target = reduced.matches
        ? manualProgress.current
        : clamp(-rect.top / Math.max(1, element.offsetHeight - window.innerHeight));
      const now = performance.now();
      displayed =
        reduced.matches || !initialised
          ? target
          : dampProgress(displayed, target, now - lastTime);
      initialised = true;
      lastTime = now;
      const progress = displayed;
      const frame = showcaseFrame(progress);
      if (previousChapter !== frame.chapter) {
        previousChapter = frame.chapter;
        setChapter(frame.chapter);
      }
      element.dataset.chapter = String(frame.chapter);
      element.dataset.progress = progress.toFixed(4);
      // Phones retain the story, with a tighter initial crop and less travel.
      const stageHeight = element.firstElementChild?.clientHeight ?? window.innerHeight;
      const maxDesktopZoom = Math.max(
        1,
        (stageHeight * 0.49) / ((camera.offsetWidth / 1.5) * 0.359)
      );
      const zoom = narrow.matches
        ? reduced.matches
          ? 1.2
          : 1.1 + (frame.zoom - 1) * 0.15
        : Math.min(maxDesktopZoom, reduced.matches ? 1.2 : frame.zoom);
      camera.style.setProperty("--camera-zoom", String(zoom));
      if (meter.current) meter.current.style.transform = `scaleX(${progress})`;
      if (logo.current) logo.current.style.opacity = String(frame.logoOpacity);
      layers.current.forEach((layer, index) => {
        if (!layer) return;
        const entry = CHAPTERS[index + 1];
        const incoming = clamp((progress - entry.start) / 0.035);
        layer.style.opacity = String(incoming);
        const video = videos.current[index];
        if (video && Number.isFinite(video.duration) && frame.chapter === index + 1) {
          targets.set(
            video,
            reduced.matches
              ? 0
              : clipTime(progress, entry.start, entry.end, video.duration)
          );
          seek(video);
        }
      });
      if (displayed !== target) raf = requestAnimationFrame(apply);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    update.current = apply;
    const resize = () => {
      if (screen.current) {
        screen.current.style.transform = `matrix3d(${screenMatrix(camera.offsetWidth).join(",")})`;
        screen.current.style.visibility = "visible";
      }
      schedule();
    };
    const observers = new ResizeObserver(resize);
    observers.observe(camera);
    observers.observe(element);
    const media = videos.current.filter((video): video is HTMLVideoElement => !!video);
    const completed = new Map<HTMLVideoElement, () => void>();
    for (const video of media) {
      const done = () => seek(video);
      completed.set(video, done);
      video.addEventListener("loadedmetadata", schedule);
      video.addEventListener("seeked", done);
    }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    reduced.addEventListener("change", resize);
    narrow.addEventListener("change", resize);
    resize();
    return () => {
      cancelAnimationFrame(raf);
      observers.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", resize);
      reduced.removeEventListener("change", resize);
      narrow.removeEventListener("change", resize);
      for (const video of media) {
        video.removeEventListener("loadedmetadata", schedule);
        video.removeEventListener("seeked", completed.get(video)!);
      }
      update.current = () => {};
    };
  }, []);

  const goTo = (index: number) => {
    if (!story.current) return;
    const entry = CHAPTERS[index];
    const target = index === 0 ? 0 : entry.start + 0.035;
    manualProgress.current = target;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      update.current();
      return;
    }
    const top = window.scrollY + story.current.getBoundingClientRect().top;
    window.scrollTo({
      top: top + target * (story.current.offsetHeight - window.innerHeight),
      behavior: "smooth",
    });
  };

  return (
    <Container className={`${styles.page} ${embedded ? styles.embedded : ""}`}>
      {!embedded && (
        <header className={styles.header}>
          <Link
            href="/"
            className={styles.wordmark}
            aria-label="Nullshift home"
            prefetch={false}
          >
            nullshift<span>®</span>
          </Link>
          <span className={styles.study}>Client stories / Suffolk Tennis</span>
          <a href="#showcase" className={styles.headerLink}>
            Explore the work <ArrowDown size={14} />
          </a>
        </header>
      )}

      <section className={styles.intro} aria-labelledby="showcase-title">
        <p className={styles.eyebrow}>
          <span /> Suffolk Tennis · A Nullshift client story
        </p>
        <Heading id="showcase-title">
          One county.
          <br />
          Every player. <em>Connected.</em>
        </Heading>
        <div className={styles.introBottom}>
          <p>
            From the team running county tennis
            <br />
            to the families on the court. One connected platform.
          </p>
          <a href="#showcase">
            Scroll to see it in action <ArrowDown size={17} />
          </a>
        </div>
      </section>

      <section
        id="showcase"
        ref={story}
        className={styles.story}
        aria-label="Suffolk Tennis scroll showcase"
        data-chapter="0"
      >
        <div className={styles.stage}>
          <div className={styles.photo} ref={photo}>
            <Image
              src={asset("studio-display.jpg")}
              alt="Two people at a desk looking at a Studio Display"
              width={3000}
              height={2000}
              unoptimized
              preload
              className={styles.photograph}
            />
            <div ref={screen} className={styles.screen} aria-hidden="true">
              <div className={styles.screenBase} />
              {clips.map((clip, index) => (
                <div
                  className={styles.clipLayer}
                  key={clip}
                  ref={(el) => {
                    layers.current[index] = el;
                  }}
                >
                  <Image
                    src={asset(`${clip}.png`)}
                    alt=""
                    fill
                    unoptimized
                    sizes="1600px"
                    loading="eager"
                  />
                  <video
                    ref={(el) => {
                      videos.current[index] = el;
                    }}
                    src={asset(`${clip}.mp4`)}
                    poster={asset(`${clip}.png`)}
                    muted
                    playsInline
                    preload="auto"
                    tabIndex={-1}
                    disablePictureInPicture
                    onError={() => setMediaError(true)}
                  />
                </div>
              ))}
              <div ref={logo} className={styles.logoScene}>
                <Image
                  src={asset("suffolk-logo.png")}
                  alt=""
                  width={660}
                  height={166}
                  unoptimized
                />
                <div className={styles.logoRule} />
                <p>ONE COUNTY. CONNECTED.</p>
                <span>A bespoke platform by Nullshift</span>
              </div>
              <div className={styles.glass} />
            </div>
          </div>

          <div className={styles.topline}>
            <span>
              Selected work <i>/</i> Suffolk Tennis
            </span>
            <span className={styles.sample}>Fictional demo data</span>
          </div>
          <div className={styles.caption}>
            <div key={chapter} className={styles.captionContent}>
              <p className={styles.chapterLabel}>
                <span>0{chapter + 1}</span> {CHAPTERS[chapter].label}
              </p>
              <h2>{CHAPTERS[chapter].title}</h2>
              <p className={styles.detail}>{CHAPTERS[chapter].detail}</p>
              <ul className={styles.featureList} aria-label="Features shown">
                {CHAPTERS[chapter].features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className={styles.toolbar}>
            <nav aria-label="Showcase chapters" className={styles.chapters}>
              {CHAPTERS.map((entry, index) => (
                <button
                  key={entry.label}
                  type="button"
                  onClick={() => goTo(index)}
                  aria-current={chapter === index ? "step" : undefined}
                  aria-label={`Chapter ${index + 1}: ${entry.label}`}
                >
                  <span>0{index + 1}</span>
                  <span>{entry.label}</span>
                </button>
              ))}
            </nav>
            <button
              className={styles.expand}
              onClick={() => {
                setInspectClip(clips[Math.max(0, chapter - 1)]);
                dialog.current?.showModal();
              }}
            >
              <Expand size={15} />
              <span>View screen</span>
            </button>
          </div>
          <div className={styles.progressTrack}>
            <div ref={meter} />
          </div>
          {mediaError && (
            <p role="status" className={styles.mediaError}>
              A recording could not load. Still previews remain available.
            </p>
          )}
          <p className={styles.reducedHint}>
            Reduced motion: choose a chapter to explore the still previews.
          </p>
        </div>
      </section>

      <ParentHubShowcase embedded={embedded} />

      {!embedded && (
        <section className={styles.outro}>
          <p className={styles.eyebrow}>Your business. Built to move forward.</p>
          <h2>
            We build it.
            <br />
            We run it.
            <br />
            <span>We grow it with you.</span>
          </h2>
          <div className={styles.outroBottom}>
            <p>
              One team, from the first conversation
              <br />
              to whatever comes next.
            </p>
            <button onClick={() => goTo(0)}>
              Experience it again <RotateCcw size={17} />
            </button>
          </div>
          <div className={styles.notes}>
            <span>Local prototype — not a published case study.</span>
            <span>
              Actual Suffolk Tennis UI. Fictional people and payments. No live services.
            </span>
            <Link href="/" prefetch={false}>
              Back to Nullshift <ArrowUpRight size={13} />
            </Link>
          </div>
        </section>
      )}
      <dialog
        ref={dialog}
        className={styles.inspector}
        aria-labelledby="screen-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
        onClose={() => dialog.current?.querySelector("video")?.pause()}
      >
        <div className={styles.inspectorHeader}>
          <div>
            <h2 id="screen-title">Inside Suffolk Tennis</h2>
            <p>Actual interface · fictional demo data</p>
          </div>
          <button aria-label="Close screen view" onClick={() => dialog.current?.close()}>
            <X size={22} />
          </button>
        </div>
        <video
          key={inspectClip}
          src={asset(`${inspectClip}.mp4`)}
          poster={asset(`${inspectClip}.png`)}
          controls
          muted
          playsInline
          preload="metadata"
          aria-label={`${inspectClip} screen recording; silent demonstration with fictional data`}
        />
        <p className={styles.inspectorNote}>
          Silent recording. Use playback controls to inspect the workflow independently of
          the page scroll.
        </p>
      </dialog>
    </Container>
  );
}
