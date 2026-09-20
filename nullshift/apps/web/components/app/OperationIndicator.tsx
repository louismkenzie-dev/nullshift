"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { subscribeOperations, resetOperations } from "./operationState";

/**
 * Minimal inline "working" indicator for pressed operations — the admin
 * shell's replacement for the full-bleed OperationOverlay. Subscribes to the
 * same operation counter that SubmitButton / PendingBeacon raise, so every
 * server-action form still reports its in-flight state; the button's own
 * spinner stays the primary cue. Force-clears on route change for the same
 * reason the overlay did (redirecting actions unmount their beacon mid-flight).
 */
const SHOW_DELAY_MS = 250;

export function OperationIndicator({
  className,
  dotClassName,
}: {
  className?: string;
  dotClassName?: string;
}) {
  const pathname = usePathname();
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => subscribeOperations(setActive), []);

  useEffect(() => {
    if (active <= 0) {
      setVisible(false);
      return;
    }
    const id = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(id);
  }, [active]);

  useEffect(() => {
    setVisible(false);
    resetOperations();
  }, [pathname]);

  if (!visible) return null;
  return (
    <span className={className} role="status" aria-live="polite">
      <span className={dotClassName} aria-hidden="true" />
      Working…
    </span>
  );
}
