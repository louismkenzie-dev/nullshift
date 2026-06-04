import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { AdminNav } from "../AdminNav";
import { T } from "@/lib/tokens";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Proxy already blocks anonymous users; this enforces the admin allowlist.
  if (!user) redirect("/admin/login");
  if (!isAdminEmail(user.email)) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6" style={{ background: T.bg }}>
        <div className="text-center max-w-md">
          <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#f87171", marginBottom: "16px" }}>ACCESS_DENIED</div>
          <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "2rem", color: T.fg, marginBottom: "12px" }}>NOT AUTHORISED</h1>
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
