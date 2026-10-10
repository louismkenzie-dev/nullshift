import { createServiceClient } from "@nullshift/db";
import { entitlementFor } from "@/lib/products/entitlement";
import { sha256, slugify } from "@/lib/products/keys";
import { EMPTY_FACTS, type LegalFacts } from "./facts";
import { TEMPLATE_VERSION, canonicalBundle } from "./generate";

export type HistoryEntry = { version: number; at: string; note: string };

export type LegalSiteRow = {
  id: string;
  tenant_id: string;
  slug: string;
  facts: LegalFacts;
  brand: { colour: string; logoUrl?: string | null };
  version: number;
  content_hash: string | null;
  template_version: string | null;
  published: boolean;
  history: HistoryEntry[];
  created_at: string;
  updated_at: string;
};

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nullshift.co.uk").replace(
    /\/$/,
    ""
  );
}

export function hostedUrl(slug: string): string {
  return `${siteUrl()}/l/${slug}`;
}

function withDefaults(row: LegalSiteRow): LegalSiteRow {
  return {
    ...row,
    facts: { ...EMPTY_FACTS, ...(row.facts ?? {}) },
    history: row.history ?? [],
  };
}

export async function listSites(tenantId: string): Promise<LegalSiteRow[]> {
  const db = createServiceClient();
  const { data } = await db
    .from("legal_sites")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at");
  return ((data ?? []) as LegalSiteRow[]).map(withDefaults);
}

export async function getSite(
  tenantId: string,
  id: string
): Promise<LegalSiteRow | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("legal_sites")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  return data ? withDefaults(data as LegalSiteRow) : null;
}

export async function createSite(opts: {
  tenantId: string;
  businessName: string;
  websiteUrl: string;
  contactEmail: string;
}): Promise<LegalSiteRow> {
  const db = createServiceClient();
  const base = slugify(opts.businessName) || "site";
  let slug = base;
  for (let i = 0; i < 6; i++) {
    const { data: taken } = await db
      .from("legal_sites")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!taken) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  const facts: LegalFacts = {
    ...EMPTY_FACTS,
    legalName: opts.businessName,
    tradingName: opts.businessName,
    websiteUrl: opts.websiteUrl,
    contactEmail: opts.contactEmail,
  };
  const { data, error } = await db
    .from("legal_sites")
    .insert({
      tenant_id: opts.tenantId,
      slug,
      facts,
      template_version: TEMPLATE_VERSION,
      content_hash: sha256(canonicalBundle(facts, hostedUrl(slug))),
      history: [{ version: 1, at: new Date().toISOString(), note: "Created" }],
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create site");
  return withDefaults(data as LegalSiteRow);
}

/**
 * Save new facts. If the generated text changed, bump the version and record
 * a history entry — that is the "changelog" the product promises.
 */
export async function saveSite(opts: {
  tenantId: string;
  id: string;
  facts: LegalFacts;
  brand?: LegalSiteRow["brand"];
  published?: boolean;
  slug?: string;
}): Promise<{ ok: true; changed: boolean } | { ok: false; error: string }> {
  const current = await getSite(opts.tenantId, opts.id);
  if (!current) return { ok: false, error: "Not found" };
  const db = createServiceClient();
  const slug =
    opts.slug && /^[a-z0-9][a-z0-9-]{1,47}$/.test(opts.slug) ? opts.slug : current.slug;
  if (slug !== current.slug) {
    const { data: taken } = await db
      .from("legal_sites")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (taken) return { ok: false, error: "That web address is already taken." };
  }
  const hash = sha256(canonicalBundle(opts.facts, hostedUrl(slug)));
  const changed =
    hash !== current.content_hash || current.template_version !== TEMPLATE_VERSION;
  const version = changed ? current.version + 1 : current.version;
  const history: HistoryEntry[] = changed
    ? [
        {
          version,
          at: new Date().toISOString(),
          note:
            current.template_version !== TEMPLATE_VERSION
              ? "Template update and your changes"
              : "Your answers changed",
        },
        ...current.history,
      ].slice(0, 50)
    : current.history;
  const { error } = await db
    .from("legal_sites")
    .update({
      facts: opts.facts,
      brand: opts.brand ?? current.brand,
      published: opts.published ?? current.published,
      slug,
      version,
      content_hash: hash,
      template_version: TEMPLATE_VERSION,
      history,
    })
    .eq("tenant_id", opts.tenantId)
    .eq("id", opts.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, changed };
}

export async function deleteSite(tenantId: string, id: string) {
  const db = createServiceClient();
  await db.from("legal_sites").delete().eq("tenant_id", tenantId).eq("id", id);
}

/** Public resolution: slug → published site whose owner is entitled. */
export async function resolvePublicSite(
  slug: string
): Promise<{ site: LegalSiteRow; trialing: boolean } | null> {
  if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(slug)) return null;
  const db = createServiceClient();
  const { data } = await db
    .from("legal_sites")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const site = withDefaults(data as LegalSiteRow);
  if (!site.published) return null;
  const ent = await entitlementFor(site.tenant_id, "legal");
  if (!ent.entitled) return null;
  return { site, trialing: ent.trialing };
}
