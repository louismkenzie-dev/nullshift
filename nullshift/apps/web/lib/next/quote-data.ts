import "server-only";
import { operationsSession, realDataEnabled } from "./live-data";
import { parseQuote, uuidPattern, type QuoteDraft } from "./quote-builder";

// Independent of commercialV2: does not activate contracts, providers or collections.
export const quoteBuilderEnabled = () =>
  realDataEnabled() && process.env.OPS_QUOTES === "true";
export async function loadBuilderQuote(id: string) {
  if (!quoteBuilderEnabled() || !uuidPattern.test(id)) return null;
  const { db } = await operationsSession();
  const { data, error } = await db
    .from("quote_versions")
    .select("id,status,updated_at,commercial,internal,version_no")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("The quote could not be loaded. Please try again.");
  if (!data) return null;
  const parsed = parseQuote({
    document: data.commercial?.builder,
    costs: data.internal?.builderCosts,
  });
  if (!parsed.ok) return null;
  return {
    id: data.id as string,
    status: data.status as string,
    updatedAt: data.updated_at as string,
    version: data.version_no as number,
    draft: parsed.value as QuoteDraft,
  };
}
export async function listBuilderQuotes() {
  if (!quoteBuilderEnabled()) return [];
  const { db } = await operationsSession();
  const { data, error } = await db
    .from("quote_versions")
    .select("id,status,updated_at,commercial,version_no")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error)
    throw new Error("Quotes could not be loaded. No example data has been substituted.");
  return (data ?? [])
    .filter((row) => row.commercial?.builder)
    .map((row) => ({
      id: row.id as string,
      status: row.status as string,
      updatedAt: row.updated_at as string,
      version: row.version_no as number,
      business: String(row.commercial.builder.business),
      title: String(row.commercial.builder.title),
      buildMinor: Number(row.commercial.build_price_minor),
      clientId: String(row.commercial.builder.clientId || ""),
    }));
}
