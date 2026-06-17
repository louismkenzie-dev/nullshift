"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { T } from "@nullshift/ui/tokens";
import { optionLabel, resourceName, type Answers, type Recommendation } from "@/lib/funnel";

/** Qualified result — personalised recommendation + discovery-call CTA. The
 *  booking link carries the answers as prefill (the /book flow is wired in
 *  Phase 3). An optional VSL/Loom slot is left ready but off. */
export function ResultQualified({
  recommendation,
  answers,
  contact,
  onRestart,
}: {
  recommendation: Recommendation;
  answers: Answers;
  contact?: { name?: string; email?: string; phone?: string };
  onRestart: () => void;
}) {
  const reduce = useReducedMotion();
  const body = contact?.name
    ? `${contact.name}, ${recommendation.body.charAt(0).toLowerCase()}${recommendation.body.slice(1)}`
    : recommendation.body;
  const container: Variants = { hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.09 } } };
  const item: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 18, filter: "blur(8px)" },
    show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
  };

  const facts: { k: string; v: string }[] = [
    { k: "Focus", v: optionLabel("need", answers.need) },
    { k: "Budget", v: recommendation.budgetBand },
    { k: "Start", v: optionLabel("timeline", answers.timeline) },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="w-full">
      <motion.span
        variants={item}
        className="inline-flex items-center gap-2"
        style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.primary, display: "inline-block", boxShadow: `0 0 0 4px ${T.primarySoft}` }} />
        Your recommendation
      </motion.span>

      <motion.h1
        variants={item}
        className="mt-4"
        style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(2rem,6vw,3.25rem)", lineHeight: 1.05, letterSpacing: "-0.03em", color: T.fg }}
      >
        {recommendation.headline}
      </motion.h1>

      <motion.p variants={item} className="mt-4 max-w-[52ch]" style={{ fontFamily: T.sans, fontSize: "1.0625rem", lineHeight: 1.6, color: T.muted }}>
        {body}
      </motion.p>

      {/* Recommended-build card */}
      <motion.div
        variants={item}
        className="mt-8"
        style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.xl, padding: 22 }}
      >
        <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: T.muted, marginBottom: 14 }}>
          What we&apos;d build
        </div>
        <p style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1.25rem", lineHeight: 1.3, letterSpacing: "-0.01em", color: T.fg }}>
          {recommendation.planSuggestion}
        </p>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {facts.map((f) => (
            <div key={f.k} style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
              <div style={{ fontFamily: T.mono, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.faint }}>{f.k}</div>
              <div style={{ fontFamily: T.sans, fontSize: "0.875rem", color: T.fg, marginTop: 3 }}>{f.v}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Booking bonus — the free resource sweetens the call (it doesn't compete with it). */}
      <motion.div
        variants={item}
        className="mt-6 flex items-center gap-3"
        style={{ padding: "12px 16px", borderRadius: T.r.md, border: `1px solid ${T.primary}33`, background: T.primarySoft }}
      >
        <span aria-hidden style={{ fontSize: 16 }}>🎁</span>
        <span style={{ fontFamily: T.sans, fontSize: "0.875rem", lineHeight: 1.5, color: T.fg }}>
          Book your call and we&apos;ll send your free <strong style={{ color: T.primary }}>{resourceName(answers)}</strong> to give you a head start before we even speak.
        </span>
      </motion.div>

      {/* Optional VSL / Loom slot — enable by passing a video URL in a later phase.
      <motion.div variants={item} className="mt-6 aspect-video" style={{ borderRadius: T.r.lg, overflow: "hidden", border: `1px solid ${T.border}` }} /> */}

      <motion.div variants={item} className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <Link
          href={{
            pathname: "/book",
            query: { segment: "qualified", need: answers.need ?? "", name: contact?.name ?? "", email: contact?.email ?? "" },
          }}
          className="inline-flex items-center justify-center font-medium"
          style={{
            height: 52,
            paddingInline: 28,
            background: T.primary,
            color: T.primaryFg,
            borderRadius: T.r.md,
            fontFamily: T.sans,
            fontSize: "0.9375rem",
            fontWeight: 500,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)`,
            textDecoration: "none",
          }}
        >
          Book your discovery call →
        </Link>
        <button
          type="button"
          onClick={onRestart}
          style={{ fontFamily: T.mono, fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}
        >
          Start over
        </button>
      </motion.div>

      <motion.p variants={item} className="mt-4" style={{ fontFamily: T.sans, fontSize: "0.8125rem", color: T.faint }}>
        Free · 30-minute call · no obligation
      </motion.p>
    </motion.div>
  );
}
