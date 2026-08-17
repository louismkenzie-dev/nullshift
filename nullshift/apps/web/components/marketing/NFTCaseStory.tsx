"use client";

import React, { useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useTransform,
  useMotionValueEvent,
} from "framer-motion";
import { T } from "@nullshift/ui/tokens";
import { useScrollProgress } from "@/components/useScrollProgress";
import { NullshiftPlayer } from "./NullshiftPlayer";

/** Client story — how we built NewFuture Therapy.
 *
 *  A pinned, scroll-driven brand morph: the story card starts as a Nullshift
 *  build spec (dark canvas, emerald, mono) and — beat by beat — becomes the
 *  real NewFuture Therapy frontend (their live homepage hero, faithfully
 *  reproduced from their repo), landing on Laura's portrait testimonial front
 *  and centre in the Nullshift-branded player (video hosted on Mux).
 *
 *  Mobile / reduced-motion: unpinned, beats stack, no scroll hijack.
 */

/* NewFuture Therapy brand — lifted from their repo (globals.css + HomeHero) */
const NFT = {
  cream: "#F5F3EF",
  sage: "#6B8C6F",
  sageLight: "#C4D9C6",
  sageDark: "#3A5A40",
  sagePale: "#EBF2EC",
  charcoal: "#2D2926",
  greyMid: "#8C8680",
  muted: "#5C5651",
  serif: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  body: "'DM Sans', system-ui, sans-serif",
} as const;

/** Laura's video testimonial (portrait 9:16) — Mux playback ID. */
const TESTIMONIAL_PLAYBACK_ID = "hevvtK01oksR8HWcs5fJAjbICgIoPCHlW3zY89ZywMRA";

type Beat = {
  tag: string;
  title: string;
  body: string;
  chips: string[];
};

const BEATS: Beat[] = [
  {
    tag: "01 · The brief",
    title: "A practice, not just a page",
    body: "NewFuture Therapy is Laura and Esther — twin sisters and BACP-accredited counsellors in Wakefield. What began as a premium marketing site grew, phase by phase, into a full digital-therapy platform. Nine weeks from first commit to production AI.",
    chips: [
      "Two-therapist practice",
      "Wakefield & online",
      "9 weeks, brief → production",
    ],
  },
  {
    tag: "02 · Brand & site",
    title: "Calm surface, engineered underneath",
    body: "A bespoke design system — warm cream, sage, a serif voice, nothing bounces — with inclusivity written in as product rules, not vibes. And from day one, client enquiries are AES-256 encrypted before they even leave the app: raw database access yields nothing readable.",
    chips: ["Bespoke design system", "Inclusive by rule", "Encrypted enquiries"],
  },
  {
    tag: "03 · The growth engine",
    title: "Found, and useful, without us",
    body: "An articles engine with proper structured data, a local landing page for Wakefield counselling searches, and a public resources library — worksheets and factsheets as branded, printable PDFs — all self-managed by the therapists from their own back office.",
    chips: ["SEO articles engine", "Local landing page", "Self-managed resources"],
  },
  {
    tag: "04 · The AI companion",
    title: "Their rules, enforced in code",
    body: "The headline: NewFuture Reflections — an AI companion built to the therapists' own 17-section behavioural spec. Safety lives in architecture, not prompts: a fixed crisis screen the model can never rewrite, partner answers it is never shown, transcripts no therapist can read. Live in production; the full course platform is in private testing ahead of launch.",
    chips: [
      "Built to their written spec",
      "Safety by architecture",
      "~£1–3 / participant / mo",
    ],
  },
];

