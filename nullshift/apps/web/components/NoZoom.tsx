"use client";

import { useEffect } from "react";

/**
 * Belt-and-braces zoom lock for iOS Safari. The touch-action rules in the
 * root layout do the real work on modern iOS; this catches the legacy
 * WebKit-only gesture events some versions still route around them, so pinch
 * can never scale the page. Touch-only (gesture events don't exist
 * elsewhere), and trackpad/keyboard zoom on desktop is unaffected. Renders
 * nothing.
 */
export function NoZoom() {
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    // WebKit fires these for pinch on iOS; passive must be false to cancel.
    document.addEventListener("gesturestart", prevent, { passive: false });
    document.addEventListener("gesturechange", prevent, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", prevent);
      document.removeEventListener("gesturechange", prevent);
    };
  }, []);
  return null;
}
