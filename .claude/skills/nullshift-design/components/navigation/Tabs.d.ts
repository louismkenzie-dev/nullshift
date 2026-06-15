import * as React from "react";

export interface TabItem {
  value: string;
  label: React.ReactNode;
  /** Optional panel content rendered below the strip when this tab is active. */
  content?: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  /** Controlled active value. */
  value?: string;
  /** Uncontrolled initial value. Defaults to the first item. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** "underline" (emerald baseline) or "pill" (filled active). Default "underline". */
  variant?: "underline" | "pill";
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Horizontal tab selector with an emerald active indicator.
 * @startingPoint section="Navigation" subtitle="Tabs — underline & pill" viewport="700x150"
 */
export function Tabs(props: TabsProps): React.ReactElement;
