import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/env";
import { T } from "@/lib/tokens";
import Link from "next/link";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseBrowserConfig()) {
    return <>{children}</>;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/portal/login");
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column" }}>
      {/* Portal top bar */}
      <header
        style={{
          height: 56,
          borderBottom: `1px solid ${T.border}`,
          background: T.surface,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingInline: 24,
          flexShrink: 0,
        }}
      >
        <Link
          href="/portal"
          style={{
            fontFamily: T.mono,
            fontWeight: 700,
            fontSize: "0.8rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: T.fg,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ color: T.primary }}>■</span> Nullshift Client Portal
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontFamily: T.mono, fontSize: "11px", color: T.muted }}>
            {user.email}
          </span>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              style={{
                fontFamily: T.mono,
                fontSize: "11px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: T.muted,
                background: "none",
                border: `1px solid ${T.border}`,
                borderRadius: T.r.sm,
                padding: "4px 12px",
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main style={{ flex: 1 }}>{children}</main>
    </div>
  );
}
