import { NextResponse } from "next/server";
import { createServiceClient } from "@nullshift/db";
import { findUserByEmail } from "../confirmation-email";

/**
 * A 6-digit code is only safe with an attempt cap: after MAX_ATTEMPTS wrong
 * guesses the code is invalidated and the user must request a fresh one.
 */
const MAX_ATTEMPTS = 5;

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and code are required." },
        { status: 400 }
      );
    }

    const normalizedCode = String(code).trim();
    const serviceClient = createServiceClient();

    // Paginating lookup — the old single listUsers page silently stopped
    // finding users past the first 1000 accounts.
    const user = await findUserByEmail(serviceClient, String(email));

    if (!user) {
      return NextResponse.json({ error: "Invalid code." }, { status: 400 });
    }

    // Find a valid unused code for this user
    const { data: rows, error: fetchError } = await serviceClient
      .from("email_verifications")
      .select("id, code, expires_at, used, attempts")
      .eq("user_id", user.id)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchError || !rows || rows.length === 0) {
      return NextResponse.json(
        { error: "No pending verification code found. Please request a new one." },
        { status: 400 }
      );
    }

    const record = rows[0];

    // Check expiry
    if (new Date(record.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This code has expired. Please request a new one." },
        { status: 400 }
      );
    }

    const attempts = Number(record.attempts ?? 0);
    if (attempts >= MAX_ATTEMPTS) {
      // Burn the code so continued guessing can never succeed against it.
      await serviceClient
        .from("email_verifications")
        .update({ used: true })
        .eq("id", record.id);
      return NextResponse.json(
        { error: "Too many attempts. Please request a new code." },
        { status: 429 }
      );
    }

    // Check code match
    if (record.code !== normalizedCode) {
      await serviceClient
        .from("email_verifications")
        .update(
          attempts + 1 >= MAX_ATTEMPTS
            ? { attempts: attempts + 1, used: true }
            : { attempts: attempts + 1 }
        )
        .eq("id", record.id);
      return NextResponse.json(
        { error: "Incorrect code. Please try again." },
        { status: 400 }
      );
    }

    // Mark code as used
    await serviceClient
      .from("email_verifications")
      .update({ used: true })
      .eq("id", record.id);

    // Confirm the user's email in Supabase Auth
    const { error: confirmError } = await serviceClient.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );

    if (confirmError) {
      console.error("Failed to confirm email:", confirmError);
      return NextResponse.json(
        { error: "Verification failed. Please contact support." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Email verified successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("verify-code error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
