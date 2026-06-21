/* ════════════════════════════════════════════════════════════════
   KYMA KIT — themed section primitives (cream/dark clone)
   ----------------------------------------------------------------
   A faithful re-skin of kyma.framer.ai: alternating cream / near-black
   sections, emerald accent (replacing Kyma's lime), UPPERCASE TASA
   Orbiter display, Roboto Mono labels, pill buttons, hairline grid,
   giant numbers. Theming is per-section via CSS vars (.k-dark /
   .k-cream set --k-bg/--k-fg/--k-muted/--k-border/--k-accent in
   globals.css) so every primitive auto-adapts with no hooks — fully
   server-safe. Interactive bits (Accordion) live in ./Accordion.
   ════════════════════════════════════════════════════════════════ */
import React from "react";
import Link from "next/link";
import { T } from "@nullshift/ui/tokens";

const MONO = T.mono; // Roboto Mono
const SANS = T.sans; // TASA Orbiter (display + body)

function isInternal(href: string) {
  return href.startsWith("/") && !href.startsWith("//");
}

/* ── Container ──────────────────────────────────────────────────── */
export function Container({
  children,
  width = "default",
  className = "",
  style,
}: {
  children: React.ReactNode;
  width?: "default" | "narrow" | "wide" | "full";
  className?: string;
  style?: React.CSSProperties;
}) {
  const max =
    width === "narrow" ? 880 : width === "wide" ? 1400 : width === "full" ? "100%" : 1280;
  return (
    <div
      className={className}
      style={{
        maxWidth: max,
        margin: "0 auto",
        paddingInline: "clamp(20px,4vw,40px)",
        width: "100%",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── Section band (themed) ──────────────────────────────────────── */
type Pad = "sm" | "md" | "lg" | "none";
const PADS: Record<Pad, string> = {
  none: "0",
  sm: "clamp(40px,6vw,72px)",
  md: "clamp(64px,8vw,104px)",
  lg: "clamp(88px,11vw,140px)",
};

export function Section({
  id,
  theme = "dark",
  pad = "md",
  topBorder = false,
  grid = false,
  bare = false,
  containerWidth = "default",
  className = "",
  style,
  children,
}: {
  id?: string;
  theme?: "dark" | "cream";
  pad?: Pad;
  topBorder?: boolean;
  /** faint vertical hairline grid backdrop */
  grid?: boolean;
  bare?: boolean;
  containerWidth?: "default" | "narrow" | "wide" | "full";
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`k-${theme} relative ${className}`}
      style={{
        background: "var(--k-bg)",
        color: "var(--k-fg)",
        borderTop: topBorder ? "1px solid var(--k-border)" : undefined,
        ...style,
      }}
    >
      {grid && (
        <div
          aria-hidden
          className="k-vgrid pointer-events-none absolute inset-0"
          style={{ opacity: 0.6 }}
        />
      )}
      <div className="relative" style={{ paddingBlock: PADS[pad], zIndex: 1 }}>
        {bare ? children : <Container width={containerWidth}>{children}</Container>}
      </div>
    </section>
  );
}

/* ── Eyebrow — [01] LABEL ───────────────────────────────────────── */
export function Eyebrow({
  index,
  label,
  align = "left",
  tone = "accent",
  cursor = true,
}: {
  index?: string;
  label: string;
  align?: "left" | "center";
  tone?: "accent" | "muted" | "danger";
  cursor?: boolean;
}) {
  const accent =
    tone === "danger"
      ? T.danger
      : tone === "muted"
        ? "var(--k-muted)"
        : "var(--k-accent)";
  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: 8,
        fontFamily: MONO,
        fontSize: "0.74rem",
        fontWeight: 500,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--k-fg)",
        justifyContent: align === "center" ? "center" : "flex-start",
      }}
    >
      {index && <span style={{ color: accent }}>[{index}]</span>}
      <span>{label}</span>
      {cursor && (
        <span
          aria-hidden
          style={{
            width: 7,
            height: 13,
            marginLeft: 2,
            background: accent,
            display: "inline-block",
          }}
        />
      )}
    </span>
  );
}

/* ── Display headline (UPPERCASE TASA Orbiter) ──────────────────── */
type DSize = "sm" | "md" | "lg" | "xl" | "hero";
const DSIZES: Record<DSize, string> = {
  sm: "clamp(1.15rem,1.7vw,1.45rem)",
  md: "clamp(1.5rem,2.8vw,2rem)",
  lg: "clamp(2rem,4.4vw,3rem)",
  xl: "clamp(2.4rem,5.4vw,3.9rem)",
  hero: "clamp(2.5rem,6.4vw,4.7rem)",
};

