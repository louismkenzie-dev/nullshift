import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  generateVerificationCode,
  sendConfirmationEmail,
} from "@/lib/auth/confirmation-email";

const CODE_TTL_MINUTES = 15;

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Create the user with no subscription tier — pure client account
    const { data: createData, error: createError } =
      await serviceClient.auth.admin.createUser({
        email,
        password,
        user_metadata: { full_name: name },
        email_confirm: false,
      });

    if (createError) {
      const msg = createError.message ?? "";
      if (
        msg.includes("already registered") ||
        msg.includes("already been registered") ||
        msg.includes("User already registered") ||
        msg.includes("already exists")
      ) {
        return NextResponse.json(
          { error: "An account with this email already exists." },
          { status: 409 }
        );
      }
      console.error("Supabase createUser error:", createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    const userId = createData.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Account creation failed." }, { status: 500 });
    }

    // Invalidate any old codes for this user
    await serviceClient
      .from("email_verifications")
      .update({ used: true })
      .eq("user_id", userId)
      .eq("used", false);

    // Generate and store a 6-digit code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();

    const { error: insertError } = await serviceClient
      .from("email_verifications")
      .insert({ user_id: userId, code, expires_at: expiresAt });

    if (insertError) {
      console.error("Failed to store verification code:", insertError);
      return NextResponse.json({ error: "Could not create verification code." }, { status: 500 });
    }

    // Send code via Resend
    try {
      await sendConfirmationEmail({
        to: email,
        name,
        code,
        idempotencyKey: `client-signup-code/${userId}/${code}`,
      });
    } catch (emailError) {
      console.error("Resend email failed:", emailError);
      return NextResponse.json(
        { error: "Account created but confirmation email could not be sent." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Account created. Check your email for a 6-digit verification code." },
      { status: 200 }
    );
  } catch (error) {
    console.error("client-signup error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
