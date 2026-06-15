import * as React from "react";

export interface BadgeProps {
  /** Status tone. Use signal tones for status only. Default "neutral". */
  tone?: "neutral" | "primary" | "success" | "warning" | "info" | "danger";
  /** Show the leading status dot. Default true. */
  dot?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/** Mono status badge — soft-filled, signal-coloured, for status only. */
export function Badge(props: BadgeProps): React.ReactElement;
