import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@nullshift/db";
import { recordLead } from "@nullshift/db/leads";
import { buildBlueprint } from "@nullshift/content/blueprint";
import { scoreLead, type Answers } from "@/lib/funnel";
import { blueprintEmail, ownerEmail } from "@/lib/funnelEmails";

/* Public endpoint — the /start quiz funnel posts here on contact capture.
 *  Re-scores server-side (never trust the client), saves the lead to the
 *  `enquiries` table (source='funnel' + funnel_data/score/segment/utm), then
 *  sends two branded emails via Resend: a tailored, lead-generating email to
 *  the visitor, and a new-lead notification to Nullshift. Honeypot + time-trap
 *  drop obvious bots. Email + DB are independent best-effort steps. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = {
  answers?: Answers;
  contact?: { name?: string; business?: string; email?: string; phone?: string };
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
  const answers = body.answers ?? {};

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
  const blueprint = buildBlueprint(answers, {
    segment,
    businessName: business ?? undefined,
  });
  const planToken =
    typeof body.planToken === "string" && UUID_RE.test(body.planToken)
      ? body.planToken
      : randomUUID();

  // ── Save to Supabase (best-effort — never blocks the emails) ──
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("enquiries").insert({
      source: "funnel",
      name,
      email,
      phone,
      message: null,
      funnel_data: { answers, recommendation },
      lead_score: score,
      segment,
      utm: body.utm && Object.keys(body.utm).length ? body.utm : null,
      status: "new",
    });
    if (error) console.error("Funnel insert error:", error.message);
  } catch (e) {
    console.error("Supabase not configured:", e);
  }

  // ── Also write the canonical multi-tenant `leads` row (Phase 1 schema). The
  //    enquiries write above stays during the transition so the legacy admin
  //    keeps showing leads until the ops hub reads `leads` directly (Phase 3). ──
  const lead = await recordLead({
    name,
    email,
    source: "funnel",
    vertical: answers.industry || null,
    quizAnswers: { answers, recommendation },
    leadScore: score,
    status: segment === "qualified" ? "qualified" : "new",
    planToken,
    plan: { blueprint, businessName: business, name, segment },
  });
  if (!lead.ok) console.error("Lead insert error:", lead.error);

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

      // The personalised Build Blueprint, with a link to the permanent plan page.
      const ce = blueprintEmail({
        name,
        businessName: business ?? undefined,
        segment,
        blueprint,
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
