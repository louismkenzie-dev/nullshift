"use client";

import Image from "next/image";
import { useState } from "react";
import { showcaseAsset, showcaseImageLoader } from "@/lib/showcasePrototype";
import styles from "./MobileParentHubShowcase.module.css";

const CHAPTERS = [
  {
    tab: "Players",
    title: "Every player. One place.",
    detail:
      "Keep each child’s profile and tennis journey together in one family account.",
    image: "parent-home",
  },
  {
    tab: "Bookings",
    title: "Their next session, sorted.",
    detail: "Upcoming training, confirmed places and payments — all in one clear view.",
    image: "parent-bookings",
  },
  {
    tab: "Progress",
    title: "Feedback that moves them forward.",
    detail:
      "Coaching reports, skill scores and development goals, ready whenever parents need them.",
    image: "parent-report",
  },
];

export function MobileParentHubShowcase({ embedded = false }: { embedded?: boolean }) {
  const [selected, setSelected] = useState(0);
  const chapter = CHAPTERS[selected];
  return (
    <section
      id="parent-hub-showcase"
      className={styles.section}
      aria-labelledby="mobile-parent-title"
      data-mobile-parent
    >
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Suffolk Tennis / Parent Hub</p>
        <h2 id="mobile-parent-title">
          Their tennis.
          <br />
          <span>In their pocket.</span>
        </h2>
        <p>
          A connected experience for families. Designed to work beautifully on the go.
        </p>
      </header>
      <div className={styles.tabs} role="tablist" aria-label="Explore the Parent Hub">
        {CHAPTERS.map((entry, index) => (
          <button
            key={entry.tab}
            id={`parent-mobile-tab-${index}`}
            type="button"
            role="tab"
            aria-selected={selected === index}
            aria-controls="parent-mobile-panel"
            tabIndex={selected === index ? 0 : -1}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % 3
                  : event.key === "ArrowLeft"
                    ? (index + 2) % 3
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 2
                        : -1;
              if (next < 0) return;
              event.preventDefault();
              setSelected(next);
              document.getElementById(`parent-mobile-tab-${next}`)?.focus();
            }}
          >
            {entry.tab}
          </button>
        ))}
      </div>
      <div
        id="parent-mobile-panel"
        role="tabpanel"
        aria-labelledby={`parent-mobile-tab-${selected}`}
        tabIndex={0}
      >
        <div className={styles.description}>
          <h3>{chapter.title}</h3>
          <p>{chapter.detail}</p>
        </div>
        <figure className={styles.preview}>
          <div className={styles.previewLabel}>
            <span>Inside the Parent Hub</span>
            <span>0{selected + 1} / 03</span>
          </div>
          <Image
            key={chapter.image}
            src={showcaseAsset(`${chapter.image}.png`, embedded)}
            alt={`Suffolk Tennis ${chapter.tab.toLowerCase()} interface with fictional demonstration data`}
            width={1170}
            height={2250}
            loader={embedded ? showcaseImageLoader : undefined}
            unoptimized={!embedded}
            sizes="(max-width: 560px) calc(100vw - 40px), 480px"
            className={styles.screen}
          />
          <figcaption>Actual interface · Fictional demo data</figcaption>
        </figure>
      </div>
      <p className={styles.ending}>
        Built for their team. <span>Made for their families.</span>
      </p>
    </section>
  );
}
