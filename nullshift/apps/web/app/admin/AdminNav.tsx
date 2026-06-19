"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  FolderKanban,
  Receipt,
  ShieldCheck,
  ListChecks,
  Calendar,
  Megaphone,
  KeyRound,
  UsersRound,
  Mail,
  Building2,
  FileText,
  FileSignature,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@nullshift/db/client";
import { T } from "@nullshift/ui/tokens";
import { LogoMark } from "@nullshift/ui/components/Logo";

type NavItem = { label: string; href: string; Icon: LucideIcon };
type NavGroup = { section: string; items: NavItem[] };

// Ordered by the client lifecycle: inquiry → call (Pipeline) → portal, proposal,
// DPA, build edits, notes (Delivery) → itemised invoice (Billing) → compliance.
const groups: NavGroup[] = [
  {
    section: "Lifecycle",
    items: [
      { label: "Dashboard", href: "/admin", Icon: LayoutDashboard },
      { label: "Pipeline", href: "/admin/pipeline", Icon: Inbox },
      { label: "Clients", href: "/admin/clients", Icon: Building2 },
      { label: "Delivery", href: "/admin/delivery", Icon: FolderKanban },
      { label: "Billing", href: "/admin/billing", Icon: Receipt },
      { label: "Compliance", href: "/admin/compliance", Icon: ShieldCheck },
    ],
  },
  {
    section: "Tools",
    items: [
      { label: "Tasks", href: "/admin/tasks", Icon: ListChecks },
      { label: "Calendar", href: "/admin/calendar", Icon: Calendar },
      { label: "Marketing", href: "/admin/marketing", Icon: Megaphone },
      { label: "Security", href: "/admin/security", Icon: KeyRound },
      { label: "Users", href: "/admin/users", Icon: UsersRound },
    ],
  },
  {
    section: "Legacy",
    items: [
      { label: "Enquiries", href: "/admin/enquiries", Icon: Mail },
      { label: "Quotes", href: "/admin/quotes", Icon: FileText },
      { label: "Proposals", href: "/admin/proposals", Icon: FileSignature },
    ],
  },
];

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Lock body scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* ── Top bar ────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-5 h-14 border-b"
        style={{
          background: `${T.bg}f0`,
          borderColor: T.border,
          backdropFilter: "blur(14px)",
        }}
      >
        {/* Logo */}
        <Link
          href="/admin"
          className="flex items-center gap-2.5"
          onClick={() => setOpen(false)}
        >
          <LogoMark size={20} />
          <span
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "1rem",
              letterSpacing: "0.02em",
              color: T.fg,
            }}
          >
            Nullshift
          </span>
          <span
            style={{
              fontFamily: T.mono,
              fontSize: "10px",
              letterSpacing: "0.1em",
              color: T.primary,
              textTransform: "uppercase",
            }}
          >
            / admin
          </span>
        </Link>

        {/* Hamburger — all screen sizes */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex flex-col justify-center items-center gap-[5px] w-9 h-9 rounded-md transition-colors"
          style={{ background: open ? T.surface2 : "transparent" }}
          aria-label="Open menu"
        >
          <span
            style={{
              display: "block",
              width: 20,
              height: 1.5,
              background: T.fg,
              borderRadius: 2,
              transition: "transform .2s, opacity .2s",
              transform: open ? "translateY(6.5px) rotate(45deg)" : "none",
            }}
          />
          <span
            style={{
              display: "block",
              width: 20,
              height: 1.5,
              background: T.fg,
              borderRadius: 2,
              transition: "opacity .2s",
              opacity: open ? 0 : 1,
            }}
          />
          <span
            style={{
              display: "block",
              width: 20,
              height: 1.5,
              background: T.fg,
              borderRadius: 2,
              transition: "transform .2s, opacity .2s",
              transform: open ? "translateY(-6.5px) rotate(-45deg)" : "none",
            }}
          />
        </button>
      </nav>

      {/* ── Mobile drawer ──────────────────────────────────── */}
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
      />

      {/* Drawer panel */}
      <aside
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
        style={{
          width: "min(320px, 85vw)",
          background: T.surface,
          borderLeft: `1px solid ${T.border}`,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Drawer header */}
        <div
          className="flex items-center justify-between px-6 h-14 shrink-0"
          style={{ borderBottom: `1px solid ${T.border}` }}
        >
          <div className="flex items-center gap-2.5">
            <LogoMark size={18} />
            <span
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: "0.95rem",
                color: T.fg,
              }}
            >
              Nullshift
            </span>
            <span
              style={{
                fontFamily: T.mono,
                fontSize: "9px",
                letterSpacing: "0.1em",
                color: T.primary,
                textTransform: "uppercase",
              }}
            >
              / admin
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{ color: T.muted, fontFamily: T.mono, fontSize: 20, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Nav links — grouped by lifecycle */}
        <nav className="flex flex-col gap-1 px-4 py-5 flex-1 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.section} className="mb-2">
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: "9px",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: T.faint,
                  paddingLeft: "12px",
                  marginTop: "10px",
                  marginBottom: "6px",
                }}
              >
                {group.section}
              </div>
              {group.items.map((l) => {
                const active = isActive(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
                    style={{
                      background: active ? `${T.primary}18` : "transparent",
                      borderLeft: `2px solid ${active ? T.primary : "transparent"}`,
                    }}
                  >
                    <l.Icon
                      size={17}
                      strokeWidth={1.75}
                      color={active ? T.primary : T.muted}
                      style={{ flexShrink: 0 }}
                    />
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontWeight: 500,
                        fontSize: "0.9375rem",
                        letterSpacing: "-0.005em",
                        color: active ? T.primary : T.fg,
                      }}
                    >
                      {l.label}
                    </span>
                    {active && (
                      <span
                        style={{
                          marginLeft: "auto",
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: T.primary,
                        }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Drawer footer */}
        <div
          className="px-6 py-5 shrink-0 flex flex-col gap-3"
          style={{ borderTop: `1px solid ${T.border}` }}
        >
          <div
            style={{
              fontFamily: T.mono,
              fontSize: "10px",
              color: T.muted,
              letterSpacing: "0.06em",
            }}
          >
            {email}
          </div>
          <Link
            href="/"
            className="w-full h-10 inline-flex items-center justify-center transition-opacity hover:opacity-90"
            onClick={() => setOpen(false)}
            style={{
              fontFamily: T.mono,
              fontSize: "11px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: T.fg,
              border: `1px solid ${T.border}`,
              borderRadius: "6px",
            }}
          >
            ← View website
          </Link>
          <button
            onClick={signOut}
            className="w-full h-10 transition-opacity hover:opacity-90"
            style={{
              fontFamily: T.mono,
              fontSize: "11px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: T.danger,
              border: `1px solid ${T.danger}40`,
              borderRadius: "6px",
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
