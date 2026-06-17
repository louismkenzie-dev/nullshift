import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@nullshift/db";
import { isAdminEmail } from "@nullshift/auth/admin";
import { T } from "@nullshift/ui/tokens";
import { MfaPanel } from "./MfaPanel";

/**
 * Staff security — TOTP 2FA enrolment + step-up. Sits OUTSIDE the (dashboard)
 * route group so the aal2 enforcement in that layout can redirect here without a
 * loop. Login is guaranteed by the proxy; we re-check the staff allowlist.
 */
export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  if (!isAdminEmail(user.email)) redirect("/admin/login");

  return (
    <main style={{ minHeight: "100vh", background: T.bg }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "80px 24px" }}>
        <div
          style={{
            fontFamily: T.mono,
            fontSize: "10px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: T.primary,
            marginBottom: 8,
          }}
        >
          {"// Security"}
        </div>
        <h1
          style={{
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: "1.9rem",
            color: T.fg,
            marginBottom: 20,
          }}
        >
          Two-factor authentication
        </h1>
        <MfaPanel />
        <Link
          href="/admin"
          style={{
            display: "inline-block",
            marginTop: 22,
            fontFamily: T.mono,
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: T.muted,
            textDecoration: "none",
          }}
        >
          ← Back to dashboard
        </Link>
      </div>
    </main>
  );
}
