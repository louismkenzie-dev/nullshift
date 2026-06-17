import { redirect } from "next/navigation";
import { createClient } from "@nullshift/db";
import { isAdminEmail } from "@nullshift/auth/admin";
import { AdminNav } from "../AdminNav";
import { T } from "@nullshift/ui/tokens";
import { hasSupabaseServerConfig, getMissingSupabaseEnv } from "@nullshift/db/env";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseServerConfig()) {
    const missing = getMissingSupabaseEnv();
    return (
      <main className="min-h-screen flex items-center justify-center px-6" style={{ background: T.bg }}>
        <div className="text-center max-w-lg">
          <div
            style={{
              fontFamily: T.mono,
              fontSize: "10px",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: T.danger,
              marginBottom: "16px",
            }}
          >
            SUPABASE_SETUP_REQUIRED
          </div>
          <h1 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "2rem", color: T.fg, marginBottom: "12px" }}>
            ADMIN LOGIN ISN'T READY YET
          </h1>
          <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted }}>
            Missing environment variables: <code>{missing.join(", ")}</code>. Add them to <code>.env.local</code>,
            restart the dev server, then try the admin login again.
          </p>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Proxy already blocks anonymous users; this enforces the admin allowlist.
  if (!user) redirect("/admin/login");
  if (!isAdminEmail(user.email)) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6" style={{ background: T.bg }}>
        <div className="text-center max-w-md">
          <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.danger, marginBottom: "16px" }}>ACCESS_DENIED</div>
          <h1 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "2rem", color: T.fg, marginBottom: "12px" }}>NOT AUTHORISED</h1>
          <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted }}>
            The account <span style={{ color: T.fg }}>{user.email}</span> is not on the admin allowlist. Add it to <code>ADMIN_EMAILS</code> in your environment.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: T.bg }}>
      <AdminNav email={user.email ?? ""} />
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
