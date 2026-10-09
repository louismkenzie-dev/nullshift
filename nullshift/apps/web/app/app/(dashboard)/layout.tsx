import { hasSupabaseBrowserConfig } from "@nullshift/db/env";
import { requireAppSession } from "@/lib/products/session";
import { entitlementsFor } from "@/lib/products/entitlement";
import { AppHeader } from "./AppHeader";

// Auth-gated console — always render per request.
export const dynamic = "force-dynamic";

export default async function AppDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasSupabaseBrowserConfig()) return <>{children}</>;
  const session = await requireAppSession();
  const entitlements = await entitlementsFor(session.workspace.tenantId);
  const active = (Object.keys(entitlements) as (keyof typeof entitlements)[]).filter(
    (k) => entitlements[k].entitled || entitlements[k].row
  );
  return (
    <div
      className="k-dark min-h-screen"
      style={{ background: "var(--k-bg)", color: "var(--k-fg)" }}
    >
      <AppHeader
        email={session.email}
        workspace={session.workspace.tenantName}
        products={active}
      />
      <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-10 md:px-8">
        {children}
      </main>
    </div>
  );
}
