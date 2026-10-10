import { createServiceClient } from "@nullshift/db";
import { publicSurfaceEnabled, entitlementFor } from "@/lib/products/entitlement";
import { publicKey } from "@/lib/products/keys";
import { validateConfig, type WidgetConfig } from "./engine";
import { templateConfig } from "./templates";

export type WidgetRow = {
  id: string;
  tenant_id: string;
  public_key: string;
  name: string;
  config: WidgetConfig;
  active: boolean;
  notify_email: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadRow = {
  id: string;
  widget_id: string;
  tenant_id: string;
  name: string;
  email: string;
  phone: string | null;
  postcode: string | null;
  message: string | null;
  service_id: string;
  service_name: string;
  quantity: number;
  answers: { question: string; answer: string }[];
  low_pence: number;
  base_pence: number;
  high_pence: number;
  status: "new" | "contacted" | "quoted" | "won" | "lost";
  source_url: string | null;
  created_at: string;
};

const KEY_RE = /^qw_[a-z0-9]{20}$/;

export function isWidgetKey(key: string): boolean {
  return KEY_RE.test(key);
}

export async function listWidgets(tenantId: string): Promise<WidgetRow[]> {
  const db = createServiceClient();
  const { data } = await db
    .from("quote_widgets")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  return (data ?? []) as WidgetRow[];
}

export async function getWidget(tenantId: string, id: string): Promise<WidgetRow | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("quote_widgets")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  return (data as WidgetRow | null) ?? null;
}

export async function createWidget(opts: {
  tenantId: string;
  businessName: string;
  template: string;
  notifyEmail: string | null;
}): Promise<WidgetRow> {
  const db = createServiceClient();
  const config = templateConfig(opts.template, opts.businessName);
  const { data, error } = await db
    .from("quote_widgets")
    .insert({
      tenant_id: opts.tenantId,
      public_key: publicKey("qw"),
      name: `${opts.businessName} — quote widget`,
      config,
      notify_email: opts.notifyEmail,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create widget");
  return data as WidgetRow;
}

export async function saveWidget(opts: {
  tenantId: string;
  id: string;
  name?: string;
  notifyEmail?: string | null;
  active?: boolean;
  config?: unknown;
}): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const patch: Record<string, unknown> = {};
  if (opts.config !== undefined) {
    const v = validateConfig(opts.config);
    if (!v.ok) return v;
    patch.config = v.config;
  }
  if (opts.name !== undefined)
    patch.name = opts.name.trim().slice(0, 120) || "Quote widget";
  if (opts.notifyEmail !== undefined)
    patch.notify_email = opts.notifyEmail?.trim().slice(0, 200) || null;
  if (opts.active !== undefined) patch.active = opts.active;
  const db = createServiceClient();
  const { error } = await db
    .from("quote_widgets")
    .update(patch)
    .eq("tenant_id", opts.tenantId)
    .eq("id", opts.id);
  if (error) return { ok: false, errors: [error.message] };
  return { ok: true };
}

export async function deleteWidget(tenantId: string, id: string) {
  const db = createServiceClient();
  await db.from("quote_widgets").delete().eq("tenant_id", tenantId).eq("id", id);
}

/**
 * Resolve a public key to a servable widget. Returns null when the key is
 * unknown, the widget is paused, or the owner's subscription has lapsed —
 * the public surface goes dark with the subscription, by design.
 */
export async function resolvePublicWidget(
  key: string
): Promise<{ widget: WidgetRow; trialing: boolean } | null> {
  if (!isWidgetKey(key)) return null;
  const db = createServiceClient();
  const { data } = await db
    .from("quote_widgets")
    .select("*")
    .eq("public_key", key)
    .maybeSingle();
  const widget = (data as WidgetRow | null) ?? null;
  if (!widget || !widget.active) return null;
  const ent = await entitlementFor(widget.tenant_id, "quote");
  if (!ent.entitled) return null;
  return { widget, trialing: ent.trialing };
}

export async function listLeads(tenantId: string, limit = 200): Promise<LeadRow[]> {
  const db = createServiceClient();
  const { data } = await db
    .from("widget_leads")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as LeadRow[];
}

export async function countLeadsThisMonth(tenantId: string): Promise<number> {
  const db = createServiceClient();
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await db
    .from("widget_leads")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", start.toISOString());
  return count ?? 0;
}

export async function setLeadStatus(
  tenantId: string,
  id: string,
  status: LeadRow["status"]
) {
  const db = createServiceClient();
  await db.from("widget_leads").update({ status }).eq("tenant_id", tenantId).eq("id", id);
}

export { publicSurfaceEnabled };
