"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bot,
  Boxes,
  Bug,
  Calendar,
  Eye,
  FileSignature,
  Hammer,
  Inbox,
  KeyRound,
  Landmark,
  Layers,
  LayoutTemplate,
  ListChecks,
  Lock,
  Menu,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Tag,
  Megaphone,
  Share2,
  Users,
  Wallet,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@nullshift/db/client";
import { LogoMark } from "@nullshift/ui/components/Logo";
import s from "./shell.module.css";

/**
 * The admin's navigation, in one place: the desktop rail, the header crumb,
 * the ⌘K quick-jump, the account menu, and on phones the bottom bar plus the
 * slide-over drawer. Grouped by what the person is trying to do — look after
 * clients, get work out, get paid, stay legal, run the platform — rather than
 * by which migration added the page.
 */

type Item = { label: string; href: string; icon?: LucideIcon; sub?: boolean };
type Group = { label: string | null; items: Item[] };

const GROUPS: Group[] = [
  { label: null, items: [{ label: "Today", href: "/admin", icon: Sun }] },
  {
    label: "Clients",
    items: [
      { label: "Clients", href: "/admin/clients", icon: Users },
      { label: "Sales & Quotes", href: "/admin/sales", icon: Tag },
      { label: "Outreach", href: "/admin/outreach", icon: Megaphone },
      { label: "Social", href: "/admin/social", icon: Share2 },
    ],
  },
  {
    label: "Work",
    items: [
      { label: "Delivery", href: "/admin/delivery", icon: Hammer },
      { label: "Issues", href: "/admin/issues", icon: Bug },
      { label: "Batches", href: "/admin/batches", icon: Layers },
      { label: "Delivery tasks", href: "/admin/tasks", icon: ListChecks },
      { label: "Systems", href: "/admin/systems", icon: Server },
    ],
  },
  {
    label: "Money",
    items: [
      { label: "Finance", href: "/admin/finance", icon: Wallet },
      { label: "Billing & Direct Debits", href: "/admin/billing", icon: Landmark },
      { label: "Bank feed", href: "/admin/bank", icon: Landmark },
    ],
  },
  {
    label: "Legal",
    items: [
      { label: "Agreements", href: "/admin/agreements", icon: FileSignature },
      { label: "Compliance", href: "/admin/compliance", icon: ShieldCheck },
      { label: "SOC 2 Readiness", href: "/admin/soc2", icon: Lock },
      { label: "Business vault", href: "/admin/vault", icon: KeyRound },
    ],
  },
  {
    label: "Platform",
    items: [
      { label: "AI Workspace", href: "/admin/ai", icon: Bot },
      { label: "Office map", href: "/admin/ai/map", sub: true },
      { label: "Agents", href: "/admin/ai/agents", sub: true },
      { label: "Agent tasks", href: "/admin/ai/tasks", sub: true },
      { label: "Approvals", href: "/admin/ai/approvals", sub: true },
      { label: "Routines", href: "/admin/ai/routines", sub: true },
      { label: "Agent Studio", href: "/admin/ai/studio", sub: true },
      { label: "Automations", href: "/admin/automations", icon: Workflow },
      { label: "Templates", href: "/admin/templates", icon: LayoutTemplate },
      { label: "Modules", href: "/admin/modules", icon: Boxes },
      { label: "Inbox", href: "/admin/inbox", icon: Inbox },
      { label: "Calendar", href: "/admin/calendar", icon: Calendar },
    ],
  },
];

// Legacy destinations stay reachable (and searchable) until each one is
// retired with a redirect; they just don't take a slot in the rail.
const LEGACY: Item[] = [
  { label: "Overview (legacy)", href: "/admin/overview" },
  { label: "Client grid (legacy)", href: "/admin/overview-grid" },
  { label: "Client list (legacy)", href: "/admin/clients/legacy" },
];

