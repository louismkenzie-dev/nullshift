"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isProductSlug } from "@nullshift/content/products";
import { appSessionOrNull } from "@/lib/products/session";
import { startTrial } from "@/lib/products/entitlement";
import { createBillingPortalUrl, createProductCheckoutUrl } from "@/lib/products/billing";
import { renameWorkspace } from "@/lib/products/workspace";
import { createServiceClient } from "@nullshift/db";

export async function startTrialAction(formData: FormData) {
  const product = String(formData.get("product") ?? "");
  if (!isProductSlug(product)) return;
  const session = await appSessionOrNull();
  if (!session) redirect("/app/login");
  await startTrial(session.workspace.tenantId, product);
  revalidatePath("/app");
  redirect(`/app/${product}`);
}

export async function checkoutAction(formData: FormData) {
  const product = String(formData.get("product") ?? "");
  if (!isProductSlug(product)) return;
  const session = await appSessionOrNull();
  if (!session) redirect("/app/login");
  // A card can be added before the trial has even been started.
  await startTrial(session.workspace.tenantId, product);
  const res = await createProductCheckoutUrl({
    tenantId: session.workspace.tenantId,
    tenantName: session.workspace.tenantName,
    email: session.email,
    product,
  });
  if ("url" in res) redirect(res.url);
  redirect(`/app/billing?error=${encodeURIComponent(res.error)}`);
}

export async function billingPortalAction() {
  const session = await appSessionOrNull();
  if (!session) redirect("/app/login");
  const res = await createBillingPortalUrl({ tenantId: session.workspace.tenantId });
  if ("url" in res) redirect(res.url);
  redirect(`/app/billing?error=${encodeURIComponent(res.error)}`);
}

export async function renameWorkspaceAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const session = await appSessionOrNull();
  if (!session) redirect("/app/login");
  await renameWorkspace(createServiceClient(), session.workspace.tenantId, name);
  revalidatePath("/app");
}
