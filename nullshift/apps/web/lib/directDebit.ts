import type { SupabaseClient } from "@supabase/supabase-js";
import { logAuditAsService } from "@nullshift/db/audit";
import {
  cancelBillingRequest,
  isGoCardlessConfigured,
  startCareDirectDebit,
} from "@nullshift/billing/gocardless";
import { carePlan } from "@/lib/carePlans";
import { contractedMrr } from "@/lib/pricing/contracted";
import { buildDirectDebitEmail } from "@/lib/clientEmails";
import { sendEmail } from "@/lib/sendEmail";
import { portalReplyTo } from "@/lib/portalAccess";
import { siteUrl } from "@/lib/portalLinks";

/**
 * Start a care-plan Direct Debit for a tenant — the ONE implementation behind
 * the portal chooser, the client hub button and the Direct Debits board.
 *
 * What it guarantees:
 *   • the amount is the tenant's CONTRACTED price (scale band applied), and it
 *     refuses when no price may be charged (not scored / Enterprise review);
 *   • Enterprise (quoted only) only proceeds on an agreed or override figure;
 *   • never double-bills: a live subscription on either rail stops it;
 *   • earlier pending Direct Debit attempts are cancelled at GoCardless before
 *     being replaced, so an old emailed link can't complete into a mandate we
 *     no longer track;
 *   • the pending `subscriptions` row stores the exact pence the webhook will
 *     charge, and the audit row records how that figure was arrived at.
 */
export type StartDirectDebitInput = {
  tenantId: string;
  planId: string;
  via: "portal" | "admin" | "board";
  /** Payer email GoCardless prefills. */
  email: string;
  /** Business (or contact) name GoCardless prefills. */
  name: string | null;
  /** Email the authorisation link (admin paths). The portal redirects instead. */
  emailLink?: boolean;
  /** Where GoCardless returns the client. Portal default; emailed links go via login. */
  returnPath?: string;
  exitPath?: string;
  /**
   * The client's agreement to the care-plan terms, captured on the portal's
   * confirm step. Admin re-sends pass nothing and the tenant's recorded
   * acceptance is used; without one, no sellable plan may start.
   */
  terms?: { version: string; acceptedAt: string; acceptedBy: string | null };
};

export type StartDirectDebitResult =
  | { ok: true; url: string; billingRequestId: string; mrr: number; emailed: boolean }
  | {
      ok: false;
      reason:
        | "unconfigured"
        | "unknown_plan"
        | "quoted_only"
        | "unpriced"
        | "already_live"
        | "no_email"
        | "client_choice_required"
        | "terms_required"
        | "gocardless";
      detail?: string;
    };

