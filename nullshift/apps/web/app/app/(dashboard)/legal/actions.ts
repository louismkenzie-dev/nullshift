"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PRODUCTS } from "@nullshift/content/products";
import { appSessionOrNull } from "@/lib/products/session";
import { entitlementFor } from "@/lib/products/entitlement";
import {
  createSite,
  deleteSite,
  getSite,
  listSites,
  saveSite,
} from "@/lib/legal-docs/data";
import { parseFacts } from "@/lib/legal-docs/facts";

async function guard() {
  const session = await appSessionOrNull();
  if (!session) redirect("/app/login?next=/app/legal");
  const ent = await entitlementFor(session.workspace.tenantId, "legal");
  if (!ent.entitled) redirect("/app/legal");
  return session;
}

export async function createSiteAction(formData: FormData) {
  const session = await guard();
  const existing = await listSites(session.workspace.tenantId);
  if (existing.length >= PRODUCTS.legal.limits.sites) redirect("/app/legal?error=limit");
  const site = await createSite({
    tenantId: session.workspace.tenantId,
    businessName:
      String(formData.get("businessName") ?? "")
        .trim()
        .slice(0, 120) || session.workspace.tenantName,
    websiteUrl: String(formData.get("websiteUrl") ?? "")
      .trim()
      .slice(0, 200),
    contactEmail: String(formData.get("contactEmail") ?? session.email)
      .trim()
      .slice(0, 200),
  });
  revalidatePath("/app/legal");
  redirect(`/app/legal/${site.id}`);
}

export async function saveSiteAction(formData: FormData) {
  const session = await guard();
  const id = String(formData.get("id") ?? "");
  const current = await getSite(session.workspace.tenantId, id);
  if (!current) redirect("/app/legal");
  const raw: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) raw[k] = typeof v === "string" ? v : "";
  // Unchecked checkboxes are absent from FormData; every boolean field is
  // listed on the form, so absence means false.
  for (const k of [
    "contactForms",
    "newsletter",
    "userAccounts",
    "onlineBookings",
    "sellsGoods",
    "marketingCookies",
    "embeddedMedia",
    "liveChat",
    "under18s",
    "healthData",
    "internationalTransfers",
    "cctv",
    "includePrivacy",
    "includeCookies",
    "includeTerms",
  ])
    if (!(k in raw)) raw[k] = "false";
  const facts = parseFacts(raw, current.facts);
  const colour = String(formData.get("colour") ?? current.brand.colour);
  const r = await saveSite({
    tenantId: session.workspace.tenantId,
    id,
    facts,
    brand: { colour: /^#[0-9a-fA-F]{6}$/.test(colour) ? colour : current.brand.colour },
    slug: String(formData.get("slug") ?? current.slug)
      .trim()
      .toLowerCase(),
    published: formData.get("published") === "on",
  });
  revalidatePath(`/app/legal/${id}`);
  revalidatePath("/app/legal");
  if (!r.ok) redirect(`/app/legal/${id}?error=${encodeURIComponent(r.error)}`);
  redirect(`/app/legal/${id}?saved=${r.changed ? "changed" : "same"}`);
}

export async function deleteSiteAction(formData: FormData) {
  const session = await guard();
  const id = String(formData.get("id") ?? "");
  if (id) await deleteSite(session.workspace.tenantId, id);
  revalidatePath("/app/legal");
  redirect("/app/legal");
}
