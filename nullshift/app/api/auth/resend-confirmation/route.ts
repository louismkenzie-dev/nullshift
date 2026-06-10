import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  buildConfirmUrl,
  buildOnboardRedirect,
  findUserByEmail,
  getSiteUrl,
  sendConfirmationEmail,
} from "@/lib/auth/confirmation-email";
import {
  isResendRateLimited,
  recordResendAttempt,
} from "@/lib/auth/resend-rate-limit";

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
    const siteUrl = getSiteUrl(req.headers.get("origin"));

    const user = await findUserByEmail(serviceClient, email);

    if (!user || user.email_confirmed_at) {
      // Generic success — do not leak account existence or confirmation state.
      return NextResponse.json({
        message: "If an account exists, a confirmation email has been sent.",
      });
    }

    const plan =
      (user.app_metadata?.subscription_tier as string | undefined) ?? "core";
    const name =
      (user.user_metadata?.full_name as string | undefined) ?? "there";
    const redirectTo = buildOnboardRedirect(siteUrl, plan);

    const { data: linkData, error: linkError } =
      await serviceClient.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo },
      });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("Failed to generate confirmation link for resend:", linkError);
      return NextResponse.json({
        message: "If an account exists, a confirmation email has been sent.",
      });
    }

    const tokenHash = linkData.properties.hashed_token;
    const linkType = linkData.properties.verification_type ?? "invite";
    const confirmUrl = buildConfirmUrl(siteUrl, tokenHash, linkType, redirectTo);

    try {
      await sendConfirmationEmail({ to: email, name, confirmUrl, idempotencyKey: `resend-confirm/${user.id}-${Date.now()}` });
      recordResendAttempt(email);
    } catch (emailError) {
      console.error("Resend confirmation email failed:", emailError);
      return NextResponse.json(
        { error: "Could not send confirmation email." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "If an account exists, a confirmation email has been sent.",
    });
  } catch (error) {
    console.error("Resend confirmation API error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