export function NFTCaseStory() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);

  // Lenis-proof progress (framer's useScroll stays at 0 under Lenis — see hook).
  const scrollYProgress = useScrollProgress(ref, ["start start", "end end"]);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(
      Math.min(BEATS.length - 1, Math.max(0, Math.floor(v * BEATS.length + 0.0001)))
    );
  });

  /* Brand interpolation — Nullshift spec sheet → NewFuture Therapy frontend */
  const cardBg = useTransform(scrollYProgress, [0.18, 0.72], [T.bg, NFT.cream]);
  const cardBorder = useTransform(scrollYProgress, [0.18, 0.72], [T.border, NFT.sage]);
  const specOpacity = useTransform(scrollYProgress, [0.3, 0.55], [1, 0]);
  const siteOpacity = useTransform(scrollYProgress, [0.45, 0.72], [0, 1]);

  const beat = BEATS[active];

  /* ── Static fallback (reduced motion): beats stack, real frame, player ── */
  if (reduce) {
    return (
      <div>
        {BEATS.map((b) => (
          <StaticBeat key={b.tag} beat={b} />
        ))}
        <div style={{ margin: "26px 0 40px" }}>
          <NFTSiteFrame final />
        </div>
        <LauraPlayer />
      </div>
    );
  }

  return (
    <div>
      {/* Pinned morph — tall scroll runway, sticky viewport */}
      <div ref={ref} style={{ height: `${BEATS.length * 85}vh`, position: "relative" }}>
        <div
          className="lg:grid lg:grid-cols-[0.85fr_1.15fr] lg:gap-14 lg:items-center"
          style={{
            position: "sticky",
            top: 0,
            minHeight: "100dvh",
            paddingTop: "clamp(60px, 9vh, 110px)",
            paddingBottom: 40,
          }}
        >
          {/* Beat copy */}
          <div style={{ maxWidth: 480 }}>
            <div style={{ ...monoTag, color: "var(--k-accent)" }}>{beat.tag}</div>
            <h3
              key={beat.title}
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: "clamp(1.5rem, 2.6vw, 2.1rem)",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                color: "var(--k-fg)",
                marginTop: 12,
                animation: "nsBeatIn 420ms ease both",
              }}
            >
              {beat.title}
            </h3>
            <p
              key={beat.body.slice(0, 24)}
              style={{
                fontFamily: T.sans,
                fontSize: "0.98rem",
                lineHeight: 1.65,
                color: "var(--k-muted)",
                marginTop: 14,
                animation: "nsBeatIn 420ms 60ms ease both",
              }}
            >
              {beat.body}
            </p>
            <div className="flex flex-wrap gap-1.5" style={{ marginTop: 16 }}>
              {beat.chips.map((c, i) => (
                <span
                  key={`${active}-${c}`}
                  style={{
                    fontFamily: T.mono,
                    fontSize: "9px",
                    fontWeight: 500,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--k-accent)",
                    background: "rgba(16,185,129,0.1)",
                    padding: "3px 8px",
                    animation: `nsBeatIn 380ms ${i * 70}ms ease both`,
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
            {/* Progress rail */}
            <div className="flex gap-2" style={{ marginTop: 26 }}>
              {BEATS.map((b, i) => (
                <span
                  key={b.tag}
                  style={{
                    height: 2,
                    flex: 1,
                    background: i <= active ? "var(--k-accent)" : "var(--k-border)",
                    transition: "background 300ms ease",
                  }}
                />
              ))}
            </div>
          </div>

          {/* The morphing card: Nullshift build spec → their real frontend */}
          <motion.div
            className="mt-10 lg:mt-0"
            style={{
              position: "relative",
              background: cardBg,
              border: "1px solid",
              borderColor: cardBorder,
              minHeight: "min(60vh, 540px)",
              overflow: "hidden",
            }}
          >
            {/* Layer A — the Nullshift build spec */}
            <motion.div
              style={{
                opacity: specOpacity,
                position: "absolute",
                inset: 0,
                padding: "clamp(20px, 3vw, 34px)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 22,
              }}
            >
              <div style={{ ...monoTag, display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    background: T.primary,
                    display: "inline-block",
                  }}
                />
                <span style={{ fontSize: 13, letterSpacing: "0.22em", color: T.fg }}>
                  NULLSHIFT
                </span>
                <span style={{ color: T.faint }}>// build spec · newfuture-therapy</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  "01 — Brand system + encrypted enquiries",
                  "02 — SEO engine + resources library",
                  "03 — Course platform · private testing",
                  "04 — Reflections AI · live in production",
                ].map((line, i) => (
                  <div
                    key={line}
                    className="flex items-center justify-between"
                    style={{
                      border: `1px solid ${T.border}`,
                      background: i <= active ? "rgba(16,185,129,0.08)" : "transparent",
                      padding: "12px 14px",
                      transition: "background 300ms ease",
                    }}
                  >
                    <span
                      style={{ fontFamily: T.sans, fontSize: "0.86rem", color: T.fg }}
                    >
                      {line}
                    </span>
                    <span
                      aria-hidden
                      style={{
                        color: i <= active ? T.primary : T.faint,
                        fontSize: 12,
                        transition: "color 300ms ease",
                      }}
                    >
                      {i <= active ? "✓" : "·"}
                    </span>
                  </div>
                ))}
              </div>
              <div
                className="flex items-center justify-between"
                style={{ ...monoTag, color: T.faint }}
              >
                <span>nullshift.co.uk</span>
                <span>Building…</span>
              </div>
            </motion.div>

            {/* Layer B — their real frontend, faithfully reproduced. Clickable
                through to the live site once visible (never while faded out). */}
            <motion.div
              style={{
                opacity: siteOpacity,
                position: "absolute",
                inset: 0,
                pointerEvents: active >= 2 ? "auto" : "none",
              }}
            >
              <NFTSiteFrame final={active >= 3} />
            </motion.div>
          </motion.div>
        </div>
      </div>

      <LauraPlayer />
      <style>{`@keyframes nsBeatIn { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }`}</style>
    </div>
  );
}

