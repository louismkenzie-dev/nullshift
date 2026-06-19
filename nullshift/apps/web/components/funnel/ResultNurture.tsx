"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { T } from "@nullshift/ui/tokens";
import type { Blueprint as BlueprintData } from "@nullshift/content/blueprint";
import type { BrandSpec } from "@/lib/brandSpec";
import { type Answers, type Recommendation } from "@/lib/funnel";
import { Blueprint } from "@/components/funnel/Blueprint";
import { SavedPlanLink } from "@/components/funnel/SavedPlanLink";

/** Nurture result — never a dead-end. Still gives the full personalised Build
 *  Blueprint (visual + itemised build + savings) and a saved link, with a softer
 *  CTA than the qualified path. */
export function ResultNurture({
  contact,
  blueprint,
  brandSpec,
  brandPending,
  planToken,
  onRestart,
}: {
  recommendation: Recommendation;
  answers: Answers;
  contact?: { name?: string; business?: string; email?: string; phone?: string };
  blueprint?: BlueprintData;
  brandSpec?: BrandSpec | null;
  brandPending?: boolean;
  planToken?: string;
  onRestart: () => void;
}) {
  const reduce = useReducedMotion();
  const first = contact?.name?.split(" ")[0];
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.08 } },
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
        Your build plan
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
        {first ? `${first}, here's your plan.` : "Here's your plan."}
      </motion.h1>

      <motion.p
        variants={item}
        className="mt-4 max-w-[54ch]"
        style={{
          fontFamily: T.sans,
          fontSize: "1.0625rem",
          lineHeight: 1.6,
          color: T.muted,
        }}
      >
        No pressure and no commitment — here&apos;s a preview of your own system, what
        we&apos;d build, and what you&apos;d save. It&apos;s saved to a link and in your
        inbox for whenever you&apos;re ready.
      </motion.p>

      {blueprint && (
        <motion.div variants={item} className="mt-8">
          <Blueprint
            blueprint={blueprint}
            brandSpec={brandSpec}
            brandPending={brandPending}
          />
        </motion.div>
      )}

      {planToken && (
        <motion.div variants={item} className="mt-6">
          <SavedPlanLink planToken={planToken} />
        </motion.div>
      )}

      <motion.div
        variants={item}
        className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
      >
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
          href={{
            pathname: "/book",
            query: {
              segment: "nurture",
              name: contact?.name ?? "",
              email: contact?.email ?? "",
            },
          }}
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
          Book a quick call
        </Link>
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
