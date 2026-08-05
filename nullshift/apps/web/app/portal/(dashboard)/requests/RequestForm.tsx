"use client";

import { useState } from "react";
import { T } from "@nullshift/ui/tokens";
import { PORTAL_KINDS } from "@/lib/ops/issues";
import { SubmitButton } from "@/components/admin/SubmitButton";

/**
 * The portal intake form — pick what kind of thing it is (three plain-English
 * radio cards), say what it's about, and optionally attach a screenshot. Posts
 * to the server action passed in; React resets the uncontrolled fields after a
 * successful submit, and we show a warm confirmation line.
 */
export function RequestForm({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  const [kind, setKind] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const inp = {
    fontFamily: T.sans,
    fontSize: "0.9rem",
    width: "100%",
    height: 44,
    padding: "0 12px",
    background: "var(--k-surface)",
    color: "var(--k-fg)",
    border: "1px solid var(--k-border)",
    borderRadius: 0,
    outline: "none",
  } as const;
  const label = {
    fontFamily: T.mono,
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "var(--k-muted)",
  };

  return (
    <form
      action={async (formData: FormData) => {
        await action(formData);
        setKind(null);
        setSent(true);
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="kind" value={kind ?? ""} />

      {/* Kind picker — three radio cards */}
      <div className="grid sm:grid-cols-3 gap-2" role="radiogroup" aria-label="What kind of request is this?">
        {PORTAL_KINDS.map((k) => {
          const active = kind === k.id;
          return (
            <button
              key={k.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setKind(k.id);
                setSent(false);
              }}
              className="flex flex-col gap-1 text-left"
              style={{
                padding: "13px 14px",
                background: active ? "rgba(16,185,129,0.10)" : "var(--k-surface)",
                border: `1px solid ${active ? "var(--k-accent)" : "var(--k-border)"}`,
                borderRadius: 0,
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.72rem",
                  fontWeight: 500,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: active ? "var(--k-accent)" : "var(--k-fg)",
                }}
              >
                {k.label}
              </span>
              <span
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.78rem",
                  lineHeight: 1.45,
                  color: "var(--k-muted)",
                }}
              >
                {k.hint}
              </span>
            </button>
          );
        })}
      </div>

      <label className="flex flex-col gap-1.5">
        <span style={label}>What&apos;s it about?</span>
        <input
          name="title"
          required
          maxLength={200}
          placeholder="A few words, e.g. “Booking form won't submit”"
          style={inp}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span style={label}>The details</span>
        <textarea
          name="description"
          rows={4}
          placeholder="Tell us what happened / what you'd like — the more detail the better"
          style={{ ...inp, height: "auto", padding: 12, resize: "vertical" }}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span style={label}>Add a screenshot (optional)</span>
        <input
          type="file"
          name="screenshot"
          accept="image/*"
          style={{
            ...inp,
            height: "auto",
            padding: "10px 12px",
            fontSize: "0.82rem",
            color: "var(--k-muted)",
          }}
        />
      </label>

      <div className="flex items-center gap-3 flex-wrap">
        <SubmitButton
          className="kb kb-primary self-start"
          pendingLabel="Sending…"
          disabled={!kind}
          style={
            !kind
              ? {
                  background: "var(--k-surface)",
                  color: "var(--k-faint)",
                  border: "1px solid var(--k-border)",
                  cursor: "not-allowed",
                }
              : undefined
          }
        >
          Send it over
          <span className="k-arrow" aria-hidden>
            →
          </span>
        </SubmitButton>
        {!kind && !sent && (
          <span style={{ fontFamily: T.sans, fontSize: "0.8rem", color: "var(--k-faint)" }}>
            Pick one of the three options above first.
          </span>
        )}
        {sent && (
          <span
            className="inline-flex items-center gap-1.5"
            style={{
              fontFamily: T.sans,
              fontSize: "0.85rem",
              color: "var(--k-accent)",
            }}
          >
            <span aria-hidden>✓</span> Got it — thank you. It&apos;s with us now and
            appears below.
          </span>
        )}
      </div>
    </form>
  );
}
