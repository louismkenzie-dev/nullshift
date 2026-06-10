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
      {/* Halo top bar — 56px, hairline border, surface background */}
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
          boxShadow: T.shadow.sm,
        }}
      >
        <Link
          href="/portal"
          style={{
            fontFamily: T.sans,
            fontWeight: 600,
            fontSize: "0.875rem",
            letterSpacing: "-0.005em",
            color: T.fg,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {/* Brand dot */}
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: T.primary,
            boxShadow: `0 0 0 4px ${T.primarySoft}`,
            display: "inline-block",
            flexShrink: 0,
          }} />
          Client Portal
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontFamily: T.mono, fontSize: "0.75rem", fontWeight: 500, color: T.muted }}>
            {user.email}
          </span>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              style={{
                fontFamily: T.sans,
                fontSize: "0.8125rem",
                fontWeight: 500,
                letterSpacing: "-0.003em",
                color: T.muted,
                background: "transparent",
                border: `1px solid ${T.border}`,
                borderRadius: T.r.full,
                padding: "4px 14px",
                cursor: "pointer",
                transition: `color ${T.duration.base} ${T.ease}, border-color ${T.duration.base} ${T.ease}`,
              }}
              onMouseOver={e => {
                (e.currentTarget as HTMLElement).style.color = T.fg;
                (e.currentTarget as HTMLElement).style.borderColor = T.borderStr;
              }}
              onMouseOut={e => {
                (e.currentTarget as HTMLElement).style.color = T.muted;
                (e.currentTarget as HTMLElement).style.borderColor = T.border;
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
