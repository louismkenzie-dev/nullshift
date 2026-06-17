"use client";

import { useEffect, useState } from "react";
import { T } from "@/lib/tokens";
import { funnelSound } from "@/lib/funnelAudio";

/** Mute / unmute control for the funnel's cinematic audio. Matches the intro's
 *  speaker icon. Unlocks the AudioContext on click (a user gesture). */
export function SoundToggle() {
  // Start unmuted for a stable server/client first render (the page is
  // statically prerendered); sync the real localStorage preference after mount
  // to avoid a hydration mismatch.
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    setMuted(funnelSound.muted);
  }, []);

  const toggle = () => {
    funnelSound.unlock();
    const next = !muted;
    funnelSound.setMuted(next);
    setMuted(next);
    if (!next) funnelSound.back(); // tiny confirmation tick when un-muting
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={muted ? "Turn sound on" : "Turn sound off"}
      aria-pressed={!muted}
      className="flex items-center justify-center transition-colors"
      style={{ width: 34, height: 34, color: muted ? T.faint : T.muted }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        {muted ? (
          <>
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </>
        ) : (
          <>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </>
        )}
      </svg>
    </button>
  );
}
