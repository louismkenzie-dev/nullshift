import * as React from "react";

export interface ToastProps {
  /** Signal tone — sets the accent rail + dot. Default "neutral". */
  tone?: "neutral" | "primary" | "success" | "warning" | "info" | "danger";
  title: React.ReactNode;
  message?: React.ReactNode;
  /** Show a dismiss × when provided. */
  onClose?: () => void;
  /** Optional action node (e.g. a small Button) below the message. */
  action?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Transient notification card.
 * @startingPoint section="Feedback" subtitle="Toast notifications" viewport="420x120"
 */
export function Toast(props: ToastProps): React.ReactElement;

export interface ToastViewportProps {
  children?: React.ReactNode;
  /** Screen corner for the stack. Default "bottom-right". */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  style?: React.CSSProperties;
}

/** Fixed corner stack for Toasts. */
export function ToastViewport(props: ToastViewportProps): React.ReactElement;
