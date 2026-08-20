import { NextResponse } from "next/server";
import { runSweep } from "@/lib/soc2/sweep";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * SOC 2 readiness sweep — daily via Vercel cron (see vercel.json).
 *
 * One idempotent pass: materialise due evidence requests (control runs with
 * DB-unique fire keys), run the exception rules over a fresh snapshot, raise
 * what's new, mark cleared conditions resolved-pending-verification, send
 * severity-routed alerts, and escalate unacknowledged critical/high
 * exceptions. Re-runs cannot double-create or re-alert — same contract as
 * ai-tick.
 *
 * Vercel invokes cron routes with "Authorization: Bearer <CRON_SECRET>" when
 * the CRON_SECRET env var is set — anything else is rejected.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const outcome = await runSweep("cron", "system:cron");
  return NextResponse.json({ ok: true, outcome });
}