/** The NewFuture Therapy homepage hero, reproduced from their repo
 *  (HomeHero.tsx — real copy, palette, ellipse backdrop, serif treatment)
 *  inside a minimal browser frame. The whole frame links to the live site so
 *  visitors can explore it themselves. `final` reveals the platform strip. */
function NFTSiteFrame({ final = false }: { final?: boolean }) {
  return (
    <a
      href="https://newfuturetherapy.co.uk"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Visit newfuturetherapy.co.uk — opens in a new tab"
      className="group"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: NFT.cream,
        textDecoration: "none",
        cursor: "pointer",
      }}
    >
      {/* Browser chrome */}
      <div
        className="flex items-center gap-2 px-4"
        style={{ height: 34, borderBottom: `1px solid ${NFT.sageLight}` }}
      >
        <span className="flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: NFT.sageLight,
              }}
            />
          ))}
        </span>
        <span
          style={{
            fontFamily: NFT.body,
            fontSize: 11,
            color: NFT.muted,
            marginLeft: 6,
          }}
        >
          newfuturetherapy.co.uk
        </span>
        <span
          className="ml-auto opacity-70 group-hover:opacity-100"
          style={{
            fontFamily: NFT.body,
            fontSize: 10.5,
            fontWeight: 500,
            color: NFT.sageDark,
            transition: "opacity 200ms ease",
          }}
        >
          Visit the live site ↗
        </span>
      </div>

      {/* Hero */}
      <div
        style={{
          position: "relative",
          flex: 1,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "18px 26px",
        }}
      >
        {/* Soft background ellipses — from their hero */}
        <svg
          viewBox="0 0 1200 800"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0.3,
          }}
        >
          <ellipse cx="1000" cy="200" rx="380" ry="340" fill={NFT.sageLight} />
          <ellipse cx="150" cy="650" rx="300" ry="280" fill={NFT.sage} opacity="0.35" />
        </svg>

        <div style={{ position: "relative", maxWidth: 440 }}>
          <p
            style={{
              fontFamily: NFT.body,
              fontSize: 9.5,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: NFT.sageDark,
              marginBottom: 12,
            }}
          >
            Face-to-Face Counselling in Wakefield &amp; Online
          </p>
          <h4
            style={{
              fontFamily: NFT.serif,
              fontWeight: 300,
              fontSize: "clamp(1.4rem, 2.4vw, 2rem)",
              lineHeight: 1.2,
              color: NFT.charcoal,
              marginBottom: 12,
            }}
          >
            Growth begins with understanding, curiosity and compassion.
          </h4>
          <p
            style={{
              fontFamily: NFT.body,
              fontSize: "0.8rem",
              lineHeight: 1.55,
              color: NFT.muted,
              marginBottom: 16,
            }}
          >
            We are Esther and Laura — twin sisters and qualified counsellors offering
            professional, inclusive therapy for individuals and couples.
          </p>
          <div className="flex items-center justify-center gap-3">
            <span
              style={{
                fontFamily: NFT.body,
                fontSize: "0.78rem",
                fontWeight: 500,
                color: NFT.cream,
                background: NFT.sageDark,
                borderRadius: 999,
                padding: "9px 18px",
              }}
            >
              Book a free consultation
            </span>
            <span
              style={{
                fontFamily: NFT.body,
                fontSize: "0.78rem",
                color: NFT.sageDark,
                border: `1px solid ${NFT.sage}`,
                borderRadius: 999,
                padding: "9px 18px",
              }}
            >
              Our approach
            </span>
          </div>
        </div>
      </div>

      {/* Platform strip — the part she owns (appears on the final beat) */}
      <div
        className="flex items-center justify-center gap-2 flex-wrap px-3"
        style={{
          minHeight: 40,
          borderTop: `1px solid ${NFT.sageLight}`,
          background: NFT.sagePale,
          opacity: final ? 1 : 0,
          transition: "opacity 500ms ease",
        }}
      >
        {[
          "Articles",
          "Resources library",
          "Reflections AI",
          "Courses · private testing",
        ].map((m) => (
          <span
            key={m}
            style={{
              fontFamily: NFT.body,
              fontSize: 10.5,
              fontWeight: 500,
              color: NFT.sageDark,
              background: NFT.cream,
              border: `1px solid ${NFT.sageLight}`,
              borderRadius: 999,
              padding: "4px 11px",
            }}
          >
            {m}
          </span>
        ))}
        <span
          style={{
            fontFamily: NFT.body,
            fontSize: 10.5,
            color: NFT.greyMid,
          }}
        >
          — all hers
        </span>
      </div>
    </a>
  );
}

