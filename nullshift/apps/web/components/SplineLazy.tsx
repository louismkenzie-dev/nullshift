"use client";

import { Suspense, lazy, useEffect, useRef, useState } from "react";
import type { Application } from "@splinetool/runtime";

const Spline = lazy(() => import("@splinetool/react-spline"));

/* ════════════════════════════════════════════════════════════════
   SplineLazy — mounts a Spline scene ONLY once its container nears
   the viewport (so heavy scenes don't fetch until needed), shows the
   brand loader while it streams, and hands the loaded Application back
   via onReady so the parent can drive it from scroll. The scene canvas
   is non-interactive (pointer-events: none) so it never eats page
   scroll / clicks — we drive any motion ourselves.
   ════════════════════════════════════════════════════════════════ */
export function SplineLazy({
  scene,
  className = "",
  style,
  onReady,
  rootMargin = "600px",
  interactive = false,
}: {
  scene: string;
  className?: string;
  style?: React.CSSProperties;
  onReady?: (app: Application) => void;
  rootMargin?: string;
  interactive?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={className} style={{ position: "relative", ...style }}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="loader" aria-hidden />
        </div>
      )}
      {show && (
        <Suspense fallback={null}>
          <Spline
            scene={scene}
            onLoad={(app) => {
              setLoaded(true);
              onReady?.(app);
            }}
            style={{
              width: "100%",
              height: "100%",
              pointerEvents: interactive ? "auto" : "none",
              opacity: loaded ? 1 : 0,
              transition: "opacity 0.6s ease",
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
