import { NextResponse } from "next/server";
import { createServiceClient } from "@nullshift/db";
import { findUserByEmail } from "../confirmation-email";

/**
 * Self-service password reset, step 2: email + valid unused code + new
 * password → the password is set (and the email confirmed, in case the
 * account never finished verification). Mirrors verify-code's checks.
 */
export async function POST(req: Request) {
  try {
    const { email, code, password } = await req.json();
    if (!email || !code || !password) {
      return NextResponse.json(
        { error: "Email, code and new password are required." },
        { status: 400 }
      );
    }
    if (String(password).length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();
    const user = await findUserByEmail(serviceClient, email);
    if (!user) return NextResponse.json({ error: "Invalid code." }, { status: 400 });

    const { data: rows, error: fetchError } = await serviceClient
      .from("email_verifications")
      .select("id, code, expires_at, used")
      .eq("user_id", user.id)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1);
    if (fetchError || !rows || rows.length === 0) {
      return NextResponse.json(
        { error: "No pending reset code found. Please request a new one." },
        { status: 400 }
      );
    }
    const record = rows[0];
    if (new Date(record.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This code has expired. Please request a new one." },
        { status: 400 }
      );
    }
    if (record.code !== String(code).trim()) {
      return NextResponse.json(
        { error: "Incorrect code. Please try again." },
        { status: 400 }
      );
    }

    await serviceClient
      .from("email_verifications")
      .update({ used: true })
      .eq("id", record.id);

    const { error: updateError } = await serviceClient.auth.admin.updateUserById(
      user.id,
      { password: String(password), email_confirm: true }
    );
    if (updateError) {
      console.error("reset-with-code: password update failed:", updateError);
      return NextResponse.json(
        { error: "Could not set the new password. Please contact support." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Password updated — you can sign in now." },
      { status: 200 }
    );
  } catch (error) {
    console.error("reset-with-code error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
