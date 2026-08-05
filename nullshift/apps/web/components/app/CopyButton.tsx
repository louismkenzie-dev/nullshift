"use client";

import { useRef, useState } from "react";

/**
 * Copy-to-clipboard button for compiled work orders and other long text.
 * Shows "Copied" for a couple of seconds after a successful copy. Styled
 * with the shared kb button classes so it sits in Panel action slots.
 */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <button
      type="button"
      className="kb kb-outline kb-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard unavailable (permissions / non-secure context) — do nothing.
        }
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
