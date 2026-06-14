"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * First-visit intro gate. On the first arrival of a browser session, overlays
 * the immersive intro (served as a self-contained page at /nullshift-intro.html)
 * above the homepage, then fades into the live site when the intro signals it's
 * done via postMessage("ns-intro-done").
 *
 * Gating: sessionStorage — plays once per session, not on internal navigation.
 */
const SEEN_KEY = "ns_intro_seen";

// useLayoutEffect on the client (pre-paint) avoids a flash of the home page
// before the overlay mounts; fall back to useEffect during SSR.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function IntroGate() {
  const [show, setShow] = useState(false);
  const [fading, setFading] = useState(false);
  const dismissed = useRef(false);

  useIsoLayoutEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      seen = false;
    }
    if (seen) return;
    setShow(true);
    // lock the page behind the overlay while the intro plays
    document.documentElement.style.overflow = "hidden";
  }, []);

  useEffect(() => {
    if (!show) return;
    const markSeen = () => {
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* ignore */
      }
      document.documentElement.style.overflow = "";
    };
    const dismiss = () => {
      if (dismissed.current) return;
      dismissed.current = true;
      markSeen();
      setFading(true);
      window.setTimeout(() => setShow(false), 900);
    };
    // Primary conversion CTA: take the visitor straight to the booking brief.
    const goBook = () => {
      if (dismissed.current) return;
      dismissed.current = true;
      markSeen();
      window.location.href = "/book";
    };

    // safety net: never trap the visitor if the intro never signals
    const failSafe = window.setTimeout(dismiss, 45000);

    const onMsg = (e: MessageEvent) => {
      // same-origin iframe; accept the intro's signals
      if (e.data === "ns-intro-done") dismiss();
      else if (e.data === "ns-intro-book") goBook();
      // The conversion frame is up and the visitor is in control — cancel the
      // auto-dismiss so it stays until they pick a CTA (no quick fade-away).
      else if (e.data === "ns-intro-closer") window.clearTimeout(failSafe);
    };
    window.addEventListener("message", onMsg);

    return () => {
      window.removeEventListener("message", onMsg);
      window.clearTimeout(failSafe);
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#0A0B0F",
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? "none" : "auto",
        transition: "opacity 0.9s cubic-bezier(0.2, 0.6, 0.2, 1)",
      }}
    >
      <iframe
        src="/nullshift-intro.html"
        title="Nullshift intro"
        style={{ width: "100%", height: "100%", border: 0, display: "block" }}
      />
    </div>
  );
}

export default IntroGate;
