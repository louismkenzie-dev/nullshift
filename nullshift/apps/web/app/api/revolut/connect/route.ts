import { NextResponse } from "next/server";
import { requireStaff } from "@nullshift/auth/guards";
import { buildConsentUrl, readRevolutEnv } from "@/lib/revolut/client";
import { mintState } from "@/lib/revolut/state";

export const dynamic = "force-dynamic";

/**
 * GET /api/revolut/connect — staff only. Builds the Revolut Business consent
 * URL (app-confirm) with a signed, expiring state and redirects. The state
 * secret is REVOLUT_STATE_SECRET, falling back to REVOLUT_TOKEN_ENCRYPTION_KEY
 * (never the private key).
 */
export async function GET(request: Request) {
  const staff = await requireStaff();
  if (!staff.ok) return NextResponse.redirect(new URL("/admin/login", request.url));

  const env = readRevolutEnv();
  if (!env.ok)
    return NextResponse.redirect(
      new URL(`/admin/bank?notice=not_configured&missing=${encodeURIComponent(env.missing.join(","))}`, request.url)
    );
  const secret = process.env.REVOLUT_STATE_SECRET || process.env.REVOLUT_TOKEN_ENCRYPTION_KEY!;
  const state = mintState({ userId: staff.userId, environment: env.value.environment }, secret);
  const redirectUri = new URL("/api/revolut/callback", request.url).toString();
  const url = buildConsentUrl({
    environment: env.value.environment,
    clientId: env.value.clientId,
    redirectUri,
    state,
  });
  return NextResponse.redirect(url);
}
