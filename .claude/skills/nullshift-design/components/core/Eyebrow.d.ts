import * as React from "react";

export interface EyebrowProps {
  /** Mono "// 01 — SECTION" code-marker variant (no dot). Default false. */
  mono?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/** Section label — emerald dot + uppercase sans, or a mono code marker. */
export function Eyebrow(props: EyebrowProps): React.ReactElement;
