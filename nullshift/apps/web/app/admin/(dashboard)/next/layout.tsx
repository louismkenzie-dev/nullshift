import type { Metadata } from "next";
import { OperationsShell } from "./OperationsShell";
import { realDataEnabled } from "@/lib/next/live-data";
import { flagOn } from "@/lib/flags";

export const metadata: Metadata = {
  title: "Operations — Nullshift",
  robots: { index: false, follow: false },
};

/**
 * Preview Operations shell inherits the existing login, MFA and staff checks.
 * OPS_REAL_DATA reads the current schema; OPS_CLIENT_CREATE separately enables
 * internal onboarding records. Neither flag enables the financial v2 engines.
 * Unconnected advanced screens remain explicitly labelled fictional previews.
 */
export default function NextLayout({ children }: { children: React.ReactNode }) {
  return (
    <OperationsShell
      real={realDataEnabled()}
      billingEnabled={flagOn("billingActivation")}
    >
      {children}
    </OperationsShell>
  );
}
