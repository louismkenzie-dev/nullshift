"use client";

import Link from "next/link";
import { T } from "@/lib/tokens";

export function BookCta() {
  return (
    <Link
      href="/client-signup"
      className="w-full flex items-center justify-between px-5 font-medium"
      style={{
        height: 48,
        fontFamily: T.sans,
        fontSize: "0.9375rem",
        fontWeight: 500,
        letterSpacing: "-0.005em",
        background: T.primary,
        color: T.primaryFg,
        borderRadius: T.r.md,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)`,
        textDecoration: "none",
        transition: `background ${T.duration.base} ${T.ease}`,
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = T.primaryHover}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = T.primary}
    >
      <span>Get started</span>
      <span>→</span>
    </Link>
  );
}
