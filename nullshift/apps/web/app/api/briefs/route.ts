import { NextResponse } from "next/server";
import { createServiceClient } from "@nullshift/db";
import { BUDGET_MIN, formatBudget, labelFor, PAGE_OPTIONS, DESIGN_STYLES, PURPOSES, TIMELINES, LOGO_STATES, type BriefData } from "@nullshift/content/brief";

/* Public endpoint — the /brief intake form posts here.
 *  • Saves to `enquiries` with source='brief' and the full brief in `brief_data`.
 *  • If `clientId` is provided (admin invited an existing client), links the
 *    enquiry to the client and stamps `clients.brief_completed_at`.
 *  • Emails a notification via Resend (best-effort).
 */
export async function POST(request: Request) {
  let body: { brief?: BriefData; clientId?: string | null };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const brief = body.brief;
  if (!brief?.clientName?.trim() || !brief?.clientEmail?.trim()) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }

  const supabase = (() => {
    try { return createServiceClient(); } catch { return null; }
  })();
  if (!supabase) return NextResponse.json({ error: "Backend not configured." }, { status: 500 });

  // If a clientId was provided, verify it exists before linking.
  let clientId: string | null = null;
  if (body.clientId) {
    const { data: c } = await supabase.from("clients").select("id").eq("id", body.clientId).maybeSingle();
    if (c) clientId = c.id;
  }

  const { error } = await supabase.from("enquiries").insert({
    source: "brief",
    name: brief.clientName,
    email: brief.clientEmail,
    business_name: brief.companyName || null,
    message: brief.additionalNotes || null,
    brief_data: brief,
    client_id: clientId,
    // If the brief came from an admin-sent invite link (clientId present),
    // the client already exists — skip the inbox and treat as 'converted'
    // so it only surfaces on that client's dashboard, not as a new enquiry.
    status: clientId ? "converted" : "new",
  });
  if (error) {
    console.error("Supabase insert error:", error.message);
    return NextResponse.json({ error: "Could not save brief." }, { status: 500 });
  }

  if (clientId) {
    await supabase.from("clients").update({ brief_completed_at: new Date().toISOString() }).eq("id", clientId);
  }

  // Email notification (best-effort, never blocks).
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.ENQUIRY_NOTIFY_EMAIL;
    const from = process.env.ENQUIRY_FROM_EMAIL || "Nullshift <onboarding@resend.dev>";
    if (apiKey && to) {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      const lines = [
        `Name: ${brief.clientName}`,
        `Email: ${brief.clientEmail}`,
        brief.companyName && `Company: ${brief.companyName}`,
        `Pages: ${brief.pages.map(p => labelFor(PAGE_OPTIONS, p)).join(", ")}`,
        brief.customPage && `Custom pages: ${brief.customPage}`,
        `Style: ${labelFor(DESIGN_STYLES, brief.designStyle)}`,
        `Has logo: ${labelFor(LOGO_STATES, brief.hasLogo)}`,
        brief.logoNotes && `Logo notes: ${brief.logoNotes}`,
        `Purpose: ${labelFor(PURPOSES, brief.websitePurpose)}`,
        brief.purposeDetail && `Detail: ${brief.purposeDetail}`,
        `Budget: ${brief.budget >= BUDGET_MIN ? formatBudget(brief.budget) : "—"}`,
        `Timeline: ${labelFor(TIMELINES, brief.timeline)}`,
        brief.additionalNotes && `Notes: ${brief.additionalNotes}`,
      ].filter(Boolean).join("\n");
      await resend.emails.send({
        from, to, replyTo: brief.clientEmail,
        subject: `New client brief — ${brief.clientName}`,
        text: `You have a new client brief via the website:\n\n${lines}`,
      });
    }
  } catch (e) {
    console.error("Resend email failed (non-fatal):", e);
  }

  return NextResponse.json({ ok: true });
}
