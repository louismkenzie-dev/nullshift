import { createServiceClient } from "@nullshift/db";
import { generatePartnerPlan } from "@nullshift/agents/partnerPlan";
import { costUsd } from "@nullshift/agents/client";
import { logAgentRun } from "@nullshift/agents/runs";
import { sendEmail } from "@/lib/sendEmail";
import type { EmbedRow, PlanLeadRow } from "./data";
import { planNotificationEmail, planReadyEmail } from "./emails";

const site = () =>
  (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nullshift.co.uk").replace(/\/$/, "");

/**
 * Generate the plan for a pending lead, store it, email both sides. Guarded
 * by a compare-and-set on status so a double-click or a retry cannot run two
 * model calls for one lead.
 */
export async function generateForLead(
  embed: EmbedRow,
  lead: PlanLeadRow
): Promise<PlanLeadRow> {
  const db = createServiceClient();
  const { data: claimed } = await db
    .from("plan_leads")
    .update({ status: "generating" })
    .eq("id", lead.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!claimed) {
    const { data } = await db.from("plan_leads").select("*").eq("id", lead.id).single();
    return data as PlanLeadRow;
  }

  const started = Date.now();
  try {
    const { plan, usage, model } = await generatePartnerPlan({
      brand: embed.brand,
      answers: lead.answers,
      contactName: lead.name,
    });
    await db
      .from("plan_leads")
      .update({
        plan,
        status: "ready",
        model,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cost_usd: costUsd(usage),
      })
      .eq("id", lead.id);
    void logAgentRun({
      agent: "plans.partner_plan",
      trigger: "embed",
      status: "ok",
      usage,
      durationMs: Date.now() - started,
    });

    const planUrl = `${site()}/p/${embed.public_key}/plan/${lead.token}`;
    const v = planReadyEmail({ brand: embed.brand, lead, planUrl });
    void sendEmail({
      to: lead.email,
      subject: v.subject,
      html: v.html,
      text: v.text,
      purpose: "transactional",
      replyTo: embed.notify_email ?? undefined,
    });
    if (embed.notify_email) {
      const n = planNotificationEmail({
        brand: embed.brand,
        lead,
        plan,
        dashboardUrl: `${site()}/app/plans/leads/${lead.id}`,
      });
      void sendEmail({
        to: embed.notify_email,
        subject: n.subject,
        html: n.html,
        text: n.text,
        purpose: "transactional",
        replyTo: lead.email,
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "generation failed";
    await db
      .from("plan_leads")
      .update({ status: "failed", error: msg.slice(0, 500) })
      .eq("id", lead.id);
    void logAgentRun({
      agent: "plans.partner_plan",
      trigger: "embed",
      status: "error",
      error: msg,
      durationMs: Date.now() - started,
    });
  }
  const { data } = await db.from("plan_leads").select("*").eq("id", lead.id).single();
  return data as PlanLeadRow;
}
