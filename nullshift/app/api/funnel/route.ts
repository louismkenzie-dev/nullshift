import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { scoreLead, type Answers } from "@/lib/funnel";
import { clientEmail, ownerEmail } from "@/lib/funnelEmails";

/* Public endpoint — the /start quiz funnel posts here on contact capture.
 *  Re-scores server-side (never trust the client), saves the lead to the
 *  `enquiries` table (source='funnel' + funnel_data/score/segment/utm), then
 *  sends two branded emails via Resend: a tailored, lead-generating email to
 *  the visitor, and a new-lead notification to Nullshift. Honeypot + time-trap
 *  drop obvious bots. Email + DB are independent best-effort steps. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = {
  answers?: Answers;
  contact?: { name?: string; email?: string; phone?: string };
  utm?: Record<string, string>;
  website?: string; // honeypot
  elapsedMs?: number; // time-trap
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ── Bot traps: pretend success, store nothing. ──
  if (body.website && body.website.trim() !== "") return NextResponse.json({ ok: true });
  if (typeof body.elapsedMs === "number" && body.elapsedMs < 1500) return NextResponse.json({ ok: true });

  const name = body.contact?.name?.trim();
  const email = body.contact?.email?.trim().toLowerCase();
  const phone = body.contact?.phone?.trim() || null;
  const answers = body.answers ?? {};

  if (!name || !email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid name and email are required." }, { status: 400 });
  }

  // Authoritative scoring happens on the server.
  const { score, segment, recommendation } = scoreLead(answers);

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

  // ── Branded emails via Resend (best-effort) ──
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://nullshift.co.uk").replace(/\/$/, "");
      const resourceUrl = process.env.FUNNEL_RESOURCE_URL || `${siteUrl}/resources`;
      const bookUrl = `${siteUrl}/book?segment=${segment}&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`;
      const from = process.env.ENQUIRY_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || "Nullshift <onboarding@resend.dev>";
      const notify = process.env.ENQUIRY_NOTIFY_EMAIL;

      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);

      // Tailored, lead-generating email to the visitor.
      const ce = clientEmail({ name, segment, recommendation, answers, resourceUrl, bookUrl });
      await resend.emails.send({ from, to: email, subject: ce.subject, html: ce.html, text: ce.text });

      // Branded new-lead notification to Nullshift.
      if (notify) {
        const oe = ownerEmail({ name, email, phone, segment, score, answers, recommendation, resourceUrl });
        await resend.emails.send({ from, to: notify, replyTo: email, subject: oe.subject, html: oe.html, text: oe.text });
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
