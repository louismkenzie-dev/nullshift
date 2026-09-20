"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@nullshift/db/client";
import s from "./shell.module.css";

type Item = { label: string; href: string; sub?: boolean };

const PRIMARY: Item[] = [
  { label: "Today", href: "/admin" },
  { label: "Sales & Quotes", href: "/admin/sales" },
  { label: "Clients", href: "/admin/clients" },
  { label: "Delivery", href: "/admin/delivery" },
  { label: "Finance", href: "/admin/finance" },
  { label: "Agreements", href: "/admin/agreements" },
  { label: "Automations", href: "/admin/automations" },
];

// Every legacy destination that used to live in the AdminNav drawer, plus the
// legacy pages the redesign replaced at their old URLs. Kept reachable until
// each workflow is retired with a redirect (phase5-pilot-checklist D7).
const ADVANCED: Item[] = [
  { label: "Overview", href: "/admin/overview" },
  { label: "Client grid (legacy)", href: "/admin/overview-grid" },
  { label: "Client list (legacy)", href: "/admin/clients/legacy" },
  { label: "Systems", href: "/admin/systems" },
  { label: "Issues", href: "/admin/issues" },
  { label: "Batches", href: "/admin/batches" },
  { label: "Delivery tasks", href: "/admin/tasks" },
  { label: "Inbox", href: "/admin/inbox" },
  { label: "Calendar", href: "/admin/calendar" },
  { label: "Templates", href: "/admin/templates" },
  { label: "Modules", href: "/admin/modules" },
  { label: "AI Workspace", href: "/admin/ai" },
  { label: "Office map", href: "/admin/ai/map", sub: true },
  { label: "Agents", href: "/admin/ai/agents", sub: true },
  { label: "Agent tasks", href: "/admin/ai/tasks", sub: true },
  { label: "Approvals", href: "/admin/ai/approvals", sub: true },
  { label: "Routines", href: "/admin/ai/routines", sub: true },
  { label: "Agent Studio", href: "/admin/ai/studio", sub: true },
  { label: "Pipeline", href: "/admin/pipeline" },
  { label: "Billing & Direct Debits", href: "/admin/billing" },
  { label: "Compliance", href: "/admin/compliance" },
  { label: "SOC 2 Readiness", href: "/admin/soc2" },
  { label: "Security", href: "/admin/security" },
  { label: "Business vault", href: "/admin/vault" },
];

const FOOT: Item[] = [
  { label: "Client portal preview", href: "/admin/portal-preview" },
  { label: "Settings", href: "/admin/settings" },
];

const ALL: Item[] = [...PRIMARY, ...ADVANCED, ...FOOT];

const startsWith = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(href + "/");

/**
 * Which rail item owns a pathname. Longest matching href wins so
 * /admin/ai/agents lights "Agents" rather than "AI Workspace", and
 * /admin/clients/legacy lights the legacy entry rather than "Clients".
 * Sales also owns /admin/quotes (the Quotes tab lives under Sales).
 */
export function activeHref(pathname: string): string | null {
  if (pathname === "/admin") return "/admin";
  if (startsWith(pathname, "/admin/quotes")) return "/admin/sales";
  let best: string | null = null;
  for (const item of ALL) {
    if (item.href === "/admin") continue;
    if (startsWith(pathname, item.href) && (!best || item.href.length > best.length)) {
      best = item.href;
    }
  }
  return best;
}

/** Human label for the header crumb. */
export function sectionLabel(pathname: string): string {
  const href = activeHref(pathname);
  return ALL.find((i) => i.href === href)?.label ?? "Admin";
}

function RailLink({ item, current }: { item: Item; current: string | null }) {
  const active = current === item.href;
  return (
    <Link
      href={item.href}
      className={`${s.railLink} ${item.sub ? s.railSub : ""} ${active ? s.railLinkActive : ""}`}
      aria-current={active ? "page" : undefined}
    >
      {item.label}
    </Link>
  );
}

export function Rail() {
  const pathname = usePathname();
  const current = activeHref(pathname);
  const advancedOpen = ADVANCED.some((i) => i.href === current);
  return (
    <nav className={s.rail} aria-label="Primary">
      <Link href="/admin" className={s.brand}>
        <span className={s.brandDot} aria-hidden="true" />
        Nullshift
      </Link>
      <div className={s.railList}>
        {PRIMARY.map((item) => (
          <RailLink key={item.href} item={item} current={current} />
        ))}
      </div>
      <details className={s.railDetails} open={advancedOpen || undefined}>
        <summary>Advanced</summary>
        <div className={s.railList}>
          {ADVANCED.map((item) => (
            <RailLink key={item.href} item={item} current={current} />
          ))}
        </div>
      </details>
      <div className={s.railFoot} style={{ paddingTop: 18 }}>
        {FOOT.map((item) => (
          <RailLink key={item.href} item={item} current={current} />
        ))}
      </div>
    </nav>
  );
}

export function HeaderCrumbs() {
  const pathname = usePathname();
  return (
    <div className={s.crumbs}>
      <span>Admin</span>
      <span aria-hidden="true">/</span>
      <strong>{sectionLabel(pathname)}</strong>
    </div>
  );
}

/** Account menu — the sign-out / view-website controls from the old drawer. */
export function AccountControl({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  const handle = email.split("@")[0] || "staff";
  return (
    <div className={s.account} ref={ref}>
      <button
        type="button"
        className={`${s.btn} ${s.btnSmall}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={s.mono} style={{ color: "inherit" }}>
          {handle} · staff
        </span>
      </button>
      {open ? (
        <div className={s.accountMenu} role="menu">
          <div className={s.accountEmail} style={{ padding: "10px 12px" }}>
            {email}
          </div>
          <Link href="/" role="menuitem" onClick={() => setOpen(false)}>
            ← View website
          </Link>
          <Link href="/admin/security" role="menuitem" onClick={() => setOpen(false)}>
            Security &amp; 2FA
          </Link>
          <button type="button" role="menuitem" className={s.danger} onClick={signOut}>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

const BOTTOM: Item[] = [
  { label: "Today", href: "/admin" },
  { label: "Clients", href: "/admin/clients" },
  { label: "Work", href: "/admin/delivery" },
  { label: "More", href: "/admin/settings" },
];

export function BottomNav() {
  const pathname = usePathname();
  const current = activeHref(pathname);
  return (
    <nav className={s.bottomNav} aria-label="Primary (mobile)">
      {BOTTOM.map((b) => (
        <Link
          key={b.label}
          href={b.href}
          className={`${s.bottomLink} ${current === b.href ? s.bottomLinkActive : ""}`}
        >
          {b.label}
        </Link>
      ))}
    </nav>
  );
}
