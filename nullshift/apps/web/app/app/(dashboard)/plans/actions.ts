"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PRODUCTS } from "@nullshift/content/products";
import { appSessionOrNull } from "@/lib/products/session";
import { entitlementFor } from "@/lib/products/entitlement";
import {
  createEmbed,
  deleteEmbed,
  getEmbed,
  listEmbeds,
  saveEmbed,
  setLeadStatus,
  type PlanLeadRow,
} from "@/lib/plan-embed/data";

async function guard() {
  const session = await appSessionOrNull();
  if (!session) redirect("/app/login?next=/app/plans");
  const ent = await entitlementFor(session.workspace.tenantId, "plans");
  if (!ent.entitled) redirect("/app/plans");
  return session;
}
const s = (fd: FormData, k: string, max = 200) =>
  String(fd.get(k) ?? "")
    .trim()
    .slice(0, max);

export async function createEmbedAction(formData: FormData) {
  const session = await guard();
  if (
    (await listEmbeds(session.workspace.tenantId)).length >= PRODUCTS.plans.limits.embeds
  )
    redirect("/app/plans?error=limit");
  const e = await createEmbed({
    tenantId: session.workspace.tenantId,
    brandName: s(formData, "brandName", 80) || session.workspace.tenantName,
    notifyEmail: session.email || null,
  });
  revalidatePath("/app/plans");
  redirect(`/app/plans/${e.id}`);
}

export async function saveEmbedAction(formData: FormData) {
  const session = await guard();
  const id = s(formData, "id");
  const current = await getEmbed(session.workspace.tenantId, id);
  if (!current) redirect("/app/plans");
  const colour = s(formData, "colour", 7);
  const logo = s(formData, "logoUrl", 400);
  await saveEmbed(session.workspace.tenantId, id, {
    name: s(formData, "name", 120) || current.name,
    intro: s(formData, "intro", 300) || null,
    notify_email: s(formData, "notifyEmail") || null,
    active: formData.get("active") === "on",
    hide_powered_by: formData.get("hidePoweredBy") === "on",
    brand: {
      name: s(formData, "brandName", 80) || current.brand.name,
      tagline: s(formData, "tagline", 120),
      website: s(formData, "website", 160),
      tone: s(formData, "tone", 240),
      services: s(formData, "services", 1200)
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 12),
      colour: /^#[0-9a-fA-F]{6}$/.test(colour) ? colour : current.brand.colour,
      logoUrl: /^https:\/\//.test(logo) ? logo : null,
      dark: formData.get("dark") === "on",
    },
  });
  revalidatePath(`/app/plans/${id}`);
  redirect(`/app/plans/${id}?saved=1`);
}

export async function deleteEmbedAction(formData: FormData) {
  const session = await guard();
  await deleteEmbed(session.workspace.tenantId, s(formData, "id"));
  revalidatePath("/app/plans");
  redirect("/app/plans");
}

export async function setPlanLeadStatusAction(formData: FormData) {
  const session = await guard();
  const status = s(formData, "status", 20) as PlanLeadRow["lead_status"];
  if (["new", "contacted", "meeting", "won", "lost"].includes(status))
    await setLeadStatus(session.workspace.tenantId, s(formData, "id"), status);
  revalidatePath("/app/plans/leads");
}
