"use client";

import { useEffect } from "react";

/**
 * Tiny module-scope store counting in-flight "pressed operations" (server
 * actions, fetch-based auth calls). PendingBeacon / SubmitButton increment it
 * while pending; OperationOverlay subscribes and shows the full-bleed loader
 * whenever the count is above zero. No context provider needed — module scope
 * is fine because this only ever runs in the browser.
 */

let count = 0;
const listeners = new Set<(n: number) => void>();

function emit() {
  for (const l of listeners) l(count);
}

export function beginOperation(): void {
  count += 1;
  emit();
}

export function endOperation(): void {
  count = Math.max(0, count - 1);
  emit();
}

/** Hard reset — used on route change, where redirecting actions can strand a count. */
export function resetOperations(): void {
  count = 0;
  emit();
}

export function subscribeOperations(listener: (n: number) => void): () => void {
  listeners.add(listener);
  listener(count);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * For components that manage their own pending flag (useTransition, fetch
 * busy state): mirrors it into the global operation count so the full-bleed
 * loader covers the wait.
 */
export function useOperationPending(pending: boolean): void {
  useEffect(() => {
    if (!pending) return;
    beginOperation();
    return endOperation;
  }, [pending]);
}
