"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { appSessionOrNull } from "@/lib/products/session";
import { entitlementFor } from "@/lib/products/entitlement";
import {
  addSite,
  getSite,
  removeSite,
  runSite,
  sendReport,
  updateSite,
} from "@/lib/watch/data";

async function guard() {
  const session = await appSessionOrNull();
  if (!session) redirect("/app/login?next=/app/watch");
  const ent = await entitlementFor(session.workspace.tenantId, "watch");
  if (!ent.entitled) redirect("/app/watch");
  return session;
}
const s = (fd: FormData, k: string, max = 200) =>
  String(fd.get(k) ?? "")
    .trim()
    .slice(0, max);

export async function addSiteAction(formData: FormData) {
  const session = await guard();
  const r = await addSite({
    tenantId: session.workspace.tenantId,
    url: s(formData, "url"),
    label: s(formData, "label", 80),
    clientEmail: s(formData, "clientEmail") || null,
    alertEmail: s(formData, "alertEmail") || session.email || null,
  });
  if (!r.ok) redirect(`/app/watch?error=${encodeURIComponent(r.error)}`);
  // First checks straight away so the page is not empty.
  const row = await getSite(session.workspace.tenantId, r.id);
  if (row) await runSite(row, true).catch(() => undefined);
  revalidatePath("/app/watch");
  redirect(`/app/watch/${r.id}`);
}

export async function updateSiteAction(formData: FormData) {
  const session = await guard();
  const id = s(formData, "id");
  await updateSite(session.workspace.tenantId, id, {
    label: s(formData, "label", 80) || undefined,
    client_email: s(formData, "clientEmail") || null,
    alert_email: s(formData, "alertEmail") || null,
    active: formData.get("active") === "on",
    checks: {
      uptime: formData.get("uptime") === "on",
      ssl: formData.get("ssl") === "on",
      links: formData.get("links") === "on",
      speed: formData.get("speed") === "on",
    },
  });
  revalidatePath(`/app/watch/${id}`);
  redirect(`/app/watch/${id}?saved=1`);
}

export async function runNowAction(formData: FormData) {
  const session = await guard();
  const id = s(formData, "id");
  const row = await getSite(session.workspace.tenantId, id);
  if (row) await runSite(row, true);
  revalidatePath(`/app/watch/${id}`);
}

export async function sendReportNowAction(formData: FormData) {
  const session = await guard();
  const id = s(formData, "id");
  const row = await getSite(session.workspace.tenantId, id);
  if (row)
    await sendReport(row, {
      to: [session.email],
      senderName: session.workspace.tenantName,
    });
  redirect(`/app/watch/${id}?report=sent`);
}

export async function removeSiteAction(formData: FormData) {
  const session = await guard();
  await removeSite(session.workspace.tenantId, s(formData, "id"));
  revalidatePath("/app/watch");
  redirect("/app/watch");
}
