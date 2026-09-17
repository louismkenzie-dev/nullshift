import type { Metadata } from "next";
import { BottomNav, DataContext, OperationsHeader, Rail } from "./Rail";
import { realDataEnabled } from "@/lib/next/live-data";
import { flagOn } from "@/lib/flags";
import s from "./next.module.css";

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
    <div className={s.shell}>
      <Rail />
      <OperationsHeader />
      <main className={s.content} id="operations-content">
        <DataContext
          real={realDataEnabled()}
          billingEnabled={flagOn("billingActivation")}
        />
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
