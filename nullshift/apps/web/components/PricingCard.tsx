"use client";

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { cn } from "@nullshift/ui/utils";
import { Button } from "@/components/ui/button";
import { T } from "@nullshift/ui/tokens";

interface BenefitProps {
  text: string;
  checked: boolean;
}

const Benefit = ({ text, checked }: BenefitProps) => {
  return (
    <div className="flex items-center gap-3">
      {checked ? (
        <span
          className="grid size-4 place-content-center rounded-full flex-shrink-0"
          style={{ background: `${T.primary}22`, border: `1px solid ${T.primary}55` }}
        >
          <Check className="size-2.5" style={{ color: T.primary }} />
        </span>
      ) : (
        <span
          className="grid size-4 place-content-center rounded-full flex-shrink-0"
          style={{ background: T.surface2, border: `1px solid ${T.border}` }}
        >
          <X className="size-2.5" style={{ color: T.muted }} />
        </span>
      )}
      <span
        style={{
          fontFamily: T.sans,
          fontSize: "0.8125rem",
          letterSpacing: "-0.003em",
          color: checked ? T.fg : T.muted,
        }}
      >
        {text}
      </span>
    </div>
  );
};

interface PricingCardProps {
  tier: string;
  price: string;
  bestFor: string;
  CTA: string;
  href?: string;
  benefits: Array<{ text: string; checked: boolean }>;
  highlighted?: boolean;
  className?: string;
}

export const PricingCard = ({
  tier,
  price,
  bestFor,
  CTA,
  href = "/book",
  benefits,
  highlighted = false,
  className,
}: PricingCardProps) => {
  return (
    <motion.div
      className="h-full"
      initial={{ filter: "blur(2px)", opacity: 0, y: 8 }}
      whileInView={{ filter: "blur(0px)", opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut", delay: 0.15 }}
      viewport={{ once: true }}
    >
      <div
        className={cn("relative h-full flex flex-col overflow-hidden", className)}
        style={{
          borderRadius: T.r.lg,
          border: `1px solid ${highlighted ? T.primary + "60" : T.border}`,
          background: highlighted
            ? `linear-gradient(145deg, color-mix(in oklab, ${T.primary} 7%, ${T.surface}), ${T.surface})`
            : `linear-gradient(145deg, ${T.surface}, ${T.bg})`,
          boxShadow: highlighted
            ? `0 0 0 1px ${T.primary}20, 0 8px 32px rgba(0,0,0,0.5)`
            : T.shadow.md,
          padding: "1.75rem",
        }}
      >
        {/* Top accent line on highlighted card */}
        {highlighted && (
          <div
            className="absolute top-0 left-0 right-0"
            style={{
              height: "2px",
              background: T.primary,
              boxShadow: `0 0 12px ${T.primary}`,
              borderRadius: `${T.r.lg} ${T.r.lg} 0 0`,
            }}
          />
        )}

        {/* Header */}
        <div
          className="flex flex-col items-center pb-6 mb-6"
          style={{
            borderBottom: `1px solid ${highlighted ? T.primary + "25" : T.border}`,
          }}
        >
          {highlighted && (
            <span
              className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-none"
              style={{
                fontFamily: T.mono,
                fontSize: "10px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: T.primary,
                background: `${T.primary}15`,
                border: `1px solid ${T.primary}35`,
              }}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: T.primary, boxShadow: `0 0 4px ${T.primary}` }}
              />
              Most Popular
            </span>
          )}

          <span
            style={{
              fontFamily: T.mono,
              fontWeight: 600,
              fontSize: "0.7rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: highlighted ? T.primary : T.muted,
              marginBottom: "0.875rem",
            }}
          >
            {tier}
          </span>

          <span
            style={{
              fontFamily: T.display,
              fontWeight: 700,
              fontSize: "2.5rem",
              lineHeight: 1,
              letterSpacing: "-0.03em",
              color: highlighted ? T.primary : T.fg,
              marginBottom: "0.625rem",
            }}
          >
            {price}
          </span>

          <span
            style={{
              fontFamily: T.sans,
              fontSize: "0.8125rem",
              lineHeight: 1.55,
              letterSpacing: "-0.003em",
              color: T.muted,
              textAlign: "center",
            }}
          >
            {bestFor}
          </span>
        </div>

        {/* Benefits */}
        <div className="flex flex-col gap-3.5 flex-1 mb-8">
          {benefits.map((benefit, index) => (
            <Benefit key={index} {...benefit} />
          ))}
        </div>

        {/* CTA */}
        <a
          href={href}
          className="w-full flex items-center justify-between px-5 h-11 transition-opacity hover:opacity-90"
          style={{
            fontFamily: T.mono,
            fontSize: "0.75rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
            borderRadius: T.r.md,
            background: highlighted ? T.primary : "transparent",
            color: highlighted ? T.primaryFg : T.fg,
            border: highlighted ? "none" : `1px solid ${T.borderStr}`,
            boxShadow: "none",
            textDecoration: "none",
          }}
        >
          <span>{CTA}</span>
          <span>→</span>
        </a>
      </div>
    </motion.div>
  );
};