/** The payoff — Laura's portrait testimonial, front and centre. */
function LauraPlayer() {
  return (
    <div style={{ maxWidth: 420, margin: "0 auto", paddingTop: 8 }}>
      <div className="text-center" style={{ marginBottom: 18 }}>
        <div style={{ ...monoTag, color: "var(--k-accent)" }}>
          The part we can&apos;t say ourselves
        </div>
        <h3
          style={{
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
            letterSpacing: "-0.02em",
            color: "var(--k-fg)",
            marginTop: 10,
          }}
        >
          Hear it from Laura
        </h3>
      </div>
      <NullshiftPlayer
        title="Laura, NewFuture Therapy — video testimonial"
        label="Client story · NewFuture Therapy"
        aspect="9 / 16"
        src={`https://stream.mux.com/${TESTIMONIAL_PLAYBACK_ID}/highest.mp4`}
        poster={`https://image.mux.com/${TESTIMONIAL_PLAYBACK_ID}/thumbnail.webp?time=1`}
      />
      <p
        className="text-center"
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--k-faint)",
          marginTop: 12,
        }}
      >
        Laura · Co-founder, NewFuture Therapy · Wakefield &amp; online
      </p>
    </div>
  );
}

function StaticBeat({ beat }: { beat: Beat }) {
  return (
    <div style={{ marginBottom: 34, maxWidth: 560 }}>
      <div style={{ ...monoTag, color: "var(--k-accent)" }}>{beat.tag}</div>
      <h3
        style={{
          fontFamily: T.display,
          fontWeight: 600,
          fontSize: "1.4rem",
          color: "var(--k-fg)",
          marginTop: 8,
        }}
      >
        {beat.title}
      </h3>
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.95rem",
          lineHeight: 1.6,
          color: "var(--k-muted)",
          marginTop: 8,
        }}
      >
        {beat.body}
      </p>
    </div>
  );
}

const monoTag: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
};
