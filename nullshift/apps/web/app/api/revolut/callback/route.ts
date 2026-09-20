import { NextResponse } from "next/server";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { RevolutClient, readRevolutEnv } from "@/lib/revolut/client";
import { readState } from "@/lib/revolut/state";
import { storeConsent } from "@/lib/revolut/store";

export const dynamic = "force-dynamic";

/**
 * GET /api/revolut/callback?code=…&state=… — verifies the signed state (same
 * staff user, not expired, same environment), exchanges the code, stores the
 * tokens encrypted, writes audit_log 'revolut.connected', redirects to
 * /admin/bank. The code and tokens never appear in a log or a redirect.
 */
export async function GET(request: Request) {
  const staff = await requireStaff();
  if (!staff.ok) return NextResponse.redirect(new URL("/admin/login", request.url));
  const back = (notice: string) => NextResponse.redirect(new URL(`/admin/bank?notice=${notice}`, request.url));

  const env = readRevolutEnv();
  if (!env.ok) return back("not_configured");
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const secret = process.env.REVOLUT_STATE_SECRET || process.env.REVOLUT_TOKEN_ENCRYPTION_KEY!;
  const state = readState(url.searchParams.get("state"), secret);
  if (!state || state.u !== staff.userId || state.v !== env.value.environment) return back("bad_state");
  if (!code) return back("no_code");

  try {
    const client = new RevolutClient(env.value);
    const token = await client.exchangeCode(code);
    if (!token.refresh_token) return back("no_refresh_token");
    const { connectionId } = await storeConsent({
      environment: env.value.environment,
      clientId: env.value.clientId,
      userId: staff.userId,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresInSeconds: token.expires_in,
    });
    await logAudit({
      action: "revolut.connected",
      target: `revolut_connection:${connectionId}`,
      metadata: { environment: env.value.environment, client_id: env.value.clientId },
    });
    return back("connected");
  } catch (e) {
    console.error("revolut callback failed:", e instanceof Error ? e.name : "error");
    return back("exchange_failed");
  }
}
