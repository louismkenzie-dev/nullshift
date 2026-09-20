import { NextResponse } from "next/server";
import { createServiceClient } from "@nullshift/db";
import { logAuditAsService } from "@nullshift/db/audit";
import { sendEmail } from "@/lib/sendEmail";
import { mandateReminderEmail } from "@/lib/clientEmails";
import { siteUrl } from "@/lib/portalLinks";
import { portalReplyTo } from "@/lib/portalAccess";
import { carePlan } from "@/lib/carePlans";
import {
  decideReminder,
  reminderTone,
  MAX_CLIENT_REMINDERS,
} from "@/lib/billing/mandateReminders";

export const dynamic = "force-dynamic";

/**
 * Chase unfinished Direct Debits, daily.
 *
 * A client accepts the care-plan terms, gets handed to GoCardless, and then
 * loses the page — a closed tab, no bank details to hand, a phone call. They
 * have committed to a plan and nothing is collecting, and because the failure
 * is silent on both sides nobody finds out until someone happens to look at
 * the board. It has happened three times.
 *
 * Two deliberate choices about the email:
 *
 *  · It links to the PORTAL, never to GoCardless. A GoCardless authorisation
 *    link is superseded the moment a new one is minted, so a run of daily
 *    emails would be a run of dead links with only the newest alive. The
 *    portal page is permanent, and the button there mints a live link on the
 *    spot.
 *  · It stops. Five reminders, then the client is left alone and it becomes
 *    staff's to pick up — an email that arrives forever earns a filter rule,
 *    and then we cannot reach that client about anything.
 *
 * Silent when there is nothing to chase.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = createServiceClient();

  // Everything signed but not collecting. `incomplete` on the GoCardless rail
  // means exactly "waiting on the mandate".
  const { data: pending, error } = await db
    .from("subscriptions")
    .select("id, tenant_id, plan, mrr, terms_accepted_at, created_at")
    .eq("provider", "gocardless")
    .eq("status", "incomplete");
  if (error) {
    console.error("mandate-reminders: query failed", error.message);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
  if (!pending?.length) return NextResponse.json({ checked: 0, reminded: 0 });

  const portalUrl = `${siteUrl()}/portal/login?next=${encodeURIComponent("/portal/plan")}`;
  let reminded = 0;
  let escalated = 0;

  for (const sub of pending) {
    const tenantId = sub.tenant_id as string;

    // How many reminders this attempt has already had. Counted from the audit
    // trail rather than a column, so the count can never disagree with the
    // record of what was actually sent.
    const since = (sub.terms_accepted_at as string | null) ?? (sub.created_at as string);
    const { count } = await db
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("action", "care_plan.dd_reminder_sent")
      .gte("created_at", since);

    const decision = decideReminder({
      tenantId,
      termsAcceptedAt: sub.terms_accepted_at as string | null,
      remindersSent: count ?? 0,
    });
    if (decision.action === "wait") continue;

    const { data: tenant } = await db
      .from("tenants")
      .select("name, contact_name, contact_email")
      .eq("id", tenantId)
      .maybeSingle();
    const email = (tenant?.contact_email as string | null) ?? "";
    const plan = carePlan(sub.plan as string);
    const planLabel = plan?.label ?? (sub.plan as string);
    const mrr = Number(sub.mrr ?? plan?.mrr ?? 0);

    if (decision.action === "escalate") {
      // Said once, when the client reminders run out — not every day after.
      if ((count ?? 0) === MAX_CLIENT_REMINDERS) {
        await logAuditAsService({
          action: "care_plan.dd_reminder_escalated",
          target: `tenant:${tenantId}`,
          tenantId,
          metadata: { plan: sub.plan, mrr, remindersSent: count, email },
        });
        escalated += 1;
      }
      continue;
    }

    if (!email) {
      console.warn("mandate-reminders: no contact email for tenant", tenantId);
      continue;
    }

    const name = (tenant?.contact_name as string | null) ?? "";
    const tone = reminderTone(decision.nth);
    const { subject, html, text } = mandateReminderEmail({
      name,
      planLabel,
      mrr,
      url: portalUrl,
      tone,
    });

    const sent = await sendEmail({
      purpose: "transactional",
      to: email,
      subject,
      html,
      text,
      replyTo: portalReplyTo(),
    });

    // Only a reminder that actually went out counts towards the five. A
    // failed send is still on the record, under its own action, so a bad spell
    // with the mail provider cannot quietly burn a client's whole sequence and
    // escalate them to staff without them ever having heard from us.
    await logAuditAsService({
      action: sent ? "care_plan.dd_reminder_sent" : "care_plan.dd_reminder_failed",
      target: `tenant:${tenantId}`,
      tenantId,
      metadata: { plan: sub.plan, mrr, nth: decision.nth, tone, email },
    });
    if (sent) reminded += 1;
  }

  return NextResponse.json({ checked: pending.length, reminded, escalated });
}
