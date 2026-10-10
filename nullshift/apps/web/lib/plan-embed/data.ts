import { createServiceClient } from "@nullshift/db";
import { PRODUCTS } from "@nullshift/content/products";
import type {
  PartnerBrand,
  PartnerPlan,
  PlanAnswers,
} from "@nullshift/agents/partnerPlan";
import { entitlementFor } from "@/lib/products/entitlement";
import { privateToken, publicKey } from "@/lib/products/keys";

export type EmbedBrand = PartnerBrand & {
  colour: string;
  logoUrl?: string | null;
  dark: boolean;
};

export type EmbedRow = {
  id: string;
  tenant_id: string;
  public_key: string;
  name: string;
  brand: EmbedBrand;
  intro: string | null;
  notify_email: string | null;
  active: boolean;
  hide_powered_by: boolean;
  created_at: string;
};

export type PlanLeadRow = {
  id: string;
  embed_id: string;
  tenant_id: string;
  token: string;
  name: string;
  email: string;
  phone: string | null;
  business_name: string;
  answers: PlanAnswers;
  plan: PartnerPlan | null;
  status: "pending" | "generating" | "ready" | "failed";
  error: string | null;
  model: string | null;
  cost_usd: number | null;
  lead_status: "new" | "contacted" | "meeting" | "won" | "lost";
  source_url: string | null;
  created_at: string;
};

export const DEFAULT_BRAND: EmbedBrand = {
  name: "",
  tagline: "",
  website: "",
  services: [
    "Systems and automation consultancy",
    "Website design and build",
    "CRM set-up and training",
  ],
  tone: "",
  colour: "#10b981",
  logoUrl: null,
  dark: true,
};

const KEY_RE = /^pl_[a-z0-9]{20}$/;
export const isEmbedKey = (k: string) => KEY_RE.test(k);

function normBrand(
  b: Partial<EmbedBrand> | null | undefined,
  fallbackName: string
): EmbedBrand {
  const x = { ...DEFAULT_BRAND, ...(b ?? {}) };
  return {
    ...x,
    name: x.name || fallbackName,
    services: Array.isArray(x.services)
      ? x.services.filter((s) => typeof s === "string" && s.trim()).slice(0, 12)
      : DEFAULT_BRAND.services,
  };
}

export async function listEmbeds(tenantId: string): Promise<EmbedRow[]> {
  const db = createServiceClient();
  const { data } = await db
    .from("plan_embeds")
    .select("*, tenants(name)")
    .eq("tenant_id", tenantId)
    .order("created_at");
  return ((data ?? []) as (EmbedRow & { tenants: { name: string } | null })[]).map(
    (r) => ({ ...r, brand: normBrand(r.brand, r.tenants?.name ?? "Our team") })
  );
}

export async function getEmbed(tenantId: string, id: string): Promise<EmbedRow | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("plan_embeds")
    .select("*, tenants(name)")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const r = data as EmbedRow & { tenants: { name: string } | null };
  return { ...r, brand: normBrand(r.brand, r.tenants?.name ?? "Our team") };
}

export async function createEmbed(opts: {
  tenantId: string;
  brandName: string;
  notifyEmail: string | null;
}): Promise<EmbedRow> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("plan_embeds")
    .insert({
      tenant_id: opts.tenantId,
      public_key: publicKey("pl"),
      name: `${opts.brandName} — systems plan`,
      brand: { ...DEFAULT_BRAND, name: opts.brandName },
      notify_email: opts.notifyEmail,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create");
  return {
    ...(data as EmbedRow),
    brand: normBrand((data as EmbedRow).brand, opts.brandName),
  };
}

export async function saveEmbed(
  tenantId: string,
  id: string,
  patch: {
    name?: string;
    brand?: EmbedBrand;
    intro?: string | null;
    notify_email?: string | null;
    active?: boolean;
    hide_powered_by?: boolean;
  }
) {
  const db = createServiceClient();
  await db.from("plan_embeds").update(patch).eq("tenant_id", tenantId).eq("id", id);
}

export async function deleteEmbed(tenantId: string, id: string) {
  const db = createServiceClient();
  await db.from("plan_embeds").delete().eq("tenant_id", tenantId).eq("id", id);
}

export async function resolvePublicEmbed(
  key: string
): Promise<{ embed: EmbedRow; trialing: boolean } | null> {
  if (!isEmbedKey(key)) return null;
  const db = createServiceClient();
  const { data } = await db
    .from("plan_embeds")
    .select("*, tenants(name)")
    .eq("public_key", key)
    .maybeSingle();
  if (!data) return null;
  const r = data as EmbedRow & { tenants: { name: string } | null };
  if (!r.active) return null;
  const ent = await entitlementFor(r.tenant_id, "plans");
  if (!ent.entitled) return null;
  return {
    embed: { ...r, brand: normBrand(r.brand, r.tenants?.name ?? "Our team") },
    trialing: ent.trialing,
  };
}

export async function plansThisMonth(tenantId: string): Promise<number> {
  const db = createServiceClient();
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await db
    .from("plan_leads")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "ready")
    .gte("created_at", start.toISOString());
  return count ?? 0;
}

/** Hard ceiling: included allowance × 3, so a runaway embed cannot run up an unbounded bill. */
export function monthlyCeiling(): number {
  return PRODUCTS.plans.limits.plansPerMonth * 3;
}

export async function createLead(opts: {
  embed: EmbedRow;
  name: string;
  email: string;
  phone: string | null;
  answers: PlanAnswers;
  sourceUrl: string | null;
  ipHash: string;
}): Promise<PlanLeadRow> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("plan_leads")
    .insert({
      embed_id: opts.embed.id,
      tenant_id: opts.embed.tenant_id,
      token: privateToken(),
      name: opts.name,
      email: opts.email,
      phone: opts.phone,
      business_name: opts.answers.businessName,
      answers: opts.answers,
      source_url: opts.sourceUrl,
      ip_hash: opts.ipHash,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not record lead");
  return data as PlanLeadRow;
}

export async function getLeadByToken(token: string): Promise<PlanLeadRow | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const db = createServiceClient();
  const { data } = await db
    .from("plan_leads")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  return (data as PlanLeadRow | null) ?? null;
}

export async function listLeads(tenantId: string, limit = 300): Promise<PlanLeadRow[]> {
  const db = createServiceClient();
  const { data } = await db
    .from("plan_leads")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as PlanLeadRow[];
}

export async function getLead(tenantId: string, id: string): Promise<PlanLeadRow | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("plan_leads")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  return (data as PlanLeadRow | null) ?? null;
}

export async function setLeadStatus(
  tenantId: string,
  id: string,
  lead_status: PlanLeadRow["lead_status"]
) {
  const db = createServiceClient();
  await db
    .from("plan_leads")
    .update({ lead_status })
    .eq("tenant_id", tenantId)
    .eq("id", id);
}
