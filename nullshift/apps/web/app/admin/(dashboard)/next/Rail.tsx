"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "./next.module.css";

const PRIMARY: { label: string; href: string }[] = [
  { label: "Today", href: "/admin/next" },
  { label: "Sales & Quotes", href: "/admin/next/sales" },
  { label: "Clients", href: "/admin/next/clients" },
  { label: "Delivery", href: "/admin/next/delivery" },
  { label: "Finance", href: "/admin/next/finance" },
  { label: "Agreements", href: "/admin/next/agreements" },
  { label: "Automations", href: "/admin/next/automations" },
];

function active(pathname: string, href: string): boolean {
  if (href === "/admin/next") return pathname === href;
  if (href === "/admin/next/sales")
    return pathname.startsWith(href) || pathname.startsWith("/admin/next/quotes");
  return pathname.startsWith(href);
}

export function Rail() {
  const pathname = usePathname();
  return (
    <nav className={s.rail} aria-label="Primary">
      <div className={s.brand}>
        <span className={s.brandDot} aria-hidden="true" />
        Nullshift
      </div>
      <div className={s.railList}>
        {PRIMARY.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`${s.railLink} ${active(pathname, item.href) ? s.railLinkActive : ""}`}
            aria-current={active(pathname, item.href) ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <div className={s.railFoot}>
        <Link
          href="/admin/next/portal"
          className={`${s.railLink} ${active(pathname, "/admin/next/portal") ? s.railLinkActive : ""}`}
        >
          Client portal preview
        </Link>
        <Link
          href="/admin/next/settings"
          className={`${s.railLink} ${active(pathname, "/admin/next/settings") ? s.railLinkActive : ""}`}
        >
          Settings
        </Link>
        <Link href="/admin" className={s.railLink}>
          Current admin →
        </Link>
      </div>
    </nav>
  );
}

const BOTTOM = [
  { label: "Today", href: "/admin/next" },
  { label: "Clients", href: "/admin/next/clients" },
  { label: "Work", href: "/admin/next/delivery" },
  { label: "More", href: "/admin/next/settings" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className={s.bottomNav} aria-label="Primary (mobile)">
      {BOTTOM.map((b) => (
        <Link
          key={b.label}
          href={b.href}
          className={`${s.bottomLink} ${active(pathname, b.href) ? s.bottomLinkActive : ""}`}
        >
          {b.label}
        </Link>
      ))}
    </nav>
  );
}
