"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, Expand, RotateCcw, X } from "lucide-react";
import {
  CHAPTERS,
  clamp,
  clipTime,
  preparedShowcaseClips,
  screenMatrix,
  showcaseFrame,
  showcaseAsset,
  showcaseImageLoader,
  showcaseInlineVideo,
} from "@/lib/showcasePrototype";
import { createFilmScrubber } from "@/lib/filmScrubber";
import { ParentHubShowcase } from "./ParentHubShowcase";
import styles from "./ShowcasePrototype.module.css";

const clips = ["programme", "ledger", "progress"];

export function ShowcasePrototype({
  embedded = false,
  introduction = "case-study",
}: {
  embedded?: boolean;
  introduction?: "case-study" | "home";
}) {
  const homeIntro = introduction === "home";
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
  const [inspectClip, setInspectClip] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const [imagesReady, setImagesReady] = useState(false);

  useEffect(() => {
    const element = story.current;
    const camera = photo.current;
    if (!element || !camera) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const narrow = window.matchMedia("(max-width: 700px)");
    let raf = 0;
    let active = false;
    let nearby = false;
    let dirty = true;
    let needsPaint = true;
    let top = 0;
    let travel = 1;
    let cameraWidth = 0;
    let stageHeight = 0;
    let previousProgress = -1;
    let previousChapter = 0;
    let selected = -1;
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
      top = scrollY + element.getBoundingClientRect().top;
      travel = Math.max(1, element.offsetHeight - innerHeight);
      cameraWidth = camera.offsetWidth;
      stageHeight = element.firstElementChild?.clientHeight ?? innerHeight;
      if (screen.current) {
        style(
          screen.current,
          "transform",
          `matrix3d(${screenMatrix(cameraWidth).join(",")})`
        );
        style(screen.current, "visibility", "visible");
      }
      dirty = false;
    };
    const prepare = (progress: number) => {
      if (document.hidden) return;
      const wanted = nearby && !reduced.matches ? preparedShowcaseClips(progress) : [];
      const sources = media.map((_, index) =>
        wanted.includes(index)
          ? showcaseInlineVideo(
              clips[index],
              embedded,
              narrow.matches,
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
      const progress = reduced.matches
        ? manualProgress.current
        : clamp((scrollY - top) / travel);
      if (!needsPaint && previousProgress === progress) return;
      needsPaint = false;
      previousProgress = progress;
      const frame = showcaseFrame(progress);
      selected = frame.chapter - 1;
      prepare(progress);
      if (previousChapter !== frame.chapter) {
        previousChapter = frame.chapter;
        setChapter(frame.chapter);
      }
      if (element.dataset.chapter !== String(frame.chapter))
        element.dataset.chapter = String(frame.chapter);
      if (element.dataset.progress !== progress.toFixed(4))
        element.dataset.progress = progress.toFixed(4);
      // Phones retain the story, with a tighter initial crop and less travel.
      const maxDesktopZoom = Math.max(
        1,
        (stageHeight * 0.49) / ((cameraWidth / 1.5) * 0.359)
      );
      const zoom = narrow.matches
        ? reduced.matches
          ? 1.2
          : 1.1 + (frame.zoom - 1) * 0.15
        : Math.min(maxDesktopZoom, reduced.matches ? 1.2 : frame.zoom);
      style(camera, "--camera-zoom", String(zoom));
      if (meter.current) style(meter.current, "transform", `scaleX(${progress})`);
      if (logo.current) {
        style(logo.current, "opacity", String(frame.logoOpacity));
        style(logo.current, "visibility", frame.logoOpacity > 0 ? "visible" : "hidden");
      }
      const transition =
        selected >= 0 ? clamp((progress - CHAPTERS[selected + 1].start) / 0.035) : 0;
      layers.current.forEach((layer, index) => {
        if (!layer) return;
        const entry = CHAPTERS[index + 1];
        const visible = index === selected || (index === selected - 1 && transition < 1);
        style(layer, "visibility", visible ? "visible" : "hidden");
        style(layer, "opacity", String(index === selected ? transition : 1));
        const video = videos.current[index];
        if (
          video &&
          !reduced.matches &&
          Number.isFinite(video.duration) &&
          selected === index
        )
          scrubbers[index].request(
            clipTime(progress, entry.start, entry.end, video.duration)
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
    update.current = invalidate;
    const resize = () => {
      dirty = true;
      invalidate();
    };
    const observers = new ResizeObserver(resize);
    observers.observe(camera);
    observers.observe(element);
    observers.observe(document.body);
    media.forEach((video) => video.addEventListener("loadedmetadata", invalidate));
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
      element.dataset.active = String(active && !document.hidden);
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
      element.dataset.active = String(active && !document.hidden);
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else {
        dirty = true;
        prepare(previousProgress);
        invalidate();
      }
    };
    mediaObserver.observe(element);
    visibilityObserver.observe(element);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    reduced.addEventListener("change", preference);
    narrow.addEventListener("change", resize);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(raf);
      observers.disconnect();
      mediaObserver.disconnect();
      visibilityObserver.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", resize);
      reduced.removeEventListener("change", preference);
      narrow.removeEventListener("change", resize);
      document.removeEventListener("visibilitychange", visibility);
      media.forEach((video) => video.removeEventListener("loadedmetadata", invalidate));
      scrubbers.forEach((scrubber) => scrubber.destroy());
      update.current = () => {};
    };
  }, [embedded]);

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

      <section
        className={`${styles.intro} ${homeIntro ? styles.homeIntro : ""}`}
        aria-labelledby="showcase-title"
      >
        <p className={styles.eyebrow}>
          <span /> Suffolk Tennis · A Nullshift client story
        </p>
        <Heading id="showcase-title">
          {homeIntro ? (
            <>
              Simplify complex processes into <em>one neat package</em>
            </>
          ) : (
            <>
              One county.
              <br />
              Every player. <em>Connected.</em>
            </>
          )}
        </Heading>
        <div className={styles.introBottom}>
          <p>
            {homeIntro ? (
              <>
                Bookings, payments, player records and parent communications — brought
                together in one Suffolk Tennis platform.
              </>
            ) : (
              <>
                From the team running county tennis
                <br />
                to the families on the court. One connected platform.
              </>
            )}
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
            {imagesReady && (
              <Image
                src={asset("studio-display.jpg")}
                alt="Two people at a desk looking at a Studio Display"
                width={3000}
                height={2000}
                loader={embedded ? showcaseImageLoader : undefined}
                unoptimized={!embedded}
                sizes="(max-width: 700px) 215vw, 160vw"
                loading="eager"
                className={styles.photograph}
              />
            )}
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
                  {imagesReady &&
                    (index === Math.max(0, chapter - 1) || index === chapter - 2) && (
                      <Image
                        src={asset(`${clip}.png`)}
                        alt=""
                        fill
                        loader={embedded ? showcaseImageLoader : undefined}
                        unoptimized={!embedded}
                        sizes="(max-width: 700px) 96vw, 60vw"
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
        onClose={() => {
          dialog.current?.querySelector("video")?.pause();
          setInspectClip(null);
        }}
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
        {inspectClip && (
          <video
            key={inspectClip}
            src={asset(`${inspectClip}.mp4`)}
            poster={asset(`${inspectClip}.png`)}
            controls
            muted
            playsInline
            preload="auto"
            aria-label={`${inspectClip} screen recording; silent demonstration with fictional data`}
          />
        )}
        <p className={styles.inspectorNote}>
          Silent recording. Use playback controls to inspect the workflow independently of
          the page scroll.
        </p>
      </dialog>
    </Container>
  );
}
