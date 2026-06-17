"use client";

import { useEffect, useRef, useState } from "react";
import { T } from "@nullshift/ui/tokens";

/**
 * Hero interview video — autoplays MUTED (always allowed by browsers), with a
 * clear "tap for sound" prompt. Sound is only enabled when the visitor taps the
 * prompt, so there's never surprise audio. Native controls remain as a backup.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    setMuted(true);
    v.play().catch(() => {});
  }, []);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted) v.play().catch(() => {});
  };

  return (
    <div
      className="relative mx-auto max-w-5xl overflow-hidden"
      style={{ border: `1px solid ${T.border}`, borderRadius: T.r.xl, boxShadow: T.shadow.lg, background: "#000" }}
    >
      <video
        ref={ref}
        src="/hero-interview.mp4"
        poster="/hero-interview-poster.jpg"
        autoPlay
        loop
        playsInline
        controls
        preload="metadata"
        className="block w-full"
        style={{ aspectRatio: "16 / 9", objectFit: "cover", display: "block" }}
      />

      {/* Branded sound toggle (in addition to native controls) */}
      <button
        type="button"
        onClick={toggle}
        aria-label={muted ? "Tap to turn sound on" : "Mute video"}
        className={`absolute top-3 right-3 z-10 flex items-center gap-2 transition-opacity hover:opacity-90 ${muted ? "ns-sound-pulse" : ""}`}
        style={{
          height: 36,
          paddingInline: 14,
          background: muted ? T.primary : `${T.bg}cc`,
          color: muted ? T.primaryFg : T.fg,
          border: muted ? "none" : `1px solid ${T.border}`,
          borderRadius: 999,
          backdropFilter: "blur(8px)",
          fontFamily: T.mono,
          fontSize: "11px",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
        {muted ? "Tap for sound" : "Sound on"}
      </button>
    </div>
  );
}
