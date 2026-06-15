import * as React from "react";

export interface SwitchProps {
  /** Controlled on/off state. */
  checked?: boolean;
  /** Uncontrolled initial state. Default false. */
  defaultChecked?: boolean;
  /** Fired with the next boolean value. */
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** Optional inline label to the right. */
  label?: React.ReactNode;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** Emerald toggle switch — controlled or uncontrolled. */
export function Switch(props: SwitchProps): React.ReactElement;
