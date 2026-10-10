"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { rateLimitAllow } from "@nullshift/db/rateLimit";
import { acceptProposalByToken, declineProposalByToken } from "@/lib/studio/data";

export async function acceptAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "");
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (!(await rateLimitAllow("studio-accept", `${token}:${ip}`, 10, 3600)))
    redirect(
      `/c/${token}/proposal/${id}?error=${encodeURIComponent("Too many attempts. Try again later.")}`
    );
  const r = await acceptProposalByToken(token, id, name, ip);
  if (!r.ok) redirect(`/c/${token}/proposal/${id}?error=${encodeURIComponent(r.error)}`);
  redirect(`/c/${token}/proposal/${id}`);
}

export async function declineAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const id = String(formData.get("id") ?? "");
  await declineProposalByToken(token, id);
  redirect(`/c/${token}/proposal/${id}`);
}
