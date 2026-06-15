import * as React from "react";

export interface StatCardProps {
  /** Uppercase mono label. */
  label: React.ReactNode;
  /** Large display value (e.g. "£8,400", "12"). */
  value: React.ReactNode;
  /** Mono sublabel beneath the value. */
  sublabel?: React.ReactNode;
  /** Value colour. Default --primary; use a signal colour to flag attention. */
  accent?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Admin KPI / metric card.
 * @startingPoint section="Data" subtitle="Dashboard KPI stat" viewport="320x140"
 */
export function StatCard(props: StatCardProps): React.ReactElement;
