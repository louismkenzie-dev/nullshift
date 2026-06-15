import * as React from "react";

export interface ButtonProps extends React.HTMLAttributes<HTMLElement> {
  /** Visual style. `primary` = emerald fill (one per view). Default "primary". */
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  /** Height preset: sm 32 · md 40 · lg 48. Default "md". */
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  /** Node rendered before the label (e.g. an icon). */
  iconStart?: React.ReactNode;
  /** Node rendered after the label (e.g. an arrow). */
  iconEnd?: React.ReactNode;
  /** Render as a different element, e.g. "a" for links. Default "button". */
  as?: "button" | "a";
  children?: React.ReactNode;
}

/**
 * Nullshift button — emerald primary, neutral secondary/ghost, danger destructive.
 * @startingPoint section="Buttons" subtitle="Primary, secondary, ghost, destructive" viewport="700x150"
 */
export function Button(props: ButtonProps): React.ReactElement;
