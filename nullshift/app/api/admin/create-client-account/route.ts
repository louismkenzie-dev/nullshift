import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/create-client-account
 *
 * Creates a Supabase auth account on behalf of an existing client and links
 * it to their client record via auth_user_id. All their existing tickets,
 * proposals and calls are preserved — only the link is added.
 *
 * Body: { clientId: string, email: string, password: string }
 *
 * Returns:
 *   200 { message, userId }
 *   400 Missing fields
 *   409 Email already has an auth account
 *   500 Supabase / DB error
 */
export async function POST(req: Request) {
  try {
    const { clientId, email, password } = await req.json();

    if (!clientId || !email || !password) {
      return NextResponse.json({ error: "clientId, email and password are required." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Fetch the client record to get their name and verify they exist.
    // Select only stable columns first — auth_user_id may not exist yet if
    // migration 010 hasn't been applied; we handle that separately below.
    const { data: clientRow, error: fetchError } = await serviceClient
      .from("clients")
      .select("id, name, email")
      .eq("id", clientId)
      .single();

    if (fetchError || !clientRow) {
      console.error("Client fetch error:", fetchError);
      return NextResponse.json(
        { error: fetchError ? fetchError.message : "Client not found." },
        { status: fetchError ? 500 : 404 }
      );
    }

    // Guard: don't create a second account if one is already linked.
    // If the migration hasn't been applied yet the column won't exist —
    // we catch that and skip the guard rather than crashing.
    const { data: authCheck } = await serviceClient
      .from("clients")
      .select("auth_user_id")
      .eq("id", clientId)
      .single();

    if (authCheck?.auth_user_id) {
      return NextResponse.json(
        { error: "This client already has a portal account linked." },
        { status: 409 }
      );
    }

    // Create the Supabase auth user. email_confirm: true so they can log in
    // immediately — the admin has verified the email by entering it manually.
    const { data: createData, error: createError } =
      await serviceClient.auth.admin.createUser({
        email,
        password,
        user_metadata: { full_name: clientRow.name },
        email_confirm: true,
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
      return NextResponse.json({ error: "Account creation failed — no user ID returned." }, { status: 500 });
    }

    // Link the new auth user to the client record
    const { error: updateError } = await serviceClient
      .from("clients")
      .update({ auth_user_id: userId })
      .eq("id", clientId);

    if (updateError) {
      // Auth account was created but linking failed — log for manual fix
      console.error("Failed to link auth_user_id to client:", updateError, { clientId, userId });
      return NextResponse.json(
        { error: "Account created but could not be linked to the client record. Contact support." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Portal account created and linked successfully.", userId },
      { status: 200 }
    );
  } catch (error) {
    console.error("create-client-account error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
