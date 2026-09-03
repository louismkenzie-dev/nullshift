"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@nullshift/db";
import { isClientPreview } from "@/lib/clientPreview";
import { logAudit } from "@nullshift/db/audit";
import { isGoCardlessConfigured } from "@nullshift/billing/gocardless";
import { CARE_PLANS, carePlan } from "@/lib/carePlans";
import { contractedMrr } from "@/lib/pricing/contracted";
import { startDirectDebitForTenant } from "@/lib/directDebit";
import { planChoiceOpen } from "@/lib/planGate";
import { CARE_PLAN_TERMS_VERSION, termsAcceptanceValid } from "@/lib/carePlanTerms";
import { recordDocumentEvent } from "@/lib/documentEvents";

/**
 * Client-side plan choice. "none" records an explicit no-plan decision (the
 * admin can attach a plan later); one of the three sellable levels starts the
 * GoCardless Direct Debit at the client's CONTRACTED price.
 *
 * The price the client saw travels back as `quoted_pence` and is re-derived
 * here before anything is charged. If the two disagree — the client was
 * re-scored while the page was open — nothing is recorded and the page
 * re-renders with the current figures and a note. Enterprise is never
 * self-serve; it is quoted and started by staff.
 */
export async function choosePlan(formData: FormData): Promise<void> {
  // Staff view-as-client preview is read-only — never record a choice or
  // start a Direct Debit on the client's behalf.
  if (await isClientPreview()) return;
  const choice = String(formData.get("plan") || "");
  const valid = choice === "none" || CARE_PLANS.some((p) => p.id === choice);
  if (!valid) return;
  const plan = choice === "none" ? null : carePlan(choice);
  if (choice !== "none" && (!plan || plan.quotedOnly)) return;

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

  // The plan is chosen AFTER the build: nothing can be picked until the
  // client's system is live, whatever link brought them here.
  const { data: proj } = await service
    .from("projects")
    .select("stage")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!planChoiceOpen(proj?.stage)) redirect("/portal/plan?gate=closed");

  // A live subscription means billing is already set up — nothing to choose.
  const { data: live } = await service
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("status", ["active", "trialing", "past_due"])
    .limit(1);
  if (live && live.length > 0) return;

  if (choice === "none" || !plan) {
    await service.from("tenants").update({ care_plan_choice: "none" }).eq("id", tenantId);
    await logAudit({
      action: "care_plan.chosen",
      target: `tenant:${tenantId}`,
      tenantId,
      metadata: { choice: "none", via: "portal" },
    });
    revalidatePath("/portal/plan");
    return;
  }

  // Price seen must equal price charged.
  const quoted = Number(formData.get("quoted_pence") || NaN);
  const price = await contractedMrr(tenantId, plan.id);
  const chargePence = Math.round(price.mrr * 100);
  if (!price.priced || !Number.isFinite(quoted) || quoted !== chargePence) {
    redirect("/portal/plan?price=changed");
  }

  // Terms before Direct Debit: the confirm step's agreement, current version
  // only. Without it nothing is recorded and no mandate is started.
  if (
    !termsAcceptanceValid({
      accepted: formData.get("terms_accepted"),
      version: formData.get("terms_version"),
    })
  ) {
    redirect(`/portal/plan/confirm?plan=${encodeURIComponent(choice)}&terms=required`);
  }
  const acceptedAt = new Date().toISOString();
  await service
    .from("tenants")
    .update({
      care_plan_choice: choice,
      care_plan_terms_version: CARE_PLAN_TERMS_VERSION,
      care_plan_terms_accepted_at: acceptedAt,
      care_plan_terms_accepted_by: user.id,
    })
    .eq("id", tenantId);
  await recordDocumentEvent(service, {
    tenantId,
    documentType: "care_plan_terms",
    documentId: CARE_PLAN_TERMS_VERSION,
    event: "signed",
    actor: user.id,
    actorKind: "client",
    meta: { plan: choice, amountPence: chargePence, email: user.email ?? null },
  });
  await logAudit({
    action: "care_plan.terms_accepted",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: {
      version: CARE_PLAN_TERMS_VERSION,
      plan: choice,
      amountPence: chargePence,
      acceptedAt,
      email: user.email ?? null,
    },
  });
  await logAudit({
    action: "care_plan.chosen",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: {
      choice,
      via: "portal",
      amountPence: chargePence,
      priceSource: price.source,
      band: price.band,
      pricingVersion: price.pricingVersion,
      scaleAssessmentId: price.assessmentId,
    },
  });

  // Direct Debit is the billing rail. When GoCardless isn't configured on this
  // deployment the recorded choice is still visible in the client hub and the
  // admin completes setup from there.
  if (!isGoCardlessConfigured()) {
    revalidatePath("/portal/plan");
    return;
  }

  const { data: tenant } = await service
    .from("tenants")
    .select("name, contact_name")
    .eq("id", tenantId)
    .maybeSingle();

  const started = await startDirectDebitForTenant(service, {
    tenantId,
    planId: plan.id,
    via: "portal",
    email: user.email ?? "",
    name: tenant?.name ?? tenant?.contact_name ?? null,
    terms: { version: CARE_PLAN_TERMS_VERSION, acceptedAt, acceptedBy: user.id },
  });
  if (!started.ok) {
    console.error(
      "choosePlan: Direct Debit did not start:",
      started.reason,
      started.detail ?? ""
    );
    revalidatePath("/portal/plan");
    return;
  }

  redirect(started.url);
}
