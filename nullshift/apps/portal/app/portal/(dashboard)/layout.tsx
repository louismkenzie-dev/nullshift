import { redirect } from "next/navigation";
import { createClient } from "@nullshift/db";
import { hasSupabaseBrowserConfig } from "@nullshift/db/env";
import { T } from "@nullshift/ui/tokens";
import { PortalHeader } from "./PortalHeader";

// Auth-gated portal — always render per request, never statically prerender,
// so `next build` can't try to reach Supabase with placeholder CI/build env.
export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseBrowserConfig()) {
    return <>{children}</>;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/portal/login");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <PortalHeader email={user.email!} />
      <main style={{ flex: 1 }}>{children}</main>
    </div>
  );
}
