"use client";

import { useEffect } from "react";
import { T } from "@nullshift/ui/tokens";

/* Segment error boundary for the marketing site. Without one, a single
   client-side throw anywhere in a page reaches the root and Next replaces the
   whole site with its default "This page couldn't load" screen. This keeps the
   failure inside the page, in our own type, with a way back. */
export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[marketing] page error", error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: 24,
        background: "var(--k-bg, #0a0a0a)",
        color: "var(--k-fg, #f5f5f0)",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontFamily: T.mono,
          fontSize: "0.68rem",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--k-accent, #00d67f)",
        }}
      >
        Something went wrong
      </p>
      <h1
        style={{
          fontFamily: T.sans,
          fontWeight: 800,
          fontSize: "clamp(1.6rem,5vw,2.6rem)",
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
          maxWidth: "18ch",
        }}
      >
        This page didn&rsquo;t load properly.
      </h1>
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.95rem",
          lineHeight: 1.6,
          color: "var(--k-muted, rgba(245,245,240,0.62))",
          maxWidth: "46ch",
        }}
      >
        Try again — it is usually a one-off. If it keeps happening,{" "}
        <a href="/book" style={{ color: "var(--k-accent, #00d67f)" }}>
          tell us
        </a>{" "}
        and we will fix it.
      </p>
      <div
        style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}
      >
        <button
          onClick={reset}
          style={{
            fontFamily: T.mono,
            fontSize: "0.7rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            padding: "12px 22px",
            border: "none",
            cursor: "pointer",
            background: T.primary,
            color: T.primaryFg,
          }}
        >
          Try again
        </button>
        <a
          href="/"
          style={{
            fontFamily: T.mono,
            fontSize: "0.7rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            padding: "12px 22px",
            border: "1px solid var(--k-border, rgba(245,245,240,0.18))",
            color: "inherit",
            textDecoration: "none",
          }}
        >
          Home
        </a>
      </div>
    </main>
  );
}
