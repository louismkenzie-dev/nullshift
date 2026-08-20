"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { T } from "@nullshift/ui/tokens";
import {
  PRICING_TIERS,
  PRICING_CONSTANTS,
  type PricingTier,
} from "@nullshift/content/pricing";
import { PRICING_LEGAL_COPY } from "@nullshift/content/legal/text";

/* ════════════════════════════════════════════════════════════════
   PRICING LADDER — four monthly tiers, hairline-divided.

   Each card carries a disclosure that answers the one question a
   pricing page has to answer: what does this tier get me that the one
   below it doesn't? On a mouse it opens on hover; on a touch screen or
   a keyboard it opens on tap/Enter and expands inline instead of
   floating (see .k-plan-* in globals.css). Only one is ever open.
   ════════════════════════════════════════════════════════════════ */

function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        flex: "0 0 17px",
        height: 17,
        marginTop: 1,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        fontSize: "0.58rem",
        fontFamily: T.mono,
        lineHeight: 1,
        background: on
          ? "color-mix(in oklab, var(--k-accent) 18%, transparent)"
          : "color-mix(in oklab, var(--k-fg) 6%, transparent)",
        border: `1px solid ${
          on ? "color-mix(in oklab, var(--k-accent) 55%, transparent)" : "var(--k-border)"
        }`,
        color: on ? "var(--k-accent)" : "var(--k-faint)",
      }}
    >
      {on ? "✓" : "✕"}
    </span>
  );
}

