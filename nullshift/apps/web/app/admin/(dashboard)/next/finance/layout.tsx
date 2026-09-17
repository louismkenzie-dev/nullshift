import type { Metadata } from "next";
import { openExceptionCount } from "@/lib/next/fixtures-finance";
import { FinanceTabs } from "./FinanceTabs";
import s from "../next.module.css";
import { realDataEnabled } from "@/lib/next/live-data";

export const metadata: Metadata = {
  title: "Finance — Nullshift Operations (prototype)",
  robots: { index: false, follow: false },
};

/**
 * Finance area (brief §5.6). Sits inside the /admin/next prototype shell, so
 * login, MFA step-up and requireStaff() are inherited from the (dashboard)
 * group. Every page below reads fixtures only and never writes.
 */
export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  if (realDataEnabled()) return <>{children}</>;
  return (
    <>
      <div className={s.pageHead}>
        <div>
          <p className={s.mono}>Finance</p>
          <h1 className={s.h1}>Finance</h1>
          <p className={s.lead}>
            Nullshift&apos;s own obligations, invoices, collections, payouts and bank
            evidence. One obligation keeps one identity through invoice, collection,
            payout and accounting projection (brief §10.1). Client payment volume is never
            counted here.
          </p>
        </div>
      </div>
      <FinanceTabs openExceptions={openExceptionCount()} />
      {children}
    </>
  );
}