const FOOT: Item[] = [
  { label: "Client portal preview", href: "/admin/portal-preview", icon: Eye },
  { label: "Security & 2FA", href: "/admin/security", icon: Lock },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

const ALL: Item[] = [...GROUPS.flatMap((g) => g.items), ...LEGACY, ...FOOT];

const startsWith = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(href + "/");

/**
 * Which item owns a pathname. Longest matching href wins so /admin/ai/agents
 * lights "Agents" rather than "AI Workspace", and /admin/clients/legacy
 * lights the legacy entry rather than "Clients". Sales also owns
 * /admin/quotes (the Quotes tab lives under Sales).
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

function RailLink({
  item,
  current,
  onNavigate,
}: {
  item: Item;
  current: string | null;
  onNavigate?: () => void;
}) {
  const active = current === item.href;
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`${s.railLink} ${item.sub ? s.railSub : ""} ${active ? s.railLinkActive : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      {Icon ? <Icon className={s.railIcon} strokeWidth={1.75} aria-hidden /> : null}
      {item.label}
    </Link>
  );
}

function NavGroups({ current, onNavigate }: { current: string | null; onNavigate?: () => void }) {
  return (
    <>
      {GROUPS.map((g, i) => (
        <div key={g.label ?? "top"} className={i === 0 ? s.railList : s.railGroup}>
          {g.label && <span className={s.railGroupLabel}>{g.label}</span>}
          <div className={s.railList}>
            {g.items.map((item) => (
              <RailLink key={item.href} item={item} current={current} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
      <div className={s.railFoot}>
        {FOOT.map((item) => (
          <RailLink key={item.href} item={item} current={current} onNavigate={onNavigate} />
        ))}
      </div>
    </>
  );
}

export function Brand() {
  return (
    <Link href="/admin" className={s.brand}>
      <span className={s.brandMark} aria-hidden="true">
        <LogoMark size={16} />
      </span>
      Nullshift
      <span className={s.brandSub}>Ops</span>
    </Link>
  );
}

export function Rail() {
  const pathname = usePathname();
  const current = activeHref(pathname);
  return (
    <nav className={s.rail} aria-label="Primary">
      <Brand />
      <NavGroups current={current} />
    </nav>
  );
}

export function HeaderCrumbs() {
  const pathname = usePathname();
  return (
    <div className={s.crumbs}>
      <span>Admin</span>
      <span className={s.crumbSep} aria-hidden="true">
        /
      </span>
      <strong>{sectionLabel(pathname)}</strong>
    </div>
  );
}

/* ── Quick jump ──────────────────────────────────────────────────────────── */

export type QuickClient = { id: string; name: string; status: string | null };

type QuickHit =
  | { kind: "client"; id: string; name: string; sub: string; href: string }
  | { kind: "page"; name: string; sub: string; href: string };

const PAGE_HITS: QuickHit[] = ALL.map((i) => ({
  kind: "page",
  name: i.label,
  sub: "page",
  href: i.href,
}));

/**
 * ⌘K / Ctrl-K: type a client's name or a page and go. The client list is
 * passed from the layout (one query, ids and names only), so this never
 * calls the server while you type.
 */
export function QuickJump({ clients }: { clients: QuickClient[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const hits = useMemo<QuickHit[]>(() => {
    const needle = q.trim().toLowerCase();
    const clientHits: QuickHit[] = clients
      .filter((c) => !needle || c.name.toLowerCase().includes(needle))
      .slice(0, needle ? 8 : 6)
      .map((c) => ({
        kind: "client",
        id: c.id,
        name: c.name,
        sub: c.status ?? "client",
        href: `/admin/clients/${c.id}`,
      }));
    const pageHits = needle
      ? PAGE_HITS.filter((p) => p.name.toLowerCase().includes(needle)).slice(0, 6)
      : [];
    return [...clientHits, ...pageHits];
  }, [clients, q]);

  useEffect(() => setIndex(0), [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const go = useCallback(
    (hit: QuickHit) => {
      setOpen(false);
      setQ("");
      inputRef.current?.blur();
      router.push(hit.href);
    },
    [router]
  );

  return (
    <div className={s.quick} ref={boxRef}>
      <label className={s.quickBox}>
        <Search size={15} strokeWidth={1.8} aria-hidden />
        <input
          ref={inputRef}
          className={s.quickInput}
          value={q}
          placeholder="Jump to a client or page…"
          aria-label="Jump to a client or page"
          aria-expanded={open}
          aria-controls="quick-jump-menu"
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && hits[index]) {
              e.preventDefault();
              go(hits[index]);
            }
          }}
        />
        <span className={s.kbd} aria-hidden>
          ⌘K
        </span>
      </label>
      {open && (
        <div className={s.quickMenu} id="quick-jump-menu" role="listbox">
          {hits.length === 0 ? (
            <div className={s.quickEmpty}>Nothing matches “{q.trim()}”.</div>
          ) : (
            <>
              {hits.some((h) => h.kind === "client") && (
                <div className={s.quickGroup}>Clients</div>
              )}
              {hits.map((h, i) =>
                h.kind === "client" ? (
                  <button
                    key={`c-${h.id}`}
                    type="button"
                    role="option"
                    aria-selected={i === index}
                    className={`${s.quickItem} ${i === index ? s.quickItemActive : ""}`}
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => go(h)}
                  >
                    <Users size={14} strokeWidth={1.8} aria-hidden />
                    {h.name}
                    <span className={s.quickItemSub}>{h.sub}</span>
                  </button>
                ) : null
              )}
              {hits.some((h) => h.kind === "page") && <div className={s.quickGroup}>Pages</div>}
              {hits.map((h, i) =>
                h.kind === "page" ? (
                  <button
                    key={`p-${h.href}`}
                    type="button"
                    role="option"
                    aria-selected={i === index}
                    className={`${s.quickItem} ${i === index ? s.quickItemActive : ""}`}
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => go(h)}
                  >
                    <Sparkles size={14} strokeWidth={1.8} aria-hidden />
                    {h.name}
                    <span className={s.quickItemSub}>{h.href.replace("/admin", "") || "/"}</span>
                  </button>
                ) : null
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Account ─────────────────────────────────────────────────────────────── */

/** Account menu — the sign-out / view-website controls. */
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
  const initials = handle.slice(0, 2);
  return (
    <div className={s.account} ref={ref}>
      <button
        type="button"
        className={`${s.btn} ${s.btnSmall}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ paddingLeft: 6 }}
      >
        <span className={s.avatar} aria-hidden>
          {initials}
        </span>
        <span className={s.accountEmail} style={{ color: "inherit", fontSize: 12 }}>
          {handle}
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

/* ── Mobile ──────────────────────────────────────────────────────────────── */

const BOTTOM: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Today", href: "/admin", icon: Sun },
  { label: "Clients", href: "/admin/clients", icon: Users },
  { label: "Work", href: "/admin/delivery", icon: Hammer },
];

/** Bottom bar on phones, with "Menu" opening the full navigation as a drawer. */
export function BottomNav() {
  const pathname = usePathname();
  const current = activeHref(pathname);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <nav className={s.bottomNav} aria-label="Primary (mobile)">
        {BOTTOM.map((b) => {
          const Icon = b.icon;
          return (
            <Link
              key={b.label}
              href={b.href}
              className={`${s.bottomLink} ${current === b.href ? s.bottomLinkActive : ""}`}
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden />
              {b.label}
            </Link>
          );
        })}
        <button
          type="button"
          className={`${s.bottomLink} ${open ? s.bottomLinkActive : ""}`}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Menu size={18} strokeWidth={1.75} aria-hidden />
          Menu
        </button>
      </nav>
      {open && (
        <div className={s.drawer} role="dialog" aria-modal="true" aria-label="Navigation">
          <div className={s.drawerScrim} onClick={() => setOpen(false)} />
          <div className={s.drawerPanel}>
            <div className={s.drawerHead}>
              <Brand />
              <button
                type="button"
                className={s.iconBtn}
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X size={16} strokeWidth={1.8} />
              </button>
            </div>
            <NavGroups current={current} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
