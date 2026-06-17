"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { T } from "@nullshift/ui/tokens";

function ErrorContent() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message") || "An unexpected error occurred.";

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center"
      style={{ background: T.bg }}
    >
      <div className="flex flex-col gap-6">
        <h1 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "2.2rem", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>
          ERROR<br /><span style={{ color: T.primary }}>OCCURRED</span>
        </h1>
        <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted }}>
          {message}
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-5 h-11 transition-opacity hover:opacity-90"
          style={{
            fontFamily: T.mono,
            fontSize: "0.78rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
            background: T.primary,
            color: T.primaryFg,
            borderRadius: T.r.md,
            boxShadow: `0 0 24px color-mix(in oklab, ${T.primary} 25%, transparent)`,
            textDecoration: "none",
            marginTop: "24px",
          }}
        >
          Go to Home
        </Link>
      </div>
    </main>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center" style={{ background: T.bg }}>
        <p style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", color: T.muted }}>LOADING...</p>
      </main>
    }>
      <ErrorContent />
    </Suspense>
  );
}
