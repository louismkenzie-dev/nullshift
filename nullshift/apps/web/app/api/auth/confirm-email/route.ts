import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSiteUrl, isAllowedRedirect } from "@nullshift/auth/confirmation-email";

const VALID_OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email",
  "email_change",
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tokenHash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const redirectParam = searchParams.get("redirect_to");

  if (!tokenHash || !typeParam) {
    return NextResponse.redirect(
      new URL("/error?message=No confirmation token provided", req.url)
    );
  }

  if (!VALID_OTP_TYPES.includes(typeParam as EmailOtpType)) {
    return NextResponse.redirect(
      new URL("/error?message=Invalid confirmation type", req.url)
    );
  }

  const siteUrl = getSiteUrl(req.headers.get("origin"));
  const defaultRedirect = `${siteUrl}/onboard`;
  const redirectTo =
    redirectParam && isAllowedRedirect(redirectParam, siteUrl)
      ? redirectParam
      : defaultRedirect;

  const cookieStore = await cookies();
  const response = NextResponse.redirect(redirectTo);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: typeParam as EmailOtpType,
  });

  if (error) {
    console.error("Supabase verifyOtp error:", error);
    return NextResponse.redirect(
      new URL(
        `/error?message=${encodeURIComponent("Invalid or expired confirmation link")}`,
        req.url
      )
    );
  }

  return response;
}
