"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { T } from "@nullshift/ui/tokens";

type Option = { id: string; label: string; description?: string; image_url?: string };

interface Props {
  updateId: string;
  type: "decision" | "branding";
  title: string;
  body: string | null;
  options: Option[];
  currentChoice: string | null;
  resolved: boolean;
}

const TYPE_COLOUR: Record<string, string> = {
  decision: T.warning,
  branding: "#818cf8",
};
const TYPE_LABEL: Record<string, string> = {
  decision: "Decision needed",
  branding: "Branding choice",
};

export function ChoiceCard({
  updateId,
  type,
  title,
  body,
  options,
  currentChoice,
  resolved,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(currentChoice);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(resolved || !!currentChoice);
  const [error, setError] = useState<string | null>(null);

  const colour = TYPE_COLOUR[type] ?? T.primary;

  async function submitChoice() {
    if (!selected || saving) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/client/choose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updateId, choice: selected }),
    });
    if (res.ok) {
      setDone(true);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Please try again.");
    }
    setSaving(false);
  }

  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${done ? T.border : colour + "60"}`,
        borderRadius: T.r.lg,
        padding: 24,
        boxShadow: done ? "none" : `0 0 0 1px ${colour}30, 0 4px 24px -6px ${colour}30`,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <span
            style={{
              fontFamily: T.mono,
              fontSize: "10px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: colour,
              background: `${colour}18`,
              padding: "3px 10px",
              borderRadius: T.r.full,
              display: "inline-block",
              marginBottom: 8,
            }}
          >
            {done ? `${TYPE_LABEL[type]} — answered ✓` : TYPE_LABEL[type]}
          </span>
          <h3
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "1rem",
              letterSpacing: "-0.01em",
              color: T.fg,
              margin: 0,
            }}
          >
            {title}
          </h3>
        </div>
      </div>

      {body && (
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.875rem",
            lineHeight: 1.6,
            color: T.muted,
            marginBottom: 16,
          }}
        >
          {body}
        </p>
      )}

      {/* Options */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {options.map((opt) => {
          const isChosen = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={done}
              onClick={() => !done && setSelected(opt.id)}
              style={{
                textAlign: "left",
                background: isChosen ? `${colour}18` : T.bg,
                border: `1.5px solid ${isChosen ? colour : T.borderStr}`,
                borderRadius: T.r.md,
                padding: 14,
                cursor: done ? "default" : "pointer",
                transition: `border-color 0.15s, background 0.15s`,
                boxShadow: isChosen ? `0 0 0 1px ${colour}40` : "none",
              }}
            >
              {opt.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={opt.image_url}
                  alt={opt.label}
                  style={{
                    width: "100%",
                    height: 100,
                    objectFit: "cover",
                    borderRadius: T.r.sm,
                    display: "block",
                    marginBottom: 10,
                    border: `1px solid ${T.border}`,
                  }}
                />
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontFamily: T.sans,
                    fontWeight: isChosen ? 600 : 400,
                    fontSize: "0.875rem",
                    color: isChosen ? T.fg : T.muted,
                  }}
                >
                  {opt.label}
                </span>
                {isChosen && (
                  <span style={{ color: colour, fontSize: 14, flexShrink: 0 }}>✓</span>
                )}
              </div>
              {opt.description && (
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.775rem",
                    lineHeight: 1.5,
                    color: T.faint,
                    marginTop: 4,
                    marginBottom: 0,
                  }}
                >
                  {opt.description}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Submit / done state */}
      {!done ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={submitChoice}
            disabled={!selected || saving}
            style={{
              height: 42,
              padding: "0 20px",
              fontFamily: T.sans,
              fontSize: "0.875rem",
              fontWeight: 500,
              letterSpacing: "-0.005em",
              background: colour,
              color: T.primaryFg,
              borderRadius: T.r.md,
              border: "none",
              cursor: !selected || saving ? "not-allowed" : "pointer",
              opacity: !selected || saving ? 0.5 : 1,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)`,
            }}
          >
            {saving ? "Submitting…" : "Confirm my choice"}
          </button>
          {!selected && (
            <span style={{ fontFamily: T.sans, fontSize: "0.8rem", color: T.faint }}>
              Select an option above
            </span>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: T.primary,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span style={{ fontFamily: T.sans, fontSize: "0.875rem", color: T.muted }}>
            Your choice has been recorded — our team will be in touch.
          </span>
        </div>
      )}

      {error && (
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.8rem",
            color: T.danger,
            marginTop: 8,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
