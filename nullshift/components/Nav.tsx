"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { T } from "@/lib/tokens";
import { Logo } from "@/components/Logo";

const links = [
  { label: "About",       href: "/about" },
  { label: "Work",        href: "/work" },
  { label: "Systems Lab", href: "/systems-lab" },
  { label: "Pricing",     href: "/pricing" },
  { label: "FAQ",         href: "/faq" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center justify-between px-6 border-b"
      style={{ background: `${T.bg}e6`, borderColor: T.border, backdropFilter: "blur(12px)" }}
    >
      {/* Logo */}
      <Link href="/" className="relative z-10">
        <Logo markSize={24} />
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