export function Display({
  children,
  size = "lg",
  as: Tag = "h2",
  caps = true,
  className = "",
  style,
}: {
  children: React.ReactNode;
  size?: DSize;
  as?: "h1" | "h2" | "h3" | "p";
  caps?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Tag
      className={className}
      style={{
        fontFamily: SANS,
        fontWeight: 700,
        fontSize: DSIZES[size],
        lineHeight: size === "hero" || size === "xl" ? 1.0 : 1.06,
        letterSpacing: "-0.03em",
        textTransform: caps ? "uppercase" : "none",
        color: "var(--k-fg)",
        margin: 0,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

/* ── Lead paragraph (sentence case) ─────────────────────────────── */
export function Lead({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <p
      className={className}
      style={{
        fontFamily: SANS,
        fontSize: "1.0625rem",
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: "-0.01em",
        color: "var(--k-muted)",
        maxWidth: "56ch",
        margin: 0,
        ...style,
      }}
    >
      {children}
    </p>
  );
}

/* ── Section header (eyebrow + title + lead) ────────────────────── */
export function SectionHeader({
  index,
  label,
  title,
  lead,
  align = "left",
  titleSize = "lg",
  caps = true,
  tone = "accent",
  maxLead = "56ch",
  className = "",
}: {
  index?: string;
  label?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: "left" | "center";
  titleSize?: DSize;
  caps?: boolean;
  tone?: "accent" | "muted" | "danger";
  maxLead?: string;
  className?: string;
}) {
  const center = align === "center";
  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: center ? "center" : "flex-start",
        textAlign: center ? "center" : "left",
      }}
    >
      {label && (
        <div style={{ marginBottom: 20 }}>
          <Eyebrow index={index} label={label} align={align} tone={tone} />
        </div>
      )}
      <Display size={titleSize} caps={caps}>
        {title}
      </Display>
      {lead && (
        <Lead
          style={{
            marginTop: 20,
            maxWidth: maxLead,
            marginInline: center ? "auto" : undefined,
          }}
        >
          {lead}
        </Lead>
      )}
    </div>
  );
}

/* ── Buttons ────────────────────────────────────────────────────── */
type BtnProps = {
  href: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  arrow?: boolean;
  className?: string;
  style?: React.CSSProperties;
};
function sizeClass(size?: "sm" | "md" | "lg") {
  return size === "sm" ? " kb-sm" : size === "lg" ? " kb-lg" : "";
}
function Btn({
  href,
  children,
  variant,
  size = "md",
  arrow,
  className = "",
  style,
}: BtnProps & { variant: string }) {
  const cls = `kb ${variant}${sizeClass(size)} ${className}`;
  const inner = (
    <>
      {children}
      {arrow && (
        <span className="k-arrow" aria-hidden>
          →
        </span>
      )}
    </>
  );
  return isInternal(href) ? (
    <Link href={href} className={cls} style={style}>
      {inner}
    </Link>
  ) : (
    <a href={href} className={cls} style={style}>
      {inner}
    </a>
  );
}
export const BtnPrimary = (p: BtnProps) => (
  <Btn {...p} variant="kb-primary" arrow={p.arrow ?? true} />
);
export const BtnSolid = (p: BtnProps) => (
  <Btn {...p} variant="kb-solid" arrow={p.arrow ?? true} />
);
export const BtnGhost = (p: BtnProps) => (
  <Btn {...p} variant="kb-outline" arrow={p.arrow ?? false} />
);

/* Full-width "bar" CTA with progress underline (Kyma hero) */
export function BarButton({
  href,
  children,
  meta,
}: {
  href: string;
  children: React.ReactNode;
  meta?: string;
}) {
  const inner = (
    <>
      <span>{children}</span>
      <span className="inline-flex items-center gap-3">
        {meta && <span style={{ color: "var(--k-muted)" }}>{meta}</span>}
        <span className="k-arrow" aria-hidden style={{ color: "var(--k-accent)" }}>
          ▸
        </span>
      </span>
    </>
  );
  return isInternal(href) ? (
    <Link href={href} className="k-bar">
      {inner}
    </Link>
  ) : (
    <a href={href} className="k-bar">
      {inner}
    </a>
  );
}

/* Inline mono text link with arrow */
export function TextLink({
  href,
  children,
  className = "",
  style,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const cls = `inline-flex items-center gap-2 ${className}`;
  const s: React.CSSProperties = {
    fontFamily: MONO,
    fontSize: "0.72rem",
    fontWeight: 500,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--k-fg)",
    textDecoration: "none",
    ...style,
  };
  const inner = (
    <>
      {children}
      <span className="k-arrow" aria-hidden style={{ color: "var(--k-accent)" }}>
        →
      </span>
    </>
  );
  return isInternal(href) ? (
    <Link href={href} className={cls} style={s}>
      {inner}
    </Link>
  ) : (
    <a href={href} className={cls} style={s}>
      {inner}
    </a>
  );
}

/* ── Pill tag ───────────────────────────────────────────────────── */
export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="k-tag">{children}</span>;
}

