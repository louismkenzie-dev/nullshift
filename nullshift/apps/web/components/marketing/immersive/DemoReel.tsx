"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./DemoReel.module.css";

const REELS = [
  {
    id: "booking",
    title: "A space, booked.",
    description:
      "A simulated booking creates Sam’s ticket. No card details or money involved.",
  },
  {
    id: "scanner",
    title: "A ticket, checked.",
    description:
      "A valid scan updates the register. A second scan is caught immediately.",
  },
  {
    id: "register",
    title: "A team, in sync.",
    description: "The team can see who has arrived and mark attendance manually.",
  },
] as const;

/** Small, silent recordings from /demo, never from a client's live account.
 * Nothing downloads or plays until visible; reduced motion gets a still.
 * The separate pause button lets any visitor stop the looping movement. */
function Clip({ id, title }: { id: string; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const manual = useRef<boolean | null>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const update = () => {
      const shouldPlay =
        visible && !document.hidden && (manual.current ?? !motion.matches);
      if (shouldPlay) {
        if (!video.getAttribute("src")) video.src = `/clients/demo-${id}.mp4`;
        void video.play().catch(() => setPlaying(false));
      } else video.pause();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        update();
      },
      { threshold: 0.15 }
    );
    observer.observe(video);
    motion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
      video.pause();
    };
  }, [id]);
  return (
    <div className={styles.clip}>
      <video
        ref={ref}
        width={1100}
        height={680}
        poster={`/clients/demo-${id}-poster.webp`}
        muted
        loop
        playsInline
        preload="none"
        aria-label={`${title} Recording of a fictional demo.`}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button
        type="button"
        className={styles.playback}
        aria-label={`${playing ? "Pause" : "Play"} demo recording`}
        onClick={() => {
          const video = ref.current;
          if (!video) return;
          manual.current = video.paused;
          if (video.paused) {
            if (!video.getAttribute("src")) video.src = `/clients/demo-${id}.mp4`;
            void video.play().catch(() => setPlaying(false));
          } else video.pause();
        }}
      >
        {playing ? "Ⅱ Pause" : "▷ Play"}
      </button>
    </div>
  );
}

export function DemoReel() {
  const [selected, setSelected] = useState(0);
  const reel = REELS[selected];
  return (
    <section className={`k-dark ${styles.reel}`} aria-label="Watch the fictional demo">
      <div className={styles.top}>
        <span>[PLAYGROUND — NOT CLIENT DATA]</span>
        <Link href="/demo">Try it yourself ↗</Link>
      </div>
      <div className={styles.layout}>
        <div className={styles.copy}>
          <h2>
            See the
            <br />
            whole thing
            <br />
            <em>working.</em>
          </h2>
          <p>One fictional studio. A real, connected demo you can explore.</p>
          <div className={styles.choices} aria-label="Choose a demo recording">
            {REELS.map((entry, index) => (
              <button
                key={entry.id}
                aria-pressed={selected === index}
                onClick={() => setSelected(index)}
              >
                <span>0{index + 1}</span>
                {entry.title}
                <span>↗</span>
              </button>
            ))}
          </div>
        </div>
        <figure className={styles.figure}>
          <Clip key={reel.id} id={reel.id} title={reel.title} />
          <figcaption>
            {reel.description}
            <span>
              Recorded from the Nullshift playground · all people and events are
              fictional.
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
