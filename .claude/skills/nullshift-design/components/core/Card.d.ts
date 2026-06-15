import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Hover-lift to the elevated tier. Default false. */
  interactive?: boolean;
  /** Emerald edge for the featured card in a set. Default false. */
  highlighted?: boolean;
  /** Inner padding in px. Default 24. */
  padding?: number;
  /** Border radius (CSS value). Default --radius-lg. */
  radius?: string;
  children?: React.ReactNode;
}

/**
 * Surface-tier container with a hairline border and no shadow.
 * @startingPoint section="Core" subtitle="Surface card" viewport="380x200"
 */
export function Card(props: CardProps): React.ReactElement;
