/**
 * Quote data layer for the redesign (Phase 2), behind `commercialV2`.
 *
 * With the flag off nothing here touches the database: the Studio keeps its
 * fixtures and the listing reads lib/commercial/fixtures.ts. With the flag on,
 * reads go through the caller's RLS client (staff-only policies in 0057).
 */
import { createClient } from "@nullshift/db";
import { flagOn } from "@/lib/flags";
import type { Quote } from "@/lib/next/fixtures";
import { FIXTURE_QUOTE_VERSIONS } from "./fixtures";
import {
  getQuote,
  getOpportunity,
  getVersion,
  getVersionContext,
  isUuid,
  latestVersionForQuote,
  listQuoteVersions,
} from "./repo";
import { toStudioQuote } from "./studio";
import type { QuoteVersionListItem } from "./types";

/**
 * Returns a persisted quote version in the Studio's shape, or null when the
 * flag is off / not found. `id` may be a quote_versions id (that exact
 * version) or a quotes id (its current version, else the latest one).
 */
export async function loadQuoteForStudio(id: string): Promise<Quote | null> {
  if (!flagOn("commercialV2")) return null;
  if (!isUuid(id)) return null;

  const db = await createClient();

  const byVersion = await getVersionContext(db, id);
  if (byVersion)
    return toStudioQuote(byVersion.version, byVersion.quote, byVersion.opportunity);

  const quote = await getQuote(db, id);
  if (!quote) return null;
  const version = quote.current_version_id
    ? await getVersion(db, quote.current_version_id)
    : await latestVersionForQuote(db, quote.id);
  if (!version) return null;
  const opportunity = await getOpportunity(db, quote.opportunity_id);
  if (!opportunity) return null;
  return toStudioQuote(version, quote, opportunity);
}

export type QuoteVersionListing = {
  source: "fixtures" | "database";
  items: QuoteVersionListItem[];
};

/** Listing for /admin/next/quotes: fixtures when the flag is off, 0057 rows when on. */
export async function loadQuoteVersionListing(): Promise<QuoteVersionListing> {
  if (!flagOn("commercialV2"))
    return { source: "fixtures", items: FIXTURE_QUOTE_VERSIONS };
  const db = await createClient();
  return { source: "database", items: await listQuoteVersions(db) };
}
