import type { Metadata } from "next";
import { openExceptionCount } from "@/lib/ops/financeData";
import { FinanceTabs } from "./FinanceTabs";
import s from "../shell.module.css";

export const metadata: Metadata = {
  title: "Finance — Nullshift Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Finance area (brief §5.6). Sits inside the /admin shell, so login, MFA
 * step-up and requireStaff() are inherited from the (dashboard) group. Every
 * page below reads production rows through lib/ops/financeData.ts and never
 * writes; the legacy billing pages remain the action surfaces.
 */
export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const open = await openExceptionCount();
  return (
    <>
      <div className={s.pageHead}>
        <div>
          <p className={s.mono}>Finance</p>
          <h1 className={s.h1}>Finance</h1>
          <p className={s.lead}>
            Nullshift&apos;s own subscriptions, invoices, Direct Debit collections and the
            Stripe Connect fee ledger, read live. Client payment volume is never counted
            here. Where the database holds no record (payouts, bank feed, provider charge
            dates) the page says so instead of inventing a figure.
          </p>
        </div>
      </div>
      <FinanceTabs openExceptions={open} />
      {children}
    </>
  );
}
