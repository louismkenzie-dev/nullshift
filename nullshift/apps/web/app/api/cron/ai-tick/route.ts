import { NextResponse } from "next/server";
import { fireDueRoutines, runtimeHygiene } from "@/lib/aiw-runtime";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * AI Workspace tick — runs via Vercel cron each workday morning (see
 * vercel.json). Fires enabled routines (DB-level idempotency: a fire key can
 * only ever fire once, so re-runs and retries cannot duplicate tasks or
 * drafts), then does runtime hygiene: expire stale approvals and time out
 * wedged runs so nothing ever looks alive when it isn't.
 *
 * Vercel invokes cron routes with "Authorization: Bearer <CRON_SECRET>" when
 * the CRON_SECRET env var is set — anything else is rejected.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const outcomes = await fireDueRoutines(new Date());
  await runtimeHygiene();
  return NextResponse.json({ ok: true, outcomes });
}
