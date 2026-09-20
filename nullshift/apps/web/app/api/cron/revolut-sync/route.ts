import { NextResponse } from "next/server";
import { runSync } from "@/lib/revolut/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Revolut bank-feed sync — every 30 minutes via Vercel cron (vercel.json).
 * Refreshes the access token when needed, imports transactions from
 * (last sync − 2 days), upserts on the provider key, runs the matcher (which
 * only ever writes `suggested` rows). Re-runnable at any time.
 *
 * Guarded exactly like the other cron routes: "Authorization: Bearer
 * <CRON_SECRET>"; anything else is 401. The response never contains token
 * material; errors are sanitised before they are stored or returned.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const outcome = await runSync();
  const status = outcome.ok || "skipped" in outcome ? 200 : 502;
  return NextResponse.json(outcome, { status });
}
