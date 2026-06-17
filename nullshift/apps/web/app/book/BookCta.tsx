"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { T } from "@nullshift/ui/tokens";

export function BookCta() {
  // Carry funnel prefill (name/email) through to the signup form, if present.
  const [href, setHref] = useState("/client-signup");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const q = new URLSearchParams();
    const name = p.get("name");
    const email = p.get("email");
    if (name) q.set("name", name);
    if (email) q.set("email", email);
    const s = q.toString();
    setHref("/client-signup" + (s ? `?${s}` : ""));
  }, []);

  return (
    <Link
      href={href}
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
      <span>Book my call</span>
      <span>→</span>
    </Link>
  );
}
