"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { beginOperation, endOperation } from "./operationState";

/**
 * Invisible marker dropped INSIDE a server-action <form>: while the form's
 * action is running it raises the global operation count, which shows the
 * full-bleed NullshiftLoader overlay. Pairs with OperationOverlay in the
 * portal/admin layouts. Renders nothing.
 */
export function PendingBeacon() {
  const { pending } = useFormStatus();
  useEffect(() => {
    if (!pending) return;
    beginOperation();
    return () => endOperation();
  }, [pending]);
  return null;
}
