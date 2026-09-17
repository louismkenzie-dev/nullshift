"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "./next.module.css";

const PRIMARY: { label: string; href: string | null }[] = [
  { label: "Today", href: "/admin/next" },
  { label: "Sales & Quotes", href: "/admin/next/quotes/q-northline-v2" },
  { label: "Clients", href: "/admin/next/clients" },
  { label: "Delivery", href: null },
  { label: "Finance", href: null },
  { label: "Agreements", href: null },
  { label: "Automations", href: null },
];

function active(pathname: string, href: string): boolean {
  if (href === "/admin/next") return pathname === href;
  return pathname.startsWith(href.replace(/\/q-[^/]+$/, ""));
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
        {PRIMARY.map((item) =>
          item.href ? (
            <Link
              key={item.label}
              href={item.href}
              className={`${s.railLink} ${active(pathname, item.href) ? s.railLinkActive : ""}`}
              aria-current={active(pathname, item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ) : (
            <span
              key={item.label}
              className={`${s.railLink} ${s.railLinkDisabled}`}
              title="Not in this slice"
            >
              {item.label}
              <span className={s.mono}>later</span>
            </span>
          )
        )}
      </div>
      <div className={s.railFoot}>
        <span className={`${s.railLink} ${s.railLinkDisabled}`} title="Not in this slice">
          Settings
        </span>
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
  { label: "Work", href: "/admin/next/quotes/q-northline-v2" },
  { label: "More", href: "/admin" },
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
