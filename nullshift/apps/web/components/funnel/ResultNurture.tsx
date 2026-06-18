"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { T } from "@nullshift/ui/tokens";
import {
  optionLabel,
  resourceName,
  type Answers,
  type Recommendation,
} from "@/lib/funnel";

/** Nurture result — never a dead-end. Offers a free resource + newsletter and
 *  keeps a soft path to talk. Email capture + Resend audience are wired in
 *  Phase 3/4; here the CTA is a placeholder. */
export function ResultNurture({
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
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.09 } },
  };
  const item: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 18, filter: "blur(8px)" },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
    },
  };

  const need = optionLabel("need", answers.need) || "your project";

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="w-full">
      <motion.span
        variants={item}
        className="inline-flex items-center gap-2"
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: T.primary,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: T.primary,
            display: "inline-block",
            boxShadow: `0 0 0 4px ${T.primarySoft}`,
          }}
        />
        Your next step
      </motion.span>

      <motion.h1
        variants={item}
        className="mt-4"
        style={{
          fontFamily: T.display,
          fontWeight: 600,
          fontSize: "clamp(2rem,6vw,3.25rem)",
          lineHeight: 1.05,
          letterSpacing: "-0.03em",
          color: T.fg,
        }}
      >
        {recommendation.headline}
      </motion.h1>

      <motion.p
        variants={item}
        className="mt-4 max-w-[52ch]"
        style={{
          fontFamily: T.sans,
          fontSize: "1.0625rem",
          lineHeight: 1.6,
          color: T.muted,
        }}
      >
        {body}
      </motion.p>

      {/* Free-resource card */}
      <motion.div
        variants={item}
        className="mt-8"
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: T.r.xl,
          padding: 22,
        }}
      >
        <div
          style={{
            fontFamily: T.mono,
            fontSize: "10px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: T.muted,
            marginBottom: 10,
          }}
        >
          Free resource
        </div>
        <p
          style={{
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: "1.25rem",
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
            color: T.fg,
          }}
        >
          The {resourceName(answers)}
        </p>
        <p
          className="mt-2"
          style={{
            fontFamily: T.sans,
            fontSize: "0.9rem",
            lineHeight: 1.6,
            color: T.muted,
          }}
        >
          On its way to your inbox
          {contact?.email ? (
            <>
              {" "}
              at <span style={{ color: T.fg }}>{contact.email}</span>
            </>
          ) : null}{" "}
          now — a practical checklist and templates to move forward today, plus the
          occasional genuinely useful tip. No spam, unsubscribe anytime.
        </p>

        <div
          className="mt-3 inline-flex items-center gap-2"
          style={{
            fontFamily: T.mono,
            fontSize: "11px",
            letterSpacing: "0.04em",
            color: T.primary,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: T.primary,
              boxShadow: `0 0 0 3px ${T.primary}22`,
              display: "inline-block",
            }}
          />
          Sent — check your inbox
        </div>

        <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center font-medium"
            style={{
              height: 50,
              paddingInline: 24,
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
            See pricing →
          </Link>
          <Link
            href="/systems-lab"
            className="inline-flex items-center justify-center"
            style={{
              height: 50,
              paddingInline: 22,
              border: `1px solid ${T.border}`,
              color: T.fg,
              borderRadius: T.r.md,
              fontFamily: T.sans,
              fontSize: "0.9375rem",
              textDecoration: "none",
            }}
          >
            Try the live demos
          </Link>
        </div>
      </motion.div>

      <motion.button
        variants={item}
        type="button"
        onClick={onRestart}
        className="mt-6 block"
        style={{
          fontFamily: T.mono,
          fontSize: "11px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: T.muted,
        }}
      >
        Start over
      </motion.button>
    </motion.div>
  );
}