/* ── Mono label (leading hairline) ──────────────────────────────── */
export function MonoTag({
  children,
  tone = "accent",
}: {
  children: React.ReactNode;
  tone?: "accent" | "muted" | "danger";
}) {
  const accent =
    tone === "danger"
      ? T.danger
      : tone === "muted"
        ? "var(--k-muted)"
        : "var(--k-accent)";
  return (
    <span
      className="inline-flex items-center gap-2"
      style={{
        fontFamily: MONO,
        fontSize: "0.7rem",
        fontWeight: 500,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: accent,
      }}
    >
      <span
        style={{
          height: 1,
          width: 14,
          background: accent,
          flexShrink: 0,
          display: "inline-block",
        }}
      />
      {children}
    </span>
  );
}

/* ── Big number ─────────────────────────────────────────────────── */
export function StatBig({
  value,
  label,
  size = "md",
}: {
  value: string;
  label?: string;
  size?: "md" | "lg" | "xl";
}) {
  const fs =
    size === "xl"
      ? "clamp(4rem,11vw,9rem)"
      : size === "lg"
        ? "clamp(3rem,7vw,5.5rem)"
        : "clamp(2.4rem,5vw,3.6rem)";
  return (
    <div className="flex flex-col gap-2">
      <span
        style={{
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: fs,
          lineHeight: 0.92,
          letterSpacing: "-0.03em",
          color: "var(--k-fg)",
        }}
      >
        {value}
      </span>
      {label && (
        <span
          style={{
            fontFamily: MONO,
            fontSize: "0.7rem",
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--k-muted)",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

export type Stat = { value: string; label: string; sub?: string };

export function StatGrid({ stats, cols = 4 }: { stats: Stat[]; cols?: 2 | 3 | 4 }) {
  const colClass =
    cols === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : cols === 3
        ? "grid-cols-1 sm:grid-cols-3"
        : "grid-cols-2 md:grid-cols-4";
  return (
    <div
      className={`grid ${colClass}`}
      style={{
        borderTop: "1px solid var(--k-border)",
        borderLeft: "1px solid var(--k-border)",
      }}
    >
      {stats.map((s, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 p-6 md:p-8"
          style={{
            borderRight: "1px solid var(--k-border)",
            borderBottom: "1px solid var(--k-border)",
          }}
        >
          <span
            style={{
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: "clamp(2.2rem,4.4vw,3.4rem)",
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
              color: "var(--k-fg)",
            }}
          >
            {s.value}
          </span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: "0.7rem",
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--k-accent)",
            }}
          >
            {s.label}
          </span>
          {s.sub && (
            <span
              style={{
                fontFamily: SANS,
                fontSize: "0.85rem",
                lineHeight: 1.45,
                color: "var(--k-muted)",
              }}
            >
              {s.sub}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Service / capability cards ─────────────────────────────────── */
export type ServiceItem = {
  n: string;
  label: string;
  title: string;
  desc: string;
  points?: string[];
};

export function ServiceGrid({ items, cols = 2 }: { items: ServiceItem[]; cols?: 2 | 3 }) {
  const colClass =
    cols === 3
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      : "grid-cols-1 md:grid-cols-2";
  return (
    <div
      className={`grid ${colClass}`}
      style={{
        borderTop: "1px solid var(--k-border)",
        borderLeft: "1px solid var(--k-border)",
      }}
    >
      {items.map((it) => (
        <article
          key={it.n}
          className="k-kard-h flex flex-col p-6 md:p-8"
          style={{
            borderRight: "1px solid var(--k-border)",
            borderBottom: "1px solid var(--k-border)",
            borderRadius: 0,
            background: "transparent",
          }}
        >
          <div className="flex items-center justify-between">
            <span
              style={{
                fontFamily: MONO,
                fontSize: "0.7rem",
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--k-accent)",
              }}
            >
              {it.label}
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontWeight: 500,
                fontSize: "0.8rem",
                color: "var(--k-faint)",
              }}
            >
              [{it.n}]
            </span>
          </div>
          <h3
            className="mt-6"
            style={{
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: "clamp(1.25rem,1.9vw,1.6rem)",
              letterSpacing: "-0.02em",
              lineHeight: 1.04,
              textTransform: "uppercase",
              color: "var(--k-fg)",
            }}
          >
            {it.title}
          </h3>
          <p
            className="mt-3"
            style={{
              fontFamily: SANS,
              fontSize: "0.92rem",
              lineHeight: 1.5,
              color: "var(--k-muted)",
            }}
          >
            {it.desc}
          </p>
          {it.points && it.points.length > 0 && (
            <ul
              className="mt-5 flex flex-col gap-2"
              style={{ listStyle: "none", margin: 0, padding: 0 }}
            >
              {it.points.map((p) => (
                <li
                  key={p}
                  className="flex items-start gap-2.5"
                  style={{
                    fontFamily: MONO,
                    fontSize: "0.74rem",
                    letterSpacing: "0.02em",
                    lineHeight: 1.4,
                    color: "var(--k-muted)",
                  }}
                >
                  <span aria-hidden style={{ color: "var(--k-accent)" }}>
                    ▸
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </div>
  );
}

/* ── Generic bordered cell grid ─────────────────────────────────── */
export function CellGrid({
  cols = 4,
  children,
}: {
  cols?: 2 | 3 | 4;
  children: React.ReactNode;
}) {
  const colClass =
    cols === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : cols === 3
        ? "grid-cols-1 sm:grid-cols-3"
        : "grid-cols-1 sm:grid-cols-2 md:grid-cols-4";
  return (
    <div
      className={`grid ${colClass}`}
      style={{
        borderTop: "1px solid var(--k-border)",
        borderLeft: "1px solid var(--k-border)",
      }}
    >
      {children}
    </div>
  );
}

export function Cell({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`flex flex-col p-6 md:p-8 ${className}`}
      style={{
        borderRight: "1px solid var(--k-border)",
        borderBottom: "1px solid var(--k-border)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── Watermark (giant faint heading behind content) ─────────────── */
export function Watermark({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none select-none"
      style={{
        fontFamily: SANS,
        fontWeight: 800,
        fontSize: "clamp(3rem,12vw,11rem)",
        lineHeight: 0.9,
        letterSpacing: "-0.04em",
        textTransform: "uppercase",
        color: "var(--k-fg)",
        opacity: 0.05,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

/* ── Marquee strip ──────────────────────────────────────────────── */
export function Marquee({
  items,
  separator = "✳",
}: {
  items: string[];
  separator?: string;
}) {
  return (
    <div className="k-marquee">
      <div className="k-marquee-track" aria-hidden>
        {[...items, ...items].map((it, i) => (
          <span
            key={i}
            className="flex items-center"
            style={{
              fontFamily: MONO,
              fontSize: "0.8rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--k-fg)",
              paddingInline: 26,
              whiteSpace: "nowrap",
            }}
          >
            {it}
            <span style={{ color: "var(--k-accent)", marginLeft: 26 }}>{separator}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── CTA band ───────────────────────────────────────────────────── */
export function CTABand({
  theme = "dark",
  index,
  label,
  title,
  lead,
  primary,
  secondary,
  note,
}: {
  theme?: "dark" | "cream";
  index?: string;
  label?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
  note?: string;
}) {
  return (
    <Section theme={theme} pad="lg" grid containerWidth="narrow">
      <div className="flex flex-col items-center text-center">
        {label && (
          <div style={{ marginBottom: 20 }}>
            <Eyebrow index={index} label={label} align="center" />
          </div>
        )}
        <Display size="xl">{title}</Display>
        {lead && (
          <Lead style={{ marginTop: 20, maxWidth: "52ch", textAlign: "center" }}>
            {lead}
          </Lead>
        )}
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-3">
          <BtnPrimary href={primary.href}>{primary.label}</BtnPrimary>
          {secondary && <BtnGhost href={secondary.href}>{secondary.label}</BtnGhost>}
        </div>
        {note && (
          <div
            className="mt-8"
            style={{
              fontFamily: MONO,
              fontSize: "0.7rem",
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--k-muted)",
            }}
          >
            {note}
          </div>
        )}
      </div>
    </Section>
  );
}
