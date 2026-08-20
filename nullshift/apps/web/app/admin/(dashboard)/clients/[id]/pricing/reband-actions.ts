"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { calculateScalePricing, PRICING_VERSION, type ScaleInput } from "@/lib/pricing/nsi";
import { currentPeriod, earliestEffectiveDate } from "@/lib/pricing/reband";

/**
 * Re-band actions (spec §7).
 *
 * Every one of these is a step a human takes. None of them touches Stripe, and
 * none of them changes what a client is billed: the last step here marks a
 * notice EFFECTIVE, which is the point at which billing may be updated —
 * deliberately as a separate, visible act rather than a side effect of a score.
 */

/**
 * File this month's shadow score. Re-runs the formula against the client's
 * most recent assessment inputs and stores what it would say today.
 */
export async function recordSnapshot(formData: FormData) {
  const staff = await requireStaff();
  if (!staff.ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  if (!tenantId) return;

  const db = createServiceClient();
  const { data: latest } = await db
    .from("scale_assessments")
    .select("inputs, agreed_mrr, override_mrr, recommended_mrr")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest?.inputs) return;

  const result = calculateScalePricing(latest.inputs as ScaleInput);
  const currentMrr =
    latest.agreed_mrr ?? latest.override_mrr ?? latest.recommended_mrr ?? null;

  // One snapshot per month. Re-filing overwrites rather than accumulating:
  // a month has one shadow score, not a stream of them.
  const { error } = await db.from("pricing_snapshots").upsert(
    {
      tenant_id: tenantId,
      period: currentPeriod(),
      pricing_version: PRICING_VERSION,
      inputs: latest.inputs,
      component_scores: result.componentScores,
      nsi: result.nsi,
      scale_band: result.scaleBand,
      multiplier: result.multiplier,
      recommended_mrr: result.recommendedMrr,
      direct_vendor_cost: (latest.inputs as ScaleInput).directMonthlyVendorCostGbp ?? null,
      enterprise_review_required: result.enterpriseReviewRequired,
      current_mrr: currentMrr,
    },
    { onConflict: "tenant_id,period" }
  );
  if (error) return;

  await logAudit({
    action: "pricing.snapshot_recorded",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: { period: currentPeriod(), nsi: result.nsi, band: result.scaleBand },
  });
  revalidatePath(`/admin/clients/${tenantId}/pricing`);
}

/** Turn a decision into a proposal. Still nothing the client can see. */
export async function proposePriceChange(formData: FormData) {
  const staff = await requireStaff();
  if (!staff.ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const direction = String(formData.get("direction") || "");
  const newMrr = Number(formData.get("new_mrr") || 0);
  const oldMrr = Number(formData.get("old_mrr") || 0);
  const reason = String(formData.get("reason") || "").trim();
  if (!tenantId || !reason || !["increase", "decrease"].includes(direction)) return;

  const db = createServiceClient();
  const { data: order } = await db
    .from("order_forms")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "accepted")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: ref } = await db.rpc("next_price_notice_ref");

  const { data: created } = await db
    .from("price_change_notices")
    .insert({
      tenant_id: tenantId,
      order_form_id: order?.id ?? null,
      reference: ref ?? `PCN-${Date.now()}`,
      direction,
      reason,
      old_mrr: oldMrr,
      new_mrr: newMrr,
      old_band: String(formData.get("old_band") || "") || null,
      new_band: String(formData.get("new_band") || "") || null,
      pricing_version: PRICING_VERSION,
      evidence_snapshot_ids: String(formData.get("evidence") || "")
        .split(",")
        .filter(Boolean),
      status: "proposed",
    })
    .select("id, reference")
    .single();

  if (created)
    await logAudit({
      action: "pricing.change_proposed",
      target: `price_change_notice:${created.id}`,
      tenantId,
      metadata: { reference: created.reference, direction, oldMrr, newMrr },
    });
  revalidatePath(`/admin/clients/${tenantId}/pricing`);
}

/** A named human signs off. Required before the client is told anything. */
export async function approvePriceChange(formData: FormData) {
  const staff = await requireStaff();
  if (!staff.ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!id || !tenantId) return;

  const db = createServiceClient();
  await db
    .from("price_change_notices")
    .update({
      status: "approved",
      approved_by: staff.userId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "proposed");

  await logAudit({
    action: "pricing.change_approved",
    target: `price_change_notice:${id}`,
    tenantId,
  });
  revalidatePath(`/admin/clients/${tenantId}/pricing`);
}

/**
 * Record that notice actually went out, and set the earliest lawful effective
 * date from that moment. The date is derived, not typed: nobody should be able
 * to shorten a client's notice period by filling in a box.
 */
export async function recordNoticeSent(formData: FormData) {
  const staff = await requireStaff();
  if (!staff.ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  const to = String(formData.get("notice_sent_to") || "").trim();
  const channel = String(formData.get("notice_channel") || "email");
  if (!id || !tenantId || !to) return;

  const sentAt = new Date();
  const db = createServiceClient();
  await db
    .from("price_change_notices")
    .update({
      status: "notice_sent",
      notice_sent_at: sentAt.toISOString(),
      notice_sent_to: to,
      notice_channel: ["email", "portal", "post", "other"].includes(channel)
        ? channel
        : "other",
      effective_date: earliestEffectiveDate(sentAt),
    })
    .eq("id", id)
    .eq("status", "approved");

  await logAudit({
    action: "pricing.notice_sent",
    target: `price_change_notice:${id}`,
    tenantId,
    metadata: { to, channel, effective: earliestEffectiveDate(sentAt) },
  });
  revalidatePath(`/admin/clients/${tenantId}/pricing`);
}

/**
 * The effective date has passed and the notice period was served: adopt the
 * new figure. This is the ONLY path from a shadow score to a changed bill, and
 * it needs a person, an approval and 30 days of notice behind it.
 */
export async function applyPriceChange(formData: FormData) {
  const staff = await requireStaff();
  if (!staff.ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!id || !tenantId) return;

  const db = createServiceClient();
  const { data: notice } = await db
    .from("price_change_notices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!notice || notice.status !== "notice_sent") return;
  if (!notice.effective_date) return;
  if (new Date(notice.effective_date) > new Date()) return;

  await db.from("price_change_notices").update({ status: "effective" }).eq("id", id);

  // Adopt the figure on the assessment, which is what contractedMrr() reads.
  const { data: latest } = await db
    .from("scale_assessments")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest)
    await db
      .from("scale_assessments")
      .update({ agreed_mrr: notice.new_mrr, agreed_at: new Date().toISOString() })
      .eq("id", latest.id);

  await logAudit({
    action: "pricing.change_effective",
    target: `price_change_notice:${id}`,
    tenantId,
    metadata: {
      oldMrr: notice.old_mrr,
      newMrr: notice.new_mrr,
      effective: notice.effective_date,
    },
  });
  revalidatePath(`/admin/clients/${tenantId}/pricing`);
}

export async function withdrawPriceChange(formData: FormData) {
  const staff = await requireStaff();
  if (!staff.ok) return;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!id || !tenantId) return;
  const db = createServiceClient();
  await db
    .from("price_change_notices")
    .update({ status: "withdrawn" })
    .eq("id", id)
    .neq("status", "effective");
  await logAudit({
    action: "pricing.change_withdrawn",
    target: `price_change_notice:${id}`,
    tenantId,
  });
  revalidatePath(`/admin/clients/${tenantId}/pricing`);
}
