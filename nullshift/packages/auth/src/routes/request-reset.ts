import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@nullshift/db";
import { findUserByEmail, generateVerificationCode } from "../confirmation-email";
import { isResendRateLimited, recordResendAttempt } from "../resend-rate-limit";

const CODE_TTL_MINUTES = 15;

/**
 * Self-service password reset, step 1: email in → 6-digit code out (via
 * Resend, same rail as signup — never Supabase's rate-limited default SMTP).
 * Always answers 200 with the same message whether or not the account exists,
 * so it can't be used to probe which emails have accounts.
 */
export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }
    const ok = NextResponse.json(
      { message: "If that email has an account, a 6-digit code is on its way." },
      { status: 200 }
    );

    if (isResendRateLimited(email)) return ok;
    recordResendAttempt(email);

    const serviceClient = createServiceClient();
    const user = await findUserByEmail(serviceClient, email);
    if (!user) return ok;

    await serviceClient
      .from("email_verifications")
      .update({ used: true })
      .eq("user_id", user.id)
      .eq("used", false);

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();
    const { error: insertError } = await serviceClient
      .from("email_verifications")
      .insert({ user_id: user.id, code, expires_at: expiresAt });
    if (insertError) {
      console.error("request-reset: code store failed:", insertError);
      return ok;
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("request-reset: RESEND_API_KEY unset — code not sent");
      return ok;
    }
    const from = process.env.RESEND_FROM_EMAIL || "Nullshift <onboarding@resend.dev>";
    const resend = new Resend(apiKey);
    const digits = code.split("");
    await resend.emails.send({
      from,
      to: [email],
      subject: `${code} is your Nullshift password reset code`,
      html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 28px;background:#09090b;color:#fafafa;border-radius:16px;">
        <p style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#10b981;margin:0 0 28px;">NULLSHIFT / RESET YOUR PASSWORD</p>
        <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.02em;margin:0 0 12px;line-height:1.1;">Here&rsquo;s your reset code.</h1>
        <p style="color:#a1a1a6;font-size:15px;line-height:1.65;margin:0 0 32px;">Enter the 6-digit code below on the reset page to choose a new password. It expires in <strong style="color:#fafafa;">15 minutes</strong>.</p>
        <div style="display:flex;gap:8px;margin-bottom:36px;">
          ${digits.map((d) => `<div style="width:48px;height:60px;background:#131316;border:1.5px solid #27272a;border-radius:10px;font-size:28px;font-weight:900;color:#fafafa;text-align:center;line-height:60px;">${d}</div>`).join("")}
        </div>
        <p style="color:#3d3d42;font-size:12px;line-height:1.6;margin:0;">
          If you didn&rsquo;t ask to reset your Nullshift password, you can safely ignore this email — nothing changes without the code.<br/>
          Do not share this code with anyone.
        </p>
      </div>`,
    });

    return ok;
  } catch (error) {
    console.error("request-reset error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
