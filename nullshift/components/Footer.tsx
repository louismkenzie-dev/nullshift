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
      <Link href="/" className="flex items-center gap-2.5">
        <span className="size-2 shrink-0" style={{ background: T.primary }} />
        <span style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "0.7rem", letterSpacing: "0.06em", color: T.fg }}>
          NULLSHIFT / STUDIO
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

      <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.08em", color: `${T.muted}88` }}>
        © 2025 NULLSHIFT. BUILT_WITH_INTENTION
      </span>
    </footer>
  );
}
