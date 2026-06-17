import { NextResponse } from "next/server";
import { createServiceClient } from "@nullshift/db";
import {
  findUserByEmail,
  generateVerificationCode,
  sendConfirmationEmail,
} from "../confirmation-email";
import {
  isResendRateLimited,
  recordResendAttempt,
} from "../resend-rate-limit";

const CODE_TTL_MINUTES = 15;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = (body.email as string)?.trim();

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    if (isResendRateLimited(email)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const serviceClient = createServiceClient();
    const user = await findUserByEmail(serviceClient, email);

    // Generic response to avoid leaking account state
    const genericOk = NextResponse.json({
      message: "If an account exists, a new code has been sent.",
    });

    if (!user || user.email_confirmed_at) {
      return genericOk;
    }

    const name = (user.user_metadata?.full_name as string | undefined) ?? "there";

    // Invalidate old codes
    await serviceClient
      .from("email_verifications")
      .update({ used: true })
      .eq("user_id", user.id)
      .eq("used", false);

    // Generate new code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();

    const { error: insertError } = await serviceClient
      .from("email_verifications")
      .insert({ user_id: user.id, code, expires_at: expiresAt });

    if (insertError) {
      console.error("Failed to store resent verification code:", insertError);
      return NextResponse.json({ error: "Could not generate a new code." }, { status: 500 });
    }

    try {
      await sendConfirmationEmail({
        to: email,
        name,
        code,
        idempotencyKey: `resend-code/${user.id}-${Date.now()}`,
      });
      recordResendAttempt(email);
    } catch (emailError) {
      console.error("Resend email failed:", emailError);
      return NextResponse.json({ error: "Could not send confirmation email." }, { status: 500 });
    }

    return genericOk;
  } catch (error) {
    console.error("resend-confirmation error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
