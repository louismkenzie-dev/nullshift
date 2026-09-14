"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { createTimeline, onScroll } from "animejs";
import { ArrowDown, ArrowUpRight, Play } from "lucide-react";
import { ClaudePartnerBadge } from "@/components/ClaudePartnerBadge";
import { useAnimeScope, useHeavyMotion } from "@/lib/motion";
import styles from "./HeroStage.module.css";

/** Original concept artwork, not hardware or a client system. Text is always
 * server-visible. Desktop scroll changes two wrappers; phones get the still. */
export function HeroStage() {
  const root = useRef<HTMLElement>(null);
  const heavy = useHeavyMotion();
  useAnimeScope(root, heavy, (el) => {
    createTimeline({
      defaults: { ease: "linear" },
      autoplay: onScroll({
        target: el,
        enter: "top top",
        leave: "bottom bottom",
        sync: 0.35,
      }),
    })
      .add(
        el.querySelectorAll("[data-object-zoom]"),
        { scale: [1, 1.18], y: [0, -35], duration: 1000 },
        0
      )
      .add(
        el.querySelectorAll("[data-hero-copy]"),
        { opacity: [1, 0.16], y: [0, -24], duration: 850 },
        150
      );
  });

  return (
    <section
      ref={root}
      className={`k-dark ${styles.hero}`}
      aria-label="Bespoke systems, built around you"
    >
      <div
        className={styles.stage}
        onPointerMove={(event) => {
          if (!heavy || event.pointerType !== "mouse") return;
          const box = event.currentTarget.getBoundingClientRect();
          event.currentTarget.style.setProperty(
            "--object-x",
            `${((event.clientX - box.left) / box.width - 0.5) * 12}px`
          );
          event.currentTarget.style.setProperty(
            "--object-y",
            `${((event.clientY - box.top) / box.height - 0.5) * 8}px`
          );
        }}
        onPointerLeave={(event) => {
          event.currentTarget.style.removeProperty("--object-x");
          event.currentTarget.style.removeProperty("--object-y");
        }}
      >
        <div className={styles.art} aria-hidden>
          <div data-object-zoom className={styles.zoom}>
            <div className={styles.pointer}>
              <Image
                src="/marketing/system-object.webp"
                alt=""
                fill
                sizes="100vw"
                preload
                className={styles.image}
              />
            </div>
          </div>
        </div>
        <div className={styles.masthead} data-hero-copy>
          <p>BESPOKE SOFTWARE. BUILT AROUND YOU.</p>
          <div className={styles.wordmark} aria-hidden>
            nullshift<span>®</span>
          </div>
        </div>
        <div className={styles.copy} data-hero-copy>
          <span className={styles.index}>[01 — THE POSSIBILITIES]</span>
          <h1>
            We build anything <br />
            your business <br />
            <em>needs.</em>
          </h1>
          <p>
            Not another tool to work around.
            <br />A system that works around you.
          </p>
          <Link href="/start" className={styles.cta}>
            Show me what you’d build <ArrowUpRight size={19} />
          </Link>
          <Link href="/book" className={styles.call}>
            Or, let’s talk <ArrowUpRight size={13} />
          </Link>
        </div>
        <div className={styles.proof} data-hero-copy>
          <p>
            DESIGNED. BUILT.
            <br />
            RUN BY NULLSHIFT.
            <br />
            <span>OWNED BY YOU.</span>
          </p>
          <ClaudePartnerBadge />
        </div>
        <div className={styles.footer}>
          <span>YOUR BUSINESS. YOUR LOGIC. YOUR SYSTEM.</span>
          <a href="#capabilities" className={styles.scroll}>
            <ArrowDown size={14} /> Explore what’s possible
          </a>
          <Link href="/demo" className={styles.demo}>
            <Play size={12} fill="currentColor" /> Try a working demo{" "}
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
