import * as React from "react";

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Brighten on hover (filterable chips). Default false. */
  interactive?: boolean;
  children?: React.ReactNode;
}

/** Full-radius emerald pill for categories and filters. */
export function Tag(props: TagProps): React.ReactElement;
