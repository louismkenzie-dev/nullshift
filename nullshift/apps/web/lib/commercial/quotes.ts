/**
 * Quote data layer for the redesign (Phase 2). Migration 0057 is live in
 * production, so reads always go to the database through the caller's RLS
 * client (staff-only policies in 0057); the commercialV2 flag is treated as
 * permanently on. lib/commercial/fixtures.ts is kept only as a fallback for
 * the Studio when the id is not a uuid (tests and the sandbox walkthrough).
 */
import { createClient } from "@nullshift/db";
import type { Quote } from "@/lib/next/fixtures";
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
 * The persisted version with its quote and opportunity, or null when not
 * found. `id` may be a quote_versions id (that exact version) or a quotes id
 * (its current version, else the latest one).
 */
export async function loadQuoteVersionContext(id: string): Promise<QuoteVersionListItem | null> {
  if (!isUuid(id)) return null;

  const db = await createClient();

  const byVersion = await getVersionContext(db, id);
  if (byVersion) return byVersion;

  const quote = await getQuote(db, id);
  if (!quote) return null;
  const version = quote.current_version_id
    ? await getVersion(db, quote.current_version_id)
    : await latestVersionForQuote(db, quote.id);
  if (!version) return null;
  const opportunity = await getOpportunity(db, quote.opportunity_id);
  if (!opportunity) return null;
  return { version, quote, opportunity };
}

/** Returns a persisted quote version in the Studio's shape, or null when not found. */
export async function loadQuoteForStudio(id: string): Promise<Quote | null> {
  const ctx = await loadQuoteVersionContext(id);
  return ctx ? toStudioQuote(ctx.version, ctx.quote, ctx.opportunity) : null;
}

export type QuoteVersionListing = {
  source: "database";
  items: QuoteVersionListItem[];
};

/** Listing for /admin/quotes: newest 100 quote versions from 0057. */
export async function loadQuoteVersionListing(): Promise<QuoteVersionListing> {
  const db = await createClient();
  return { source: "database", items: await listQuoteVersions(db, 100) };
}
