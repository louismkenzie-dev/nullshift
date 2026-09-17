import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { flagOn } from "@/lib/flags";
import { defaultHandlers } from "@/lib/integrations/handlers";
import { sweepUnprocessedEvents } from "@/lib/integrations/gocardlessEvents";
import { liveGoCardlessPort } from "@/lib/integrations/gocardlessClient";
import { supabaseOpsStore } from "@/lib/integrations/supabaseStore";
import { runOnce } from "@/lib/integrations/worker";
import { liveXeroPort } from "@/lib/xeroOps";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Ops worker — every 10 minutes via Vercel cron (see vercel.json). Admin
 * redesign Phase 4 (brief §12.4): claims a bounded, leased batch from the
 * outbox (`integration_operations`) and runs the handler registry; first
 * re-processes inbox events that were captured but not processed (a crash
 * after acknowledgement, a transient provider error).
 *
 * Off unless OPS_V2_FLAGS contains `integrationWorkers`: the route then
 * answers 200 with `skipped: "flag_off"` and touches nothing.
 *
 * Guarded exactly like the other cron routes: Vercel sends
 * "Authorization: Bearer <CRON_SECRET>"; anything else is 401.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!flagOn("integrationWorkers"))
    return NextResponse.json({ ok: true, skipped: "flag_off" });

  const owner = `cron:${process.env.VERCEL_DEPLOYMENT_ID ?? "local"}:${randomUUID().slice(0, 8)}`;
  try {
    const store = supabaseOpsStore();
    const gocardless = liveGoCardlessPort();
    const now = new Date().toISOString();

    // Inbox first: events at least 2 minutes old (the webhook's own after()
    // has had its chance) within the last 7 days, bounded.
    const swept = await sweepUnprocessedEvents(
      { store, gocardless, now },
      { limit: 50, olderThanMs: 2 * 60 * 1000, windowMs: 7 * 24 * 60 * 60 * 1000 }
    );

    const outcome = await runOnce({
      store,
      ports: {
        xero: liveXeroPort(),
        gocardless,
        notify: { deliver: async () => ({ delivered: false, stubbed: true }) },
      },
      handlers: defaultHandlers(),
      owner,
      now,
      limit: 25,
    });
    return NextResponse.json({
      ok: true,
      owner,
      inbox: {
        swept: swept.length,
        failed: swept.filter((s) => s.outcome === "failed").length,
      },
      outbox: {
        claimed: outcome.claimed,
        succeeded: outcome.succeeded,
        retried: outcome.retried,
        deadLettered: outcome.deadLettered,
        leaseLost: outcome.leaseLost,
      },
    });
  } catch (e) {
    console.error("ops-worker failed:", e);
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message.slice(0, 300) : "worker failed",
      },
      { status: 500 }
    );
  }
}
