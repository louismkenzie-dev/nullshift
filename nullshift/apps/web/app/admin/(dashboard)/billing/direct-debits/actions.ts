"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { carePlan } from "@/lib/carePlans";
import { contractedPrices } from "@/lib/pricing/contracted";
import { ensurePortalAccess, portalReplyTo } from "@/lib/portalAccess";
import { siteUrl } from "@/lib/portalLinks";
import { startDirectDebitForTenant } from "@/lib/directDebit";
import { sendEmail } from "@/lib/sendEmail";
import { planChoiceOpen } from "@/lib/planGate";
import {
  planInviteEmail,
  portalAccessEmail,
  portalInviteEmail,
} from "@/lib/clientEmails";

/**
 * Direct Debits board actions. Each is one click for the owner and one email
 * for the client; each goes through the shared helpers so the rules (three-
 * branch portal access, contracted price, never double-bill) are the same as
 * everywhere else. Every action is audit-logged and re-renders the board, the
 * money cockpit and the client's hub.
 */

function revalidateAll(tenantId: string) {
  revalidatePath("/admin/billing/direct-debits");
  revalidatePath("/admin/billing");
  revalidatePath(`/admin/clients/${tenantId}`);
}

async function tenantContact(tenantId: string) {
  const service = createServiceClient();
  const { data } = await service
    .from("tenants")
    .select("id, name, contact_name, contact_email, care_plan_choice")
    .eq("id", tenantId)
    .maybeSingle();
  return {
    service,
    tenant: data as {
      id: string;
      name: string;
      contact_name: string | null;
      contact_email: string | null;
      care_plan_choice: string | null;
    } | null,
  };
}

/** The plan is chosen after the build — is this client's system live yet? */
async function systemIsBuilt(
  service: ReturnType<typeof createServiceClient>,
  tenantId: string
) {
  const { data } = await service
    .from("projects")
    .select("stage")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return planChoiceOpen(data?.stage);
}

/** Invite / fresh link / sign-in pointer, whichever the account state calls for. */
export async function sendPortalLink(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const override = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  if (!tenantId) return;
  const { service, tenant } = await tenantContact(tenantId);
  const email = override || tenant?.contact_email?.toLowerCase() || "";
  if (!tenant || !email) return;
  const name = tenant.contact_name ?? tenant.name ?? "there";

  const access = await ensurePortalAccess(service, { tenantId, email });
  if (!access.ok) {
    console.error("sendPortalLink:", access.error);
    return;
  }
  const mail = access.link
    ? portalInviteEmail({ name, inviteUrl: access.link })
    : portalAccessEmail({ name, loginUrl: `${siteUrl()}/portal/login` });
  const sent = await sendEmail({
    purpose: "transactional",
    to: email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    replyTo: portalReplyTo(),
  });
  await logAudit({
    action: "portal.account_created",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: { email, invited: !!access.link, kind: access.kind, sent, via: "board" },
  });
  revalidateAll(tenantId);
}

/** The three priced options by email, with one link into the plan page. */
export async function sendPlanInvite(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const override = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  if (!tenantId) return;
  const { service, tenant } = await tenantContact(tenantId);
  const email = override || tenant?.contact_email?.toLowerCase() || "";
  if (!tenant || !email) return;
  if (!(await systemIsBuilt(service, tenantId))) {
    console.warn("sendPlanInvite: system not live yet for", tenantId);
    return;
  }

  const pricing = await contractedPrices(tenantId);
  const options = pricing.sellable
    .filter((s) => s.priced && s.mrr !== null)
    .map((s) => {
      const p = carePlan(s.planId)!;
      return { label: p.label, mrr: s.mrr!, blurb: p.blurb, note: s.note };
    });
  if (options.length === 0) return; // not scored / Enterprise — nothing to offer yet

  const access = await ensurePortalAccess(service, {
    tenantId,
    email,
    next: "/portal/plan",
  });
  if (!access.ok) {
    console.error("sendPlanInvite:", access.error);
    return;
  }
  const url =
    access.link ?? `${siteUrl()}/portal/login?next=${encodeURIComponent("/portal/plan")}`;
  const mail = planInviteEmail({
    name: tenant.contact_name ?? tenant.name ?? "there",
    options,
    url,
    firstSignIn: !!access.link,
  });
  const sent = await sendEmail({
    purpose: "transactional",
    to: email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    replyTo: portalReplyTo(),
  });
  await logAudit({
    action: "care_plan.plan_invite_sent",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: {
      email,
      sent,
      firstSignIn: !!access.link,
      prices: Object.fromEntries(options.map((o) => [o.label, o.mrr])),
      band: pricing.assessment?.scale_band ?? null,
      pricingVersion: pricing.assessment?.pricing_version ?? null,
      scaleAssessmentId: pricing.assessment?.id ?? null,
    },
  });
  revalidateAll(tenantId);
}

/**
 * Re-send the GoCardless authorisation link for the plan THE CLIENT chose in
 * the portal (their terms acceptance travels with it). Staff never pick the
 * plan; Enterprise, quoted and contracted separately, may be passed explicitly.
 */
export async function sendDirectDebitLink(formData: FormData) {
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const override = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  if (!tenantId) return;
  const { service, tenant } = await tenantContact(tenantId);
  const email = override || tenant?.contact_email?.toLowerCase() || "";
  if (!tenant || !email) return;
  const requested = String(formData.get("plan") || "");
  const planId = carePlan(requested)?.quotedOnly
    ? requested
    : (tenant.care_plan_choice ?? "");
  if (!carePlan(planId)) {
    console.warn("sendDirectDebitLink: client has not chosen a plan yet", tenantId);
    return;
  }
  const res = await startDirectDebitForTenant(service, {
    tenantId,
    planId,
    via: "board",
    email,
    name: tenant.name ?? tenant.contact_name ?? null,
    emailLink: true,
  });
  if (!res.ok) console.error("sendDirectDebitLink:", res.reason, res.detail ?? "");
  revalidateAll(tenantId);
}
