import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@nullshift/db";
import { recordLead } from "@nullshift/db/leads";
import { buildScalingPlan } from "@nullshift/content/scalingPlan";
import { scoreLead, type Answers } from "@/lib/funnel";
import { scalingPlanEmail, ownerEmail } from "@/lib/funnelEmails";

/* Public endpoint — the /start quiz funnel posts here on contact capture.
 *  Re-scores server-side (never trust the client), upserts the canonical
 *  `leads` row (recordLead: dedupe/merge by email, plan + plan_token stored,
 *  agent consultation seeded), then sends two branded emails via Resend: a
 *  tailored, lead-generating email to the visitor, and a new-lead notification
 *  to Nullshift. Honeypot + time-trap drop obvious bots. Email + DB are
 *  independent best-effort steps. Phone + UTM are persisted on the lead
 *  (migration 0023) so callbacks and attribution survive capture. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = {
  answers?: Answers;
  contact?: {
    name?: string;
    business?: string;
    email?: string;
    phone?: string;
    /** Their real website (optional) — researched by the Agent Consultation. */
    siteUrl?: string;
  };
  utm?: Record<string, string>;
  planToken?: string; // client-minted token for the permanent /plan link
  website?: string; // honeypot
  elapsedMs?: number; // time-trap
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ── Bot traps: pretend success, store nothing. ──
  if (body.website && body.website.trim() !== "") return NextResponse.json({ ok: true });
  if (typeof body.elapsedMs === "number" && body.elapsedMs < 1500)
    return NextResponse.json({ ok: true });

  const name = body.contact?.name?.trim();
  const business = body.contact?.business?.trim() || null;
  const email = body.contact?.email?.trim().toLowerCase();
  const phone = body.contact?.phone?.trim() || null;
  // Fold their website into the answer set (key: website_url) so it flows into
  // quiz_answers and the agent's research without schema changes. Normalised +
  // sanity-capped; never trusted beyond being a URL to look at.
  const rawSite = body.contact?.siteUrl?.trim() ?? "";
  const siteUrl =
    rawSite && rawSite.length <= 200 && !/\s/.test(rawSite)
      ? /^https?:\/\//i.test(rawSite)
        ? rawSite
        : `https://${rawSite}`
      : null;
  const answers: Answers = { ...(body.answers ?? {}) };
  if (siteUrl) answers.website_url = siteUrl;

  if (!name || !email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "A valid name and email are required." },
      { status: 400 }
    );
  }

  // Authoritative scoring + Build Blueprint happen on the server (never trust the
  // client). The token is the public key for the permanent /plan page — accept a
  // well-formed client-minted one (so the link is known instantly) or mint our own.
  const { score, segment, recommendation } = scoreLead(answers);
  const scalingPlan = buildScalingPlan(answers, {
    segment,
    businessName: business ?? undefined,
  });
  const planToken =
    typeof body.planToken === "string" && UUID_RE.test(body.planToken)
      ? body.planToken
      : randomUUID();

  // ── Write the canonical multi-tenant `leads` row. (The old dual-write to
  //    `enquiries` is gone — the pipeline reads `leads`; `enquiries` now only
  //    carries contact/booking/brief messages.) ──
  // UTM: keep only sane string pairs (attribution data, not a dumping ground).
  const utm: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.utm ?? {})) {
    if (typeof v === "string" && k.length <= 40 && v.length <= 200) utm[k] = v;
  }

  const lead = await recordLead({
    name,
    email,
    source: "funnel",
    vertical: answers.industry || null,
    quizAnswers: { answers, recommendation },
    leadScore: score,
    status: segment === "qualified" ? "qualified" : "new",
    planToken,
    plan: { scalingPlan, businessName: business, name, segment },
    phone,
    utm,
  });
  if (!lead.ok) console.error("Lead insert error:", lead.error);

  // ── Seed the Agent Consultation row (pending) so the /plan page generates
  //    the tailored plan + live mockup on first view. Best-effort. ──
  try {
    const supabase = createServiceClient();
    await supabase
      .from("agent_consultations")
      .upsert(
        { plan_token: planToken },
        { onConflict: "plan_token", ignoreDuplicates: true }
      );
  } catch (e) {
    console.error("agent_consultations seed failed (non-fatal):", e);
  }

  // ── Branded emails via Resend (best-effort) ──
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const siteUrl = (
        process.env.NEXT_PUBLIC_SITE_URL || "https://nullshift.co.uk"
      ).replace(/\/$/, "");
      const resourceUrl = process.env.FUNNEL_RESOURCE_URL || `${siteUrl}/resources`;
      const planUrl = `${siteUrl}/plan/${planToken}`;
      const bookUrl = `${siteUrl}/book?segment=${segment}&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`;
      const from =
        process.env.ENQUIRY_FROM_EMAIL ||
        process.env.RESEND_FROM_EMAIL ||
        "Nullshift <onboarding@resend.dev>";
      const notify = process.env.ENQUIRY_NOTIFY_EMAIL;

      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);

      // The personalised Free Scaling Plan, with a link to the permanent plan page.
      const ce = scalingPlanEmail({
        name,
        businessName: business ?? undefined,
        segment,
        plan: scalingPlan,
        planUrl,
        bookUrl,
      });
      await resend.emails.send({
        from,
        to: email,
        subject: ce.subject,
        html: ce.html,
        text: ce.text,
      });

      // Branded new-lead notification to Nullshift.
      if (notify) {
        const oe = ownerEmail({
          name,
          email,
          phone,
          segment,
          score,
          answers,
          recommendation,
          resourceUrl,
          planUrl,
        });
        await resend.emails.send({
          from,
          to: notify,
          replyTo: email,
          subject: oe.subject,
          html: oe.html,
          text: oe.text,
        });
      }

      // Add the lead to a Resend audience for ongoing nurture (best-effort).
      const audienceId = process.env.RESEND_AUDIENCE_ID;
      if (audienceId) {
        const [firstName, ...rest] = name.split(" ");
        await resend.contacts.create({
          email,
          firstName: firstName || undefined,
          lastName: rest.join(" ") || undefined,
          audienceId,
          unsubscribed: false,
        });
      }
    }
  } catch (e) {
    console.error("Resend email/audience failed (non-fatal):", e);
  }

  return NextResponse.json({ ok: true, segment, recommendation });
}
