import * as React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  helper?: React.ReactNode;
  error?: React.ReactNode;
  /** Visible rows. Default 4. */
  rows?: number;
}

/** Multi-line text input matching Input's treatment. */
export function Textarea(props: TextareaProps): React.ReactElement;
