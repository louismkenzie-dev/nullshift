"use client";

import React from "react";

/* ════════════════════════════════════════════════════════════════
   SplineBoundary — the blast door around a Spline scene.

   The scenes stream from prod.spline.design. When that fetch fails —
   a flaky connection, a blocked third-party host, a content blocker —
   the runtime throws during render, and with no boundary in the tree
   the error reaches the root and Next replaces the ENTIRE page with
   its default "This page couldn't load" screen. A decorative 3D prop
   must never be able to take the site down, so every scene mounts
   behind this: on failure it renders the fallback (nothing, by
   default) and the page around it carries on.
   ════════════════════════════════════════════════════════════════ */
export class SplineBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode; onError?: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Decorative — log it and move on, never surface it to the visitor.
    console.warn("[spline] scene failed to load", error);
    this.props.onError?.();
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
