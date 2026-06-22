"use client";

import { useEffect, useState } from "react";

/* Renders children only on viewports >= minWidth (default lg, 1024px),
   and ONLY after mount — so heavy desktop-only widgets (e.g. the Spline
   3D scene) never mount or download their runtime on mobile. */
export function DesktopOnly({
  children,
  minWidth = 1024,
}: {
  children: React.ReactNode;
  minWidth?: number;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    const update = () => setShow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [minWidth]);
  return show ? <>{children}</> : null;
}
