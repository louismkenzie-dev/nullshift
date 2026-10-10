"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { T } from "@nullshift/ui/tokens";
import { Logo } from "@nullshift/ui/components/Logo";
import { PRODUCTS, type ProductSlug } from "@nullshift/content/products";

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.68rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

/**
 * Console header. Only products the workspace has started (trial or paid)
 * appear as tabs; the rest live on the home grid. Mirrors the portal header's
 * KYMA language: mono uppercase, emerald underline on the active tab, a
 * full-screen menu on phones.
 */
export function AppHeader({
  email,
  workspace,
  products,
}: {
  email: string;
  workspace: string;
  products: ProductSlug[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close the sheet on route change (same pattern as PortalHeader)
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const nav = [
    { href: "/app", label: "Home" },
    ...products.map((p) => ({ href: `/app/${p}`, label: PRODUCTS[p].name })),
    { href: "/app/billing", label: "Billing" },
  ];
  const isActive = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  return (
    <>
      <header
        className="pt-[env(safe-area-inset-top)]"
        style={{
          borderBottom: "1px solid var(--k-border)",
          background: "rgba(10,10,10,0.72)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-6 px-5 md:px-8">
          <Link
            href="/app"
            className="flex items-center gap-3"
            style={{ textDecoration: "none" }}
          >
            <Logo markSize={22} />
            <span
              style={{ ...mono, color: "var(--k-muted)" }}
              className="hidden sm:inline"
            >
              / {workspace}
            </span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  ...mono,
                  color: isActive(item.href) ? "var(--k-fg)" : "var(--k-muted)",
                  textDecoration: "none",
                  paddingBottom: 4,
                  borderBottom: `2px solid ${isActive(item.href) ? "var(--k-accent)" : "transparent"}`,
                }}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/app/signout"
              style={{ ...mono, color: "var(--k-faint)", textDecoration: "none" }}
            >
              Sign out
            </Link>
          </nav>
          <button
            type="button"
            className="md:hidden"
            onClick={() => setOpen((v) => !v)}
            style={{ ...mono, color: "var(--k-fg)", background: "none", border: "none" }}
            aria-expanded={open}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </header>
      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col gap-6 p-8 pt-24 md:hidden"
          style={{ background: "var(--k-bg)" }}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              ...mono,
              color: "var(--k-muted)",
              background: "none",
              border: "none",
              position: "absolute",
              top: 20,
              right: 24,
            }}
          >
            Close
          </button>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                fontFamily: T.display,
                fontWeight: 700,
                fontSize: "1.8rem",
                textTransform: "uppercase",
                color: isActive(item.href) ? "var(--k-accent)" : "var(--k-fg)",
                textDecoration: "none",
              }}
            >
              {item.label}
            </Link>
          ))}
          <span style={{ ...mono, color: "var(--k-faint)", marginTop: "auto" }}>
            {email}
          </span>
          <Link href="/app/signout" style={{ ...mono, color: "var(--k-muted)" }}>
            Sign out
          </Link>
        </div>
      )}
    </>
  );
}
