import { NextResponse } from "next/server";
import { createServiceClient } from "@nullshift/db";

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json({ error: "Email and code are required." }, { status: 400 });
    }

    const normalizedCode = String(code).trim();
    const serviceClient = createServiceClient();

    // Look up the user by email
    const { data: { users }, error: listError } =
      await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (listError) {
      console.error("listUsers error:", listError);
      return NextResponse.json({ error: "Verification failed." }, { status: 500 });
    }

    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      return NextResponse.json({ error: "Invalid code." }, { status: 400 });
    }

    // Find a valid unused code for this user
    const { data: rows, error: fetchError } = await serviceClient
      .from("email_verifications")
      .select("id, code, expires_at, used")
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

    // Check code match
    if (record.code !== normalizedCode) {
      return NextResponse.json({ error: "Incorrect code. Please try again." }, { status: 400 });
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
      return NextResponse.json({ error: "Verification failed. Please contact support." }, { status: 500 });
    }

    return NextResponse.json({ message: "Email verified successfully." }, { status: 200 });
  } catch (error) {
    console.error("verify-code error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