export async function startDirectDebitForTenant(
  service: SupabaseClient,
  input: StartDirectDebitInput
): Promise<StartDirectDebitResult> {
  if (!isGoCardlessConfigured()) return { ok: false, reason: "unconfigured" };
  const plan = carePlan(input.planId);
  if (!plan) return { ok: false, reason: "unknown_plan" };
  if (!input.email) return { ok: false, reason: "no_email" };

  // Never double-bill: bail if billing is already live on either rail.
  const { data: live } = await service
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .in("status", ["active", "trialing", "past_due"])
    .limit(1);
  if (live && live.length > 0) return { ok: false, reason: "already_live" };

  // The plan is the client's choice, made in the portal after go-live, and
  // they agree the terms there. Staff paths may only re-send the plan the
  // client chose, carrying the acceptance they already gave. Enterprise is the
  // exception: quoted and contracted by staff under its Order Form.
  const { data: tenantRow } = await service
    .from("tenants")
    .select(
      "care_plan_choice, care_plan_terms_version, care_plan_terms_accepted_at, care_plan_terms_accepted_by"
    )
    .eq("id", input.tenantId)
    .maybeSingle();
  let terms = input.terms ?? null;
  if (!plan.quotedOnly) {
    if (input.via !== "portal" && tenantRow?.care_plan_choice !== plan.id)
      return {
        ok: false,
        reason: "client_choice_required",
        detail: `client chose ${tenantRow?.care_plan_choice ?? "nothing yet"}`,
      };
    if (
      !terms &&
      tenantRow?.care_plan_terms_accepted_at &&
      tenantRow.care_plan_terms_version
    )
      terms = {
        version: tenantRow.care_plan_terms_version,
        acceptedAt: tenantRow.care_plan_terms_accepted_at,
        acceptedBy: tenantRow.care_plan_terms_accepted_by ?? null,
      };
    if (!terms) return { ok: false, reason: "terms_required" };
  }

  const price = await contractedMrr(input.tenantId, plan.id);
  if (plan.quotedOnly && !(price.source === "agreed" || price.source === "override"))
    return { ok: false, reason: "quoted_only" };
  if (!price.priced) return { ok: false, reason: "unpriced", detail: price.source };
  const mrr = price.mrr;
  const amountPence = Math.round(mrr * 100);

  const origin = siteUrl();
  // An emailed link is opened from an inbox, usually signed out — land on the
  // login page and bounce back to the plan page's success/exit state.
  const emailed = !!input.emailLink;
  const returnPath =
    input.returnPath ??
    (emailed
      ? `/portal/login?next=${encodeURIComponent("/portal/plan?dd=authorised")}`
      : "/portal/plan?dd=authorised");
  const exitPath =
    input.exitPath ??
    (emailed
      ? `/portal/login?next=${encodeURIComponent("/portal/plan?dd=exit")}`
      : "/portal/plan?dd=exit");

  let dd: { url: string; billingRequestId: string } | null;
  try {
    dd = await startCareDirectDebit({
      tenantId: input.tenantId,
      plan: plan.id,
      amountPence,
      description: `Nullshift ${plan.label} plan — £${mrr}/month`,
      email: input.email,
      name: input.name,
      origin,
      redirectPath: returnPath,
      exitPath,
    });
  } catch (e) {
    return { ok: false, reason: "gocardless", detail: (e as Error).message };
  }
  if (!dd) return { ok: false, reason: "unconfigured" };

  // Supersede any earlier attempt: cancel its billing request at GoCardless
  // (so the old link dies) before replacing the tracking row.
  const { data: stale } = await service
    .from("subscriptions")
    .select("gc_billing_request_id")
    .eq("tenant_id", input.tenantId)
    .eq("provider", "gocardless")
    .eq("status", "incomplete");
  for (const row of (stale ?? []) as { gc_billing_request_id: string | null }[]) {
    if (row.gc_billing_request_id && row.gc_billing_request_id !== dd.billingRequestId)
      await cancelBillingRequest(row.gc_billing_request_id);
  }
  await service
    .from("subscriptions")
    .delete()
    .eq("tenant_id", input.tenantId)
    .eq("provider", "gocardless")
    .eq("status", "incomplete");
  const { error: insertErr } = await service.from("subscriptions").insert({
    tenant_id: input.tenantId,
    plan: plan.id,
    mrr,
    status: "incomplete",
    provider: "gocardless",
    gc_billing_request_id: dd.billingRequestId,
    terms_version: terms?.version ?? null,
    terms_accepted_at: terms?.acceptedAt ?? null,
    terms_accepted_by: terms?.acceptedBy ?? null,
  });
  if (insertErr) return { ok: false, reason: "gocardless", detail: insertErr.message };

  let sent = false;
  if (emailed) {
    const mail = buildDirectDebitEmail({
      name: input.name ?? "",
      planLabel: plan.label,
      mrr,
      url: dd.url,
    });
    sent = await sendEmail({
      purpose: "transactional",
      to: input.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: portalReplyTo(),
    });
    if (!sent)
      console.error(
        "startDirectDebitForTenant: link email did not send for",
        input.email
      );
  }

  await logAuditAsService({
    action: emailed ? "care_plan.dd_setup_sent" : "care_plan.dd_started",
    target: `tenant:${input.tenantId}`,
    tenantId: input.tenantId,
    metadata: {
      plan: plan.id,
      billingRequest: dd.billingRequestId,
      via: input.via,
      amountPence,
      priceSource: price.source,
      band: price.band,
      multiplier: price.multiplier,
      pricingVersion: price.pricingVersion,
      scaleAssessmentId: price.assessmentId,
      emailed: sent,
      termsVersion: terms?.version ?? null,
      termsAcceptedAt: terms?.acceptedAt ?? null,
    },
  });

  return {
    ok: true,
    url: dd.url,
    billingRequestId: dd.billingRequestId,
    mrr,
    emailed: sent,
  };
}
