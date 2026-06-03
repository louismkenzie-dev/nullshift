"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { T } from "@/lib/tokens";

const links = [
  { label: "Why us",  href: "/why-us" },
  { label: "Work",    href: "/work" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ",     href: "/faq" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center justify-between px-6 border-b"
      style={{ background: `${T.bg}e6`, borderColor: T.border, backdropFilter: "blur(12px)" }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5">
        <span className="size-2 shrink-0" style={{ background: T.primary }} />
        <span style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.04em", color: T.fg }}>
          NULLSHIFT
        </span>
        <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.04em", color: T.muted }}>
          / STUDIO
        </span>
      </Link>

      {/* Links */}
      <ul className="hidden md:flex items-center gap-8 list-none">
        {links.map(({ label, href }) => (
          <li key={href}>
            <Link
              href={href}
              className="transition-colors hover:text-[#10b981]"
              style={{
                fontFamily: T.mono,
                fontSize: "10px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: pathname === href ? T.primary : T.muted,
              }}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Link
        href="/book"
        className="h-7 px-4 inline-flex items-center font-semibold transition-opacity hover:opacity-90"
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          background: T.primary,
          color: T.primaryFg,
          borderRadius: "2px",
        }}
      >
        Book a call
      </Link>
    </nav>
  );
}
