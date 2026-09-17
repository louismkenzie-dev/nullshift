"use client";
import { BottomNav, DataContext, OperationsHeader, Rail } from "./Rail";
import s from "./next.module.css";
export function OperationsShell({
  children,
  real,
  billingEnabled,
  integrated = false,
}: {
  children: React.ReactNode;
  real: boolean;
  billingEnabled: boolean;
  integrated?: boolean;
}) {
  return (
    <div className={`${s.shell} ${integrated ? s.integrated : ""}`}>
      <Rail />
      <OperationsHeader />
      <main className={s.content} id="operations-content">
        <DataContext
          real={real}
          billingEnabled={billingEnabled}
          integrated={integrated}
        />
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
