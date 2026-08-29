"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NullshiftLoader } from "./NullshiftLoader";
import { subscribeOperations, resetOperations } from "./operationState";

/**
 * Full-bleed loading overlay for pressed operations — mounted once in the
 * portal and admin layouts. Shows the Nullshift scramble loader while any
 * PendingBeacon / SubmitButton reports an in-flight server action, with a
 * short delay so instant actions never flash, and force-clears on route
 * change (redirecting actions unmount their beacon mid-flight).
 */
const SHOW_DELAY_MS = 250;

export function OperationOverlay() {
  const pathname = usePathname();
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => subscribeOperations(setActive), []);

  // Only surface the overlay when the wait is real (>250ms).
  useEffect(() => {
    if (active <= 0) {
      setVisible(false);
      return;
    }
    const id = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(id);
  }, [active]);

  // A route change means the operation finished with a redirect — the beacon
  // may have unmounted without its cleanup effect firing in order; make sure
  // nothing lingers.
  useEffect(() => {
    setVisible(false);
    resetOperations();
  }, [pathname]);

  if (!visible) return null;
  return <NullshiftLoader overlay />;
}
