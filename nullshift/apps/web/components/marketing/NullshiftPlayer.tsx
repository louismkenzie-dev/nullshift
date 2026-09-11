"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { T } from "@nullshift/ui/tokens";

/** Nullshift-branded video player — custom chrome over a native <video>, so
 *  Mux-hosted MP4s play everywhere with zero player dependencies and none of
 *  the default browser chrome. Square corners, hairline borders, emerald
 *  accent, mono micro-labels: indistinguishable from the rest of the site.
 *
 *  `src` may be null: the frame then renders the poster (or a neutral stage)
 *  at `aspect` with a centred "Video coming soon" and no controls — the slot
 *  a client story keeps until their testimonial is recorded.
 *
 *  Keyboard: space/k play·pause, m mute, c captions, f fullscreen. */

function fmt(s: number): string {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function NullshiftPlayer({
  src,
  poster,
  captionsSrc,
  label = "Client story",
  title,
  aspect = "16 / 9",
}: {
  src: string | null;
  poster?: string;
  /** WebVTT captions track. When absent the CC toggle renders disabled. */
  captionsSrc?: string;
  /** Corner mono tag, e.g. "Client story". */
  label?: string;
  /** Accessible name for the video element. */
  title: string;
  /** CSS aspect-ratio of the stage, e.g. "9 / 16" for portrait. */
  aspect?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [captions, setCaptions] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hovering, setHovering] = useState(false);

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }, []);

  const fullscreen = useCallback(() => {
    const el = frameRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }, []);

  const toggleCaptions = useCallback(() => {
    if (!captionsSrc) return;
    setCaptions((on) => {
      const track = videoRef.current?.textTracks?.[0];
      if (track) track.mode = on ? "hidden" : "showing";
      return !on;
    });
  }, [captionsSrc]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => {
      setPlaying(true);
      setStarted(true);
    };
    const onPause = () => setPlaying(false);
    const onTime = () => setTime(v.currentTime);
    const onMeta = () => {
      setDuration(v.duration);
      // Captions start hidden; the CC button turns them on.
      const track = v.textTracks?.[0];
      if (track) track.mode = "hidden";
    };
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
    };
  }, [src]);

  const onKey = (e: React.KeyboardEvent) => {
    if (!src) return;
    const k = e.key.toLowerCase();
    if (e.key === " " || k === "k") {
      e.preventDefault();
      toggle();
    } else if (k === "m") {
      setMuted((m) => {
        if (videoRef.current) videoRef.current.muted = !m;
        return !m;
      });
    } else if (k === "c") {
      toggleCaptions();
    } else if (k === "f") {
      fullscreen();
    }
  };

  const pct = duration > 0 ? (time / duration) * 100 : 0;
  const controlsVisible = !playing || hovering;

  return (
    <div
      ref={frameRef}
      role="group"
      aria-label={title}
      tabIndex={src ? 0 : -1}
      onKeyDown={onKey}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        position: "relative",
        background: T.bg,
        border: `1px solid ${T.border}`,
        outline: "none",
      }}
    >
      {/* Top chrome */}
      <div
        className="flex items-center justify-between px-4"
        style={{
          height: 38,
          borderBottom: `1px solid ${T.border}`,
          background: T.bg,
        }}
      >
        <span style={{ ...mono, color: T.primary }}>
          Nullshift <span style={{ color: T.faint }}>//</span> {label}
        </span>
        <span style={{ ...mono, color: T.faint }}>{src ? fmt(duration) : "—:——"}</span>
      </div>

      {/* Stage */}
      <div style={{ position: "relative", background: "#000" }}>
        {src ? (
          <video
            ref={videoRef}
            title={title}
            poster={poster}
            preload="metadata"
            playsInline
            muted={muted}
            crossOrigin={captionsSrc ? "anonymous" : undefined}
            onClick={toggle}
            style={{
              width: "100%",
              aspectRatio: aspect,
              display: "block",
              cursor: "pointer",
            }}
          >
            <source src={src} type="video/mp4" />
            {captionsSrc && (
              <track
                kind="captions"
                src={captionsSrc}
                srcLang="en"
                label="English"
                default
              />
            )}
          </video>
        ) : (
          <ComingSoon aspect={aspect} poster={poster} />
        )}

        {/* Big square play — shown until first play, and on pause */}
        {src && !playing && (
          <button
            onClick={toggle}
            aria-label={started ? "Resume" : "Play"}
            style={{
              position: "absolute",
              inset: 0,
              margin: "auto",
              width: 74,
              height: 74,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `${T.bg}d9`,
              border: `1.5px solid ${T.primary}`,
              color: T.primary,
              cursor: "pointer",
              backdropFilter: "blur(4px)",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
              <path d="M6 3.5v15l13-7.5-13-7.5z" fill="currentColor" />
            </svg>
          </button>
        )}

        {/* Bottom control bar */}
        {src && (
          <div
            className="flex items-center gap-3 px-3"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 44,
              background: `linear-gradient(transparent, ${T.bg}e8 40%)`,
              opacity: controlsVisible ? 1 : 0,
              transition: "opacity 200ms ease",
              pointerEvents: controlsVisible ? "auto" : "none",
            }}
          >
            <button onClick={toggle} aria-label={playing ? "Pause" : "Play"} style={ctl}>
              {playing ? (
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                  <path d="M2 1h3v10H2zM7 1h3v10H7z" fill="currentColor" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                  <path d="M2.5 1v10l8-5-8-5z" fill="currentColor" />
                </svg>
              )}
            </button>
            <span style={{ ...mono, color: T.fg, minWidth: 34 }}>{fmt(time)}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={pct}
              aria-label="Seek"
              onChange={(e) => {
                const v = videoRef.current;
                if (!v || !duration) return;
                v.currentTime = (Number(e.target.value) / 100) * duration;
              }}
              style={{
                flex: 1,
                appearance: "none",
                height: 2,
                background: `linear-gradient(to right, ${T.primary} ${pct}%, ${T.borderStr} ${pct}%)`,
                cursor: "pointer",
                accentColor: T.primary,
              }}
            />
            <button
              onClick={toggleCaptions}
              disabled={!captionsSrc}
              aria-pressed={captions}
              aria-label={
                !captionsSrc
                  ? "Captions not available yet"
                  : captions
                    ? "Hide captions"
                    : "Show captions"
              }
              title={!captionsSrc ? "Captions coming soon" : undefined}
              style={{
                ...ctl,
                ...mono,
                fontSize: "9px",
                width: "auto",
                paddingInline: 6,
                color: captions ? T.primary : T.fg,
                opacity: captionsSrc ? 1 : 0.35,
                cursor: captionsSrc ? "pointer" : "default",
                borderBottom: captions
                  ? `1.5px solid ${T.primary}`
                  : "1.5px solid transparent",
              }}
            >
              CC
            </button>
            <button
              onClick={() =>
                setMuted((m) => {
                  if (videoRef.current) videoRef.current.muted = !m;
                  return !m;
                })
              }
              aria-label={muted ? "Unmute" : "Mute"}
              style={ctl}
            >
              {muted ? (
                <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
                  <path d="M1 5h3l4-3v10l-4-3H1z" fill="currentColor" />
                  <path d="M10 5l3 4M13 5l-3 4" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
                  <path d="M1 5h3l4-3v10l-4-3H1z" fill="currentColor" />
                  <path
                    d="M10.5 4.5a3.6 3.6 0 010 5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    fill="none"
                  />
                </svg>
              )}
            </button>
            <button onClick={fullscreen} aria-label="Fullscreen" style={ctl}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path
                  d="M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** The empty slot: poster if we have one, otherwise a neutral stage. */
function ComingSoon({ aspect, poster }: { aspect: string; poster?: string }) {
  return (
    <div
      role="img"
      aria-label="Video coming soon"
      style={{
        width: "100%",
        aspectRatio: aspect,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: poster
          ? `center / cover no-repeat url(${poster}), ${T.surface}`
          : `linear-gradient(135deg, ${T.surface}, ${T.bg})`,
      }}
    >
      <span
        style={{
          ...mono,
          color: T.muted,
          border: `1px solid ${T.border}`,
          background: `${T.bg}cc`,
          padding: "10px 14px",
          backdropFilter: "blur(4px)",
        }}
      >
        Video coming soon
      </span>
    </div>
  );
}

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "10px",
  fontWeight: 500,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

const ctl: React.CSSProperties = {
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  color: T.fg,
  cursor: "pointer",
  padding: 0,
};
