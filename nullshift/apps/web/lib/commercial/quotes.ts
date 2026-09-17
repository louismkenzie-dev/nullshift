/**
 * Quote data layer for the redesign (Phase 2). Filled in behind the
 * `commercialV2` flag; until then Quote Studio renders fixtures.
 */
import type { Quote } from "@/lib/next/fixtures";

/** Returns a persisted quote version in the Studio's shape, or null when the flag is off / not found. */
export async function loadQuoteForStudio(_id: string): Promise<Quote | null> {
  return null;
}
