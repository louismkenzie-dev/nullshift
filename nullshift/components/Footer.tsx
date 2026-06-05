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
      className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 md:px-12 h-auto md:h-14 py-4 md:py-0"
      style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}
    >
      <Link href="/" className="flex items-center gap-3">
        {/* Brand pill badge (dark, paths-only SVG) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/nullshift-pill-dark.svg" alt="Nullshift" width={30} height={30} style={{ borderRadius: 7 }} />
        <span style={{ fontFamily: T.display, fontWeight: 900, fontSize: "0.95rem", letterSpacing: "0.02em", color: T.fg }}>
          NULLSHIFT
        </span>
      </Link>

      <nav>
        <ul className="flex flex-wrap justify-center gap-6 list-none">
          {navLinks.map(({ label, href }) => (
            <li key={href}>
              <Link
                href={href}
                className="transition-colors hover:text-[#10b981]"
                style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted }}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex items-center gap-3">
        <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.08em", color: `${T.muted}88` }}>
          © 2025 NULLSHIFT.
        </span>
        <Link
          href="/admin/login"
          aria-label="Admin login"
          className="inline-flex items-center px-3 h-7 transition-colors hover:text-[#10b981]"
          style={{
            fontFamily: T.mono,
            fontSize: "10px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: T.fg,
            border: `1px solid ${T.border}`,
            borderRadius: "999px",
            background: `${T.bg}66`,
          }}
        >
          Admin Login
        </Link>
      </div>
    </footer>
  );
}
