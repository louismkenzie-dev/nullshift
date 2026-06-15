import * as React from "react";

export interface LogoMarkProps {
  /** Pixel height of the mark. Default 24. */
  size?: number;
  /** Colour of the left pill — keep light on dark backgrounds. Default --pill-light. */
  leftColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The Nullshift parallel-pill mark on its own (no wordmark).
 * @startingPoint section="Brand" subtitle="Nullshift pill mark" viewport="200x120"
 */
export function LogoMark(props: LogoMarkProps): React.ReactElement;

export interface LogoProps {
  /** Pixel height of the mark; wordmark scales with it. Default 24. */
  size?: number;
  /** Use sentence-case "Nullshift" lockup (nav drawers, footers). Default false. */
  compact?: boolean;
  /** Left pill colour. Default --pill-light. */
  leftColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Full Nullshift logo lockup — pill mark + wordmark. Dark backgrounds only.
 */
export function Logo(props: LogoProps): React.ReactElement;
