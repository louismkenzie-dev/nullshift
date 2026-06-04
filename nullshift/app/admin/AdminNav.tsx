"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { T } from "@/lib/tokens";
import { LogoMark } from "@/components/Logo";

const links = [
  { label: "Enquiries", href: "/admin" },
  { label: "Clients", href: "/admin/clients" },
  { label: "Proposals", href: "/admin/proposals" },
];

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-6 h-14 border-b"
      style={{ background: `${T.bg}e6`, borderColor: T.border, backdropFilter: "blur(12px)" }}>
      <div className="flex items-center gap-8">
        <Link href="/admin" className="flex items-center gap-2.5">
          <LogoMark size={20} />
          <span style={{ fontFamily: T.display, fontWeight: 900, fontSize: "1rem", letterSpacing: "0.02em", color: T.fg }}>NULLSHIFT</span>
          <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", color: T.primary, textTransform: "uppercase" }}>/ admin</span>
        </Link>
        <ul className="hidden md:flex items-center gap-6 list-none">
          {links.map(l => {
            const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
            return (
              <li key={l.href}>
                <Link href={l.href} style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: active ? T.primary : T.muted }}>
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden sm:inline" style={{ fontFamily: T.mono, fontSize: "10px", color: T.muted }}>{email}</span>
        <button onClick={signOut} className="px-3 h-7 transition-opacity hover:opacity-90"
          style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.fg, border: `1px solid ${T.border}`, borderRadius: "2px" }}>
          Sign out
        </button>
      </div>
    </nav>
  );
}
