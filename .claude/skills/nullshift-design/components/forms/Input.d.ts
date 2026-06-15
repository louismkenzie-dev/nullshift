import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Field label above the input. */
  label?: React.ReactNode;
  /** Helper text below (faint). */
  helper?: React.ReactNode;
  /** Error message — turns the field danger-red and overrides helper. */
  error?: React.ReactNode;
}

/**
 * Single-line text input with emerald focus ring.
 * @startingPoint section="Forms" subtitle="Text input + label + error" viewport="420x110"
 */
export function Input(props: InputProps): React.ReactElement;
