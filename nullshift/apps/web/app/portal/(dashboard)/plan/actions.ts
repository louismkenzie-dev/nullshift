"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@nullshift/db";
import { isClientPreview } from "@/lib/clientPreview";
import { logAudit } from "@nullshift/db/audit";
import {
  cancelBillingRequest,
  isGoCardlessConfigured,
  startCareDirectDebit,
} from "@nullshift/billing/gocardless";
import { CARE_PLANS, carePlan } from "@/lib/carePlans";

/**
 * Client-side care plan choice. "none" records an explicit no-plan decision
 * (the admin can attach a plan later from the client hub); a paid tier starts
 * the GoCardless Direct Debit authorisation when configured, else records the
 * choice for the admin to complete billing setup.
 */
export async function choosePlan(formData: FormData): Promise<void> {
  // Staff view-as-client preview is read-only — never record a choice or
  // start a Direct Debit on the client's behalf.
  if (await isClientPreview()) return;
  const choice = String(formData.get("plan") || "");
  const valid = choice === "none" || CARE_PLANS.some((p) => p.id === choice);
  if (!valid) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Resolve the caller's own client workspace — explicitly via their
  // client_admin membership (never staff-wide RLS visibility).
  const service = createServiceClient();
  const { data: membership } = await service
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("role", "client_admin")
    .limit(1)
    .maybeSingle();
  const tenantId = membership?.tenant_id as string | undefined;
  if (!tenantId) return;

  // A live subscription means billing is already set up — nothing to choose.
  const { data: live } = await service
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("status", ["active", "trialing", "past_due"])
    .limit(1);
  if (live && live.length > 0) return;

  await service.from("tenants").update({ care_plan_choice: choice }).eq("id", tenantId);
  await logAudit({
    action: "care_plan.chosen",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: { choice, via: "portal" },
  });

  if (choice === "none") {
    revalidatePath("/portal/plan");
    return;
  }

  const plan = carePlan(choice);
  if (!plan) return;

  // Direct Debit is the billing rail for care plans. When GoCardless isn't
  // configured yet, the recorded choice is still visible in the client hub and
  // the admin completes setup from there.
  if (!isGoCardlessConfigured()) {
    revalidatePath("/portal/plan");
    return;
  }

  const { data: tenant } = await service
    .from("tenants")
    .select("name, contact_name")
    .eq("id", tenantId)
    .maybeSingle();

  const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://nullshift.co.uk").replace(
    /\/$/,
    ""
  );
  const dd = await startCareDirectDebit({
    tenantId,
    plan: plan.id,
    amountPence: Math.round(plan.mrr * 100),
    description: `Nullshift ${plan.label} care plan`,
    email: user.email ?? "",
    name: tenant?.name ?? tenant?.contact_name ?? null,
    origin,
  });
  if (!dd) {
    revalidatePath("/portal/plan");
    return;
  }

  // Track the pending mandate so the webhook can activate it. Stale pending
  // GoCardless attempts for this tenant are superseded, not duplicated — and
  // their billing requests are CANCELLED at GoCardless first, so an old
  // emailed/open authorisation link can't be completed into a mandate we no
  // longer track. (Belt-and-braces: the webhook also rescues orphans via the
  // billing request's metadata.)
  const { data: stale } = await service
    .from("subscriptions")
    .select("gc_billing_request_id")
    .eq("tenant_id", tenantId)
    .eq("provider", "gocardless")
    .eq("status", "incomplete");
  for (const row of (stale ?? []) as { gc_billing_request_id: string | null }[]) {
    if (row.gc_billing_request_id) await cancelBillingRequest(row.gc_billing_request_id);
  }
  await service
    .from("subscriptions")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("provider", "gocardless")
    .eq("status", "incomplete");
  await service.from("subscriptions").insert({
    tenant_id: tenantId,
    plan: plan.id,
    mrr: plan.mrr,
    status: "incomplete",
    provider: "gocardless",
    gc_billing_request_id: dd.billingRequestId,
  });
  await logAudit({
    action: "care_plan.dd_started",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: { plan: plan.id, billingRequest: dd.billingRequestId, via: "portal" },
  });

  redirect(dd.url);
}
