import Link from "next/link";
import { T } from "@nullshift/ui/tokens";
import { PRICING_ON_APPLICATION } from "@nullshift/content/pricing";
import { MonoTag, Display, Lead } from "@/components/kyma";

/* ════════════════════════════════════════════════════════════════
   Shown in place of any published price ladder while PRICING_PUBLIC is
   false. It replaces the figures with the thing the figures were for —
   a way to get a real quote — rather than leaving a hole in the page.
   ════════════════════════════════════════════════════════════════ */
export function PricingOnApplication({ compact = false }: { compact?: boolean }) {
  const c = PRICING_ON_APPLICATION;
  return (
    <div
      style={{
        border: "1px solid var(--k-border-strong)",
        background: "var(--k-surface)",
        padding: compact ? "clamp(24px,3vw,32px)" : "clamp(32px,4.5vw,56px)",
        maxWidth: compact ? undefined : "72ch",
      }}
    >
      <MonoTag>{c.eyebrow}</MonoTag>
      <Display
        as="p"
        size="md"
        className="mt-5"
        style={{ fontSize: compact ? "clamp(1.3rem,2.4vw,1.7rem)" : undefined }}
      >
        {c.title}
      </Display>
      <Lead className="mt-4" style={{ maxWidth: "56ch" }}>
        {c.body}
      </Lead>
      <Link
        href={c.cta.href}
        className="mt-7 inline-block"
        style={{
          fontFamily: T.mono,
          fontSize: "0.72rem",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          padding: "13px 24px",
          background: "var(--k-accent)",
          color: "var(--k-bg)",
          textDecoration: "none",
        }}
      >
        {c.cta.label} →
      </Link>
    </div>
  );
}
