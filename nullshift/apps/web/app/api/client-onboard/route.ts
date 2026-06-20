import { NextResponse } from "next/server";
import { recordLead } from "@nullshift/db/leads";
import { createServiceClient } from "@nullshift/db";

/**
 * POST /api/client-onboard
 *
 * Called from the book-a-call flow before the auth account is created. Records a
 * canonical `leads` row (status='call_booked', with the requested slot) so the
 * booking lands in the admin Pipeline, and notifies the team. No legacy `clients`
 * row — the admin works off the multi-tenant Pipeline → client hub.
 */
export async function POST(request: Request) {
  let body: {
    name: string;
    email: string;
    business_name?: string;
    requested_date?: string;
    requested_time?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, email, business_name, requested_date, requested_time } = body;
  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }

  // Record the call REQUEST as a lead (merged onto any existing funnel lead).
  // It stays 'qualified' with the requested slot — it only moves to 'call_booked'
  // once an admin confirms the call on the client's profile, so a lead is never
  // in two columns at once.
  const lead = await recordLead({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    source: "book",
    vertical: "clinic",
    quizAnswers: { business_name: business_name ?? null, requested_date, requested_time },
    status: "qualified",
  });
  if (!lead.ok) {
    console.error("Lead insert error (book):", lead.error);
    return NextResponse.json(
      { error: "Could not record your booking." },
      { status: 500 }
    );
  }

  // ── Admin notification email (best-effort, non-blocking) ──────────────
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.ENQUIRY_FROM_EMAIL || "Nullshift <onboarding@resend.dev>";
    const notify = process.env.ENQUIRY_NOTIFY_EMAIL || "louis@nullshift.co.uk";
    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL || "https://nullshift.co.uk"
    ).replace(/\/$/, "");
    const pipelineLink = `${siteUrl}/admin/pipeline`;

    const timeLabels: Record<string, string> = {
      morning: "Morning (9am–12pm)",
      afternoon: "Afternoon (12pm–5pm)",
      evening: "Evening (5pm–8pm)",
    };

    const rows: [string, string][] = [
      ["Name", name.trim()],
      ["Email", email.trim()],
      ...(business_name?.trim()
        ? [["Business", business_name.trim()] as [string, string]]
        : []),
      ...(requested_date ? [["Preferred date", requested_date] as [string, string]] : []),
      ...(requested_time
        ? [
            ["Preferred time", timeLabels[requested_time] || requested_time] as [
              string,
              string,
            ],
          ]
        : []),
    ];

    const textLines = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
    const tableRows = rows
      .map(
        ([k, v]) => `
        <tr>
          <td style="padding:8px 0;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#9AA0AE;width:140px;vertical-align:top;">${k}</td>
          <td style="padding:8px 0;font-size:14px;color:#F2F4F8;">${v}</td>
        </tr>`
      )
      .join("");

    if (apiKey) {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);

      await resend.emails.send({
        from,
        to: notify,
        replyTo: email.trim(),
        subject: `New call booked — ${name.trim()}`,
        text: `A new call has been booked via nullshift.co.uk:\n\n${textLines}\n\nView in the Pipeline:\n${pipelineLink}`,
        html: `
<div style="background:#0A0B0F;color:#F2F4F8;font-family:system-ui,sans-serif;padding:40px;max-width:580px;margin:0 auto;border-radius:12px;border:1px solid #2A2D38;">
  <div style="margin-bottom:8px;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#10b981;">New call booked</div>
  <h1 style="margin:0 0 24px;font-size:26px;font-weight:600;letter-spacing:-0.02em;">${name.trim()}</h1>
  <table style="width:100%;border-collapse:collapse;margin-bottom:32px;">${tableRows}</table>
  <a href="${pipelineLink}"
     style="display:inline-block;background:#10b981;color:#0A0B0F;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">
    View in the Pipeline →
  </a>
</div>`,
      });
    }
  } catch (e) {
    console.error("Admin notification email failed (non-fatal):", e);
  }

  // Has this person already completed the funnel? (a source='funnel' lead with
  // the same email). If so, the booking flow sends them straight to the portal
  // instead of offering the funnel again.
  let funnelCompleted = false;
  try {
    const service = createServiceClient();
    const { data: prior } = await service
      .from("leads")
      .select("id")
      .ilike("email", email.trim().toLowerCase())
      .eq("source", "funnel")
      .limit(1);
    funnelCompleted = (prior?.length ?? 0) > 0;
  } catch (e) {
    console.error("funnel-completion check failed (non-fatal):", e);
  }

  return NextResponse.json({ ok: true, funnelCompleted });
}
