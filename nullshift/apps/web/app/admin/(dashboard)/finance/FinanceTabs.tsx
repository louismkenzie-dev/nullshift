"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "../shell.module.css";

const TABS: { label: string; href: string; badge?: number }[] = [
  { label: "Overview", href: "/admin/finance" },
  { label: "Invoices", href: "/admin/finance/invoices" },
  { label: "Collections", href: "/admin/finance/collections" },
  { label: "Subscriptions", href: "/admin/finance/subscriptions" },
  { label: "Reconciliation", href: "/admin/finance/reconciliation" },
  { label: "Exceptions", href: "/admin/finance/exceptions" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin/finance") return pathname === href;
  return pathname.startsWith(href);
}

/** Local tabs for the Finance area (brief §5.6). Client-only for the active state. */
export function FinanceTabs({ openExceptions }: { openExceptions: number }) {
  const pathname = usePathname();
  return (
    <nav className={s.tabs} aria-label="Finance sections">
      {TABS.map((t) => {
        const active = isActive(pathname, t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`${s.tab} ${active ? s.tabActive : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {t.label}
            {t.label === "Exceptions" && openExceptions > 0 ? (
              <span className={s.muted}> · {openExceptions}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
