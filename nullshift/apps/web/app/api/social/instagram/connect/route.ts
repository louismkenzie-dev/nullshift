import { NextResponse } from "next/server";
import { requireStaff } from "@nullshift/auth/guards";
import { buildLoginUrl, readMetaEnv } from "@/lib/social/instagram";
import { mintSocialState, socialStateSecret } from "@/lib/social/state";

export const dynamic = "force-dynamic";

/**
 * GET /api/social/instagram/connect — staff only. Builds the Facebook Login
 * dialog URL (scopes: instagram_basic, instagram_content_publish,
 * pages_show_list, pages_read_engagement, business_management) with a
 * signed, expiring state and redirects. The redirect URI must match the one
 * registered on the Meta app: https://nullshift.co.uk/api/social/instagram/callback.
 */
export async function GET(request: Request) {
  const staff = await requireStaff();
  if (!staff.ok) return NextResponse.redirect(new URL("/admin/login", request.url));

  const env = readMetaEnv();
  const secret = socialStateSecret();
  if (!env.ok || !secret) {
    const missing = env.ok ? ["SOCIAL_OAUTH_STATE_SECRET"] : env.missing;
    return NextResponse.redirect(
      new URL(
        `/admin/social/accounts?notice=not_configured&missing=${encodeURIComponent(missing.join(","))}`,
        request.url
      )
    );
  }
  const state = mintSocialState(staff.userId, secret);
  const redirectUri = new URL("/api/social/instagram/callback", request.url).toString();
  return NextResponse.redirect(
    buildLoginUrl({ appId: env.value.appId, redirectUri, state })
  );
}
