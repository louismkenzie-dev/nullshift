"use client";

import { usePathname } from "next/navigation";
import { AdminNav } from "../AdminNav";
import { Atmosphere } from "@/components/funnel/Atmosphere";
import { OperationOverlay } from "@/components/app/OperationOverlay";
import { OperationsShell } from "./next/OperationsShell";

/** Keep the original tools intact without mounting their chrome behind Operations. */
export function AdminFrame({
  children,
  email,
  operations = false,
}: {
  children: React.ReactNode;
  email: string;
  operations?: boolean;
}) {
  const path = usePathname();
  if (path === "/admin/next" || path.startsWith("/admin/next/")) return children;
  if (operations)
    return (
      <OperationsShell real billingEnabled={false} integrated>
        {children}
      </OperationsShell>
    );
  return (
    <div className="min-h-screen relative" style={{ background: "var(--k-bg)" }}>
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <Atmosphere />
      </div>
      <div
        aria-hidden
        className="k-vgrid fixed inset-0 pointer-events-none"
        style={{ zIndex: 0, opacity: 0.35 }}
      />
      <div className="relative" style={{ zIndex: 1 }}>
        <AdminNav email={email} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
      </div>
      <OperationOverlay />
    </div>
  );
}
