"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronRight } from "lucide-react";
import { T } from "@nullshift/ui/tokens";
import { HeroVideo } from "@/components/HeroVideo";
import { ScrollDissolve } from "@/components/ScrollDissolve";

/* ── Animation variants ───────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, filter: "blur(12px)", y: 12 },
  visible: {
    opacity: 1,
    filter: "blur(0px)",
    y: 0,
    transition: { type: "spring" as const, bounce: 0.3, duration: 1.5 },
  },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
};

const staggerSlow = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.75 } },
};

// Sequenced headline phases — loops after final hold.
// Repositioned to the recurring / outcome message: more than a website →
// we run the system → (trades) catches every job → (wellness) fills every
// chair → the brand line.
const PHASES = [
  { text: "We build more\nthan websites.",          size: "clamp(2.8rem, 6.5vw, 5.5rem)", color: T.fg,      glow: false, hold: 3800, fast: false },
  { text: "We run the system",                      size: "clamp(2.8rem, 6.5vw, 5.5rem)", color: T.primary, glow: true,  hold: 2400, fast: false },
  { text: "that catches\nevery job",                size: "clamp(3rem, 8vw, 6.5rem)",     color: T.primary, glow: true,  hold: 1600, fast: true  },
  { text: "fills\nevery chair",                     size: "clamp(3rem, 8vw, 6.5rem)",     color: T.primary, glow: true,  hold: 1600, fast: true  },
  { text: "Own your system.\nSubscribe to results.", size: "clamp(2.4rem, 5.5vw, 4.6rem)", color: T.primary, glow: true,  hold: 20000, fast: false },
] as const;

const phaseEnter = { opacity: 0, filter: "blur(20px)", y: 24 };
const phaseVisible = (fast: boolean) => ({
  opacity: 1, filter: "blur(0px)", y: 0,
  transition: { duration: fast ? 0.5 : 1.1, ease: [0.2, 0.6, 0.2, 1] as const },
});
const phaseExit = (fast: boolean) => ({
  opacity: 0, filter: "blur(12px)", y: -18,
  transition: { duration: fast ? 0.35 : 0.6, ease: [0.4, 0, 1, 1] as const },
});

function AnimatedHeadline() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t = setTimeout(
      () => setPhase((p) => (p + 1) % PHASES.length),
      PHASES[phase].hold
    );
    return () => clearTimeout(t);
  }, [phase]);

  const p = PHASES[phase];

  return (
    <div
      className="relative mx-auto w-full"
      style={{ minHeight: "clamp(160px, 20vw, 280px)", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <AnimatePresence mode="wait">
        <motion.h1
          key={phase}
          className={`text-center w-full${p.glow ? " hero-glow" : ""}`}
          style={{
            fontFamily: T.sans,
            fontWeight: 600,
            fontSize: p.size,
            lineHeight: 1.04,
            letterSpacing: "-0.03em",
            color: p.color,
            whiteSpace: "pre-line",
            margin: 0,
          }}
          initial={phaseEnter}
          animate={phaseVisible(p.fast)}
          exit={phaseExit(p.fast)}
        >
          {p.text}
        </motion.h1>
      </AnimatePresence>
    </div>
  );
}

const stats = [
  { label: "Avg. delivery", value: "2–4 weeks" },
  { label: "Ownership", value: "100% yours" },
  { label: "Lock-in", value: "None" },
  { label: "We report", value: "£ recovered" },
];

export default function HeroText() {
  return (
    <>
      {/* ── Main hero ────────────────────────────── */}
      <div className="overflow-hidden">
        {/* Decorative blobs — top-left */}
        <div
          aria-hidden
          className="z-[2] absolute inset-0 pointer-events-none isolate opacity-60 contain-strict hidden lg:block"
        >
          <div className="w-[35rem] h-[80rem] -translate-y-[350px] absolute left-0 top-0 -rotate-45 rounded-full"
            style={{ background: `radial-gradient(68.54% 68.72% at 55.02% 31.46%, ${T.primary}14 0, ${T.primary}05 50%, transparent 80%)` }} />
          <div className="h-[80rem] absolute left-0 top-0 w-56 -rotate-45 rounded-full"
            style={{ background: `radial-gradient(50% 50% at 50% 50%, ${T.primary}0a 0, ${T.primary}04 80%, transparent 100%)`, translate: "5% -50%" }} />
        </div>

        <section>
          <div className="relative pt-24 md:pt-28">
            {/* Radial vignette at bottom */}
            <div
              aria-hidden
              className="absolute inset-0 -z-10 size-full"
              style={{ background: `radial-gradient(125% 125% at 50% 100%, transparent 0%, ${T.bg} 75%)` }}
            />

            <div className="mx-auto max-w-7xl px-6">
              <ScrollDissolve className="text-center sm:mx-auto lg:mr-auto lg:mt-0">

                {/* Announcement badge */}
                <motion.div variants={stagger} initial="hidden" animate="visible">
                  <motion.div variants={fadeUp}>
                    <Link
                      href="/systems-lab"
                      className="group mx-auto mb-0 flex w-fit items-center gap-4 rounded-full border p-1 pl-4 transition-all duration-300"
                      style={{
                        background: T.surface,
                        borderColor: T.border,
                        boxShadow: "0 1px 8px rgba(0,0,0,0.3)",
                      }}
                    >
                      <span style={{ fontFamily: T.sans, fontSize: "0.875rem", fontWeight: 500, color: T.muted }}>
                        New — Systems Lab is now live
                      </span>
                      <span style={{ display: "block", height: 16, width: 1, background: T.border }} />
                      <div
                        className="size-7 overflow-hidden rounded-full"
                        style={{ background: T.surface2 }}
                      >
                        <div className="flex w-14 transition-transform duration-500 ease-in-out group-hover:-translate-x-1/2">
                          <span className="flex size-7 shrink-0 items-center justify-center">
                            <ArrowRight size={12} color={T.primary} />
                          </span>
                          <span className="flex size-7 shrink-0 items-center justify-center">
                            <ArrowRight size={12} color={T.primary} />
                          </span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>

                  {/* Headline — sequenced animation */}
                  <div className="mt-6 lg:mt-8">
                    <AnimatedHeadline />
                  </div>

                  {/* Subtitle */}
                  <motion.p
                    variants={fadeUp}
                    className="mx-auto mt-6 max-w-2xl text-balance"
                    style={{
                      fontFamily: T.sans,
                      fontWeight: 400,
                      fontSize: "1.0625rem",
                      lineHeight: 1.65,
                      letterSpacing: "-0.005em",
                      color: T.muted,
                    }}
                  >
                    We build your bespoke site, then run the system that brings the
                    customers in — booking, missed-call recovery, automations and AI.
                    You own all of it, live in weeks, and we report the revenue we
                    recover every month.
                  </motion.p>
                </motion.div>

                {/* CTAs */}
                <motion.div
                  variants={staggerSlow}
                  initial="hidden"
                  animate="visible"
                  className="mt-8 flex flex-col items-center justify-center gap-3 md:flex-row"
                >
                  <motion.div variants={fadeUp}>
                    <div
                      className="rounded-[14px] p-0.5"
                      style={{
                        background: `${T.primary}22`,
                        border: `1px solid ${T.primary}44`,
                      }}
                    >
                      <a
                        href="/start"
                        className="inline-flex items-center justify-center font-medium transition-opacity hover:opacity-90"
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.9375rem",
                          fontWeight: 500,
                          letterSpacing: "-0.005em",
                          height: 46,
                          paddingInline: 22,
                          background: T.primary,
                          color: T.primaryFg,
                          borderRadius: "10px",
                          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 0 28px ${T.primary}35`,
                          textDecoration: "none",
                          whiteSpace: "nowrap",
                          display: "inline-flex",
                        }}
                      >
                        Get my free plan
                      </a>
                    </div>
                  </motion.div>

                  <motion.div variants={fadeUp}>
                    <a
                      href="/book"
                      className="inline-flex items-center justify-center font-medium"
                      style={{
                        fontFamily: T.sans, fontSize: "0.9375rem", fontWeight: 500,
                        letterSpacing: "-0.005em", height: 46, paddingInline: 22,
                        background: "transparent", color: T.muted, borderRadius: "10px",
                        border: `1px solid ${T.borderStr}`, textDecoration: "none", whiteSpace: "nowrap",
                      }}
                    >
                      Book a call
                    </a>
                  </motion.div>
                </motion.div>

                {/* Tertiary — live demos text link */}
                <motion.div
                  variants={fadeUp} initial="hidden" animate="visible"
                  className="mt-4 flex items-center justify-center"
                >
                  <a
                    href="/systems-lab"
                    className="inline-flex items-center gap-1 transition-opacity hover:opacity-75"
                    style={{
                      fontFamily: T.sans, fontSize: "0.875rem", fontWeight: 500,
                      letterSpacing: "-0.005em", color: T.faint, textDecoration: "none",
                    }}
                  >
                    Try the live demos
                    <ChevronRight size={14} />
                  </a>
                </motion.div>

                {/* Vertical chooser — surface the two wedge offers */}
                <motion.div
                  variants={fadeUp} initial="hidden" animate="visible"
                  className="mt-6 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1"
                  style={{ fontFamily: T.mono, fontSize: "0.72rem", letterSpacing: "0.04em", textTransform: "uppercase", color: T.faint }}
                >
                  <span>Built for</span>
                  <a href="/trades" style={{ color: T.primary, textDecoration: "none" }}>Trades →</a>
                  <span style={{ color: T.border }}>·</span>
                  <a href="/wellness" style={{ color: T.primary, textDecoration: "none" }}>Salons &amp; clinics →</a>
                </motion.div>
              </ScrollDissolve>
            </div>

            {/* Hero video — autoplaying interview */}
            <div className="relative mt-10 px-4 sm:mt-12 md:mt-14">
              <HeroVideo />
            </div>
          </div>
        </section>

        {/* ── Stats / trust row ───────────────────── */}
        <section
          className="pb-16 pt-16 md:pb-24"
          style={{ background: T.bg }}
        >
          <div className="group relative mx-auto max-w-5xl px-6">
            {/* Hover CTA */}
            <div className="absolute inset-0 z-10 flex scale-95 items-center justify-center opacity-0 duration-500 group-hover:scale-100 group-hover:opacity-100">
              <Link
                href="/about"
                className="flex items-center gap-1 text-sm duration-150 hover:opacity-75"
                style={{ fontFamily: T.sans, fontWeight: 500, color: T.fg, textDecoration: "none" }}
              >
                <span>Why choose Nullshift</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            {/* Stat tiles */}
            <div className="mx-auto mt-4 grid max-w-3xl grid-cols-2 gap-6 transition-all duration-500 group-hover:opacity-40 group-hover:blur-[2px] sm:grid-cols-4">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="flex flex-col items-center gap-1 text-center"
                >
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontWeight: 600,
                      fontSize: "clamp(1rem, 4vw, 1.5rem)",
                      letterSpacing: "-0.02em",
                      color: T.fg,
                      lineHeight: 1.1,
                    }}
                  >
                    {s.value}
                  </span>
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: T.muted,
                    }}
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
