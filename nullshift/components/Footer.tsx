import Link from "next/link";
import { T } from "@/lib/tokens";

const navLinks = [
  { label: "About",   href: "/about" },
  { label: "Work",    href: "/work" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ",     href: "/faq" },
  { label: "Brand",   href: "/brand" },
  { label: "Legal",   href: "/legal" },
];

export function Footer() {
  return (
    <footer
      className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 md:px-12 py-5 md:py-0"
      style={{ minHeight: 64, borderTop: `1px solid ${T.border}`, background: T.surface }}
    >
      <Link href="/" className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/nullshift-pill-dark.svg" alt="Nullshift" width={28} height={28} style={{ borderRadius: 7 }} />
        <span style={{ fontFamily: T.sans, fontWeight: 600, fontSize: "0.9375rem", letterSpacing: "-0.01em", color: T.fg }}>
          Nullshift
        </span>
      </Link>

      <nav>
        <ul className="flex flex-wrap justify-center gap-6 list-none">
          {navLinks.map(({ label, href }) => (
            <li key={href}>
              <Link
                href={href}
                className="transition-colors"
                style={{ fontFamily: T.sans, fontSize: "0.8125rem", fontWeight: 400, letterSpacing: "-0.003em", color: T.muted, textDecoration: "none" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = T.fg}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = T.muted}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex items-center gap-3">
        <span style={{ fontFamily: T.mono, fontSize: "0.75rem", letterSpacing: "0em", color: `${T.muted}88` }}>
          © 2025 Nullshift.
        </span>
        <Link
          href="/admin/login"
          aria-label="Admin login"
          className="inline-flex items-center px-3 h-7 transition-colors"
          style={{
            fontFamily: T.sans,
            fontSize: "0.75rem",
            fontWeight: 500,
            letterSpacing: "-0.003em",
            color: T.muted,
            border: `1px solid ${T.border}`,
            borderRadius: "999px",
            background: `${T.bg}66`,
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = T.fg}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = T.muted}
        >
          Admin
        </Link>
      </div>
    </footer>
  );
}
