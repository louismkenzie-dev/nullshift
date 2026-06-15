import * as React from "react";

export interface AvatarProps {
  /** Image URL. Falls back to initials when absent. */
  src?: string;
  /** 1–2 letter monogram shown when there's no image. */
  initials?: string;
  alt?: string;
  /** Pixel diameter. Default 36. */
  size?: number;
  /** Optional presence dot, bottom-right. */
  status?: "online" | "busy" | "away" | "offline";
  className?: string;
  style?: React.CSSProperties;
}

/** Circular identity chip — image or mono monogram, optional status dot. */
export function Avatar(props: AvatarProps): React.ReactElement;
