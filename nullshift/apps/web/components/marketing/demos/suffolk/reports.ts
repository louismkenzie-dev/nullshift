/* Ported verbatim from Suffolk Tennis LTA — the pure helpers in
   src/components/children/ChildReportsView.tsx (main @ 281b548, read
   2026-09-11): visibility, the "Updated" rule, and the radial inversion that
   puts Excelling on the outer edge of the radar. */

import { isComplete, type Ratings } from "./lta";

export const isParentVisible = (r: {
  complete?: boolean;
  sent_at?: string | null;
  ratings?: Ratings | null;
}) => !!r.complete && !!r.sent_at && isComplete(r.ratings);

/** Edited after it was sent — the parent sees "Updated" instead of a second email. */
export const isUpdated = (r: { sent_at: string | null; updated_at: string }) =>
  !!r.sent_at &&
  new Date(r.updated_at).getTime() - new Date(r.sent_at).getTime() > 60_000;

/** LTA 1..4 (1 best) → radial value where Excelling sits at the outer edge. */
export const outward = (rating: number | undefined) =>
  rating && rating >= 1 && rating <= 4 ? 5 - rating : null;

/* From supabase/functions/session-reports-dispatch/index.ts — the grace
   window: a complete report goes to the parent when the coach ends the
   session, or two hours after the session ends, whichever comes first. */
export const GRACE_MS = 120 * 60 * 1000;
export const DEFAULT_DURATION_MS = 120 * 60 * 1000;
