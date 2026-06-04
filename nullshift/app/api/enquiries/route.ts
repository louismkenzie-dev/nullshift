import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/* Public endpoint — the website contact + booking forms POST here.
   Saves the enquiry to Supabase, then emails a notification via Resend. */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const source = (body.source as string) === "booking" ? "booking" : "contact";
  const name = (body.name as string)?.trim();
  const email = (body.email as string)?.trim();

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }

  const record = {
    source,
    name,
    email,
    business_name: ((body.business as string) || (body.business_name as string) || null) ?? null,
    phone: ((body.phone as string) || null) ?? null,
    message: ((body.message as string) || (body.brief as string) || null) ?? null,
    preferred_date: ((body.date as string) || null) ?? null,
    preferred_time: ((body.time as string) || null) ?? null,
    referral: ((body.referral as string) || null) ?? null,
  };

  // ---- Save to Supabase ----
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("enquiries").insert(record);
    if (error) {
      console.error("Supabase insert error:", error.message);
      return NextResponse.json({ error: "Could not save enquiry." }, { status: 500 });
    }
  } catch (e) {
    console.error("Supabase not configured:", e);
    return NextResponse.json({ error: "Backend not configured." }, { status: 500 });
  }

  // ---- Email notification (best-effort; never blocks the user) ----
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.ENQUIRY_NOTIFY_EMAIL;
    const from = process.env.ENQUIRY_FROM_EMAIL || "Nullshift <onboarding@resend.dev>";
    if (apiKey && to) {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      const rows = Object.entries(record)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
        .join("\n");
      await resend.emails.send({
        from,
        to,
        replyTo: email,
        subject: `New ${source} enquiry — ${name}`,
        text: `You have a new ${source} enquiry via the website:\n\n${rows}`,
      });
    }
  } catch (e) {
    console.error("Resend email failed (non-fatal):", e);
  }

  return NextResponse.json({ ok: true });
}
