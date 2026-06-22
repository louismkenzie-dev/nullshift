import React from "react";
import { Eyebrow, Display, Lead, Reveal } from "@/components/kyma";
import { CountUp } from "@/components/anim/CountUp";
import { T } from "@nullshift/ui/tokens";

/* ════════════════════════════════════════════════════════════════
   AppKit — shared building blocks for the dark app surfaces (admin +
   client portal), so every page wears the KYMA brand language: TASA
   Orbiter display, Roboto Mono labels, emerald accent, hairline square
   panels, subtle reveal/scramble motion. See /DESIGN_SYSTEM.md.
   Server-safe: composes kit pieces (some are client) without hooks.
   ════════════════════════════════════════════════════════════════ */

const monoLabel: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.66rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--k-muted)",
};

/** Standard page top: eyebrow label + display title + optional lead/actions. */
export function PageHeader({
  index,
  label,
  title,
  lead,
  actions,
  className = "",
}: {
  index?: string;
  label?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <Reveal className={className}>
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          {label && (
            <div style={{ marginBottom: 14 }}>
              <Eyebrow index={index} label={label} />
            </div>
          )}
          <Display as="h1" size="md">
            {title}
          </Display>
          {lead && <Lead style={{ marginTop: 14 }}>{lead}</Lead>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
    </Reveal>
  );
}

/** Hairline square card with an optional labelled header row. The workhorse. */
export function Panel({
  label,
  title,
  actions,
  children,
  pad = true,
  className = "",
  style,
}: {
  label?: string;
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  pad?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const hasHeader = label || title || actions;
  return (
    <div
      className={`k-kard ${className}`}
      style={{ background: "var(--k-surface)", ...style }}
    >
      {hasHeader && (
        <div
          className="flex items-center justify-between gap-4"
          style={{ padding: "14px 18px", borderBottom: "1px solid var(--k-border)" }}
        >
          <div className="flex flex-col gap-1">
            {label && <span style={monoLabel}>{label}</span>}
            {title && (
              <span
                style={{
                  fontFamily: T.sans,
                  fontWeight: 700,
                  fontSize: "1.05rem",
                  letterSpacing: "-0.01em",
                  textTransform: "uppercase",
                  color: "var(--k-fg)",
                }}
              >
                {title}
              </span>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div style={{ padding: pad ? 18 : 0 }}>{children}</div>
    </div>
  );
}

/** Compact KPI card — animated CountUp value + mono label. */
export function StatCard({
  value,
  label,
  sub,
  accent = false,
}: {
  value: string;
  label: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className="k-kard flex flex-col gap-2"
      style={{ background: "var(--k-surface)", padding: 18 }}
    >
      <span
        style={{
          fontFamily: T.sans,
          fontWeight: 800,
          fontSize: "clamp(1.8rem,3vw,2.6rem)",
          lineHeight: 0.95,
          letterSpacing: "-0.03em",
          color: accent ? "var(--k-accent)" : "var(--k-fg)",
        }}
      >
        <CountUp value={value} />
      </span>
      <span style={monoLabel}>{label}</span>
      {sub && (
        <span
          style={{
            fontFamily: T.sans,
            fontSize: "0.82rem",
            lineHeight: 1.45,
            color: "var(--k-muted)",
          }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}

/** Mono uppercase status chip (tone-based). */
export function StatusChip({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "accent" | "success" | "warning" | "danger" | "muted";
}) {
  const map: Record<string, { fg: string; bg: string }> = {
    accent: { fg: T.primary, bg: "rgba(16,185,129,0.12)" },
    success: { fg: T.success, bg: "rgba(43,224,140,0.12)" },
    warning: { fg: T.warning, bg: "rgba(245,213,71,0.14)" },
    danger: { fg: T.danger, bg: "rgba(255,58,92,0.14)" },
    muted: { fg: "var(--k-muted)", bg: "rgba(255,255,255,0.05)" },
  };
  const c = map[tone] ?? map.muted;
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        fontFamily: T.mono,
        fontSize: "0.6rem",
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: c.fg,
        background: c.bg,
        padding: "4px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
