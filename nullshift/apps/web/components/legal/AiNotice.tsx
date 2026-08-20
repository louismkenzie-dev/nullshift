"use client";

import { useEffect, useState } from "react";
import { T } from "@nullshift/ui/tokens";
import { AI_DISCLOSURE } from "@nullshift/content/legal/text";
import { legalConfig } from "@nullshift/content/legal/config";

/**
 * AI transparency UI (spec §13).
 *
 * Two obligations, two components:
 *
 *  · `AiIndicator` is PERSISTENT. It stays on screen for as long as the AI
 *    surface does — it is not a toast, it cannot be dismissed, and it does not
 *    fade after a few seconds. Someone joining halfway through a conversation
 *    must still be able to tell they are talking to a machine.
 *  · `AiFirstInteractionNotice` appears once per surface and says the three
 *    things that actually protect a user: it can be wrong, do not paste
 *    sensitive data, and a person should check anything important.
 *
 * The notice is dismissible; the indicator is not. That asymmetry is the whole
 * design — an acknowledgement can be given once, but the fact of talking to an
 * AI does not stop being true after it is acknowledged.
 */

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.6rem",
  fontWeight: 500,
  letterSpacing: "0.11em",
  textTransform: "uppercase",
};

export function AiIndicator({
  /** Adds the line about the assistant being able to act, when it can. */
  actionCapable = false,
  className = "",
}: {
  actionCapable?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 ${className}`}
      // Announced to assistive technology on every relevant view, not only
      // when it changes.
      role="note"
      aria-label={
        actionCapable
          ? `${AI_DISCLOSURE.shortLabel}. ${AI_DISCLOSURE.actionCapable}`
          : AI_DISCLOSURE.shortLabel
      }
      title={actionCapable ? AI_DISCLOSURE.actionCapable : AI_DISCLOSURE.firstInteraction}
      style={{
        ...mono,
        color: "var(--k-accent)",
        border: "1px solid color-mix(in oklab, var(--k-accent) 40%, transparent)",
        background: "color-mix(in oklab, var(--k-accent) 8%, transparent)",
        padding: "4px 9px",
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          background: "var(--k-accent)",
          display: "inline-block",
        }}
      />
      {AI_DISCLOSURE.shortLabel}
      {actionCapable && (
        <span style={{ color: "var(--k-muted)" }}>· can act on your behalf</span>
      )}
    </span>
  );
}

/**
 * Shown before the first interaction on a surface. `surface` keys the
 * acknowledgement, so a user who has seen it in the portal still sees it the
 * first time an AI appears somewhere else.
 */
export function AiFirstInteractionNotice({
  surface,
  actionCapable = false,
}: {
  surface: string;
  actionCapable?: boolean;
}) {
  const key = `ns-ai-notice:${surface}`;
  // Start hidden and reveal after the storage check, so the notice never
  // flashes for someone who dismissed it.
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(key)) setShow(true);
    } catch {
      // Storage blocked — show it. Erring towards disclosure is the right
      // failure here.
      setShow(true);
    }
  }, [key]);

  if (!show) return null;

  return (
    <div
      role="note"
      style={{
        border: "1px solid var(--k-border-strong)",
        background: "var(--k-surface)",
        padding: "14px 16px",
        marginBottom: 16,
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <AiIndicator actionCapable={actionCapable} />
      </div>
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.88rem",
          lineHeight: 1.65,
          color: "var(--k-muted)",
          marginTop: 10,
        }}
      >
        {AI_DISCLOSURE.firstInteraction}
        {actionCapable ? ` ${AI_DISCLOSURE.actionCapable}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(key, new Date().toISOString());
            } catch {
              // Not persisting is survivable; it just shows again next time.
            }
            setShow(false);
          }}
          style={{
            ...mono,
            color: "var(--k-fg)",
            background: "none",
            border: "1px solid var(--k-border-strong)",
            padding: "6px 12px",
            cursor: "pointer",
          }}
        >
          Understood
        </button>
        <a
          href={legalConfig.routes.ai}
          style={{
            ...mono,
            color: "var(--k-muted)",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          How we use AI
        </a>
      </div>
    </div>
  );
}
