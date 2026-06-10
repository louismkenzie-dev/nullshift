import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/client-onboard
 *
 * Called from /client-signup before the auth account is created.
 * Creates (or updates) a clients row with name, email, business_name,
 * requested_date, requested_time and returns the clientId.
 *
 * Also fires a notification email to the admin (louis@nullshift.com)
 * with a direct link to the new client in the admin dashboard.
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

  const supabase = (() => {
    try { return createServiceClient(); } catch { return null; }
  })();
  if (!supabase) {
    return NextResponse.json({ error: "Backend not configured." }, { status: 500 });
  }

  // Check for an existing client by email (case-insensitive) to avoid duplicates.
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .ilike("email", email.trim())
    .maybeSingle();

  let clientId: string;

  if (existing) {
    clientId = existing.id;
    // Update the existing record with the latest details.
    await supabase
      .from("clients")
      .update({
        name: name.trim(),
        business_name: business_name?.trim() || null,
        requested_date: requested_date || null,
        requested_time: requested_time || null,
      })
      .eq("id", clientId);
  } else {
    const { data: newClient, error } = await supabase
      .from("clients")
      .insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        business_name: business_name?.trim() || null,
        status: "lead",
        requested_date: requested_date || null,
        requested_time: requested_time || null,
      })
      .select("id")
      .single();

    if (error || !newClient) {
      console.error("Client insert error:", error?.message);
      return NextResponse.json({ error: "Could not create client record." }, { status: 500 });
    }
    clientId = newClient.id;
  }

  // ── Admin notification email (best-effort, non-blocking) ──────────────
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.ENQUIRY_FROM_EMAIL || "Nullshift <onboarding@resend.dev>";
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://nullshift.co.uk").replace(/\/$/, "");
    const adminLink = `${siteUrl}/admin/clients/${clientId}`;

    const timeLabels: Record<string, string> = {
      morning:   "Morning (9am–12pm)",
      afternoon: "Afternoon (12pm–5pm)",
      evening:   "Evening (5pm–8pm)",
    };

    const rows: [string, string][] = [
      ["Name",   name.trim()],
      ["Email",  email.trim()],
      ...(business_name?.trim() ? [["Business", business_name.trim()] as [string, string]] : []),
      ...(requested_date ? [["Preferred date", requested_date] as [string, string]] : []),
      ...(requested_time ? [["Preferred time", timeLabels[requested_time] || requested_time] as [string, string]] : []),
    ];

    const textLines = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
    const tableRows = rows
      .map(([k, v]) => `
        <tr>
          <td style="padding:8px 0;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#9AA0AE;width:140px;vertical-align:top;">${k}</td>
          <td style="padding:8px 0;font-size:14px;color:#F2F4F8;">${v}</td>
        </tr>`)
      .join("");

    if (apiKey) {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);

      await resend.emails.send({
        from,
        to: "louis@nullshift.com",
        replyTo: email.trim(),
        subject: `New enquiry — ${name.trim()}`,
        text: `A new client has booked a call via nullshift.co.uk:\n\n${textLines}\n\nView in admin:\n${adminLink}`,
        html: `
<div style="background:#0A0B0F;color:#F2F4F8;font-family:system-ui,sans-serif;padding:40px;max-width:580px;margin:0 auto;border-radius:12px;border:1px solid #2A2D38;">
  <div style="margin-bottom:8px;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#10b981;">New booking enquiry</div>
  <h1 style="margin:0 0 24px;font-size:26px;font-weight:600;letter-spacing:-0.02em;">${name.trim()}</h1>
  <table style="width:100%;border-collapse:collapse;margin-bottom:32px;">${tableRows}</table>
  <a href="${adminLink}"
     style="display:inline-block;background:#10b981;color:#0A0B0F;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">
    View client in admin →
  </a>
  <p style="margin-top:24px;font-size:12px;color:#5C6170;">
    Nullshift admin notification ·
    <a href="${siteUrl}/admin" style="color:#9AA0AE;text-decoration:none;">Go to dashboard</a>
  </p>
</div>`,
      });
    }
  } catch (e) {
    console.error("Admin notification email failed (non-fatal):", e);
  }

  return NextResponse.json({ ok: true, clientId });
}
