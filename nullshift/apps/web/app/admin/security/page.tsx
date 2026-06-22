import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@nullshift/db";
import { isAdminEmail } from "@nullshift/auth/admin";
import { T } from "@nullshift/ui/tokens";
import { PageHeader } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
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
    <main style={{ minHeight: "100vh", background: "var(--k-bg)" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "80px 24px" }}>
        <PageHeader index="SEC" label="SECURITY" title="Two-factor authentication" />
        <Reveal delay={0.05} className="mt-8">
          <MfaPanel />
        </Reveal>
        <Link
          href="/admin"
          style={{
            display: "inline-block",
            marginTop: 22,
            fontFamily: T.mono,
            fontSize: "0.66rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--k-muted)",
            textDecoration: "none",
          }}
        >
          ← Back to dashboard
        </Link>
      </div>
    </main>
  );
}
