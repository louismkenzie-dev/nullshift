import { redirect } from "next/navigation";
import { createClient } from "@nullshift/db";
import { isAdminEmail } from "@nullshift/auth/admin";
import { AdminNav } from "../AdminNav";
import { T } from "@nullshift/ui/tokens";
import { Atmosphere } from "@/components/funnel/Atmosphere";
import { hasSupabaseServerConfig, getMissingSupabaseEnv } from "@nullshift/db/env";

// Auth-gated dashboard — always render per request, never statically prerender,
// so `next build` can't try to reach Supabase with placeholder CI/build env.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasSupabaseServerConfig()) {
    const missing = getMissingSupabaseEnv();
    return (
      <main
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: "var(--k-bg)" }}
      >
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
          <h1
            style={{
              fontFamily: T.sans,
              fontWeight: 700,
              fontSize: "2rem",
              letterSpacing: "-0.03em",
              textTransform: "uppercase",
              color: "var(--k-fg)",
              marginBottom: "12px",
            }}
          >
            ADMIN LOGIN ISN'T READY YET
          </h1>
          <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: "var(--k-muted)" }}>
            Missing environment variables: <code>{missing.join(", ")}</code>. Add them to{" "}
            <code>.env.local</code>, restart the dev server, then try the admin login
            again.
          </p>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Proxy already blocks anonymous users; this enforces the admin allowlist.
  if (!user) redirect("/admin/login");

  // 2FA step-up: if the staff user has a verified TOTP factor but the session is
  // still aal1, require the challenge (handled at /admin/security, outside this
  // layout so there's no loop). Users without a factor are NOT blocked — they're
  // prompted to enrol there. (brief §9)
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
    redirect("/admin/security");
  }
  if (!isAdminEmail(user.email)) {
    return (
      <main
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: "var(--k-bg)" }}
      >
        <div className="text-center max-w-md">
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
            ACCESS_DENIED
          </div>
          <h1
            style={{
              fontFamily: T.sans,
              fontWeight: 700,
              fontSize: "2rem",
              letterSpacing: "-0.03em",
              textTransform: "uppercase",
              color: "var(--k-fg)",
              marginBottom: "12px",
            }}
          >
            NOT AUTHORISED
          </h1>
          <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: "var(--k-muted)" }}>
            The account <span style={{ color: "var(--k-fg)" }}>{user.email}</span> is not
            on the admin allowlist. Add it to <code>ADMIN_EMAILS</code> in your
            environment.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen relative" style={{ background: "var(--k-bg)" }}>
      {/* Shared funnel atmosphere — the same ambient world as /start. */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <Atmosphere />
      </div>
      <div className="relative" style={{ zIndex: 1 }}>
        <AdminNav email={user.email ?? ""} />
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
