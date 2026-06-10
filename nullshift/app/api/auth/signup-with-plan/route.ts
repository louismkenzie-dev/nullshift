import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  buildConfirmUrl,
  buildOnboardRedirect,
  getSiteUrl,
  sendConfirmationEmail,
} from "@/lib/auth/confirmation-email";

export async function POST(req: Request) {
  try {
    const { name, email, password, plan } = await req.json();

    if (!name || !email || !password || !plan) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const serviceClient = createServiceClient();
    const siteUrl = getSiteUrl(req.headers.get("origin"));
    const redirectTo = buildOnboardRedirect(siteUrl, plan);

    const { data: linkData, error: linkError } =
      await serviceClient.auth.admin.generateLink({
        type: "signup",
        email,
        password,
        options: {
          data: { full_name: name },
          redirectTo,
        },
      });

    if (linkError) {
      const message = linkError.message ?? "";
      if (
        message.includes("already registered") ||
        message.includes("already been registered") ||
        message.includes("User already registered")
      ) {
        return NextResponse.json(
          { error: "A user with this email already exists." },
          { status: 409 }
        );
      }
      console.error("Supabase generateLink error:", linkError);
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }

    const userId = linkData.user?.id;
    const tokenHash = linkData.properties?.hashed_token;

    if (!userId || !tokenHash) {
      console.error("Supabase generateLink did not return user ID or token hash.");
      return NextResponse.json({ error: "User creation failed." }, { status: 500 });
    }

    const { error: updateAppMetadataError } =
      await serviceClient.auth.admin.updateUserById(userId, {
        app_metadata: {
          subscription_tier: plan.toLowerCase(),
        },
      });

    if (updateAppMetadataError) {
      console.error(
        "Supabase admin update user app_metadata error:",
        updateAppMetadataError
      );
      return NextResponse.json(
        { error: "User created but failed to set subscription plan." },
        { status: 500 }
      );
    }

    const confirmUrl = buildConfirmUrl(siteUrl, tokenHash, "signup", redirectTo);

    try {
      await sendConfirmationEmail({ to: email, name, confirmUrl });
    } catch (emailError) {
      console.error("Resend confirmation email failed:", emailError);
      return NextResponse.json(
        { error: "Account created but confirmation email could not be sent." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "User signed up. Please check your email to confirm your account." },
      { status: 200 }
    );
  } catch (error) {
    console.error("API route error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
