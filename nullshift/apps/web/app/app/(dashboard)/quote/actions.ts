"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PRODUCTS } from "@nullshift/content/products";
import { appSessionOrNull } from "@/lib/products/session";
import { entitlementFor } from "@/lib/products/entitlement";
import {
  createWidget,
  deleteWidget,
  listWidgets,
  saveWidget,
  setLeadStatus,
  type LeadRow,
} from "@/lib/quote-widget/data";

async function guard() {
  const session = await appSessionOrNull();
  if (!session) redirect("/app/login?next=/app/quote");
  const ent = await entitlementFor(session.workspace.tenantId, "quote");
  if (!ent.entitled) redirect("/app/quote");
  return session;
}

export async function createWidgetAction(formData: FormData) {
  const session = await guard();
  const existing = await listWidgets(session.workspace.tenantId);
  if (existing.length >= PRODUCTS.quote.limits.widgets)
    redirect("/app/quote?error=limit");
  const w = await createWidget({
    tenantId: session.workspace.tenantId,
    businessName:
      String(formData.get("businessName") ?? session.workspace.tenantName)
        .trim()
        .slice(0, 80) || session.workspace.tenantName,
    template: String(formData.get("template") ?? "blank"),
    notifyEmail: session.email || null,
  });
  revalidatePath("/app/quote");
  redirect(`/app/quote/${w.id}`);
}

export type SaveResult = { ok: true } | { ok: false; errors: string[] };

export async function saveWidgetAction(input: {
  id: string;
  name: string;
  notifyEmail: string;
  active: boolean;
  config: unknown;
}): Promise<SaveResult> {
  const session = await guard();
  const r = await saveWidget({
    tenantId: session.workspace.tenantId,
    id: input.id,
    name: input.name,
    notifyEmail: input.notifyEmail,
    active: input.active,
    config: input.config,
  });
  revalidatePath(`/app/quote/${input.id}`);
  revalidatePath("/app/quote");
  return r;
}

export async function deleteWidgetAction(formData: FormData) {
  const session = await guard();
  const id = String(formData.get("id") ?? "");
  if (id) await deleteWidget(session.workspace.tenantId, id);
  revalidatePath("/app/quote");
  redirect("/app/quote");
}

export async function setLeadStatusAction(formData: FormData) {
  const session = await guard();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as LeadRow["status"];
  if (id && ["new", "contacted", "quoted", "won", "lost"].includes(status))
    await setLeadStatus(session.workspace.tenantId, id, status);
  revalidatePath("/app/quote/leads");
}
