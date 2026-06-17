"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@nullshift/db/client";
import { T } from "@nullshift/ui/tokens";

/**
 * /portal/signout — visit this URL directly to sign out from any state.
 * Useful when the portal dashboard is in an error state and the normal
 * sign-out button is unreachable.
 */
export default function SignOutPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.signOut().then(() => {
      router.replace("/portal/login");
    });
  }, [router]);

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
      <p style={{ fontFamily: T.mono, fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted }}>
        Signing out…
      </p>
    </main>
  );
}
