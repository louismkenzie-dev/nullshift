"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

/**
 * A submit button that gives instant feedback: the moment it's clicked it shows a
 * spinner and disables itself (via useFormStatus) until the server action that
 * owns its <form> resolves — so an admin never wonders whether their click
 * registered while a DB / Stripe / email round-trip runs. Drop-in replacement for
 * `<button type="submit" ...>` (it forwards any button attribute).
 */
export function SubmitButton({
  children,
  style,
  disabled,
  pendingLabel,
  ...rest
}: {
  children: ReactNode;
  style?: CSSProperties;
  disabled?: boolean;
  pendingLabel?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  const isDisabled = !!disabled || pending;
  return (
    <button
      {...rest}
      type="submit"
      disabled={isDisabled}
      aria-busy={pending || undefined}
      data-pending={pending ? "true" : undefined}
      style={style}
    >
      {pending && pendingLabel ? pendingLabel : children}
      {pending && <span className="ns-btn-spinner" aria-hidden />}
    </button>
  );
}
