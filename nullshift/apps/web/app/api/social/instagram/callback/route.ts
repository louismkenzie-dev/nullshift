import { NextResponse } from "next/server";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import {
  exchangeCode,
  exchangeForLongLived,
  getAccountInfo,
  listPages,
  pickInstagramPage,
  readMetaEnv,
  tokenExpiry,
} from "@/lib/social/instagram";
import { readSocialState, socialStateSecret } from "@/lib/social/state";
import { storeInstagramConnection } from "@/lib/social/store";

export const dynamic = "force-dynamic";

/**
 * GET /api/social/instagram/callback?code=…&state=… — verifies the signed
 * state (same staff user, not expired), exchanges the code for a short-lived
 * user token, upgrades it to a long-lived one (~60 days), finds the Facebook
 * Page with a linked Instagram professional account, stores the token
 * encrypted, writes audit_log 'social.instagram.connected' and redirects to
 * /admin/social/accounts. The code and tokens never appear in a log or a
 * redirect.
 */
export async function GET(request: Request) {
  const staff = await requireStaff();
  if (!staff.ok) return NextResponse.redirect(new URL("/admin/login", request.url));
  const back = (notice: string) =>
    NextResponse.redirect(
      new URL(`/admin/social/accounts?notice=${notice}`, request.url)
    );

  const env = readMetaEnv();
  const secret = socialStateSecret();
  if (!env.ok || !secret) return back("not_configured");
  const url = new URL(request.url);
  const state = readSocialState(url.searchParams.get("state"), secret);
  if (!state || state.u !== staff.userId) return back("bad_state");
  if (url.searchParams.get("error")) return back("denied");
  const code = url.searchParams.get("code");
  if (!code) return back("no_code");

  try {
    const redirectUri = new URL("/api/social/instagram/callback", request.url).toString();
    const short = await exchangeCode(env.value, code, redirectUri);
    const long = await exchangeForLongLived(env.value, short.access_token);
    const token = long.access_token;

    const pages = await listPages(token);
    const page = pickInstagramPage(pages);
    if (!page?.instagram_business_account?.id) return back("no_ig_account");
    const igUserId = page.instagram_business_account.id;
    const info = await getAccountInfo(igUserId, token);

    const expiresAt =
      (await tokenExpiry(env.value, token)) ??
      (long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : null);

    const { accountId } = await storeInstagramConnection({
      igUserId,
      pageId: page.id,
      handle: info.username,
      displayName: info.name ?? page.name,
      userId: staff.userId,
      accessToken: token,
      expiresAt,
    });
    await logAudit({
      action: "social.instagram.connected",
      target: `social_account:${accountId}`,
      metadata: { handle: info.username, page_id: page.id, ig_user_id: igUserId },
    });
    return back("connected");
  } catch (e) {
    console.error("instagram callback failed:", e instanceof Error ? e.name : "error");
    return back("exchange_failed");
  }
}
