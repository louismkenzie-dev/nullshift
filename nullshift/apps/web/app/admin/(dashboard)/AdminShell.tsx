import { OperationIndicator } from "@/components/app/OperationIndicator";
import { AccountControl, BottomNav, Brand, HeaderCrumbs, QuickJump, Rail, type QuickClient } from "./Rail";
import s from "./shell.module.css";

/**
 * The admin chrome: backdrop (one glow, grid, noise, a beam), the rail, the
 * header with the ⌘K quick-jump and the account menu, the content column and
 * the phone bottom bar. The dashboard layout wraps every authenticated page
 * in it; the env-gated design preview renders it with fixtures so the shell
 * can be looked at in a browser without a Supabase session.
 */
export function AdminShell({
  email,
  clients,
  children,
}: {
  email: string;
  clients: QuickClient[];
  children: React.ReactNode;
}) {
  return (
    <div className={s.shell} data-ns-shell="">
      <div className={s.backdrop} aria-hidden="true">
        <div className={s.glow} />
        <div className={s.grid} />
        <div className={s.beam} />
        <div className={s.noise} />
      </div>
      <Rail />
      <header className={s.header}>
        <span className={s.headerBrand}>
          <Brand />
        </span>
        <HeaderCrumbs />
        <QuickJump clients={clients} />
        <div className={s.headerRight}>
          <OperationIndicator className={`${s.working} ${s.mono}`} dotClassName={s.workingDot} />
          <AccountControl email={email} />
        </div>
      </header>
      <main className={s.content}>{children}</main>
      <BottomNav />
    </div>
  );
}