function TierCard({
  tier,
  open,
  onOpen,
  onClose,
}: {
  tier: PricingTier;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const panelId = `plan-detail-${tier.id}`;
  const hi = !!tier.highlighted;

  // Hover opens, but only for a real mouse — a touch tap fires
  // pointerenter too, and would leave the panel stuck open with no
  // pointerleave ever coming.
  const hoverOpen = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") onOpen();
  };
  const hoverClose = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") onClose();
  };

  return (
    <div
      className="relative flex flex-col"
      style={{
        borderRight: "1px solid var(--k-border)",
        borderBottom: "1px solid var(--k-border)",
        padding: "clamp(24px,2.4vw,32px)",
        background: hi ? "var(--k-surface)" : "transparent",
        boxShadow: hi
          ? "inset 0 0 0 1px color-mix(in oklab, var(--k-accent) 42%, transparent)"
          : "none",
        // Lift the open card over its neighbours so the floating panel
        // is never painted under the next card along.
        zIndex: open ? 30 : 1,
      }}
    >
      {hi && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            insetInline: 0,
            top: 0,
            height: 2,
            background: "var(--k-accent)",
            boxShadow: "0 0 14px var(--k-accent)",
          }}
        />
      )}

      {/* ── Header: index, price, who it's for ── */}
      <div className="flex items-center justify-between gap-3">
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "0.7rem",
            fontWeight: 500,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: hi ? "var(--k-accent)" : "var(--k-muted)",
          }}
        >
          {tier.index} — {tier.name}
        </span>
        {hi && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 9px",
              borderRadius: 999,
              fontFamily: T.mono,
              fontSize: "0.6rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              color: "var(--k-accent)",
              background: "color-mix(in oklab, var(--k-accent) 14%, transparent)",
              border: "1px solid color-mix(in oklab, var(--k-accent) 40%, transparent)",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "var(--k-accent)",
              }}
            />
            Most popular
          </span>
        )}
      </div>

      <div className="mt-5 flex items-baseline gap-2">
        <span
          style={{
            fontFamily: T.sans,
            fontWeight: 800,
            fontSize: "clamp(2.1rem,3vw,2.75rem)",
            lineHeight: 1,
            letterSpacing: "-0.03em",
            color: hi ? "var(--k-accent)" : "var(--k-fg)",
          }}
        >
          {tier.price}
        </span>
      </div>
      <span
        className="mt-2"
        style={{
          fontFamily: T.mono,
          fontSize: "0.7rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--k-faint)",
        }}
      >
        {tier.cadence}
      </span>
      <span
        className="mt-4"
        style={{
          fontFamily: T.sans,
          fontWeight: 700,
          fontSize: "1rem",
          letterSpacing: "-0.01em",
          color: "var(--k-fg)",
        }}
      >
        {tier.tagline}
      </span>

      <span
        className="mt-6"
        style={{
          fontFamily: T.mono,
          fontSize: "0.66rem",
          lineHeight: 1.4,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--k-accent)",
          // Two lines are reserved whether the tag needs them or not, so the
          // hairline and the feature lists sit level across all four cards.
          minHeight: "2.8em",
        }}
      >
        For — {tier.audience}
      </span>
      <p
        className="mt-2.5"
        style={{
          fontFamily: T.sans,
          fontSize: "0.92rem",
          lineHeight: 1.55,
          color: "var(--k-muted)",
          margin: "10px 0 0",
          // Four lines reserved so the response-target row and the feature
          // lists sit level across all four cards at every breakpoint.
          minHeight: "6.5em",
        }}
      >
        {tier.who}
      </p>

      {/* ── Response target — the concrete promise on every tier ── */}
      <div
        className="flex items-baseline justify-between gap-3"
        style={{
          margin: "24px 0 0",
          padding: "10px 0 0",
          borderTop: "1px solid var(--k-border)",
        }}
      >
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "0.62rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--k-faint)",
          }}
        >
          Response target
        </span>
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "0.66rem",
            letterSpacing: "0.04em",
            color: "var(--k-accent)",
            textAlign: "right",
          }}
        >
          {tier.responseTarget}
        </span>
      </div>

      {/* ── What's in it ── */}
      <ul
        className="mt-7 flex flex-col gap-3"
        style={{
          listStyle: "none",
          margin: "20px 0 0",
          padding: "20px 0 0",
          borderTop: "1px solid var(--k-border)",
        }}
      >
        {tier.features.map((f) => (
          <li
            key={f.text}
            className="flex items-start gap-3"
            style={{
              fontFamily: T.sans,
              fontSize: "0.875rem",
              lineHeight: 1.45,
              color: f.included ? "var(--k-fg)" : "var(--k-faint)",
            }}
          >
            <Check on={f.included} />
            <span>{f.text}</span>
          </li>
        ))}
      </ul>

      {/* ── The upgrade disclosure ── */}
      <div
        className="k-plan-reveal"
        style={{ position: "relative", marginTop: "auto", paddingTop: 26 }}
        onPointerEnter={hoverOpen}
        onPointerLeave={hoverClose}
      >
        <button
          type="button"
          id={`${panelId}-trigger`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => (open ? onClose() : onOpen())}
          // Keyboard focus opens it; pointer focus must not, or the tap that
          // focuses would open it and the click straight after would toggle it
          // shut again — leaving touch users unable to open it at all.
          onFocus={(e) => {
            if (e.currentTarget.matches(":focus-visible")) onOpen();
          }}
          className="k-plan-trigger"
        >
          <span>{tier.upgrade.short}</span>
          <span aria-hidden className="k-plan-trigger-mark">
            {open ? "–" : "+"}
          </span>
        </button>

        {open && (
          <div
            id={panelId}
            role="group"
            aria-labelledby={`${panelId}-trigger`}
            className="k-plan-panel"
          >
            <p className="k-plan-panel-title">{tier.upgrade.title}</p>
            <p className="k-plan-panel-lead">{tier.upgrade.lead}</p>
            <ul className="k-plan-panel-list">
              {tier.upgrade.points.map((p) => (
                <li key={p.title}>
                  <span className="k-plan-point-title">{p.title}</span>
                  <span className="k-plan-point-body">{p.body}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {hi && (
        <p
          className="mt-4"
          style={{
            fontFamily: T.sans,
            fontSize: "0.78rem",
            lineHeight: 1.6,
            color: "var(--k-faint)",
            margin: "16px 0 0",
          }}
        >
          {PRICING_LEGAL_COPY.max}
        </p>
      )}

      <Link
        href={tier.cta.href}
        className={`kb ${hi ? "kb-primary" : "kb-outline"} mt-7`}
        style={{ justifyContent: "space-between", width: "100%" }}
      >
        {tier.cta.label}
        <span className="k-arrow" aria-hidden>
          →
        </span>
      </Link>
    </div>
  );
}

export function PricingTiers() {
  const [open, setOpen] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(null), []);

  // Escape closes, and so does moving focus or tapping outside the ladder —
  // otherwise a tap-opened panel on a touch screen has no way out.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, close]);

  return (
    <div ref={wrapRef}>
      <div className="k-plan-grid">
        {PRICING_TIERS.map((tier) => (
          <TierCard
            key={tier.id}
            tier={tier}
            open={open === tier.id}
            onOpen={() => setOpen(tier.id)}
            onClose={close}
          />
        ))}
      </div>

      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.88rem",
          lineHeight: 1.6,
          color: "var(--k-muted)",
          margin: "22px 0 0",
          maxWidth: "78ch",
        }}
      >
        {PRICING_LEGAL_COPY.main}
      </p>

      <ul
        className="mt-7 flex flex-wrap gap-x-7 gap-y-2.5"
        style={{ listStyle: "none", margin: "20px 0 0", padding: 0 }}
      >
        {PRICING_CONSTANTS.map((c) => (
          <li
            key={c}
            className="flex items-center gap-2.5"
            style={{
              fontFamily: T.mono,
              fontSize: "0.7rem",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--k-muted)",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 14,
                height: 1,
                background: "var(--k-accent)",
                display: "inline-block",
              }}
            />
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}
