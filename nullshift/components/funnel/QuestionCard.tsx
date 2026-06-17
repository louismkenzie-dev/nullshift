"use client";

import { useEffect, useRef, useState } from "react";
import { T } from "@/lib/tokens";
import type { FunnelStep } from "@/lib/funnel";

/** One question per screen. Large tap targets, instant-advance on tap (the
 *  parent records the answer and moves forward). An option flagged `other`
 *  reveals a free-text input instead of advancing. Accessible: the question is
 *  a focus-managed heading, options are a labelled button group. */
export function QuestionCard({
  step,
  index,
  total,
  selected,
  otherValue,
  onSelect,
  onSkip,
}: {
  step: FunnelStep;
  index: number; // 1-based position in the visible sequence
  total: number;
  selected?: string;
  otherValue?: string;
  onSelect: (optionId: string, otherText?: string) => void;
  onSkip?: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const otherRef = useRef<HTMLInputElement>(null);
  const [showOther, setShowOther] = useState(selected === "other");
  const [otherText, setOtherText] = useState(otherValue ?? "");

  useEffect(() => {
    headingRef.current?.focus();
  }, [step.id]);

  useEffect(() => {
    if (showOther) otherRef.current?.focus();
  }, [showOther]);

  const submitOther = () => {
    const v = otherText.trim();
    if (v) onSelect("other", v);
  };

  return (
    <div>
      <span
        className="inline-flex items-center gap-2"
        style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: T.primary, marginBottom: 14 }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.primary, display: "inline-block" }} />
        {step.stage === 1 ? "Getting started" : `Step ${index} of ${total}`}
      </span>

      <h1
        ref={headingRef}
        tabIndex={-1}
        style={{
          fontFamily: T.display,
          fontWeight: 600,
          fontSize: "clamp(1.75rem, 5vw, 2.75rem)",
          lineHeight: 1.08,
          letterSpacing: "-0.03em",
          color: T.fg,
          outline: "none",
        }}
      >
        {step.question}
      </h1>

      {step.help && (
        <p className="mt-3 max-w-[44ch]" style={{ fontFamily: T.sans, fontSize: "0.95rem", lineHeight: 1.6, color: T.muted }}>
          {step.help}
        </p>
      )}

      <div role="group" aria-label={step.question} className="mt-8 grid gap-3">
        {step.options.map((opt) => {
          const sel = opt.other ? showOther : selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                if (opt.other) setShowOther(true);
                else {
                  setShowOther(false);
                  onSelect(opt.id);
                }
              }}
              aria-pressed={sel}
              className="ns-funnel-option flex items-center justify-between text-left w-full"
              style={{
                minHeight: 64,
                padding: "14px 18px",
                borderRadius: T.r.lg,
                border: `1px solid ${sel ? T.primary : T.border}`,
                background: sel ? T.primarySoft : T.surface,
                transition: "border-color .18s ease, background .18s ease, transform .12s ease",
              }}
            >
              <span className="flex flex-col">
                <span style={{ fontFamily: T.sans, fontSize: "1.0625rem", fontWeight: 500, color: T.fg }}>{opt.label}</span>
                {opt.desc && (
                  <span style={{ fontFamily: T.sans, fontSize: "0.8125rem", color: T.muted, marginTop: 2 }}>{opt.desc}</span>
                )}
              </span>
              <span
                aria-hidden
                className="shrink-0 ml-4 flex items-center justify-center"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  border: `1.5px solid ${sel ? T.primary : T.borderStr}`,
                  background: sel ? T.primary : "transparent",
                  color: T.primaryFg,
                  fontFamily: T.mono,
                  fontSize: 13,
                  lineHeight: 1,
                  transition: "border-color .18s ease, background .18s ease",
                }}
              >
                {sel ? "✓" : ""}
              </span>
            </button>
          );
        })}
      </div>

      {/* Free-text "Other" reveal */}
      {showOther && (
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            ref={otherRef}
            className="brief-input"
            type="text"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitOther();
              }
            }}
            placeholder="Tell us a little more…"
            aria-label="Tell us more"
          />
          <button
            type="button"
            onClick={submitOther}
            disabled={!otherText.trim()}
            className="inline-flex items-center justify-center font-medium disabled:opacity-50 shrink-0"
            style={{ height: 44, paddingInline: 20, background: T.primary, color: T.primaryFg, borderRadius: T.r.md, fontFamily: T.sans, fontSize: "0.9375rem", fontWeight: 500 }}
          >
            Continue →
          </button>
        </div>
      )}

      {step.optional && onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="mt-5 transition-colors"
          style={{ fontFamily: T.mono, fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: T.faint }}
        >
          Skip this question →
        </button>
      )}
    </div>
  );
}
