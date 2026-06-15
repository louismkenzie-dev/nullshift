import * as React from "react";

export interface DropdownItem {
  label?: React.ReactNode;
  onSelect?: () => void;
  /** Danger-red styling for destructive actions. */
  danger?: boolean;
  /** Optional leading mono glyph. */
  icon?: React.ReactNode;
  /** Render a divider instead of an item. */
  divider?: boolean;
}

export interface DropdownProps {
  /** Default trigger button label (ignored if `trigger` is provided). */
  label?: React.ReactNode;
  /** Custom trigger node (e.g. an Avatar or IconButton). */
  trigger?: React.ReactNode;
  items: DropdownItem[];
  /** Panel alignment under the trigger. Default "start". */
  align?: "start" | "end";
  className?: string;
  style?: React.CSSProperties;
}

/** Menu dropdown — closes on outside click / Escape. */
export function Dropdown(props: DropdownProps): React.ReactElement;
